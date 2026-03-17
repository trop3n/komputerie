import { createSourceSelector } from '../../js/media-source.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const app = document.getElementById('app');

const sampCanvas = document.createElement('canvas');
const sampCtx = sampCanvas.getContext('2d', { willReadFrequently: true });

const { mediaSource, onChange } = createSourceSelector(document.getElementById('source-controls'));

let midiOutput = null;
let animId = null;
let prevNotes = [];

const samplePointsSel = document.getElementById('sample-points');
const midiChannelSel = document.getElementById('midi-channel');
const baseNoteEl = document.getElementById('base-note');
const noteRangeEl = document.getElementById('note-range');
const thresholdEl = document.getElementById('threshold');
const brightnessEl = document.getElementById('brightness');
const contrastEl = document.getElementById('contrast');
const scaleSel = document.getElementById('scale');
const midiStatus = document.getElementById('midi-status');

document.querySelectorAll('input[type="range"]').forEach(r => {
  const span = document.querySelector(`.range-value[data-for="${r.id}"]`);
  if (span) r.addEventListener('input', () => { span.textContent = r.value; });
});

// Musical scales (intervals from root)
const scales = {
  chromatic: [0,1,2,3,4,5,6,7,8,9,10,11],
  major: [0,2,4,5,7,9,11],
  minor: [0,2,3,5,7,8,10],
  pentatonic: [0,2,4,7,9],
  blues: [0,3,5,6,7,10],
  dorian: [0,2,3,5,7,9,10],
};

function quantizeToScale(note, scaleName) {
  const intervals = scales[scaleName] || scales.chromatic;
  const octave = Math.floor(note / 12);
  const degree = note % 12;
  // Find closest scale degree
  let closest = intervals[0];
  let minDist = 12;
  for (const interval of intervals) {
    const dist = Math.abs(degree - interval);
    if (dist < minDist) { minDist = dist; closest = interval; }
  }
  return octave * 12 + closest;
}

// MIDI connection
document.getElementById('btn-connect-midi').addEventListener('click', async () => {
  try {
    const midi = await navigator.requestMIDIAccess();
    const outputs = Array.from(midi.outputs.values());
    if (outputs.length > 0) {
      midiOutput = outputs[0];
      midiStatus.textContent = `MIDI: ${midiOutput.name}`;
    } else {
      midiStatus.textContent = 'MIDI: No outputs found';
    }
  } catch (e) {
    midiStatus.textContent = 'MIDI: Access denied';
  }
});

function sendNoteOn(note, velocity, channel) {
  if (!midiOutput) return;
  midiOutput.send([0x90 | channel, note, velocity]);
}

function sendNoteOff(note, channel) {
  if (!midiOutput) return;
  midiOutput.send([0x80 | channel, note, 0]);
}

function render() {
  if (!mediaSource.ready) return;

  const srcW = mediaSource.width;
  const srcH = mediaSource.height;
  const numPoints = +samplePointsSel.value;
  const baseNote = +baseNoteEl.value;
  const noteRange = +noteRangeEl.value;
  const thresh = +thresholdEl.value / 100;
  const bright = +brightnessEl.value * 2.55;
  const cont = +contrastEl.value;
  const channel = +midiChannelSel.value;
  const scaleName = scaleSel.value;
  const f = (259 * (cont + 255)) / (255 * (259 - cont));

  // Sample source
  const procW = Math.min(srcW, 480);
  const procH = Math.round(procW * (srcH / srcW));
  sampCanvas.width = procW;
  sampCanvas.height = procH;
  sampCtx.drawImage(mediaSource.drawable, 0, 0, procW, procH);
  const sampData = sampCtx.getImageData(0, 0, procW, procH).data;

  // Display
  canvas.width = procW;
  canvas.height = procH;
  ctx.drawImage(sampCanvas, 0, 0);

  // Sample points are distributed horizontally across the center
  const currentNotes = [];
  const sampleY = Math.floor(procH / 2);

  for (let i = 0; i < numPoints; i++) {
    const sampleX = Math.floor((i + 0.5) * procW / numPoints);
    const si = (sampleY * procW + sampleX) * 4;

    let r = sampData[si] + bright;
    let g = sampData[si + 1] + bright;
    let b = sampData[si + 2] + bright;
    r = f * (r - 128) + 128; g = f * (g - 128) + 128; b = f * (b - 128) + 128;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const clampedLum = Math.max(0, Math.min(1, lum));

    // Draw sample point indicator
    const dotSize = 4 + clampedLum * 8;
    const isActive = clampedLum > thresh;

    ctx.beginPath();
    ctx.arc(sampleX, sampleY, dotSize, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? `hsl(${120 * clampedLum}, 80%, 50%)` : 'rgba(255,0,0,0.4)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw vertical line from point
    ctx.strokeStyle = isActive ? `hsla(${120 * clampedLum}, 80%, 50%, 0.3)` : 'rgba(255,0,0,0.1)';
    ctx.beginPath();
    ctx.moveTo(sampleX, 0);
    ctx.lineTo(sampleX, procH);
    ctx.stroke();

    if (isActive) {
      const rawNote = baseNote + Math.floor(clampedLum * noteRange);
      const note = quantizeToScale(Math.min(127, rawNote), scaleName);
      const velocity = Math.min(127, Math.floor(clampedLum * 127));
      currentNotes.push({ note, velocity, x: sampleX });

      // Note label
      const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
      const noteName = noteNames[note % 12] + (Math.floor(note / 12) - 1);
      ctx.font = '10px monospace';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(noteName, sampleX, sampleY - dotSize - 6);
    }
  }

  // Draw sample line
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, sampleY);
  ctx.lineTo(procW, sampleY);
  ctx.stroke();
  ctx.setLineDash([]);

  // MIDI output — send note changes
  if (midiOutput) {
    // Note off for previous notes not in current
    for (const prev of prevNotes) {
      if (!currentNotes.find(n => n.note === prev.note)) {
        sendNoteOff(prev.note, channel);
      }
    }
    // Note on for new notes
    for (const curr of currentNotes) {
      if (!prevNotes.find(n => n.note === curr.note)) {
        sendNoteOn(curr.note, curr.velocity, channel);
      }
    }
  }
  prevNotes = currentNotes;
}

function loop() {
  if (mediaSource.ready) render();
  animId = requestAnimationFrame(loop);
}

onChange(() => { if (!animId) loop(); });

function toggleFullscreen() { app.classList.toggle('fullscreen'); }
document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
document.getElementById('btn-exit-fs').addEventListener('click', toggleFullscreen);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && app.classList.contains('fullscreen')) toggleFullscreen(); });

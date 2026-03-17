const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const app = document.getElementById('app');

let subtitles = [];
let playing = false;
let startTime = 0;
let pausedAt = 0;
let currentTime = 0;
let totalDuration = 0;
let animId = null;

const srtFileEl = document.getElementById('srt-file');
const fontSizeEl = document.getElementById('font-size');
const fontFamilyEl = document.getElementById('font-family');
const textColorEl = document.getElementById('text-color');
const bgColorEl = document.getElementById('bg-color');
const brightnessEl = document.getElementById('brightness');
const contrastEl = document.getElementById('contrast');
const timelineEl = document.getElementById('timeline');
const timeDisplay = document.getElementById('time-display');

document.querySelectorAll('input[type="range"]').forEach(r => {
  const span = document.querySelector(`.range-value[data-for="${r.id}"]`);
  if (span && r.id !== 'timeline') r.addEventListener('input', () => { span.textContent = r.value; render(); });
});

// SRT parser
function parseSRT(text) {
  const blocks = text.trim().split(/\n\s*\n/);
  const subs = [];
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!timeMatch) continue;
    const startMs = (+timeMatch[1]*3600 + +timeMatch[2]*60 + +timeMatch[3]) * 1000 + +timeMatch[4];
    const endMs = (+timeMatch[5]*3600 + +timeMatch[6]*60 + +timeMatch[7]) * 1000 + +timeMatch[8];
    const content = lines.slice(2).join('\n').replace(/<[^>]+>/g, '');
    subs.push({ start: startMs, end: endMs, text: content });
  }
  return subs;
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

srtFileEl.addEventListener('change', () => {
  const file = srtFileEl.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    subtitles = parseSRT(reader.result);
    if (subtitles.length > 0) {
      totalDuration = Math.max(...subtitles.map(s => s.end));
      timelineEl.max = totalDuration;
    }
    currentTime = 0;
    render();
  };
  reader.readAsText(file);
});

function getActiveSubtitle(time) {
  for (const sub of subtitles) {
    if (time >= sub.start && time <= sub.end) return sub;
  }
  return null;
}

function getNextGap(time) {
  // Find gap between current and next subtitle
  let currentEnd = 0;
  let nextStart = Infinity;
  for (const sub of subtitles) {
    if (time >= sub.start && time <= sub.end) currentEnd = sub.end;
    if (sub.start > time && sub.start < nextStart) nextStart = sub.start;
  }
  if (currentEnd > 0 && nextStart < Infinity) {
    return { start: currentEnd, end: nextStart, duration: nextStart - currentEnd };
  }
  return null;
}

function render() {
  const W = 800, H = 450;
  canvas.width = W;
  canvas.height = H;

  const bright = +brightnessEl.value;
  const cont = +contrastEl.value;

  // Background
  let bgR, bgG, bgB;
  {
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = 1;
    const tx = tmp.getContext('2d'); tx.fillStyle = bgColorEl.value; tx.fillRect(0,0,1,1);
    const d = tx.getImageData(0,0,1,1).data;
    const f = (259 * (cont + 255)) / (255 * (259 - cont));
    bgR = Math.max(0, Math.min(255, f * (d[0] + bright * 2.55 - 128) + 128)) | 0;
    bgG = Math.max(0, Math.min(255, f * (d[1] + bright * 2.55 - 128) + 128)) | 0;
    bgB = Math.max(0, Math.min(255, f * (d[2] + bright * 2.55 - 128) + 128)) | 0;
  }
  ctx.fillStyle = `rgb(${bgR},${bgG},${bgB})`;
  ctx.fillRect(0, 0, W, H);

  const fontSize = +fontSizeEl.value;
  const fontFamily = fontFamilyEl.value;
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = textColorEl.value;

  if (subtitles.length === 0) {
    ctx.font = '16px monospace';
    ctx.fillStyle = '#555';
    ctx.fillText('Load an SRT file to begin', W / 2, H / 2);
    return;
  }

  const activeSub = getActiveSubtitle(currentTime);
  const showGaps = document.querySelector('input[name="gaps"]:checked').value === 'on';

  if (activeSub) {
    // Word wrap
    const lines = activeSub.text.split('\n');
    const wrappedLines = [];
    for (const line of lines) {
      const words = line.split(' ');
      let current = '';
      for (const word of words) {
        const test = current ? current + ' ' + word : word;
        if (ctx.measureText(test).width > W * 0.85) {
          if (current) wrappedLines.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      if (current) wrappedLines.push(current);
    }

    const lineHeight = fontSize * 1.3;
    const startY = H / 2 - (wrappedLines.length - 1) * lineHeight / 2;
    for (let i = 0; i < wrappedLines.length; i++) {
      ctx.fillText(wrappedLines[i], W / 2, startY + i * lineHeight);
    }
  }

  // Time gap indicator
  if (showGaps && !activeSub) {
    const gap = getNextGap(currentTime);
    if (gap) {
      const remaining = ((gap.end - currentTime) / 1000).toFixed(1);
      ctx.font = '14px monospace';
      ctx.fillStyle = '#444';
      ctx.fillText(`Gap: ${remaining}s`, W / 2, H - 30);
    }
  }

  // Progress bar
  if (totalDuration > 0) {
    const progress = currentTime / totalDuration;
    ctx.fillStyle = '#222';
    ctx.fillRect(0, H - 4, W, 4);
    ctx.fillStyle = '#555';
    ctx.fillRect(0, H - 4, W * progress, 4);
  }

  // Time display
  timeDisplay.textContent = formatTime(currentTime);
}

function loop() {
  if (playing) {
    currentTime = performance.now() - startTime;
    if (currentTime >= totalDuration) {
      currentTime = totalDuration;
      playing = false;
    }
    timelineEl.value = currentTime;
    render();
  }
  animId = requestAnimationFrame(loop);
}

timelineEl.addEventListener('input', () => {
  currentTime = +timelineEl.value;
  if (playing) {
    startTime = performance.now() - currentTime;
  }
  render();
});

document.getElementById('btn-play').addEventListener('click', () => {
  if (!playing) {
    playing = true;
    startTime = performance.now() - currentTime;
  }
});

document.getElementById('btn-pause').addEventListener('click', () => {
  playing = false;
});

document.getElementById('btn-restart').addEventListener('click', () => {
  currentTime = 0;
  timelineEl.value = 0;
  if (playing) startTime = performance.now();
  render();
});

[fontSizeEl, fontFamilyEl, textColorEl, bgColorEl].forEach(el => el.addEventListener('change', render));
document.querySelectorAll('input[name="gaps"]').forEach(r => r.addEventListener('change', render));

function toggleFullscreen() { app.classList.toggle('fullscreen'); }
document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
document.getElementById('btn-exit-fs').addEventListener('click', toggleFullscreen);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && app.classList.contains('fullscreen')) toggleFullscreen(); });

document.getElementById('btn-save').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'srt2video.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

// Init
render();
requestAnimationFrame(loop);

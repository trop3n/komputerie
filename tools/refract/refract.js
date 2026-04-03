import { createSourceSelector } from '../../js/media-source.js';

const canvas = document.getElementById('canvas');
const app = document.getElementById('app');

const CW = 800, CH = 600;
canvas.width = CW;
canvas.height = CH;

const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
if (!gl) { document.body.textContent = 'WebGL not supported'; throw new Error('No WebGL'); }

const { mediaSource, onChange } = createSourceSelector(document.getElementById('source-controls'));

let animId = null;
let animTime = 0;
let needsUpdate = true;

// --- Shaders ---

const vertSrc = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 vTexCoord;
void main() {
  vTexCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const displaceFrag = `
precision highp float;
varying vec2 vTexCoord;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform int u_displaceType;
uniform float u_seed;
uniform float u_contentScaleX;
uniform float u_contentScaleY;
uniform float u_time;

uniform float u_box_ampX, u_box_ampY, u_box_freqX, u_box_freqY, u_box_speedX, u_box_speedY;
uniform int u_flow_complexity;
uniform float u_flow_freq, u_flow_ampX, u_flow_ampY, u_flow_speedX, u_flow_speedY;
uniform float u_sine_ampX, u_sine_ampY, u_sine_freqX, u_sine_freqY, u_sine_speedX, u_sine_speedY;

vec2 mirrorWrap(vec2 uv) {
  return abs(mod(uv - 1.0, 2.0) - 1.0);
}

vec3 _snPerm(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1  = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy  -= i1;
  i = mod(i, 289.0);
  vec3 p = _snPerm(_snPerm(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x  = 2.0 * fract(p * C.www) - 1.0;
  vec3 h  = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x   + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p, int octaves) {
  float val = 0.0, amp = 0.5, frq = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    val += amp * snoise(p * frq);
    amp *= 0.5; frq *= 2.0;
  }
  return val;
}

float cellHash(vec2 cell) {
  return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = vec2(vTexCoord.x, 1.0 - vTexCoord.y);
  vec2 scaledSrcUV = (uv - 0.5) / vec2(u_contentScaleX, u_contentScaleY) + 0.5;
  vec2 disp = vec2(0.0);

  if (u_displaceType == 0) {
    float sx = u_time * u_box_speedX * 0.002;
    float sy = u_time * u_box_speedY * 0.002;
    vec2 shiftedUV = uv + vec2(sx, sy);
    vec2 cell = floor(shiftedUV * vec2(u_box_freqX, u_box_freqY));
    float hx = cellHash(cell + u_seed) * 2.0 - 1.0;
    float hy = cellHash(cell + u_seed + 31.41) * 2.0 - 1.0;
    disp = vec2(hx * u_box_ampX, hy * u_box_ampY);
  } else if (u_displaceType == 1) {
    float sx = u_time * u_flow_speedX * 0.002;
    float sy = u_time * u_flow_speedY * 0.002;
    vec2 p = uv * u_flow_freq + vec2(sx, sy) + u_seed * 0.01;
    float nx = fbm(p, u_flow_complexity);
    float ny = fbm(p + vec2(31.41, 17.32), u_flow_complexity);
    disp = vec2(nx * u_flow_ampX, ny * u_flow_ampY);
  } else {
    float phaseX = u_time * u_sine_speedX * 0.05;
    float phaseY = u_time * u_sine_speedY * 0.05;
    float dx = sin(uv.x * u_sine_freqX + phaseX) * u_sine_ampX;
    float dy = sin(uv.y * u_sine_freqY + phaseY) * u_sine_ampY;
    disp = vec2(dx, dy);
  }

  vec2 distortedUV = mirrorWrap(scaledSrcUV + disp);
  gl_FragColor = texture2D(u_image, distortedUV);
}
`;

const gridRefractFrag = `
precision highp float;
varying vec2 vTexCoord;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_gridAmtX, u_gridAmtY;
uniform float u_skewX, u_skewY;

vec2 mirrorWrap(vec2 uv) {
  return abs(mod(uv - 1.0, 2.0) - 1.0);
}

void main() {
  vec2 uv = vec2(vTexCoord.x, 1.0 - vTexCoord.y);
  vec2 cellSize = vec2(1.0 / u_gridAmtX, 1.0 / u_gridAmtY);
  vec2 cellIndex = floor(uv / cellSize);
  vec2 cellUV = fract(uv / cellSize);
  vec2 fromCenter = cellUV - 0.5;
  float dist = length(fromCenter);
  vec2 lensOffset = fromCenter * dist * vec2(u_skewX, u_skewY);
  vec2 warpedCellUV = cellUV + lensOffset;
  vec2 finalUV = mirrorWrap((cellIndex + warpedCellUV) * cellSize);
  gl_FragColor = texture2D(u_image, finalUV);
}
`;

// --- WebGL helpers ---

function compileShader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function createProgram(vSrc, fSrc) {
  const v = compileShader(gl.VERTEX_SHADER, vSrc);
  const f = compileShader(gl.FRAGMENT_SHADER, fSrc);
  const p = gl.createProgram();
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}

function getUniforms(prog, names) {
  const u = {};
  for (const n of names) u[n] = gl.getUniformLocation(prog, n);
  return u;
}

// --- Setup programs ---

const dispProg = createProgram(vertSrc, displaceFrag);
const gridProg = createProgram(vertSrc, gridRefractFrag);

const dispUni = getUniforms(dispProg, [
  'u_image', 'u_resolution', 'u_displaceType', 'u_seed',
  'u_contentScaleX', 'u_contentScaleY', 'u_time',
  'u_box_ampX', 'u_box_ampY', 'u_box_freqX', 'u_box_freqY', 'u_box_speedX', 'u_box_speedY',
  'u_flow_complexity', 'u_flow_freq', 'u_flow_ampX', 'u_flow_ampY', 'u_flow_speedX', 'u_flow_speedY',
  'u_sine_ampX', 'u_sine_ampY', 'u_sine_freqX', 'u_sine_freqY', 'u_sine_speedX', 'u_sine_speedY',
]);

const gridUni = getUniforms(gridProg, [
  'u_image', 'u_resolution', 'u_gridAmtX', 'u_gridAmtY', 'u_skewX', 'u_skewY',
]);

// --- Quad geometry ---

const quadBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -1, -1,  0, 0,
   1, -1,  1, 0,
  -1,  1,  0, 1,
   1,  1,  1, 1,
]), gl.STATIC_DRAW);

function setupAttribs(prog) {
  const aPos = gl.getAttribLocation(prog, 'a_position');
  const aTex = gl.getAttribLocation(prog, 'a_texCoord');
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(aTex);
  gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, 16, 8);
}

// --- Textures ---

const srcTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, srcTexture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

// Placeholder gradient
function uploadPlaceholder() {
  const w = CW, h = CH;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const t = (x + y) / (w + h);
      const v = Math.floor(t * 255);
      data[i] = v;
      data[i + 1] = Math.floor(v * 0.7);
      data[i + 2] = Math.floor(255 - v * 0.5);
      data[i + 3] = 255;
    }
  }
  gl.bindTexture(gl.TEXTURE_2D, srcTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
}

uploadPlaceholder();

// --- Framebuffer for pass 1 ---

const fbTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, fbTex);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, CW, CH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

const fb = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fbTex, 0);
gl.bindFramebuffer(gl.FRAMEBUFFER, null);

// --- Update source texture from MediaSource ---

function updateSourceTexture() {
  if (!mediaSource.ready) return;
  gl.bindTexture(gl.TEXTURE_2D, srcTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mediaSource.drawable);
  needsUpdate = true;
}

// --- Element refs ---

function getRadio(id) { return document.querySelector(`#${id} input:checked`)?.value; }

// --- UI wiring ---

document.querySelectorAll('input[type="range"]').forEach(r => {
  const span = document.querySelector(`.range-value[data-for="${r.id}"]`);
  if (span) r.addEventListener('input', () => { span.textContent = r.value; needsUpdate = true; });
});

// Show/hide mode-specific controls
document.querySelectorAll('#displace-radios input').forEach(r => {
  r.addEventListener('change', () => {
    document.getElementById('box-controls').style.display = r.value === 'box' ? '' : 'none';
    document.getElementById('flow-controls').style.display = r.value === 'flow' ? '' : 'none';
    document.getElementById('sine-controls').style.display = r.value === 'sine' ? '' : 'none';
    needsUpdate = true;
  });
});

document.querySelectorAll('#refract-radios input').forEach(r => {
  r.addEventListener('change', () => {
    document.getElementById('grid-controls').style.display = r.value === 'grid' ? '' : 'none';
    needsUpdate = true;
  });
});

// --- Render ---

let sourceUpdateCounter = 0;

function render() {
  const animating = getRadio('animate-radios') === 'on';

  if (animating) {
    animTime += 0.016;
    needsUpdate = true;
  }

  // Update source for video/camera
  if (mediaSource.ready && mediaSource.type !== 'image') {
    sourceUpdateCounter++;
    if (sourceUpdateCounter % 3 === 0) {
      updateSourceTexture();
    }
  }

  if (!needsUpdate) return;
  needsUpdate = false;

  const displaceType = getRadio('displace-radios') || 'box';
  const refractType = getRadio('refract-radios') || 'none';
  const typeMap = { box: 0, flow: 1, sine: 2 };

  // --- Pass 1: Displacement → framebuffer ---
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.viewport(0, 0, CW, CH);
  gl.useProgram(dispProg);
  setupAttribs(dispProg);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, srcTexture);
  gl.uniform1i(dispUni.u_image, 0);
  gl.uniform2f(dispUni.u_resolution, CW, CH);
  gl.uniform1i(dispUni.u_displaceType, typeMap[displaceType] ?? 0);
  gl.uniform1f(dispUni.u_seed, +document.getElementById('seed').value);
  gl.uniform1f(dispUni.u_contentScaleX, +document.getElementById('content-scale-x').value);
  gl.uniform1f(dispUni.u_contentScaleY, +document.getElementById('content-scale-y').value);
  gl.uniform1f(dispUni.u_time, animTime);

  // Box
  gl.uniform1f(dispUni.u_box_ampX, +document.getElementById('box-amp-x').value);
  gl.uniform1f(dispUni.u_box_ampY, +document.getElementById('box-amp-y').value);
  gl.uniform1f(dispUni.u_box_freqX, +document.getElementById('box-freq-x').value);
  gl.uniform1f(dispUni.u_box_freqY, +document.getElementById('box-freq-y').value);
  gl.uniform1f(dispUni.u_box_speedX, +document.getElementById('box-speed-x').value);
  gl.uniform1f(dispUni.u_box_speedY, +document.getElementById('box-speed-y').value);

  // Flow
  gl.uniform1i(dispUni.u_flow_complexity, +document.getElementById('flow-complexity').value);
  gl.uniform1f(dispUni.u_flow_freq, +document.getElementById('flow-freq').value);
  gl.uniform1f(dispUni.u_flow_ampX, +document.getElementById('flow-amp-x').value);
  gl.uniform1f(dispUni.u_flow_ampY, +document.getElementById('flow-amp-y').value);
  gl.uniform1f(dispUni.u_flow_speedX, +document.getElementById('flow-speed-x').value);
  gl.uniform1f(dispUni.u_flow_speedY, +document.getElementById('flow-speed-y').value);

  // Sine
  gl.uniform1f(dispUni.u_sine_ampX, +document.getElementById('sine-amp-x').value);
  gl.uniform1f(dispUni.u_sine_ampY, +document.getElementById('sine-amp-y').value);
  gl.uniform1f(dispUni.u_sine_freqX, +document.getElementById('sine-freq-x').value);
  gl.uniform1f(dispUni.u_sine_freqY, +document.getElementById('sine-freq-y').value);
  gl.uniform1f(dispUni.u_sine_speedX, +document.getElementById('sine-speed-x').value);
  gl.uniform1f(dispUni.u_sine_speedY, +document.getElementById('sine-speed-y').value);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // --- Pass 2 or direct output ---
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, CW, CH);

  if (refractType === 'grid') {
    gl.useProgram(gridProg);
    setupAttribs(gridProg);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbTex);
    gl.uniform1i(gridUni.u_image, 0);
    gl.uniform2f(gridUni.u_resolution, CW, CH);
    gl.uniform1f(gridUni.u_gridAmtX, +document.getElementById('grid-amt-x').value);
    gl.uniform1f(gridUni.u_gridAmtY, +document.getElementById('grid-amt-y').value);
    gl.uniform1f(gridUni.u_skewX, +document.getElementById('skew-x').value);
    gl.uniform1f(gridUni.u_skewY, +document.getElementById('skew-y').value);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  } else {
    // Copy pass 1 to screen
    gl.useProgram(gridProg);
    setupAttribs(gridProg);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbTex);
    gl.uniform1i(gridUni.u_image, 0);
    gl.uniform2f(gridUni.u_resolution, CW, CH);
    gl.uniform1f(gridUni.u_gridAmtX, 1.0);
    gl.uniform1f(gridUni.u_gridAmtY, 1.0);
    gl.uniform1f(gridUni.u_skewX, 0.0);
    gl.uniform1f(gridUni.u_skewY, 0.0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

// --- Loop ---

function loop() {
  render();
  animId = requestAnimationFrame(loop);
}

onChange(() => {
  updateSourceTexture();
});

loop();

// --- Fullscreen & Save ---

function toggleFullscreen() { app.classList.toggle('fullscreen'); }
document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
document.getElementById('btn-exit-fs').addEventListener('click', toggleFullscreen);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && app.classList.contains('fullscreen')) toggleFullscreen(); });

document.getElementById('btn-save').addEventListener('click', () => {
  // Force a render to ensure buffer is current
  needsUpdate = true;
  render();
  const link = document.createElement('a');
  link.download = 'refract.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

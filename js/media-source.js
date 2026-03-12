/**
 * Shared media source selector — handles camera, video file, screen capture, and image input.
 * Returns a drawable source (video element or image) and manages lifecycle.
 */
export class MediaSource {
  constructor() {
    this.source = null;
    this.type = null;
    this.stream = null;
    this._video = document.createElement('video');
    this._video.playsInline = true;
    this._video.muted = true;
    this._video.loop = true;
  }

  get width() {
    if (this.type === 'image') return this.source.naturalWidth;
    return this._video.videoWidth || 640;
  }

  get height() {
    if (this.type === 'image') return this.source.naturalHeight;
    return this._video.videoHeight || 480;
  }

  get drawable() {
    return this.type === 'image' ? this.source : this._video;
  }

  get ready() {
    if (this.type === 'image') return this.source?.complete;
    return this._video.readyState >= 2;
  }

  async useCamera() {
    this.stop();
    this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    this._video.srcObject = this.stream;
    await this._video.play();
    this.type = 'camera';
    this.source = this._video;
  }

  async useScreen() {
    this.stop();
    this.stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    this._video.srcObject = this.stream;
    await this._video.play();
    this.type = 'screen';
    this.source = this._video;
  }

  async useVideo(file) {
    this.stop();
    const url = URL.createObjectURL(file);
    this._video.srcObject = null;
    this._video.src = url;
    await this._video.play();
    this.type = 'video';
    this.source = this._video;
  }

  async useImage(file) {
    this.stop();
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.type = 'image';
        this.source = img;
        resolve();
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this._video.pause();
    this._video.srcObject = null;
    this._video.removeAttribute('src');
    this.source = null;
    this.type = null;
  }
}

/**
 * Build source-selector UI into a container element.
 * Returns { mediaSource, onChange } where onChange(callback) fires when source changes.
 */
export function createSourceSelector(container) {
  const ms = new MediaSource();
  const callbacks = [];

  // Build source selector DOM
  const srcGroup = document.createElement('div');
  srcGroup.className = 'control-group';
  const srcLabel = document.createElement('label');
  srcLabel.textContent = 'Source';
  srcGroup.appendChild(srcLabel);

  const radioRow = document.createElement('div');
  radioRow.className = 'radio-row';
  radioRow.setAttribute('data-source-radios', '');
  const sources = [
    { id: 'src-image', value: 'image', text: 'Image', checked: true },
    { id: 'src-camera', value: 'camera', text: 'Camera' },
    { id: 'src-screen', value: 'screen', text: 'Screen' },
    { id: 'src-video', value: 'video', text: 'Video' },
  ];
  for (const s of sources) {
    const radio = document.createElement('input');
    radio.type = 'radio'; radio.name = 'src'; radio.id = s.id; radio.value = s.value;
    if (s.checked) radio.checked = true;
    const lbl = document.createElement('label');
    lbl.htmlFor = s.id; lbl.textContent = s.text;
    radioRow.appendChild(radio);
    radioRow.appendChild(lbl);
  }
  srcGroup.appendChild(radioRow);
  container.appendChild(srcGroup);

  const fileGroup = document.createElement('div');
  fileGroup.className = 'control-group';
  fileGroup.setAttribute('data-file-input-group', '');
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.setAttribute('data-file-input', '');
  fileInput.accept = 'image/*,video/*';
  fileGroup.appendChild(fileInput);
  container.appendChild(fileGroup);

  const radios = radioRow.querySelectorAll('input');

  function notify() { callbacks.forEach(cb => cb(ms)); }

  function updateFileVisibility(val) {
    fileGroup.style.display = (val === 'image' || val === 'video') ? '' : 'none';
    fileInput.accept = val === 'video' ? 'video/*' : 'image/*';
  }

  updateFileVisibility('image');

  radios.forEach(r => {
    r.addEventListener('change', async () => {
      updateFileVisibility(r.value);
      if (r.value === 'camera') { await ms.useCamera(); notify(); }
      else if (r.value === 'screen') { await ms.useScreen(); notify(); }
    });
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const val = container.querySelector('[data-source-radios] input:checked').value;
    if (val === 'video' || file.type.startsWith('video/')) { await ms.useVideo(file); }
    else { await ms.useImage(file); }
    notify();
  });

  // Load a default sample image
  const defaultImg = new Image();
  defaultImg.crossOrigin = 'anonymous';
  defaultImg.onload = () => {
    ms.type = 'image';
    ms.source = defaultImg;
    notify();
  };
  defaultImg.src = defaultSampleImage();

  return {
    mediaSource: ms,
    onChange(cb) { callbacks.push(cb); }
  };
}

function defaultSampleImage() {
  // Generate a small data URL with a gradient pattern as default
  const c = document.createElement('canvas');
  c.width = 640; c.height = 480;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 640, 480);
  grad.addColorStop(0, '#1a1a2e');
  grad.addColorStop(0.3, '#16213e');
  grad.addColorStop(0.5, '#0f3460');
  grad.addColorStop(0.7, '#533483');
  grad.addColorStop(1, '#e94560');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 640, 480);
  // Add some circles for visual interest
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * 640;
    const y = Math.random() * 480;
    const r = 20 + Math.random() * 80;
    const g2 = ctx.createRadialGradient(x, y, 0, x, y, r);
    g2.addColorStop(0, `hsla(${Math.random() * 360}, 60%, 60%, 0.6)`);
    g2.addColorStop(1, 'transparent');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return c.toDataURL();
}

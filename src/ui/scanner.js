/**
 * CROIVA — Document Scanner
 * Live camera preview + multi-capture + attach to payment form.
 */

import { State } from '../state.js';
import { showToast } from '../utils.js';

let _stream    = null;
let _captures  = [];
let _onAttach  = null;   // callback opcional para contextos distintos al form de pago

// ── Public API ────────────────────────────────────────────────

export function openScanner(options = {}) {
  _captures = [];
  _onAttach = options.onAttach || null;
  _buildModal();
  _startCamera();
}

// ── Modal DOM ─────────────────────────────────────────────────

function _buildModal() {
  document.getElementById('scanner-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'scanner-modal';
  modal.innerHTML = `
    <div class="scn-overlay">
      <div class="scn-sheet">

        <div class="scn-header">
          <span class="scn-title">Escanear Documento</span>
          <button class="scn-close" id="scn-btn-close">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Visor de cámara -->
        <div class="scn-viewfinder">
          <video id="scn-video" autoplay playsinline muted></video>
          <canvas id="scn-canvas" style="display:none"></canvas>
          <div class="scn-corner tl"></div>
          <div class="scn-corner tr"></div>
          <div class="scn-corner bl"></div>
          <div class="scn-corner br"></div>
          <div id="scn-no-camera" class="scn-no-camera" style="display:none">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <p>Cámara no disponible</p>
            <button class="scn-fallback-btn" id="scn-btn-fallback">Elegir archivo</button>
            <input type="file" id="scn-file-fallback" accept="image/*,.pdf" multiple style="display:none" />
          </div>
        </div>

        <!-- Galería de capturas -->
        <div class="scn-gallery" id="scn-gallery"></div>

        <!-- Controles -->
        <div class="scn-controls">
          <button class="scn-btn-secondary" id="scn-btn-gallery">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            Galería
            <input type="file" id="scn-file-gallery" accept="image/*,.pdf" multiple style="display:none" />
          </button>

          <button class="scn-btn-capture" id="scn-btn-capture" title="Capturar">
            <div class="scn-shutter"></div>
          </button>

          <button class="scn-btn-attach" id="scn-btn-attach" disabled>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Adjuntar (<span id="scn-count">0</span>)
          </button>
        </div>

      </div>
    </div>`;

  document.body.appendChild(modal);
  _bindEvents(modal);
}

function _bindEvents(modal) {
  modal.querySelector('#scn-btn-close').addEventListener('click', _close);

  modal.querySelector('#scn-btn-capture').addEventListener('click', _capture);

  // Galería: elegir desde el sistema
  const galleryBtn  = modal.querySelector('#scn-btn-gallery');
  const galleryFile = modal.querySelector('#scn-file-gallery');
  galleryBtn.addEventListener('click', () => galleryFile.click());
  galleryFile.addEventListener('change', (e) => _addFiles(Array.from(e.target.files)));

  // Fallback sin cámara
  const fallbackBtn  = modal.querySelector('#scn-btn-fallback');
  const fallbackFile = modal.querySelector('#scn-file-fallback');
  fallbackBtn?.addEventListener('click', () => fallbackFile.click());
  fallbackFile?.addEventListener('change', (e) => _addFiles(Array.from(e.target.files)));

  // Adjuntar al formulario
  modal.querySelector('#scn-btn-attach').addEventListener('click', _attach);
}

// ── Cámara ────────────────────────────────────────────────────

async function _startCamera() {
  const video   = document.getElementById('scn-video');
  const noCamera = document.getElementById('scn-no-camera');
  try {
    _stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    video.srcObject = _stream;
  } catch {
    video.style.display = 'none';
    if (noCamera) noCamera.style.display = 'flex';
    document.getElementById('scn-btn-capture').style.display = 'none';
  }
}

function _stopCamera() {
  _stream?.getTracks().forEach(t => t.stop());
  _stream = null;
}

// ── Captura ───────────────────────────────────────────────────

function _capture() {
  const video  = document.getElementById('scn-video');
  const canvas = document.getElementById('scn-canvas');
  if (!video.videoWidth) { showToast('Cámara aún iniciando...'); return; }

  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  // Efecto flash
  const viewfinder = document.querySelector('.scn-viewfinder');
  viewfinder.classList.add('scn-flash');
  setTimeout(() => viewfinder.classList.remove('scn-flash'), 200);

  canvas.toBlob(blob => {
    const name = `scan-${Date.now()}.jpg`;
    _addFiles([new File([blob], name, { type: 'image/jpeg' })]);
  }, 'image/jpeg', 0.92);
}

async function _addFiles(files) {
  const MAX = 5;
  for (const f of files) {
    if (_captures.length >= MAX) { showToast(`Máximo ${MAX} archivos por solicitud`); break; }
    if (f.size > 10 * 1024 * 1024) { showToast(`"${f.name}" supera 10 MB`); continue; }

    if (f.type.startsWith('image/')) {
      _showConvertingBadge(true);
      try {
        const pdf = await _imageToPdf(f);
        _captures.push(pdf);
      } catch {
        // Si falla la conversión, adjunta la imagen original
        _captures.push(f);
      }
      _showConvertingBadge(false);
    } else {
      _captures.push(f);   // PDF u otro — sin conversión
    }
  }
  _renderGallery();
}

async function _imageToPdf(file) {
  if (!window.jspdf) throw new Error('jsPDF no disponible');
  const { jsPDF } = window.jspdf;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const landscape = img.width > img.height;
        const doc = new jsPDF({
          orientation: landscape ? 'landscape' : 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        const pageW  = doc.internal.pageSize.getWidth();
        const pageH  = doc.internal.pageSize.getHeight();
        const margin = 8;
        const maxW   = pageW - margin * 2;
        const maxH   = pageH - margin * 2;
        const ratio  = Math.min(maxW / img.width, maxH / img.height);
        const w = img.width  * ratio;
        const h = img.height * ratio;
        const x = (pageW - w) / 2;
        const y = (pageH - h) / 2;

        // jsPDF acepta JPEG y PNG directamente
        const fmt = file.type === 'image/png' ? 'PNG' : 'JPEG';
        doc.addImage(img, fmt, x, y, w, h, undefined, 'FAST');

        const blob    = doc.output('blob');
        const pdfName = file.name.replace(/\.[^.]+$/, '') + '.pdf';
        URL.revokeObjectURL(url);
        resolve(new File([blob], pdfName, { type: 'application/pdf' }));
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

function _showConvertingBadge(show) {
  let badge = document.getElementById('scn-converting');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'scn-converting';
    badge.className = 'scn-converting-badge';
    badge.textContent = 'Convirtiendo a PDF...';
    document.querySelector('.scn-gallery')?.before(badge);
  }
  badge.style.display = show ? 'block' : 'none';
}

function _removeCapture(index) {
  _captures.splice(index, 1);
  _renderGallery();
}

function _renderGallery() {
  const gallery = document.getElementById('scn-gallery');
  const count   = document.getElementById('scn-count');
  const attach  = document.getElementById('scn-btn-attach');

  if (count)  count.textContent = _captures.length;
  if (attach) attach.disabled   = _captures.length === 0;

  if (!gallery) return;
  gallery.innerHTML = _captures.map((f, i) => {
    const url = URL.createObjectURL(f);
    const isPdf = f.type === 'application/pdf';
    return `
      <div class="scn-thumb">
        ${isPdf
          ? `<div class="scn-thumb-pdf"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>`
          : `<img src="${url}" alt="scan" />`}
        <button class="scn-thumb-del" data-index="${i}">×</button>
      </div>`;
  }).join('');

  gallery.querySelectorAll('.scn-thumb-del').forEach(btn => {
    btn.addEventListener('click', () => _removeCapture(parseInt(btn.dataset.index)));
  });
}

// ── Adjuntar al formulario de pago ────────────────────────────

function _attach() {
  if (_captures.length === 0) return;

  // Si hay callback personalizado (ej. cotización), úsalo
  if (_onAttach) {
    const files = [..._captures];
    _close();
    _onAttach(files);
    return;
  }

  // Flujo por defecto: adjuntar al formulario de pago
  const MAX_TOTAL = 5;
  const current   = State.uploadedFiles.length;
  const available = MAX_TOTAL - current;
  const toAdd     = _captures.slice(0, available);

  if (toAdd.length < _captures.length) {
    showToast(`Solo se agregaron ${toAdd.length} archivo(s) — límite de ${MAX_TOTAL} alcanzado`);
  }

  toAdd.forEach(f => State.uploadedFiles.push(f));
  import('./forms.js').then(({ renderUploadedFiles }) => renderUploadedFiles());
  showToast(`${toAdd.length} archivo(s) adjunto(s) a la solicitud`);
  _close();
}

function _close() {
  _stopCamera();
  document.getElementById('scanner-modal')?.remove();
}

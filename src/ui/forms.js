/**
 * CROIVA - Forms UI Component
 */

import { Auth, API, isSystemOpen, refreshSystemStatus, getNextOpenTime } from '../api.js';
import { openScanner } from './scanner.js';
import { State } from '../state.js';
import { 
  fmt, escapeHTML, showToast, openModal, closeModal 
} from '../utils.js';
import { navigateTo } from '../router.js';
import { updateNotificationCount } from './notifications.js';

// BUG-011: Constantes de validación de archivos
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILE_COUNT = 5;

export async function renderPaymentForm() {
  State.uploadedFiles = [];
  State.rejectedFilesCount = 0;
  State.paymentIdempotencyKey = crypto.randomUUID();
  renderUploadedFiles();

  // Estado del sistema
  await refreshSystemStatus();
  const open    = isSystemOpen();
  const alertEl = document.getElementById('closed-system-alert');
  const submitEl = document.getElementById('btn-submit-payment');
  if (!open) {
    if (alertEl) {
      alertEl.style.display = 'flex';
      alertEl.querySelector('.alert-text').innerHTML =
        `La recepción de facturas está cerrada. El sistema reabre <strong>${getNextOpenTime()}</strong>.`;
    }
  } else {
    if (alertEl) alertEl.style.display = 'none';
  }

  // Fecha automática
  const autoDate = document.getElementById('pf-auto-date');
  if (autoDate) {
    const now = new Date();
    autoDate.textContent = now.toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' });
  }

  // Cargar proyectos
  const projSel = document.getElementById('payment-project-select');
  if (projSel) {
    projSel.innerHTML = '<option value="">Seleccionar proyecto...</option>';
    try {
      const projects = await API.get('/projects') || [];
      projects.forEach(p => {
        projSel.innerHTML += `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)}</option>`;
      });
    } catch (_) {}
  }

  // Ocultar secciones
  ['payment-quote-group','payment-items-group','pf-auto-section','pf-details-section'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  if (submitEl) submitEl.style.display = 'none';

  document.getElementById('payment-quote-select').innerHTML = '<option value="">Seleccionar presupuesto proveedor...</option>';
  document.getElementById('payment-items-list').innerHTML   = '';
  document.getElementById('pf-total-importe').textContent   = '$0.00';
  document.getElementById('payment-amount').value           = '0';
}

export async function submitPaymentRequest() {
  if (!isSystemOpen()) {
    showToast('El sistema está cerrado. Intenta el Lunes.');
    return;
  }

  const projectId = document.getElementById('payment-project-select')?.value;
  const quoteId   = document.getElementById('payment-quote-select')?.value;
  const amount    = parseFloat(document.getElementById('payment-amount')?.value) || 0;
  const concept   = document.getElementById('payment-concept')?.value?.trim();
  const progress  = document.getElementById('progress-slider')?.value || '0';
  const notes     = document.getElementById('payment-notes')?.value?.trim();

  if (!projectId || !quoteId) {
    showToast('Selecciona un proyecto y un presupuesto proveedor');
    return;
  }
  if (!concept) {
    showToast('El concepto del trabajo es requerido');
    return;
  }
  if (amount <= 0) {
    showToast('Agrega al menos una partida con importe mayor a 0');
    return;
  }

  // Recopilar partidas con cantidad, PU e importe
  const selectedItems = [];
  document.querySelectorAll('.pf-item-card').forEach((card) => {
    const qty     = parseFloat(card.querySelector('.pi-qty')?.value)     || 0;
    const pu      = parseFloat(card.querySelector('.pi-pu')?.value)      || 0;
    const importe = parseFloat(card.querySelector('.pi-importe')?.value) || 0;
    if (importe <= 0) return;

    const origQty = parseFloat(card.dataset.origQty) || 0;
    const paidQty = parseFloat(card.dataset.paidQty) || 0;
    const totalQty = paidQty + qty;
    const progress = origQty > 0 ? Math.min(100, Math.round((totalQty / origQty) * 100)) : 0;

    selectedItems.push({
      quoteItemId: card.dataset.itemId,
      quantity:    qty,
      unitPrice:   pu,
      amount:      importe,
      progress,
    });
  });

  if (selectedItems.length === 0) {
    showToast('Agrega al menos una partida con importe');
    return;
  }

  if (!State.uploadedFiles || State.uploadedFiles.length === 0) {
    showToast('Debes adjuntar al menos una factura o comprobante');
    return;
  }

  if (State.rejectedFilesCount > 0) {
    showToast(`Tienes ${State.rejectedFilesCount} archivo(s) rechazado(s). Por favor elimínalos o corrígelos.`);
    return;
  }

  const btn = document.getElementById('btn-submit-payment');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

  try {
    const formData = new FormData();
    formData.append('projectId', projectId);
    formData.append('quoteId',   quoteId);
    formData.append('amount',    amount.toFixed(2));
    formData.append('concept',   concept);
    formData.append('progress',  progress);
    formData.append('items',     JSON.stringify(selectedItems));
    if (notes) formData.append('notes', notes);
    State.uploadedFiles.forEach(f => formData.append('files', f));

    await API.postForm('/payments', formData, State.paymentIdempotencyKey);

    showToast('¡Solicitud enviada exitosamente!');
    State.uploadedFiles = []; // Clear files
    State.rejectedFilesCount = 0; // Clear rejected count
    State.paymentIdempotencyKey = null; // Clear key
    updateNotificationCount();
    // Navigate to solicitudes and render provider list
    setTimeout(async () => {
      navigateTo('solicitudes');
      try {
        const { renderSolicitudesProviderList } = await import('./payments.js');
        renderSolicitudesProviderList();
      } catch (_) {}
    }, 1000);
  } catch (err) {
    showToast('Error al enviar: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar Solicitud'; }
  }
}

export function handleFileUpload(event) {
  const files = Array.from(event.target.files);
  let newlyRejected = 0;
  files.forEach(file => {
    if (!ALLOWED_MIME.includes(file.type)) { newlyRejected++; return; }
    if (file.size > MAX_FILE_SIZE_BYTES) { newlyRejected++; return; }
    if (State.uploadedFiles.length >= MAX_FILE_COUNT) { newlyRejected++; return; }
    if (State.uploadedFiles.some(f => f.name === file.name && f.size === file.size)) return;
    State.uploadedFiles.push(file);
  });
  State.rejectedFilesCount = newlyRejected;
  if (newlyRejected > 0) showToast(`${newlyRejected} archivo(s) rechazado(s): tipo inválido o mayor a 10MB`);
  else if (files.length > 0) showToast(`${files.length - newlyRejected} archivo(s) adjunto(s) correctamente`);
  renderUploadedFiles();
  event.target.value = '';
}

export function renderUploadedFiles() {
  const container = document.getElementById('uploaded-files');
  if (!container) return;
  container.innerHTML = State.uploadedFiles.map((f, i) => `
    <div class="uploaded-file-chip">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      </svg>
      ${escapeHTML(f.name)}
      <span class="remove-file" data-index="${i}">×</span>
    </div>`).join('');

  container.querySelectorAll('.remove-file').forEach(btn => {
    btn.addEventListener('click', () => {
      removeFile(parseInt(btn.dataset.index));
    });
  });
}

export function removeFile(index) {
  State.uploadedFiles.splice(index, 1);
  renderUploadedFiles();
}

export function recalcPaymentTotal() {
  let total = 0;
  document.querySelectorAll('.payment-item-row').forEach(row => {
    const cb = row.querySelector('.pi-checkbox');
    const progressWrap = row.querySelector('.pi-progress-wrap');
    if (progressWrap) progressWrap.style.display = cb.checked ? 'block' : 'none';
    if (cb.checked) {
      const slider = row.querySelector('.pi-slider');
      const pct = (slider ? parseInt(slider.value) : 0) / 100;
      const qty      = parseFloat(row.dataset.qty);
      const unitPrice = parseFloat(row.dataset.unitPrice);
      total += qty * unitPrice * pct;
    }
  });
  const amountInput = document.getElementById('payment-amount');
  if (amountInput) amountInput.value = total > 0 ? total.toFixed(2) : '';
}

export function updateSlider(value) {
  const display = document.getElementById('slider-display');
  const fill = document.getElementById('slider-fill');
  if (display) display.textContent = `${value}%`;
  if (fill) fill.style.width = `${value}%`;
}

// Project Form logic
let _editingProjectId = null;
export function resetProjectForm() { _editingProjectId = null; }

export function openEditProjectModal() {
  if (!State.currentProject) {
    showToast('Selecciona un proyecto primero');
    return;
  }

  _editingProjectId = State.currentProject.id;

  const modalTitle = document.querySelector('#modal-new-project .modal-header h3');
  if (modalTitle) modalTitle.textContent = 'Editar Proyecto';
  const modalBtn = document.querySelector('#modal-new-project .btn-submit');
  if (modalBtn) modalBtn.textContent = 'Actualizar Proyecto';
  
  document.getElementById('new-project-name').value = State.currentProject.name || '';
  document.getElementById('new-project-type').value = State.currentProject.type || 'COMMERCIAL';
  document.getElementById('new-project-budget').value = State.currentProject.budget || '';
  if (State.currentProject.startDate) {
    document.getElementById('new-project-date').value = new Date(State.currentProject.startDate).toISOString().slice(0,10);
  } else {
    document.getElementById('new-project-date').value = '';
  }
  document.getElementById('new-project-location').value = State.currentProject.location || '';
  document.getElementById('new-project-ip').value = State.currentProject.indirectoProyecto || 0;
  document.getElementById('new-project-io').value = State.currentProject.indirectoOficina || 0;
  document.getElementById('new-project-util').value = State.currentProject.utilidad || 0;
  
  openModal('modal-new-project');
}

export async function createProject() {
  const name     = document.getElementById('new-project-name')?.value?.trim();
  const type     = document.getElementById('new-project-type')?.value;
  const budget   = document.getElementById('new-project-budget')?.value;
  const date     = document.getElementById('new-project-date')?.value;
  const location = document.getElementById('new-project-location')?.value?.trim();
  const ip       = document.getElementById('new-project-ip')?.value || 0;
  const io       = document.getElementById('new-project-io')?.value || 0;
  const util     = document.getElementById('new-project-util')?.value || 0;

  if (!name || !budget) { showToast('Nombre y costo directo son requeridos'); return; }

  const payload = { 
    name, type, 
    budget: parseFloat(budget), 
    indirectoProyecto: parseFloat(ip),
    indirectoOficina: parseFloat(io),
    utilidad: parseFloat(util),
    startDate: date, location 
  };

    try {
      if (_editingProjectId) {
        await API.put(`/projects/${_editingProjectId}`, payload);
        showToast(`Proyecto "${name}" actualizado exitosamente`);
      } else {
        await API.post('/projects', payload);
        showToast(`Proyecto "${name}" creado exitosamente`);
      }
      
      closeModal('modal-new-project');
      document.querySelector('#modal-new-project form')?.reset();

      // Force refresh data
      if (document.getElementById('projects-list-full')) {
        const { renderProjectsList } = await import('./projects.js');
        renderProjectsList();
      }
      
      // If we are on dashboard, refresh projects grid
      if (document.getElementById('projects-grid')) {
        const { renderDashboard } = await import('./dashboard.js');
        renderDashboard();
      }

      if (State.currentScreen !== 'dashboard' && State.currentScreen !== 'projects') {
        navigateTo('dashboard');
      }
    } catch (err) {
      console.error("[DEBUG] createProject error:", err);
      showToast('Error: ' + err.message);
    }
}

export async function onPaymentProjectChange(projectId) {
  const quoteGroup  = document.getElementById('payment-quote-group');
  const quoteSelect = document.getElementById('payment-quote-select');

  ['payment-quote-group','payment-items-group','pf-auto-section','pf-details-section'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  const submitEl = document.getElementById('btn-submit-payment');
  if (submitEl) submitEl.style.display = 'none';
  quoteSelect.innerHTML = '<option value="">Seleccionar presupuesto proveedor...</option>';
  document.getElementById('payment-items-list').innerHTML = '';
  document.getElementById('payment-amount').value = '0';
  document.getElementById('pf-total-importe').textContent = '$0.00';

  if (!projectId) return;

  try {
    const rawQuotes = await API.get(`/quotes?projectId=${projectId}`);
    const quotes = (Array.isArray(rawQuotes) ? rawQuotes : (rawQuotes.data || []))
      .filter(q => q.status === 'APPROVED');
      
    if (quotes.length === 0) {
      quoteSelect.innerHTML = '<option value="" disabled selected>No hay presupuestos proveedores aprobadas</option>';
      quoteSelect.disabled = true;
    } else {
      quoteSelect.disabled = false;
      quoteSelect.innerHTML = '<option value="">Seleccionar presupuesto proveedor...</option>';
      quotes.forEach(q => {
        const num = q.quoteNumber ? `PP-${String(q.quoteNumber).padStart(3,'0')} — ` : '';
        quoteSelect.innerHTML += `<option value="${escapeHTML(q.id)}">${num}${escapeHTML(q.description)}</option>`;
      });
    }
    quoteGroup.style.display = 'block';
  } catch (_) {}
}

export async function onPaymentQuoteChange(quoteId) {
  ['payment-items-group','pf-auto-section','pf-details-section'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  const submitEl = document.getElementById('btn-submit-payment');
  if (submitEl) submitEl.style.display = 'none';
  document.getElementById('payment-items-list').innerHTML = '';
  document.getElementById('payment-amount').value = '0';
  document.getElementById('pf-total-importe').textContent = '$0.00';

  if (!quoteId) return;

  const projectId = document.getElementById('payment-project-select').value;
  try {
    // Cargar quote completo con historial de pagos aprobados
    const [quote, allPayments] = await Promise.all([
      API.get(`/quotes/${quoteId}`),
      API.get(`/payments?projectId=${projectId}`).catch(() => []),
    ]);
    if (!quote) return;

    // Calcular total recibido de este presupuesto proveedor (pagos aprobados)
    const approvedPayments = (allPayments || []).filter(p => p.status === 'APPROVED' && p.quoteId === quoteId);
    const totalRecibido    = approvedPayments.reduce((s, p) => s + Number(p.amount), 0);
    const quoteTotal       = Number(quote.amount);
    const pendiente        = quoteTotal - totalRecibido;

    // Acumulado pagado por partida
    const paidByItem = {};
    approvedPayments.forEach(p => {
      (p.items || []).forEach(pi => {
        if (!paidByItem[pi.quoteItemId]) paidByItem[pi.quoteItemId] = { qty: 0, amount: 0 };
        paidByItem[pi.quoteItemId].qty    += Number(pi.quantity || 0);
        paidByItem[pi.quoteItemId].amount += Number(pi.amount   || 0);
      });
    });

    // Auto-fill sección datos automáticos
    const qNum = quote.quoteNumber ? `PP-${String(quote.quoteNumber).padStart(3,'0')}` : quote.id.slice(-6);
    document.getElementById('pf-auto-quote-num').textContent   = qNum;
    document.getElementById('pf-auto-quote-total').textContent = fmt(quoteTotal);
    document.getElementById('pf-auto-received').textContent    = fmt(totalRecibido);
    document.getElementById('pf-auto-pending').textContent     = fmt(pendiente);
    document.getElementById('pf-auto-section').style.display   = 'block';

    // Guardar en state para submitPaymentRequest
    State._currentQuote = quote;
    State._paidByItem   = paidByItem;

    // Renderizar tabla de partidas
    const itemsList = document.getElementById('payment-items-list');
    if (!quote.items || quote.items.length === 0) {
      itemsList.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:12px 0">Este presupuesto proveedor no tiene partidas.</p>';
    } else {
      itemsList.innerHTML = quote.items.map((it, idx) => {
        const originalQty   = Number(it.quantity);
        const paidQty       = paidByItem[it.id]?.qty || 0;
        const avancePct     = originalQty > 0 ? Math.min(100, Math.round((paidQty / originalQty) * 100)) : 0;
        const paidAmt       = paidByItem[it.id]?.amount || 0;
        const code          = `P${String(idx + 1).padStart(3, '0')}`;

        return `
          <div class="pf-item-card" data-item-id="${escapeHTML(it.id)}" data-orig-qty="${originalQty}" data-unit-price="${it.unitPrice}" data-paid-qty="${paidQty}">
            <div class="pf-item-header">
              <span class="pf-item-code">${code}</span>
              <span class="pf-item-concept">${escapeHTML(it.concept)}</span>
            </div>
            <div class="pf-item-meta">
              <span>Original: ${originalQty} ${escapeHTML(it.unit)} × ${fmt(it.unitPrice)}</span>
              <span style="color:var(--orange)">Pagado: ${fmt(paidAmt)} (${avancePct}%)</span>
            </div>
            <div class="pf-item-inputs">
              <div class="pf-item-field">
                <label class="pf-item-label">Cantidad</label>
                <input type="number" class="pf-input pi-qty" placeholder="0" min="0" step="any"
                  max="${originalQty - paidQty}" />
              </div>
              <div class="pf-item-field">
                <label class="pf-item-label">Unidad</label>
                <input type="text" class="pf-input pi-unit" value="${escapeHTML(it.unit)}" readonly />
              </div>
              <div class="pf-item-field">
                <label class="pf-item-label">P.U.</label>
                <input type="number" class="pf-input pi-pu" value="${it.unitPrice}" min="0" step="any" />
              </div>
              <div class="pf-item-field">
                <label class="pf-item-label">Importe</label>
                <input type="number" class="pf-input pi-importe" placeholder="0.00" min="0" step="any" />
              </div>
            </div>
            <div class="pf-item-avance">
              <span class="pf-item-label">Avance acumulado tras esta estimación</span>
              <span class="pi-avance-pct" style="font-weight:700;color:var(--primary)">${avancePct}%</span>
              <div class="pf-mini-bar-bg"><div class="pf-mini-bar-fill" style="width:${avancePct}%;background:var(--primary)"></div></div>
            </div>
          </div>`;
      }).join('');

      // Listeners de cálculo automático por partida
      itemsList.querySelectorAll('.pf-item-card').forEach(card => {
        const qtyEl    = card.querySelector('.pi-qty');
        const puEl     = card.querySelector('.pi-pu');
        const importeEl= card.querySelector('.pi-importe');
        const avanceEl = card.querySelector('.pi-avance-pct');
        const barEl    = card.querySelector('.pf-mini-bar-fill');
        const origQty  = parseFloat(card.dataset.origQty) || 0;
        const paidQty  = parseFloat(card.dataset.paidQty) || 0;

        const recalc = () => {
          const qty = parseFloat(qtyEl.value) || 0;
          const pu  = parseFloat(puEl.value)  || 0;
          const imp = qty * pu;
          importeEl.value = imp > 0 ? imp.toFixed(2) : '';

          // Avance acumulado
          const totalQty = paidQty + qty;
          const pct = origQty > 0 ? Math.min(100, Math.round((totalQty / origQty) * 100)) : 0;
          avanceEl.textContent = `${pct}%`;
          if (barEl) barEl.style.width = `${pct}%`;

          _recalcPaymentTotal();
        };

        importeEl.addEventListener('input', _recalcPaymentTotal);
        qtyEl.addEventListener('input', recalc);
        puEl.addEventListener('input',  recalc);
      });
    }

    document.getElementById('payment-items-group').style.display  = 'block';
    document.getElementById('pf-details-section').style.display   = 'block';
    if (submitEl) submitEl.style.display = 'block';

  } catch (err) {
    showToast('Error al cargar presupuesto proveedor: ' + err.message);
  }
}

function _recalcPaymentTotal() {
  let total = 0;
  document.querySelectorAll('.pf-item-card .pi-importe').forEach(el => {
    total += parseFloat(el.value) || 0;
  });
  document.getElementById('pf-total-importe').textContent = fmt(total);
  document.getElementById('payment-amount').value = total.toFixed(2);
}

// No global bindings needed - handled by event delegation in main.js
export const uploadPDF = () => document.getElementById('file-input').click();
export const openCamera = () => openScanner();

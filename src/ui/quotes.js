/**
 * CROIVA - Quotes UI Component
 */

import { Auth, API, isSystemOpen } from '../api.js';
import { State } from '../state.js';
import {
  fmt, fmtDate, calcPct, escapeHTML, setLoading,
  showToast, emptyState, statusLabel, openModal, closeModal
} from '../utils.js';
import { navigateTo, goBack } from '../router.js';

export async function renderQuotes(pid) {
  setLoading('quotes-list');
  try {
    const quotes = await API.get(`/quotes?projectId=${pid}`) || [];
    const container = document.getElementById('quotes-list');

    const btn = document.getElementById('btn-new-quote');
    if (btn) btn.style.display = Auth.isProvider() ? 'block' : 'none';

    const quotesArr = Array.isArray(quotes) ? quotes : (quotes.data || []);

    if (quotesArr.length === 0) {
      container.innerHTML = emptyState('Sin presupuestos proveedores registradas', 'Los proveedores asignados pueden agregar presupuestos proveedores');
      return;
    }

    const headerLabel = Auth.isProvider()
      ? `Presupuestos Proveedores de ${escapeHTML(Auth.user.name)} (${quotesArr.length})`
      : `Presupuestos Proveedores (${quotesArr.length})`;
    const headerHtml = `<div class="quotes-section-header">${headerLabel}</div>`;

    const cardsHtml = quotesArr.map((q, i) => {
      const displayId   = q.quoteNumber
        ? `PP-${String(q.quoteNumber).padStart(3, '0')}`
        : `Q-${String(i + 1).padStart(3, '0')}`;
      const partidas    = (q.items || []);
      const totalBudget = partidas.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
      const totalPaid   = partidas.reduce((s, it) =>
        s + (it.paymentItems || []).reduce((ps, pi) => ps + Number(pi.amount), 0), 0);
      const progress    = calcPct(totalPaid, totalBudget || q.amount);
      const subtotal    = q.amount / 1.16;
      const iva         = q.amount - subtotal;

      return `
        <div class="quote-card" data-id="${q.id}" data-display-id="${displayId}">
          <div class="qc-top-row">
            <div class="qc-id-provider">
              <span class="qc-id">${displayId}</span>
              <span class="qc-provider-name">${escapeHTML(q.provider?.name || 'Proveedor')}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <span class="status-badge ${(q.status||'pending').toLowerCase()}" style="font-size:10px;padding:2px 8px">${statusLabel(q.status)}</span>
              <div class="qc-progress-badge">${progress}%</div>
            </div>
          </div>
          <div class="qc-date-row">${fmtDate(q.date)}</div>
          <div class="qc-bar-wrap">
            <div class="qc-bar-bg"><div class="qc-bar-fill" style="width:${progress}%"></div></div>
          </div>
          <div class="qc-financials">
            <div class="qc-fin-row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
            <div class="qc-fin-row"><span>IVA (16%)</span><span>${fmt(iva)}</span></div>
            <div class="qc-fin-row qc-fin-total"><span>Total</span><span class="orange">${fmt(q.amount)}</span></div>
          </div>
          <div class="qc-footer">${partidas.length} partida${partidas.length !== 1 ? 's' : ''} · ${fmt(totalPaid)} pagado de ${fmt(totalBudget)}</div>
        </div>`;
    }).join('');

    container.innerHTML = headerHtml + cardsHtml;

    // Attach card listeners
    container.querySelectorAll('.quote-card').forEach(card => {
      card.addEventListener('click', () => {
        openQuotePartidas(card.dataset.id, card.dataset.displayId);
      });
    });

  } catch (err) {
    console.error('renderQuotes error:', err);
    const container = document.getElementById('quotes-list');
    if (container) container.innerHTML = emptyState('Error al cargar presupuestos proveedores', 'Ocurrió un problema, verifica la conexión y los permisos.');
  }
}

export async function updateQuoteStatus(status) {
  if (!State.currentQuotePartidasId) return;
  const label = status === 'APPROVED' ? 'aprobada' : 'rechazada';
  try {
    await API.patch(`/quotes/${State.currentQuotePartidasId}/status`, { status });
    showToast(`Presupuesto Proveedor ${label} exitosamente`);
    renderQuotePartidas();
    renderQuotes(State.currentProjectId);
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

export async function renderQuotePartidas() {
  const quoteId = State.currentQuotePartidasId;
  const displayId = State.currentQuotePartidasDisplayId;
  
  if (!quoteId || quoteId === 'undefined') {
    showToast('Error: presupuesto proveedor no identificada');
    goBack();
    return;
  }
  setLoading('qp-partidas-list');
  try {
    const quote = await API.get(`/quotes/${quoteId}`);

    const quoteDisplayId = quote.quoteNumber
      ? `PP-${String(quote.quoteNumber).padStart(3, '0')}`
      : (displayId || 'PP-???');
    document.getElementById('qp-quote-id').textContent = quoteDisplayId;
    document.getElementById('qp-provider').textContent = quote.provider?.name || 'Proveedor';

    const statusBadge  = document.getElementById('qp-status-badge');
    const quoteActions = document.getElementById('qp-quote-actions');
    if (statusBadge) {
      statusBadge.textContent  = statusLabel(quote.status);
      statusBadge.className    = 'status-badge ' + (quote.status || '').toLowerCase();
      statusBadge.style.display = 'inline-block';
    }
    if (quoteActions) {
      quoteActions.style.display = (Auth.isAdmin() && quote.status === 'PENDING') ? 'flex' : 'none';
      quoteActions.classList.toggle('hidden', !(Auth.isAdmin() && quote.status === 'PENDING'));
    }

    // Mostrar "Agregar Partida" al admin siempre, y al proveedor en sus propios presupuestos
    const isOwnQuote = Auth.isProvider() && quote.provider?.id === Auth.user?.id;
    const canAddItems = Auth.isAdmin() || isOwnQuote;
    const addSection = document.getElementById('qp-add-item-section');
    if (addSection) addSection.style.display = canAddItems ? 'block' : 'none';

    let totalPresupuesto = 0;
    let totalPagado      = 0;

    (quote.items || []).forEach(it => {
      const presupuesto = it.quantity * it.unitPrice;
      const pagado      = (it.paymentItems || []).reduce((s, pi) => s + Number(pi.amount), 0);
      totalPresupuesto += presupuesto;
      totalPagado      += pagado;
    });

    const totalDisponible = totalPresupuesto - totalPagado;
    const quoteProgress   = calcPct(totalPagado, totalPresupuesto);

    document.getElementById('qp-budget').textContent      = fmt(totalPresupuesto);
    document.getElementById('qp-paid').textContent        = fmt(totalPagado);
    document.getElementById('qp-available').textContent   = fmt(totalDisponible);
    document.getElementById('qp-progress-bar').style.width = `${quoteProgress}%`;
    document.getElementById('qp-progress-pct').textContent = `${quoteProgress}% ejecutado`;

    const container = document.getElementById('qp-partidas-list');
    if (!quote.items || quote.items.length === 0) {
      container.innerHTML = emptyState('Sin partidas', 'Este presupuesto proveedor no tiene partidas registradas');
      return;
    }

    container.innerHTML = quote.items.map((it, i) => {
      const presupuesto = it.quantity * it.unitPrice;
      const pagado      = (it.paymentItems || []).reduce((s, pi) => s + Number(pi.amount), 0);
      const disponible  = presupuesto - pagado;
      const pct         = calcPct(pagado, presupuesto);
      const code        = `P${String(i + 1).padStart(3, '0')}`;
      const paymentsCount = (it.paymentItems || []).length;

      let barColor;
      if (pct === 0)           barColor = '#6B7280';
      else if (pct < 50)       barColor = '#F59E0B';
      else if (pct < 75)       barColor = '#FF6B35';
      else if (pct < 100)      barColor = '#E85D04';
      else                     barColor = '#22C55E';

      if (Auth.isProvider()) {
        const canRequest = disponible > 0 && isSystemOpen();
        return `
          <div class="qp-partida-card" data-id="${it.id}">
            <div class="qp-partida-top">
              <span class="qp-partida-code">${code}</span>
              <span class="qp-partida-name">${escapeHTML(it.concept)}</span>
              <span class="qp-partida-pct${pct === 100 ? ' pct-done' : ''}" style="color:${barColor}">${pct}%</span>
            </div>
            ${it.description ? `<div class="qp-partida-desc">${escapeHTML(it.description)}</div>` : ''}
            <div class="qp-bar-wrap">
              <div class="qp-bar-bg"><div class="qp-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
            </div>
            <div class="qp-partida-financials">
              <div class="qp-fin-item"><span class="qp-fin-label">Presupuesto</span><span class="qp-fin-value">${fmt(presupuesto)}</span></div>
              <div class="qp-fin-item"><span class="qp-fin-label">Pagado</span><span class="qp-fin-value" style="color:#22C55E">${fmt(pagado)}</span></div>
              <div class="qp-fin-item"><span class="qp-fin-label">Disponible</span><span class="qp-fin-value blue">${fmt(disponible)}</span></div>
            </div>
            <div class="partida-action-btns">
              <button class="btn-historial" data-id="${it.id}" data-concept="${escapeHTML(it.concept)}" data-budget="${presupuesto}" data-paid="${pagado}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Historial ${paymentsCount > 0 ? `<span class="historial-badge">${paymentsCount}</span>` : ''}
              </button>
              <button class="btn-solicitar-partida${canRequest ? '' : ' disabled'}" 
                data-id="${it.id}" 
                data-concept="${escapeHTML(it.concept)}" 
                data-budget="${presupuesto}" 
                data-paid="${pagado}" 
                data-pct="${pct}" 
                ${canRequest ? '' : 'disabled'} 
                title="${canRequest ? 'Solicitar pago para esta partida' : 'Sin saldo disponible o ventana cerrada'}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Solicitar Pago
              </button>
            </div>
          </div>`;
      } else {
        return `
          <div class="qp-partida-card admin-view" data-id="${it.id}" data-concept="${escapeHTML(it.concept)}" data-budget="${presupuesto}" data-paid="${pagado}">
            <div class="qp-partida-top">
              <span class="qp-partida-code">${code}</span>
              <span class="qp-partida-name">${escapeHTML(it.concept)}</span>
              <span class="qp-partida-pct ${pct === 100 ? 'pct-done' : ''}">${pct}%</span>
            </div>
            <div class="qp-bar-wrap">
              <div class="qp-bar-bg"><div class="qp-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
            </div>
            <div class="qp-partida-financials">
              <div class="qp-fin-item"><span class="qp-fin-label">Presupuesto</span><span class="qp-fin-value">${fmt(presupuesto)}</span></div>
              <div class="qp-fin-item"><span class="qp-fin-label">Pagado</span><span class="qp-fin-value orange">${fmt(pagado)}</span></div>
              <div class="qp-fin-item"><span class="qp-fin-label">Disponible</span><span class="qp-fin-value blue">${fmt(disponible)}</span></div>
            </div>
            <div class="qp-partida-hint">Toca para ver historial de pagos</div>
          </div>`;
      }
    }).join('');

    // Attach listeners
    container.querySelectorAll('.btn-historial, .admin-view').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const d = btn.dataset;
        if (window.openPartidaHistory) window.openPartidaHistory(d.id, d.concept, Number(d.budget), Number(d.paid));
      });
    });

    container.querySelectorAll('.btn-solicitar-partida').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const d = btn.dataset;
        if (window.openPaymentFormForPartida) {
          window.openPaymentFormForPartida(d.id, d.concept, Number(d.budget), Number(d.paid), Number(d.pct), quoteId, displayId);
        }
      });
    });

  } catch (err) {
    showToast('Error al cargar partidas: ' + err.message);
  }
}

export async function addItemToQuote() {
  const concept  = document.getElementById('qp-new-concept')?.value?.trim();
  const unit     = document.getElementById('qp-new-unit')?.value?.trim() || 'u';
  const qty      = parseFloat(document.getElementById('qp-new-qty')?.value  || 0);
  const price    = parseFloat(document.getElementById('qp-new-price')?.value || 0);

  if (!concept) { showToast('El concepto es requerido'); return; }
  if (qty <= 0 || price <= 0) { showToast('Cantidad y precio deben ser mayores a 0'); return; }

  const btn = document.getElementById('btn-save-new-item');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    const result = await API.post(`/quotes/${State.currentQuotePartidasId}/items`, { concept, unit, quantity: qty, unitPrice: price });
    if (result.quoteResetToPending) {
      showToast('Partida agregada. El presupuesto volvió a Pendiente — el administrador deberá aprobarlo nuevamente.');
    } else {
      showToast('Partida agregada correctamente');
    }

    // Limpiar formulario y colapsar
    ['qp-new-concept','qp-new-unit','qp-new-qty','qp-new-price'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('qp-add-item-form').style.display  = 'none';

    // Refrescar pantalla
    renderQuotePartidas();
  } catch (err) {
    showToast('Error: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar Partida'; }
  }
}

export function openQuotePartidas(quoteId, displayId) {
  State.currentQuotePartidasId = quoteId;
  State.currentQuotePartidasDisplayId = displayId;
  renderQuotePartidas();
  navigateTo('quote-partidas');
}

export async function openNewQuoteModal() {
  if (!State.currentProjectId) { showToast('Selecciona un proyecto primero'); return; }

  document.getElementById('quote-method-step')?.classList.remove('hidden');
  document.getElementById('quote-form-step')?.classList.add('hidden');

  // Fecha automática = hoy
  const dateEl = document.getElementById('quote-date');
  if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

  // Número de presupuesto proveedor: contar existentes + 1 para preview
  try {
    const existing = await API.get(`/quotes?projectId=${State.currentProjectId}`);
    const nextNum  = (existing?.length || 0) + 1;
    const idEl     = document.getElementById('quote-display-id');
    if (idEl) idEl.value = `PP-${String(nextNum).padStart(3, '0')}`;
  } catch (_) {}

  // Limpiar campos del form
  ['quote-desc','quote-rfc'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('quote-items-rows').innerHTML = '';
  State._quoteScanFiles = [];

  openModal('modal-new-quote');
  addQuoteItemRow();
}

export function selectQuoteMethod(method) {
  if (method === 'scan') {
    _openNativeQuoteScanner();
    return;
  }

  if (method !== 'digital') { showToast('Disponible próximamente'); return; }
  document.getElementById('quote-method-step')?.classList.add('hidden');
  document.getElementById('quote-form-step')?.classList.remove('hidden');

  _autofillProviderFields();
}

function _openNativeQuoteScanner() {
  // Elimina instancia anterior si existe
  document.getElementById('native-scan-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'native-scan-overlay';
  overlay.innerHTML = `
    <div class="nscan-sheet">
      <div class="nscan-header">
        <span class="nscan-title">Escanear Presupuesto Proveedor</span>
        <button class="nscan-close" id="nscan-close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <p class="nscan-hint">El modo documento del teléfono recorta y corrige la perspectiva automáticamente.</p>

      <div class="nscan-options">
        <!-- Cámara nativa — activa modo documento en iOS/Android -->
        <label class="nscan-option" id="nscan-camera-label">
          <input type="file" id="nscan-camera-input"
            accept="image/*" capture="environment"
            multiple style="display:none" />
          <div class="nscan-option-icon nscan-blue">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          <span class="nscan-option-label">Cámara</span>
          <span class="nscan-option-sub">Modo documento</span>
        </label>

        <!-- Selector de archivos — PDF o imagen -->
        <label class="nscan-option" id="nscan-file-label">
          <input type="file" id="nscan-file-input"
            accept="image/*,.pdf" multiple style="display:none" />
          <div class="nscan-option-icon nscan-orange">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <span class="nscan-option-label">Subir archivo</span>
          <span class="nscan-option-sub">PDF o imagen</span>
        </label>
      </div>

      <div id="nscan-preview" class="nscan-preview"></div>

      <button class="btn-submit" id="nscan-attach" style="display:none;margin-top:12px;width:100%">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Adjuntar y completar presupuesto proveedor (<span id="nscan-count">0</span>)
      </button>
    </div>`;

  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '10000',
    background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  });

  document.body.appendChild(overlay);

  const files = [];

  const close = () => overlay.remove();
  document.getElementById('nscan-close').addEventListener('click', close);

  const handleFiles = async (rawFiles) => {
    const preview = document.getElementById('nscan-preview');
    preview.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;padding:12px;color:var(--primary);font-size:13px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite">
          <path d="M21 12a9 9 0 1 1-6.22-8.56"/>
        </svg>
        Analizando documento con IA...
      </div>`;

    for (const f of Array.from(rawFiles)) {
      if (f.size > 10 * 1024 * 1024) { showToast(`"${f.name}" supera 10 MB`); continue; }
      files.push(f);
    }

    if (files.length === 0) { preview.innerHTML = ''; return; }

    // Intentar extracción con Claude Vision (solo imágenes)
    const imageFile = files.find(f => f.type.startsWith('image/'));
    let extracted = null;

    if (imageFile) {
      try {
        const fd = new FormData();
        fd.append('file', imageFile);
        const res = await API.postForm('/quotes/extract', fd);

        if (res.available && !res.pdfNotSupported && res.items) {
          extracted = res;
        }
      } catch (_) { /* sin API key o error — modo manual */ }
    }

    // Preview de archivos
    preview.innerHTML = files.map(f => `
      <span style="display:inline-flex;align-items:center;gap:4px;background:rgba(0,20,137,.12);border:1px solid rgba(0,20,137,.3);border-radius:6px;padding:4px 10px;font-size:12px;color:var(--primary);margin:3px">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
        ${escapeHTML(f.name)}
      </span>`).join('');

    if (extracted) {
      preview.innerHTML += `
        <div style="margin-top:10px;padding:10px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);border-radius:8px;font-size:12px">
          <div style="color:#22C55E;font-weight:700;margin-bottom:4px">
            ✓ ${extracted.items.length} partida(s) detectada(s) — se llenarán automáticamente
          </div>
          ${extracted.companyName ? `<div style="color:var(--text-muted)">Empresa: ${escapeHTML(extracted.companyName)}</div>` : ''}
          ${extracted.rfc        ? `<div style="color:var(--text-muted)">RFC: ${escapeHTML(extracted.rfc)}</div>` : ''}
        </div>`;
    }

    // Guardar extracted para usarlo al adjuntar
    overlay._extracted = extracted;

    document.getElementById('nscan-count').textContent = files.length;
    const attachBtn = document.getElementById('nscan-attach');
    if (attachBtn) attachBtn.style.display = files.length > 0 ? 'block' : 'none';
  };

  document.getElementById('nscan-camera-input').addEventListener('change', e => handleFiles(e.target.files));
  document.getElementById('nscan-file-input').addEventListener('change',  e => handleFiles(e.target.files));

  document.getElementById('nscan-attach').addEventListener('click', () => {
    State._quoteScanFiles = [...files];
    const extracted = overlay._extracted || null;
    close();

    document.getElementById('quote-method-step')?.classList.add('hidden');
    document.getElementById('quote-form-step')?.classList.remove('hidden');
    _autofillProviderFields();
    _renderScanPreview(State._quoteScanFiles);

    if (extracted) {
      _fillFormFromExtraction(extracted);
      showToast(`✓ Formulario completado automáticamente — revisa y ajusta si es necesario`);
    } else {
      showToast(`${files.length} documento(s) adjunto(s). Completa los datos.`);
    }
  });
}

function _fillFormFromExtraction(data) {
  // Descripción / empresa
  if (data.companyName) {
    const el = document.getElementById('quote-desc');
    if (el) el.value = data.companyName;
  }
  // RFC
  if (data.rfc) {
    const el = document.getElementById('quote-rfc');
    if (el) el.value = data.rfc.toUpperCase();
  }
  // Fecha
  if (data.date) {
    const el = document.getElementById('quote-date');
    if (el) el.value = data.date;
  }

  // Partidas — limpiar las existentes y agregar las extraídas
  const container = document.getElementById('quote-items-rows');
  if (!container) return;
  container.innerHTML = '';

  (data.items || []).forEach(item => {
    addQuoteItemRow();
    const rows = container.querySelectorAll('.qi-row');
    const row  = rows[rows.length - 1];
    if (!row) return;

    const conceptEl = row.querySelector('.col-concept');
    const unitEl    = row.querySelector('.col-unit');
    const qtyEl     = row.querySelector('.col-qty');
    const priceEl   = row.querySelector('.col-price');

    if (conceptEl) {
      conceptEl.value = item.concept;
      // Ajustar altura del textarea
      conceptEl.style.height = 'auto';
      conceptEl.style.height = conceptEl.scrollHeight + 'px';
    }
    if (unitEl)  unitEl.value  = item.unit;
    if (qtyEl)   qtyEl.value   = item.quantity;
    if (priceEl) {
      priceEl.value = item.unitPrice;
      priceEl.dispatchEvent(new Event('input')); // recalcula totales
    }
  });

  // Recalcular totales
  document.querySelector('.col-qty')?.dispatchEvent(new Event('input'));
}

function _renderScanPreview(files) {
  // Busca o crea el contenedor de preview en el formulario
  let preview = document.getElementById('quote-scan-preview');
  if (!preview) {
    preview = document.createElement('div');
    preview.id = 'quote-scan-preview';
    const backBtn = document.getElementById('btn-back-quote-method');
    backBtn?.parentNode?.insertBefore(preview, backBtn.nextSibling);
  }
  if (!files || files.length === 0) { preview.innerHTML = ''; return; }
  preview.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 0 4px">
      <span style="font-size:11px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.4px">
        Documentos escaneados:
      </span>
      ${files.map(f => `
        <span style="display:inline-flex;align-items:center;gap:4px;background:rgba(0,20,137,.12);border:1px solid rgba(0,20,137,.3);border-radius:6px;padding:3px 9px;font-size:12px;color:var(--primary)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
          ${escapeHTML(f.name)}
        </span>`).join('')}
    </div>`;
}

function _autofillProviderFields() {
  const user = Auth.user;
  if (!user) return;
  const descEl = document.getElementById('quote-desc');
  if (descEl && !descEl.value) descEl.value = user.companyName || user.name || '';
  const rfcEl = document.getElementById('quote-rfc');
  if (rfcEl && !rfcEl.value && user.rfc) rfcEl.value = user.rfc;
}

export function backToQuoteMethod() {
  document.getElementById('quote-form-step')?.classList.add('hidden');
  document.getElementById('quote-method-step')?.classList.remove('hidden');
}

export function addQuoteItemRow() {
  const container = document.getElementById('quote-items-rows');
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'qi-row';
  row.innerHTML = `
    <div class="qi-concept-wrap">
      <textarea class="qi-input qi-textarea col-concept" placeholder="Descripción del concepto o trabajo a realizar..." rows="2"></textarea>
      <button type="button" class="qi-remove-btn" title="Eliminar fila">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="qi-nums-row">
      <div class="qi-field">
        <label class="qi-label">Unidad</label>
        <input type="text" class="qi-input col-unit" placeholder="m², pza, hr..." />
      </div>
      <div class="qi-field">
        <label class="qi-label">Cantidad</label>
        <input type="number" class="qi-input col-qty" placeholder="0" min="0" step="any" />
      </div>
      <div class="qi-field">
        <label class="qi-label">Precio Unit.</label>
        <input type="number" class="qi-input col-price" placeholder="0.00" min="0" step="any" />
      </div>
      <div class="qi-field qi-field-total">
        <label class="qi-label">Total</label>
        <span class="qi-row-total">$0.00</span>
      </div>
    </div>
  `;

  const updateRowTotal = () => {
    const qty   = parseFloat(row.querySelector('.col-qty')?.value   || 0);
    const price = parseFloat(row.querySelector('.col-price')?.value || 0);
    row.querySelector('.qi-row-total').textContent =
      '$' + (qty * price).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    recalcQuoteTotals();
  };

  row.querySelector('.qi-remove-btn').addEventListener('click', () => { row.remove(); recalcQuoteTotals(); });
  row.querySelector('.col-qty').addEventListener('input', updateRowTotal);
  row.querySelector('.col-price').addEventListener('input', updateRowTotal);

  // Auto-resize textarea
  const ta = row.querySelector('.col-concept');
  ta.addEventListener('input', () => {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  });

  container.appendChild(row);
  ta.focus();
}

function recalcQuoteTotals() {
  let subtotal = 0;
  document.querySelectorAll('#quote-items-rows .qi-row').forEach(row => {
    const qty   = parseFloat(row.querySelector('.col-qty')?.value   || 0);
    const price = parseFloat(row.querySelector('.col-price')?.value || 0);
    subtotal += qty * price;
  });
  const iva   = subtotal * 0.16;
  const total = subtotal + iva;
  const f = n => '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const el = id => document.getElementById(id);
  if (el('quote-subtotal-display')) el('quote-subtotal-display').textContent = f(subtotal);
  if (el('quote-iva-display'))      el('quote-iva-display').textContent      = f(iva);
  if (el('quote-calc-total'))       el('quote-calc-total').textContent       = f(total);
}

export async function createQuote() {
  const displayId = document.getElementById('quote-display-id')?.value?.trim();
  let desc  = document.getElementById('quote-desc')?.value?.trim();
  const date  = document.getElementById('quote-date')?.value;
  if (!desc || !date) { showToast('Completa la descripción y la fecha'); return; }

  if (displayId && !desc.startsWith('[')) {
    desc = `[${displayId}] ${desc}`;
  }

  const items = [];
  document.querySelectorAll('#quote-items-rows .qi-row').forEach(row => {
    const concept   = row.querySelector('.col-concept')?.value?.trim();
    const unit      = row.querySelector('.col-unit')?.value?.trim() || 'u';
    const quantity  = parseFloat(row.querySelector('.col-qty')?.value   || 0);
    const unitPrice = parseFloat(row.querySelector('.col-price')?.value || 0);
    if (concept && quantity > 0 && unitPrice > 0) items.push({ concept, unit, quantity, unitPrice });
  });
  if (items.length === 0) { showToast('Agrega al menos una partida válida'); return; }

  const btn = document.getElementById('btn-save-quote');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  try {
    await API.post('/quotes', { projectId: State.currentProjectId, description: desc, date, items });
    closeModal('modal-new-quote');
    showToast('Presupuesto Proveedor creada exitosamente');
    renderQuotes(State.currentProjectId);
  } catch (err) {
    showToast('Error: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar Presupuesto Proveedor'; }
  }
}

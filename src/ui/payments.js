/**
 * CROIVA - Payments UI Component
 */

import { Auth, API } from '../api.js';
import { State } from '../state.js';
import { 
  fmt, fmtDate, escapeHTML, setLoading, 
  showToast, emptyState, statusLabel 
} from '../utils.js';
import { navigateTo, goBack } from '../router.js';

export async function renderPaymentsList(pid) {
  setLoading('payments-list');
  try {
    const payments = await API.get(`/payments?projectId=${pid}`) || [];
    const container = document.getElementById('payments-list');
    container.innerHTML = '';

    if (payments.length === 0) {
      container.innerHTML = emptyState('Sin solicitudes de pago', 'No hay solicitudes registradas para este proyecto');
      return;
    }

    container.innerHTML = payments.map(pay => {
      const statusClass = (pay.status || '').toLowerCase();
      const providerName = pay.provider?.name || 'Proveedor';
      const filesCount   = pay.files?.length || 0;
      const progress     = Math.min(100, Math.max(0, Number(pay.progress) || 0));

      const actionBtns = (Auth.isAdmin() && pay.status === 'PENDING') ? `
        <div class="pc-actions">
          <button class="btn-approve" data-id="${pay.id}" data-action="approve">✓ Aprobar</button>
          <button class="btn-reject"  data-id="${pay.id}" data-action="reject">✕ Rechazar</button>
        </div>` : `<span class="status-badge ${statusClass}">${statusLabel(pay.status)}</span>`;

      return `
        <div class="payment-card">
          <div class="pc-top">
            <div class="pc-provider-name">${escapeHTML(providerName)}</div>
            <div class="pc-amount-req">${fmt(pay.amount)}</div>
          </div>
          <div class="pc-bottom">
            <div class="pc-concept">${escapeHTML(pay.concept)}</div>
            ${actionBtns}
          </div>
          <div class="pc-progress-mini">
            <div class="ppm-bar"><div class="ppm-fill" style="width:${progress}%"></div></div>
            <div class="ppm-label">Avance físico: ${progress}% | ${filesCount} archivo(s) adjunto(s)</div>
          </div>
        </div>`;
    }).join('');

    // Attach listeners
    container.querySelectorAll('.btn-approve, .btn-reject').forEach(btn => {
      btn.addEventListener('click', () => {
        const { id, action } = btn.dataset;
        reviewPayment(id, action);
      });
    });

  } catch (err) {
    showToast('Error al cargar solicitudes: ' + err.message);
  }
}

export async function renderSolicitudesList(filter) {
  // Show admin view, hide provider view
  document.getElementById('solicitudes-admin-view')?.classList.remove('hidden');
  document.getElementById('solicitudes-provider-view')?.classList.add('hidden');

  const container = document.getElementById('solicitudes-list');
  setLoading('solicitudes-list');
  try {
    const payments = await API.get('/payments') || [];
    State.allPayments = payments;
  } catch (err) {
    showToast('Error al cargar solicitudes: ' + err.message);
    return;
  }
  // Update counters
  const counts = {
    PENDING:  State.allPayments.filter(p => p.status === 'PENDING').length,
    APPROVED: State.allPayments.filter(p => p.status === 'APPROVED').length,
    REJECTED: State.allPayments.filter(p => p.status === 'REJECTED').length
  };

  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setVal('sol-count-pending',  counts.PENDING);
  setVal('sol-count-approved', counts.APPROVED);
  setVal('sol-count-rejected', counts.REJECTED);
  setVal('sol-tab-count-pending',  counts.PENDING);
  setVal('sol-tab-count-approved', counts.APPROVED);
  setVal('sol-tab-count-rejected', counts.REJECTED);

  // Sync tab active state if coming from direct navigation
  if (filter !== 'all') {
    ['PENDING','APPROVED','REJECTED'].forEach(s => {
      const tab = document.getElementById(`sol-tab-${s.toLowerCase()}`);
      if (tab) tab.classList.toggle('active', s === filter);
    });
  }

  const filtered = State.allPayments.filter(p => filter === 'all' ? true : p.status === filter);

  if (filtered.length === 0) {
    container.innerHTML = emptyState('Sin solicitudes', `No hay solicitudes ${statusLabel(filter).toLowerCase()}`);
    return;
  }

  container.innerHTML = filtered.map((pay) => {
    const globalIdx = State.allPayments.findIndex(p => p.id === pay.id);
    const prId    = globalIdx >= 0 ? `PR-${String(globalIdx + 1).padStart(3, '0')}` : 'PR-???';
    const project = pay.project?.name || 'Proyecto';
    const partida = pay.items?.[0]?.quoteItem?.concept || pay.concept;
    const iconHtml = pay.status === 'PENDING'
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
      : pay.status === 'APPROVED'
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    const iconColor = pay.status === 'PENDING' ? 'sol-icon-yellow' : pay.status === 'APPROVED' ? 'sol-icon-green' : 'sol-icon-red';

    return `
      <div class="sol-card" data-id="${pay.id}">
        <div class="sol-card-top">
          <div class="sol-status-icon ${iconColor}">${iconHtml}</div>
          <div class="sol-card-info">
            <div class="sol-card-id">${prId}</div>
            <div class="sol-card-partida">${escapeHTML(partida)}</div>
          </div>
          <div class="sol-card-amount">${fmt(pay.amount)}</div>
        </div>
        <div class="sol-card-meta">
          <span>📋 ${escapeHTML(project)}</span>
          <span>👤 ${escapeHTML(pay.provider?.name || '—')}</span>
          <span>📅 ${fmtDate(pay.createdAt)}</span>
          ${pay.progress ? `<span>⚡ Avance: ${pay.progress}%</span>` : ''}
        </div>
        ${pay.status === 'PENDING' ? '<div class="sol-card-cta">Toca para revisar →</div>' : ''}
      </div>`;
  }).join('');

  // Attach card listeners
  container.querySelectorAll('.sol-card').forEach(card => {
    card.addEventListener('click', () => {
      openPRDetail(card.dataset.id);
    });
  });
}

export async function renderSolicitudesProviderList() {
  // Show provider view, hide admin view
  document.getElementById('solicitudes-provider-view')?.classList.remove('hidden');
  document.getElementById('solicitudes-admin-view')?.classList.add('hidden');

  const container = document.getElementById('solicitudes-provider-list');
  setLoading('solicitudes-provider-list');
  try {
    const payments = await API.get('/payments') || [];
    State.allPayments = payments;
  } catch (err) {
    showToast('Error al cargar solicitudes: ' + err.message);
    return;
  }
  const anchor = document.getElementById('prov-sol-active-tab');
  const tab = anchor?.dataset?.status || 'ALL';
  const list = tab === 'ALL' ? State.allPayments : State.allPayments.filter(p => p.status === tab);

  if (list.length === 0) {
    container.innerHTML = emptyState(
      tab === 'ALL' ? 'Sin solicitudes enviadas' : `Sin solicitudes ${statusLabel(tab).toLowerCase()}`,
      'Tus solicitudes de pago aparecerán aquí'
    );
    return;
  }
  container.innerHTML = list.map((pay, i) => {
    const statusColor = pay.status === 'APPROVED' ? '#22C55E' : pay.status === 'PENDING' ? '#FBBF24' : '#F87171';
    const iconSvg = pay.status === 'APPROVED'
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
      : pay.status === 'PENDING'
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    const prId = `PR-${String(i + 1).padStart(3, '0')}`;
    const project = pay.project?.name || '—';
    const concept = pay.items?.[0]?.quoteItem?.concept || pay.concept || '—';
    return `
      <div class="sol-card" data-id="${pay.id}">
        <div class="sol-card-top">
          <div class="sol-status-icon" style="background:${statusColor}20;color:${statusColor}">${iconSvg}</div>
          <div class="sol-card-info">
            <div class="sol-card-id">${prId}</div>
            <div class="sol-card-partida">${escapeHTML(concept)}</div>
            <div class="sol-card-meta" style="margin-top:4px">
              <span>📋 ${escapeHTML(project)}</span>
              <span>📅 ${fmtDate(pay.createdAt)}</span>
              ${pay.progress ? `<span>⚡ ${pay.progress}%</span>` : ''}
            </div>
            ${pay.rejectedReason ? `<div class="prov-rejection-note">Rechazado: ${escapeHTML(pay.rejectedReason)}</div>` : ''}
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div class="sol-card-amount">${fmt(pay.amount)}</div>
            <span class="ph-pay-badge" style="background:${statusColor}20;color:${statusColor};margin-top:4px;display:inline-block">${statusLabel(pay.status)}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  // Attach card listeners
  container.querySelectorAll('.sol-card').forEach(card => {
    card.addEventListener('click', () => {
      openPRDetail(card.dataset.id);
    });
  });
}

export async function renderPRDetail() {
  if (!State.currentPaymentId) return;

  if (!State.currentPaymentData) {
    try {
      State.currentPaymentData = await API.get(`/payments/${State.currentPaymentId}`);
    } catch (err) {
      showToast('Error al cargar detalle: ' + err.message);
      return;
    }
  }

  const pay = State.currentPaymentData;
  const prIndex = State.allPayments.findIndex(p => p.id === pay.id);
  
  const idEl = document.getElementById('prd-id');
  if (idEl) idEl.textContent = prIndex >= 0 ? `PR-${String(prIndex + 1).padStart(3, '0')}` : 'PR-???';

  const statusEl = document.getElementById('prd-status');
  if (statusEl) {
    statusEl.textContent = statusLabel(pay.status);
    statusEl.className   = 'detail-status ' + pay.status.toLowerCase();
  }

  // Datos del proveedor
  document.getElementById('prd-provider-name').textContent  = pay.provider?.name        || '—';
  document.getElementById('prd-provider-email').textContent = pay.provider?.email       || '—';
  const companyEl = document.getElementById('prd-provider-company');
  if (companyEl) companyEl.textContent = pay.provider?.companyName || '';
  const rfcEl = document.getElementById('prd-provider-rfc');
  if (rfcEl) rfcEl.textContent = pay.provider?.rfc ? `RFC: ${pay.provider.rfc}` : '';

  document.getElementById('prd-project').textContent = pay.project?.name || '—';

  // Presupuesto Proveedor
  const quoteNumEl = document.getElementById('prd-quote-num');
  if (quoteNumEl && pay.quote) {
    const qn = pay.quote.quoteNumber ? `PP-${String(pay.quote.quoteNumber).padStart(3,'0')}` : '—';
    quoteNumEl.textContent = `${qn} — ${pay.quote.description || ''}`;
  }

  document.getElementById('prd-concept').textContent  = pay.concept    || '—';
  document.getElementById('prd-progress').textContent = `${pay.progress || 0}%`;

  // Monto autorizado (si existe)
  const authRow = document.getElementById('prd-authorized-row');
  if (authRow) {
    if (pay.authorizedAmount != null && Math.abs(pay.authorizedAmount - pay.amount) > 0.01) {
      authRow.style.display = 'flex';
      document.getElementById('prd-authorized-amount').textContent = fmt(pay.authorizedAmount);
    } else {
      authRow.style.display = 'none';
    }
  }

  // Partidas — con campo de monto autorizado por partida (solo admin + PENDING)
  const itemsSec  = document.getElementById('prd-items-section');
  const itemsList = document.getElementById('prd-items-list');
  const isPending = pay.status === 'PENDING';
  const isAdmin   = Auth.isAdmin();

  if (pay.items && pay.items.length > 0) {
    itemsList.innerHTML = pay.items.map((it, i) => {
      const concept   = escapeHTML(it.quoteItem?.concept || '—');
      const unit      = escapeHTML(it.quoteItem?.unit || '');
      const pu        = it.unitPrice || it.quoteItem?.unitPrice || 0;
      const code      = `P${String(i + 1).padStart(3,'0')}`;
      const authValue = it.authorizedAmount != null ? it.authorizedAmount : '';

      return `
        <div class="prd-item-row" data-item-id="${it.id}">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="font-size:10px;font-weight:700;color:var(--primary);background:rgba(0,20,137,.1);padding:2px 6px;border-radius:4px">${code}</span>
            <span style="font-size:13px;font-weight:600">${concept}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;font-size:12px;color:var(--text-muted);margin-bottom:6px">
            <div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.4px">Cant.</div><strong style="color:var(--text-primary)">${it.quantity || 0} ${unit}</strong></div>
            <div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.4px">P.U.</div><strong style="color:var(--text-primary)">${fmt(pu)}</strong></div>
            <div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.4px">Importe</div><strong style="color:var(--text-primary)">${fmt(it.amount)}</strong></div>
            <div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.4px">Avance</div><strong style="color:var(--primary)">${it.progress}%</strong></div>
          </div>
          ${isAdmin && isPending ? `
          <div class="prd-auth-row">
            <label class="prd-auth-label">Monto autorizado:</label>
            <input type="number" class="prd-auth-input" placeholder="${fmt(it.amount)}" value="${authValue}" min="0" step="any" style="max-width:140px" />
          </div>` : it.authorizedAmount != null ? `
          <div style="font-size:12px;color:var(--primary);font-weight:600;margin-top:4px">Autorizado: ${fmt(it.authorizedAmount)}</div>` : ''}
        </div>`;
    }).join('');
    itemsSec.style.display = 'block';
  } else {
    itemsSec.style.display = 'none';
  }

  const gallery = document.getElementById('prd-gallery');
  if (pay.files && pay.files.length > 0) {
    // Renderiza placeholders mientras se obtienen las URLs firmadas
    gallery.innerHTML = pay.files.map(f => {
      const isImage = f.mimeType?.startsWith('image/');
      return `<div class="prd-file-entry" data-file-id="${escapeHTML(f.id)}" data-mime="${escapeHTML(f.mimeType || '')}">
        ${isImage
          ? `<div class="prd-photo-placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.4"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`
          : `<div class="prd-file-chip"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>${escapeHTML(f.filename)}</div>`}
      </div>`;
    }).join('');

    // Obtiene URLs firmadas en paralelo y las inyecta
    pay.files.forEach(async (f) => {
      try {
        const { url } = await API.get(`/payments/files/${f.id}/url`);
        const entry = gallery.querySelector(`[data-file-id="${f.id}"]`);
        if (!entry || !url) return;

        if (f.mimeType?.startsWith('image/')) {
          const img = document.createElement('img');
          img.className = 'prd-photo';
          img.alt = f.filename;
          img.src = url;
          img.addEventListener('click', () => window.open(url, '_blank'));
          entry.replaceWith(img);
        } else {
          entry.querySelector('.prd-file-chip')?.addEventListener('click', () => window.open(url, '_blank'));
        }
      } catch (_) { /* silencioso — el placeholder queda */ }
    });

  } else {
    gallery.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Sin evidencia adjunta</p>';
  }

  const total    = Number(pay.amount);
  const subtotal = total / 1.16;
  const iva      = total - subtotal;
  document.getElementById('prd-subtotal').textContent = fmt(subtotal);
  document.getElementById('prd-iva').textContent      = fmt(iva);
  document.getElementById('prd-total').textContent    = fmt(total);

  const actionsEl = document.getElementById('prd-actions');
  if (Auth.isAdmin() && pay.status === 'PENDING') {
    actionsEl.classList.remove('hidden');
  } else {
    actionsEl.classList.add('hidden');
  }
}

export async function renderPartidaHistory() {
  if (!State.currentPartidaData) { goBack(); return; }
  const { id, concept, presupuesto, pagado } = State.currentPartidaData;

  const titleEl    = document.getElementById('ph-title');
  const subtitleEl = document.getElementById('ph-subtitle');
  if (titleEl)    titleEl.textContent    = concept || 'Historial de Pagos';
  if (subtitleEl) subtitleEl.textContent = `Partida • ${fmt(presupuesto)}`;

  const disponible = presupuesto - pagado;
  const pct        = Math.min(100, Math.round((pagado / (presupuesto || 1)) * 100));

  const sumCard = document.getElementById('ph-summary-card');
  if (sumCard) {
    sumCard.style.display = 'block';
    document.getElementById('ph-budget').textContent    = fmt(presupuesto);
    document.getElementById('ph-paid').textContent      = fmt(pagado);
    document.getElementById('ph-available').textContent = fmt(disponible);

    let barColor;
    if (pct === 0)      barColor = '#6B7280';
    else if (pct < 50)  barColor = '#F59E0B';
    else if (pct < 75)  barColor = '#FF6B35';
    else if (pct < 100) barColor = '#E85D04';
    else                barColor = '#22C55E';

    const barEl = document.getElementById('ph-bar');
    if (barEl) { barEl.style.width = `${pct}%`; barEl.style.background = barColor; }
    const pctEl = document.getElementById('ph-pct');
    if (pctEl) pctEl.textContent = `${pct}% ejecutado`;
  }

  const listEl = document.getElementById('ph-list');
  listEl.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted)">Cargando historial...</div>';

  try {
    const allPayments = await API.get('/payments').catch(() => []);
    const relevant    = (Array.isArray(allPayments) ? allPayments : []).filter(
      p => (p.items || []).some(pi => pi.quoteItemId === id)
    );

    if (relevant.length === 0) {
      listEl.innerHTML = emptyState('Sin pagos registrados', 'No hay solicitudes de pago para esta partida aún.');
      return;
    }

    listEl.innerHTML = relevant.map((pay, i) => {
      const statusColor = pay.status === 'APPROVED' ? '#22C55E' : pay.status === 'PENDING' ? '#FBBF24' : '#F87171';
      const statusIcon  = pay.status === 'APPROVED'
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
        : pay.status === 'PENDING'
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

      return `
        <div class="ph-payment-card">
          <div class="ph-pay-top">
            <div class="ph-pay-status-icon" style="color:${statusColor};background:${statusColor}20">${statusIcon}</div>
            <div class="ph-pay-info">
              <div class="ph-pay-id">PR-${String(i + 1).padStart(3, '0')} • ${fmtDate(pay.createdAt)}</div>
              <div class="ph-pay-amount">${fmt(pay.amount)}</div>
            </div>
            <span class="ph-pay-badge" style="background:${statusColor}20;color:${statusColor}">${statusLabel(pay.status)}</span>
          </div>
          ${pay.progress ? `<div class="ph-pay-progress">Avance reportado: <strong>${pay.progress}%</strong></div>` : ''}
          ${pay.notes ? `<div class="ph-pay-notes">${escapeHTML(pay.notes)}</div>` : ''}
          ${pay.rejectedReason ? `<div class="ph-pay-rejection">Motivo rechazo: ${escapeHTML(pay.rejectedReason)}</div>` : ''}
        </div>`;
    }).join('');
  } catch (err) {
    listEl.innerHTML = emptyState('Error', err.message);
  }
}

export function openPaymentFormForPartida(itemId, concept, presupuesto, pagado, currentPct, quoteId, quoteDisplayId) {
  State.currentPartidaData = { id: itemId, concept, presupuesto, pagado, currentPct, quoteId, quoteDisplayId };
  API.get(`/quotes/${quoteId}`).then(q => {
    if (q && q.projectId) {
      State.currentPartidaData.projectId = q.projectId;
      State.currentPartidaData.projectName = q.project?.name || '';
    }
  }).catch(() => {});
  navigateTo('payment-form');
}

export async function openPRDetail(id) {
  State.currentPaymentId = id;
  State.currentPaymentData = State.allPayments.find(p => p.id === id) || null;
  navigateTo('pr-detail');
  // Render content after navigation so screen is visible
  renderPRDetail();
}

export async function reviewPayment(payId, action) {
  try {
    await API.patch(`/payments/${payId}/${action}`, {});
    showToast(action === 'approve' ? 'Pago aprobado exitosamente ✓' : 'Solicitud rechazada');
    renderPaymentsList(State.currentProjectId);
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

export function filterSolicitudes(status) {
  State.currentSolicitudesFilter = status;
  const filterVal = (status === 'all') ? 'all' : status;
  ['PENDING','APPROVED','REJECTED'].forEach(s => {
    const tab = document.getElementById(`sol-tab-${s.toLowerCase()}`);
    if (tab) tab.classList.toggle('active', s === status);
  });
  renderSolicitudesList(filterVal);
}

export function filterProviderSolicitudes(status, btn) {
  document.querySelectorAll('[id^="prov-sol-tab-"]').forEach(el => el.classList.remove('active'));
  btn?.classList.add('active');
  const anchor = document.getElementById('prov-sol-active-tab');
  if (anchor) anchor.dataset.status = status;
  renderSolicitudesProviderList();
}

export async function approveFromDetail() {
  const id = State.currentPaymentId;
  if (!id) return;

  // Recopilar montos autorizados por partida (si el admin los llenó)
  const itemAuthorizations = [];
  document.querySelectorAll('#prd-items-list .prd-item-row').forEach(row => {
    const input = row.querySelector('.prd-auth-input');
    if (!input) return;
    const val = parseFloat(input.value);
    if (!isNaN(val) && val >= 0) {
      itemAuthorizations.push({ id: row.dataset.itemId, authorizedAmount: val });
    }
  });

  // Monto autorizado total: suma de partidas autorizadas, o el monto original si no se tocó
  let authorizedAmount;
  if (itemAuthorizations.length > 0) {
    authorizedAmount = itemAuthorizations.reduce((s, it) => s + it.authorizedAmount, 0);
  }

  try {
    await API.patch(`/payments/${id}/approve`, {
      ...(authorizedAmount != null && { authorizedAmount }),
      ...(itemAuthorizations.length > 0 && { itemAuthorizations }),
    });

    const amountMsg = authorizedAmount != null
      ? `Pago aprobado — Monto autorizado: ${authorizedAmount.toLocaleString('es-MX', { style:'currency', currency:'MXN' })}`
      : 'Pago aprobado exitosamente ✓';
    showToast(amountMsg);

    State.currentPaymentData = null;
    // Navigate back to solicitudes list and refresh it
    const nextFilter = State.currentSolicitudesFilter || 'PENDING';
    navigateTo('solicitudes');
    renderSolicitudesList(nextFilter);
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

export async function rejectFromDetail() {
  const id = State.currentPaymentId;
  if (!id) return;
  const reason = prompt('Motivo del rechazo (opcional):') || '';
  try {
    await API.patch(`/payments/${id}/reject`, { reason });
    showToast('Solicitud rechazada');
    State.currentPaymentData = null;
    // Navigate back to solicitudes list and refresh it
    const nextFilter = State.currentSolicitudesFilter || 'PENDING';
    navigateTo('solicitudes');
    renderSolicitudesList(nextFilter);
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

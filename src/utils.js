/**
 * CROIVA - Utility Functions
 */

export function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function fmt(n) {
  const num = Number(n);
  if (isNaN(num)) return '$0';
  // Formato explícito: separador de miles con coma, 2 decimales solo si los tiene
  const abs = Math.abs(num);
  const decimals = abs % 1 !== 0 ? 2 : 0;
  return (num < 0 ? '-$' : '$') +
    abs.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: 2 });
}

export function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function progressClass(pct) {
  if (pct < 30) return 'low';
  if (pct < 70) return 'mid';
  return 'high';
}

export function getProjectIcon(type) {
  const t = (type || '').toLowerCase();
  const icons = {
    residential: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    commercial:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    industrial:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="1"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="17"/><line x1="9.5" y1="14.5" x2="14.5" y2="14.5"/></svg>`,
    infrastructure: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>`,
  };
  return icons[t] || icons.commercial;
}

export function typeLabel(t) {
  const m = { residential:'Residencial', commercial:'Comercial', industrial:'Industrial', infrastructure:'Infraestructura' };
  return m[(t||'').toLowerCase()] || t;
}

export function statusLabel(s) {
  const m = { 
    approved: 'Aprobado', pending: 'Pendiente', rejected: 'Rechazado',
    APPROVED: 'Aprobado', PENDING: 'Pendiente', REJECTED: 'Rechazado',
    PAID: 'Pagado', all: 'registradas', ALL: 'registradas'
  };
  return m[s] || s;
}

export function emptyState(title, desc) {
  return `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="margin-bottom:12px;opacity:0.35"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
    <p style="font-size:15px;font-weight:600;color:var(--text-secondary);margin-bottom:6px">${title}</p>
    <p style="font-size:13px">${desc}</p>
  </div>`;
}

const SKELETONS = {
  'projects-grid': () => Array(3).fill(`
    <div class="sk-card">
      <div class="sk-row"><div class="sk-circle"></div><div class="sk-lines"><div class="sk-line w70"></div><div class="sk-line w40"></div></div></div>
      <div class="sk-line w100" style="margin-top:12px"></div><div class="sk-line w60" style="margin-top:8px"></div>
      <div class="sk-bar" style="margin-top:12px"></div>
    </div>`).join(''),
  'projects-list-full': () => Array(4).fill(`
    <div class="sk-list-item">
      <div class="sk-circle sm"></div>
      <div class="sk-lines flex1"><div class="sk-line w60"></div><div class="sk-line w40" style="margin-top:6px"></div></div>
      <div class="sk-lines" style="align-items:flex-end"><div class="sk-line w50"></div></div>
    </div>`).join(''),
  'quotes-list': () => Array(2).fill(`
    <div class="sk-card" style="margin-bottom:10px">
      <div class="sk-row"><div class="sk-line w30"></div><div class="sk-line w20" style="margin-left:auto"></div></div>
      <div class="sk-bar" style="margin-top:10px"></div>
      <div class="sk-line w80" style="margin-top:10px"></div><div class="sk-line w60" style="margin-top:6px"></div>
    </div>`).join(''),
  'solicitudes-list': () => Array(3).fill(`
    <div class="sk-list-item">
      <div class="sk-circle sm"></div>
      <div class="sk-lines flex1"><div class="sk-line w50"></div><div class="sk-line w70" style="margin-top:6px"></div></div>
      <div class="sk-line w20"></div>
    </div>`).join(''),
  'qp-partidas-list': () => Array(3).fill(`
    <div class="sk-card" style="margin-bottom:8px">
      <div class="sk-line w60"></div><div class="sk-bar" style="margin-top:8px"></div>
    </div>`).join(''),
};

export function setLoading(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const skeleton = SKELETONS[containerId];
  el.innerHTML = skeleton
    ? `<div class="sk-wrapper">${skeleton()}</div>`
    : `<div style="text-align:center;padding:32px;color:var(--text-muted)">
         <div class="sk-line w40" style="margin:0 auto 8px"></div>
         <div class="sk-line w60" style="margin:0 auto"></div>
       </div>`;
}

export function formatAmount(input) {
  let v = input.value.replace(/[^0-9.]/g, '');
  const parts = v.split('.');
  if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
  input.value = v;
}

export function calcPct(spent, budget) {
  const s = Number(spent);
  const b = Number(budget);
  if (!b || b <= 0) return 0;
  return Math.min(Math.round((s / b) * 100), 999);
}

// Avance físico del proyecto = promedio ponderado por monto de cada presupuesto proveedor.
// Avance por presupuesto = promedio ponderado del progress de sus partidas (por importe de partida).
export function calcProjectProgress(project) {
  const quotes = project.quotes || [];
  if (quotes.length === 0) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  quotes.forEach(q => {
    const quoteAmount = Number(q.amount) || 0;
    const items = q.items || [];
    let quoteProgress = 0;

    if (items.length > 0) {
      let itemBudget = 0;
      let itemWeighted = 0;
      items.forEach(it => {
        const budget   = Number(it.quantity) * Number(it.unitPrice);
        const progress = it.paymentItems?.[0]?.progress || 0;
        itemBudget   += budget;
        itemWeighted += progress * budget;
      });
      quoteProgress = itemBudget > 0 ? itemWeighted / itemBudget : 0;
    }

    totalWeight += quoteAmount;
    weightedSum += quoteProgress * quoteAmount;
  });

  if (totalWeight === 0) return 0;
  return Math.min(Math.round(weightedSum / totalWeight), 100);
}

export function setCurrentDate() {
  const el = document.getElementById('current-date');
  if (!el) return;
  const now  = new Date();
  const days   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  el.textContent = `${days[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]} ${now.getFullYear()}`;
  
  // Also for provider if exists
  const provEl = document.getElementById('provider-current-date');
  if (provEl) provEl.textContent = el.textContent;
}

export function showToast(message, duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
    </svg>
    <span></span>
  `;
  toast.querySelector('span').textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// Modal helpers — CSS usa clase "visible" para mostrar/ocultar
export function openModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.add('visible');
}

export function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.remove('visible');
}

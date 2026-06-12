/**
 * CROIVA - Dashboard UI Component
 */

import { Auth, API, isSystemOpen } from '../api.js';
import { fmt, getProjectIcon, typeLabel, calcProjectProgress, progressClass, escapeHTML, setLoading, showToast } from '../utils.js';
import { navigateTo } from '../router.js';
import { State } from '../state.js';

export async function renderDashboard() {
  setLoading('projects-grid');

  const providerHero = document.getElementById('provider-dashboard-hero');
  if (Auth.isProvider()) {
    providerHero?.classList.remove('hidden');
    document.querySelectorAll('.financial-banner').forEach(el => el.style.display = 'none');
    
    const pNameEl = document.getElementById('provider-name-display');
    if (pNameEl) pNameEl.textContent = (Auth.user.name || 'Proveedor').split(' ')[0];
    
    const pDateEl = document.getElementById('provider-current-date');
    if (pDateEl) {
      const now = new Date();
      const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
      const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      pDateEl.textContent = `${days[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]}`;
    }

    const windowEl = document.getElementById('phb-window-status');
    const windowText = document.getElementById('phb-window-text');
    if (windowEl) {
      windowEl.style.display = 'flex';
      if (isSystemOpen()) {
        windowEl.className = 'phb-window-open';
        if (windowText) windowText.textContent = 'Ventana de pagos abierta (Lunes–Jueves)';
      } else {
        windowEl.className = 'phb-window-closed';
        if (windowText) windowText.textContent = 'Ventana cerrada. Reabre el Lunes a las 9 AM';
      }
    }
  } else {
    providerHero?.classList.add('hidden');
    document.querySelectorAll('.financial-banner').forEach(el => el.style.display = 'block');
  }

  try {
    const projects = await API.get('/projects');
    if (!projects) return;

    if (Auth.isProvider()) {
      const [allQuotes, allPayments] = await Promise.all([
        API.get('/quotes').catch(() => []),
        API.get('/payments').catch(() => []),
      ]);
      const approvedQuotes = (allQuotes || []).filter(q => q.status === 'APPROVED');
      const totalGanancias = approvedQuotes.reduce((s, q) => s + Number(q.amount), 0);
      const approvedPayments = (allPayments || []).filter(p => p.status === 'APPROVED');
      const totalPaid = approvedPayments.reduce((s, p) => s + Number(p.amount), 0);

      const earningsEl = document.getElementById('provider-earnings');
      const paidEl = document.getElementById('provider-paid-total');
      if (earningsEl) earningsEl.textContent = fmt(totalGanancias);
      if (paidEl) paidEl.textContent = fmt(totalPaid);

      document.getElementById('active-projects-count').textContent = projects.length;
      document.getElementById('pending-requests-count').textContent = (allPayments || []).filter(p => p.status === 'PENDING').length;
      document.getElementById('paid-count').textContent = approvedPayments.length;
    } else {
      const totalBudget  = projects.reduce((s, p) => s + Number(p.budget), 0);
      const totalSpent   = projects.reduce((s, p) => s + Number(p.spent), 0);
      document.getElementById('total-investment').textContent = fmt(totalBudget);
      document.getElementById('total-profits').textContent    = fmt(totalBudget - totalSpent);
      document.getElementById('active-projects-count').textContent = projects.length;

      // Fetch payments en paralelo con el render del grid
      API.get('/payments').then(payments => {
        if (!payments) return;
        document.getElementById('pending-requests-count').textContent = payments.filter(p => p.status === 'PENDING').length;
        document.getElementById('paid-count').textContent             = payments.filter(p => p.status === 'APPROVED').length;
      }).catch(() => {});
    }

    const grid = document.getElementById('projects-grid');
    if (projects.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-folder-open"></i></div>
          <h3>Aún no hay proyectos</h3>
          <p>${Auth.isAdmin() ? 'Comienza creando tu primer proyecto de construcción.' : 'Aún no tienes proyectos asignados.'}</p>
          ${Auth.isAdmin() ? '<button class="btn-primary" onclick="window.newProject()"><i class="fas fa-plus"></i> Crear Proyecto</button>' : ''}
        </div>`;
      return;
    }

    grid.innerHTML = projects.map(p => {
      const pct = calcProjectProgress(p);
      const cls = progressClass(pct);
      const type = (p.type || '').toLowerCase();
      return `
        <div class="project-card" data-id="${p.id}">
          <div class="pc-header">
            <div class="pc-icon ${escapeHTML(type)}">${getProjectIcon(type)}</div>
            <div>
              <div class="pc-name">${escapeHTML(p.name)}</div>
              <div class="pc-type">${escapeHTML(typeLabel(type))}</div>
            </div>
          </div>
          <div class="pc-kpi">
            <div class="pc-kpi-label">Presupuesto</div>
            <div class="pc-kpi-value">${fmt(p.budget)}</div>
          </div>
          <div class="pc-kpi">
            <div class="pc-kpi-label">Gastado</div>
            <div class="pc-kpi-value spent">${fmt(p.spent)}</div>
          </div>
          <div class="pc-kpi">
            <div class="pc-kpi-label">Saldo</div>
            <div class="pc-kpi-value balance">${fmt(Number(p.budget) - Number(p.spent))}</div>
          </div>
          <div class="pc-progress">
            <div class="pc-progress-bar"><div class="pc-progress-fill ${cls}" style="width:${pct}%"></div></div>
            <div class="pc-percent">${pct}% utilizado</div>
          </div>
        </div>`;
    }).join('');

    // Attach card listeners
    grid.querySelectorAll('.project-card').forEach(card => {
      card.addEventListener('click', () => {
        if (window.openProject) window.openProject(card.dataset.id);
      });
    });

    const adminBtnUser = document.getElementById('btn-new-user');
    const adminBtnProj = document.getElementById('btn-new-project');
    if (adminBtnUser) adminBtnUser.style.display = Auth.isAdmin() ? 'flex' : 'none';
    if (adminBtnProj) adminBtnProj.style.display = Auth.isAdmin() ? 'flex' : 'none';

    const nameEl = document.getElementById('user-name-display');
    if (nameEl) nameEl.textContent = Auth.user.name.split(' ')[0];

  } catch (err) {
    const grid = document.getElementById('projects-grid');
    if (grid) grid.innerHTML = `<div class="empty-state"><div class="empty-icon" style="color:var(--danger)"><i class="fas fa-exclamation-triangle"></i></div><h3>Error</h3><p>${err.message}</p></div>`;
    showToast('Error al cargar el dashboard: ' + err.message);
  }
}

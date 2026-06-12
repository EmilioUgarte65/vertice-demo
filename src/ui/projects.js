/**
 * CROIVA - Projects UI Component
 */

import { Auth, API } from '../api.js';
import { State } from '../state.js';
import {
  fmt, getProjectIcon, typeLabel, calcProjectProgress,
  escapeHTML, setLoading, showToast, emptyState
} from '../utils.js';
import { navigateTo } from '../router.js';

import { renderQuotes } from './quotes.js';
import { renderPaymentsList } from './payments.js';
import { renderPartidaHistory } from './payments.js'; // I'll move this to payments.js in next step

export async function renderProjectsList() {
  setLoading('projects-list-full');
  
  const adminBtn = document.getElementById('projects-list-admin-btn');
  if (adminBtn) adminBtn.style.display = Auth.isAdmin() ? 'block' : 'none';
  
  try {
    const projects = await API.get('/projects') || [];
    State.setAllProjects(projects);
    renderProjectItems(document.getElementById('projects-list-full'), projects);
  } catch (err) {
    showToast('Error al cargar proyectos: ' + err.message);
  }
}

export function renderProjectItems(container, projects) {
  container.innerHTML = '';
  if (projects.length === 0) {
    container.innerHTML = emptyState('No hay proyectos disponibles', 'No tienes proyectos asignados');
    return;
  }

  const counterHtml = `<div class="projects-counter">Proyectos (${projects.length})</div>`;

  const itemsHtml = projects.map(p => {
    const pct = calcProjectProgress(p);
    const type = (p.type || '').toLowerCase();
    const providers = (p.users || []).filter(pu => pu.user.role === 'PROVIDER');
    const chips = providers.slice(0, 3).map(pu =>
      `<span class="provider-chip">${escapeHTML(pu.user.name.split(' ')[0])}</span>`).join('');
    const extra = providers.length > 3
      ? `<span class="provider-chip provider-chip-more">+${providers.length - 3}</span>`
      : '';
    const chipsHtml = providers.length > 0
      ? `<div class="pli-providers"><span class="pli-providers-label">Proveedores:</span>${chips}${extra}</div>`
      : '';

    const deleteBtn = Auth.isAdmin()
      ? `<button class="pli-delete-btn" data-id="${p.id}" data-name="${escapeHTML(p.name)}" title="Archivar proyecto">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
         </button>`
      : '';

    return `
      <div class="project-list-item" data-id="${p.id}">
        <div class="pli-icon ${escapeHTML(type)}">${getProjectIcon(type)}</div>
        <div class="pli-info">
          <div class="pli-top-row">
            <div class="pli-name">${escapeHTML(p.name)}</div>
            <span class="pli-active-badge">Activo</span>
          </div>
          <div class="pli-meta"><span>📍 ${escapeHTML(p.location || '—')}</span></div>
          ${chipsHtml}
        </div>
        <div class="pli-right">
          <div class="pli-budget">${fmt(p.budget)}</div>
          <div class="pli-progress-mini"><span>${pct}%</span> utilizado</div>
          ${deleteBtn}
        </div>
      </div>`;
  }).join('');

  const bannerHtml = `
    <div class="projects-24h-banner">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      Disponible 24/7: La gestión de proyectos puede realizarse en cualquier momento.
    </div>`;

  container.innerHTML = counterHtml + itemsHtml + bannerHtml;

  // Attach card listeners
  container.querySelectorAll('.project-list-item').forEach(card => {
    card.addEventListener('click', () => {
      openProject(card.dataset.id);
    });
  });

  // Attach delete listeners
  container.querySelectorAll('.pli-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      confirmDeleteProject(btn.dataset.id, btn.dataset.name);
    });
  });
}

export function filterProjects() {
  const q = (document.getElementById('search-projects')?.value || '').toLowerCase();
  const filtered = State.allProjects.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.location || '').toLowerCase().includes(q) ||
    typeLabel(p.type).toLowerCase().includes(q)
  );
  renderProjectItems(document.getElementById('projects-list-full'), filtered);
}

export async function confirmDeleteProject(projectId, projectName) {
  if (!confirm(`¿Archivar el proyecto "${projectName}"? Esta acción no se puede deshacer fácilmente.`)) return;
  try {
    await API.del(`/projects/${projectId}`);
    showToast(`Proyecto "${projectName}" archivado`);
    State.allProjects = State.allProjects.filter(p => p.id !== projectId);
    renderProjectItems(document.getElementById('projects-list-full'), State.allProjects);
  } catch (err) {
    showToast('Error al archivar: ' + err.message);
  }
}

export async function renderProjectDetail(pid) {
  setLoading('quotes-list');
  try {
    const p = await API.get(`/projects/${pid}`);
    if (!p) return;
    State.setCurrentProject(p);

    const pct = calcProjectProgress(p);
    const balance = Number(p.budget) - Number(p.spent);

    document.getElementById('detail-project-name').textContent = p.name;
    document.getElementById('detail-budget').textContent = fmt(p.budget);
    document.getElementById('detail-paid').textContent = fmt(p.spent);
    document.getElementById('detail-balance').textContent = fmt(balance);
    document.getElementById('detail-progress-bar').style.width = `${pct}%`;
    document.getElementById('detail-percent').textContent = `${pct}% del presupuesto utilizado`;
    document.getElementById('detail-status').textContent = p.status === 'ACTIVE' ? 'En Progreso' : 'Finalizado';

    // Pestaña Proveedores: solo visible para admin
    const provTab = document.getElementById('tab-providers');
    if (provTab) provTab.style.display = Auth.isAdmin() ? '' : 'none';

    switchTab('quotes');
  } catch (err) {
    showToast('Error al cargar proyecto: ' + err.message);
  }
}

export function switchTab(tabName) {
  ['quotes', 'payments', 'providers'].forEach(t => {
    document.getElementById(`tab-${t}`)?.classList.toggle('active', t === tabName);
    document.getElementById(`tab-content-${t}`)?.classList.toggle('hidden', t !== tabName);
  });

  if (tabName === 'quotes')     renderQuotes(State.currentProjectId);
  if (tabName === 'payments')   renderPaymentsList(State.currentProjectId);
  if (tabName === 'providers')  renderProviders(State.currentProjectId);
}

export async function renderProviders(pid) {
  const listEl = document.getElementById('providers-list');
  if (!listEl) return;
  listEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted)">Cargando...</div>';

  try {
    const [project, allUsers] = await Promise.all([
      API.get(`/projects/${pid}`),
      API.get('/users'),
    ]);

    const assigned    = (project.users || []).map(pu => pu.user);
    const assignedIds = new Set(assigned.map(u => u.id));
    const available   = (allUsers || []).filter(u => u.role === 'PROVIDER' && !assignedIds.has(u.id));

    let html = '';

    // ── Sección: Asignados ──────────────────────────────────────
    html += `<div class="prov-section-title">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      Asignados al proyecto (${assigned.length})
    </div>`;

    if (assigned.length === 0) {
      html += `<div style="padding:12px 0 20px;color:var(--text-muted);font-size:13px">Ningún proveedor asignado aún.</div>`;
    } else {
      html += assigned.map(u => `
        <div class="user-list-item prov-assigned-row">
          <div class="uli-avatar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
          <div class="uli-info">
            <div class="uli-name">${escapeHTML(u.name)}</div>
            <div class="uli-meta"><span>${escapeHTML(u.email)}</span></div>
          </div>
          ${Auth.isAdmin() ? `
          <button class="btn-icon-only" onclick="window.removeProviderFromProject('${escapeHTML(pid)}','${escapeHTML(u.id)}')" title="Quitar del proyecto">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>` : ''}
        </div>`).join('');
    }

    // ── Sección: Disponibles con checkboxes (solo admin) ────────
    if (Auth.isAdmin()) {
      html += `<div class="prov-section-title" style="margin-top:20px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Agregar proveedores (${available.length} disponibles)
      </div>`;

      if (available.length === 0) {
        html += `<div style="padding:12px 0;color:var(--text-muted);font-size:13px">Todos los proveedores ya están asignados.</div>`;
      } else {
        html += `<div id="provider-checkbox-list">`;
        html += available.map(u => `
          <label class="prov-checkbox-row">
            <input type="checkbox" class="prov-cb" value="${escapeHTML(u.id)}" />
            <div class="uli-avatar" style="width:32px;height:32px;flex-shrink:0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
            <div class="uli-info">
              <div class="uli-name" style="font-size:14px">${escapeHTML(u.name)}</div>
              <div class="uli-meta"><span>${escapeHTML(u.email)}</span></div>
            </div>
          </label>`).join('');
        html += `</div>
        <button class="btn-submit" id="btn-assign-provider" style="margin-top:14px;width:100%">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Agregar seleccionados
        </button>`;
      }
    }

    listEl.innerHTML = html;

    // Listener del botón (delegado, renderizado dinámicamente)
    document.getElementById('btn-assign-provider')?.addEventListener('click', () => assignProviderToProject());

  } catch (err) {
    listEl.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted)">Error: ${err.message}</div>`;
  }
}

export async function assignProviderToProject() {
  const pid      = State.currentProjectId;
  const checked  = [...document.querySelectorAll('.prov-cb:checked')];
  if (checked.length === 0) { showToast('Selecciona al menos un proveedor'); return; }

  const btn = document.getElementById('btn-assign-provider');
  if (btn) { btn.disabled = true; btn.textContent = 'Asignando...'; }

  try {
    await Promise.all(checked.map(cb => API.post(`/projects/${pid}/users`, { userId: cb.value })));
    showToast(`${checked.length} proveedor(es) asignado(s) correctamente`);
    renderProviders(pid);
  } catch (err) {
    showToast('Error: ' + err.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Agregar seleccionados'; }
  }
}

export async function removeProviderFromProject(pid, userId) {
  if (!confirm('¿Quitar este proveedor del proyecto?')) return;
  try {
    await API.del(`/projects/${pid}/users/${userId}`);
    showToast('Proveedor quitado del proyecto');
    renderProviders(pid);
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

export function openProject(pid) {
  navigateTo('project-detail');
  renderProjectDetail(pid);
}

export function openPartidaHistory(itemId, concept, presupuesto, pagado) {
  // Enrich with quoteId from current state if available
  const quoteId = State.currentQuotePartidasId || null;
  const quoteDisplayId = State.currentQuotePartidasDisplayId || null;
  State.currentPartidaData = { id: itemId, concept, presupuesto, pagado, quoteId, quoteDisplayId };
  navigateTo('partida-history');
  renderPartidaHistory();
}

export function toggleFilter() {
  const panel = document.getElementById('filter-panel');
  if (panel) panel.classList.toggle('hidden');
}

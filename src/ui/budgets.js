/**
 * CROIVA - Budgets UI Component
 */

import { API } from '../api.js';
import { State } from '../state.js';
import { 
  fmt, escapeHTML, showToast, closeModal 
} from '../utils.js';

export async function renderBudgetTable(pid) {
  const tbody = document.getElementById('budget-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">Cargando...</td></tr>';

  try {
    const items = await API.get(`/budgets?projectId=${pid}`) || [];
    tbody.innerHTML = '';

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">Sin partidas registradas</td></tr>`;
      return;
    }

    items.forEach((item, i) => {
      const total = Number(item.quantity) * Number(item.unitPrice);
      tbody.innerHTML += `
        <tr>
          <td style="color:var(--text-secondary)">${i + 1}</td>
          <td style="font-weight:600">${escapeHTML(item.concept)}</td>
          <td>${escapeHTML(item.unit)}</td>
          <td>${Number(item.quantity).toLocaleString('es-MX')}</td>
          <td>${fmt(item.unitPrice)}</td>
          <td class="total-col">${fmt(total)}</td>
        </tr>`;
    });

    const grandTotal = items.reduce((s, b) => s + Number(b.quantity) * Number(b.unitPrice), 0);
    tbody.innerHTML += `
      <tr style="background:rgba(255,107,53,0.06);font-weight:700">
        <td colspan="5" style="text-align:right;color:var(--text-secondary);font-size:11px;text-transform:uppercase;letter-spacing:.5px">TOTAL PARTIDAS</td>
        <td class="total-col" style="font-size:15px">${fmt(grandTotal)}</td>
      </tr>`;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">Error al cargar partidas</td></tr>`;
  }
}

export async function createBudgetItem() {
  const concept   = document.getElementById('bi-concept')?.value?.trim();
  const unit      = document.getElementById('bi-unit')?.value?.trim();
  const quantity  = parseFloat(document.getElementById('bi-qty')?.value || 0);
  const unitPrice = parseFloat(document.getElementById('bi-price')?.value || 0);

  if (!concept) { showToast('El concepto es requerido'); return; }
  if (quantity <= 0) { showToast('La cantidad debe ser mayor a 0'); return; }

  try {
    await API.post('/budgets', { projectId: State.currentProjectId, concept, unit, quantity, unitPrice });
    closeModal('modal-new-budget-item');
    ['bi-concept','bi-unit','bi-qty','bi-price'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    renderBudgetTable(State.currentProjectId);
    showToast('Partida agregada exitosamente');
  } catch (err) {
    showToast('Error al guardar partida: ' + err.message);
  }
}

// Window bindings are registered in main.js

/**
 * CROIVA - Users UI Component
 */

import { API, Auth } from '../api.js';
import { State } from '../state.js';
import { 
  escapeHTML, showToast, openModal, closeModal, setLoading, emptyState 
} from '../utils.js';

export async function renderUsersList() {
  const container = document.getElementById('users-list-full');
  if (!container) return;

  setLoading('users-list-full');
  
  try {
    const users = await API.get('/users');
    container.innerHTML = '';

    if (!users || users.length === 0) {
      container.innerHTML = emptyState('No hay usuarios', 'No se encontraron usuarios en el sistema');
      return;
    }

    const html = users.map(u => `
      <div class="user-list-item">
        <div class="uli-avatar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div class="uli-info">
          <div class="uli-name">${escapeHTML(u.name)}</div>
          ${u.companyName ? `<div style="font-size:12px;color:var(--primary);font-weight:600;margin-top:1px">${escapeHTML(u.companyName)}</div>` : ''}
          <div class="uli-meta">
            <span>${escapeHTML(u.email)}</span>
            <span class="uli-role-badge ${u.role.toLowerCase()}">${u.role}</span>
          </div>
          ${u.phone   ? `<div style="font-size:11px;color:var(--text-muted)">📞 ${escapeHTML(u.phone)}</div>`   : ''}
          ${u.address ? `<div style="font-size:11px;color:var(--text-muted)">📍 ${escapeHTML(u.address)}</div>` : ''}
        </div>
        <div class="uli-actions">
           ${u.id !== Auth.user.id ? `
             <button class="btn-icon-only" onclick="confirmDeleteUser('${u.id}', '${escapeHTML(u.name)}')">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
             </button>
           ` : ''}
        </div>
      </div>
    `).join('');

    container.innerHTML = html;
  } catch (err) {
    showToast('Error al cargar usuarios: ' + err.message);
  }
}

export async function createUser() {
  const first       = document.getElementById('new-user-first')?.value?.trim();
  const last        = document.getElementById('new-user-last')?.value?.trim();
  const email       = document.getElementById('new-user-email')?.value?.trim();
  const phone       = document.getElementById('new-user-phone')?.value?.trim();
  const role        = document.getElementById('new-user-role')?.value;
  const companyName = document.getElementById('new-user-company')?.value?.trim();
  const rfc         = document.getElementById('new-user-rfc')?.value?.trim().toUpperCase();
  const address     = document.getElementById('new-user-address')?.value?.trim();
  const _genPwd = () => Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map(b => b.toString(36)).join('').slice(0, 12);
  const password = document.getElementById('new-user-password')?.value || _genPwd();

  if (!first || !last || !email) {
    showToast('Nombre, apellido y correo son requeridos');
    return;
  }

  try {
    const newUser = await API.post('/users', {
      name: `${first} ${last}`,
      email,
      password,
      role,
      phone:       phone       || undefined,
      rfc:         rfc         || undefined,
      companyName: companyName || undefined,
      address:     address     || undefined,
    });
    
    // Close creation modal
    closeModal('modal-new-user');
    
    // Clear fields
    ['new-user-first','new-user-last','new-user-company','new-user-rfc','new-user-email','new-user-phone','new-user-address','new-user-password'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    
    // Show success modal with password
    showPasswordModal(first, last, password);
    
    // Refresh list if we are on the users screen
    if (document.getElementById('users-list-full')) {
      renderUsersList();
    }
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

export function showPasswordModal(first, last, password) {
  const nameEl = document.getElementById('tmp-pwd-name');
  const valEl = document.getElementById('tmp-pwd-value');
  if (nameEl) nameEl.textContent = `${first} ${last}`;
  if (valEl) valEl.value = password;
  openModal('modal-temp-password');
}

export function copyTempPassword() {
  const input = document.getElementById('tmp-pwd-value');
  if (!input) return;
  
  navigator.clipboard.writeText(input.value).then(() => {
    showToast('Contraseña copiada');
    closeModal('modal-temp-password');
  }).catch(() => {
    input.select();
    document.execCommand('copy');
    showToast('Contraseña copiada');
    closeModal('modal-temp-password');
  });
}

window.confirmDeleteUser = async (id, name) => {
  if (!confirm(`¿Estás seguro de eliminar a ${name}?`)) return;
  try {
    await API.del(`/users/${id}`);
    showToast('Usuario eliminado');
    renderUsersList();
  } catch (err) {
    showToast('Error al eliminar: ' + err.message);
  }
};

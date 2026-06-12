/**
 * CROIVA - Profile UI Component
 */

import { Auth, API } from '../api.js';
import { 
  showToast, openModal, closeModal 
} from '../utils.js';
import { showLogin } from '../router.js';

export function setupProfile() {
  const user = Auth.user;
  if (!user) return;
  
  const nameEl = document.getElementById('profile-name');
  const emailEl = document.getElementById('profile-email');
  if (nameEl) nameEl.textContent  = user.name;
  if (emailEl) emailEl.textContent = user.email;

  const roleText = Auth.isAdmin() ? 'Administrador' : 'Proveedor';
  const roleEl = document.querySelector('.profile-role-badge');
  if (roleEl) roleEl.textContent = roleText;

  const initials = user.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  const avatarEl = document.getElementById('avatar-initials');
  if (avatarEl) avatarEl.textContent = initials;

  const resetBtn = document.getElementById('btn-nuclear-reset');
  const manageUsersBtn = document.getElementById('btn-manage-users');
  
  if (Auth.isAdmin()) {
    resetBtn?.classList.remove('hidden');
    manageUsersBtn?.classList.remove('hidden');
  } else {
    resetBtn?.classList.add('hidden');
    manageUsersBtn?.classList.add('hidden');
  }

  const headerAvatar = document.getElementById('header-avatar');
  if (headerAvatar) headerAvatar.textContent = initials;
}

export function doLogout() {
  closeModal('modal-confirm-logout');
  Auth.clearSession();
  showToast('Sesión cerrada. ¡Hasta pronto!');
  setTimeout(() => { showLogin(); }, 1200);
}

export async function changePassword() {
  const currentPassword = document.getElementById('cp-current')?.value;
  const newPassword     = document.getElementById('cp-new')?.value;
  const confirmPassword = document.getElementById('cp-confirm')?.value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast('Completa todos los campos'); return;
  }
  if (newPassword !== confirmPassword) {
    showToast('Las contraseñas nuevas no coinciden'); return;
  }
  if (newPassword.length < 8) {
    showToast('La contraseña debe tener al menos 8 caracteres'); return;
  }

  const btn = document.getElementById('btn-change-password');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  try {
    await API.patch('/users/me/password', { currentPassword, newPassword, confirmPassword });
    closeModal('modal-change-password');
    showToast('Contraseña actualizada correctamente');
  } catch (err) {
    showToast(err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Actualizar Contraseña'; }
  }
}

export async function executeNuclearReset() {
  if (!Auth.isAdmin()) return;

  const firstConfirm = confirm('⚠️ ¡ADVERTENCIA NUCLEAR! ⚠️\n\nEsta acción eliminará TODOS los proyectos, presupuestos proveedores, pagos y notificaciones del sistema de forma PERMANENTE.\n\nSolo se conservarán los usuarios.\n\n¿Estás ABSOLUTAMENTE seguro de que deseas proceder?');
  if (!firstConfirm) return;

  const phrase = prompt('Para confirmar, escribe exactamente:\n\nCONFIRMO LIMPIEZA TOTAL');
  if (phrase !== 'CONFIRMO LIMPIEZA TOTAL') {
    showToast('Frase incorrecta. Operación cancelada.');
    return;
  }

  const btn = document.getElementById('btn-nuclear-reset');
  const originalText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Ejecutando Limpieza...';
  }

  try {
    const res = await API.nuclearReset();
    showToast(res.message);
    setTimeout(() => { window.location.reload(); }, 2000);
  } catch (err) {
    showToast('Error en limpieza: ' + err.message);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

// No global bindings needed - handled by event delegation in main.js
export const confirmLogout = () => openModal('modal-confirm-logout');
export const openChangePasswordModal = () => {
  ['cp-current','cp-new','cp-confirm'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  openModal('modal-change-password');
};

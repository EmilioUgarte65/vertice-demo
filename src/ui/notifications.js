import { NotificationsAPI } from '../api.js';
import { State } from '../state.js';
import { escapeHTML, fmtDate, emptyState, showToast } from '../utils.js';

export async function renderNotifications() {
  const container = document.getElementById('notifications-list');
  try {
    const notifications = await NotificationsAPI.getAll();

    let html = '';

    if (notifications.length > 0) {
      html += `<div class="notif-section-header">Notificaciones (${notifications.length})</div>`;
      html += notifications.map(n => {
        const icon = notifIcon(n.type === 'PAYMENT' ? 'payment' : 'info');
        const isUnread = !n.read;
        return `
          <div class="notif-card ${isUnread ? 'unread' : ''}" data-id="${n.id}">
            <div class="notif-icon ${n.type.toLowerCase()}">${icon}</div>
            <div class="notif-info">
              <div class="notif-title">${escapeHTML(n.title)}</div>
              <div class="notif-desc">${escapeHTML(n.message)}</div>
              <div class="notif-time">${fmtDate(n.createdAt)}</div>
            </div>
            ${isUnread ? '<div class="notif-dot"></div>' : ''}
          </div>`;
      }).join('');
    }

    if (!html) {
      container.innerHTML = emptyState('Sin notificaciones', 'Aquí aparecerán las actividades del sistema');
      return;
    }

    container.innerHTML = html;

    // Attach local click listeners to cards
    container.querySelectorAll('.notif-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        markNotifAsRead(id);
      });
    });

  } catch (err) {
    showToast('Error al cargar notificaciones: ' + err.message);
  }
}

function notifIcon(type) {
  const icons = {
    payment: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
    success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
    warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>`,
    alert:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    info:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };
  return icons[type] || icons.alert;
}

export async function updateNotificationCount() {
  try {
    const notifications = await NotificationsAPI.getAll() || [];
    const unread = notifications.filter(n => !n.read).length;
    const badge    = document.getElementById('notif-badge');
    const navBadge = document.getElementById('nav-notif-badge');
    
    [badge, navBadge].forEach(el => {
      if (!el) return;
      if (unread > 0) { el.textContent = unread; el.style.display = 'flex'; }
      else el.style.display = 'none';
    });
  } catch (_) {}
}

export async function markNotifAsRead(id) {
  try {
    await NotificationsAPI.markAsRead(id);
    updateNotificationCount();
    if (State.currentScreen === 'notifications') renderNotifications();
  } catch (e) {
    showToast('Error al marcar como leída');
  }
}

export async function markAllNotifsRead() {
  try {
    await NotificationsAPI.markAllAsRead();
    showToast('Todas las notificaciones marcadas como leídas');
    updateNotificationCount();
    if (State.currentScreen === 'notifications') renderNotifications();
  } catch (e) {
    showToast('Error al marcar todas como leídas');
  }
}

export async function clearNotifHistory() {
  if (!confirm('¿Seguro que quieres borrar todo el historial de notificaciones?')) return;
  try {
    await NotificationsAPI.deleteAll();
    showToast('Historial limpiado');
    updateNotificationCount();
    if (State.currentScreen === 'notifications') renderNotifications();
  } catch (e) {
    showToast('Error al limpiar el historial');
  }
}

// No global bindings needed - handled by event delegation in main.js

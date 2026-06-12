/**
 * CROIVA - Simple SPA Router
 */

import { Auth } from './api.js';
import { State } from './state.js';

export const SCREEN_MAP = {
  'dashboard':      'screen-dashboard',
  'projects':       'screen-projects',
  'project-detail': 'screen-project-detail',
  'notifications':  'screen-notifications',
  'solicitudes':    'screen-solicitudes',
  'pr-detail':      'screen-pr-detail',
  'quote-partidas': 'screen-quote-partidas',
  'profile':        'screen-profile',
  'payment-form':   'screen-payment-form',
  'partida-history':'screen-partida-history',
  'users':          'screen-users'
};

const historyStack = [];

// ── Page cache ───────────────────────────────────────────────
// Guarda el HTML renderizado de las pantallas de lista para que
// al volver a ellas se muestren INSTANTÁNEAMENTE sin esperar la red.
const _pageCache = new Map();
const CACHEABLE  = new Set(['dashboard','projects','solicitudes','notifications','users']);

export function savePageCache(screenName) {
  if (!CACHEABLE.has(screenName)) return;
  const el = document.getElementById(SCREEN_MAP[screenName]);
  if (el) _pageCache.set(screenName, el.innerHTML);
}

// Llamado desde main.js al recibir un evento SSE _invalidate
export function invalidatePageCache(resource) {
  const affected = {
    projects: ['dashboard', 'projects'],
    payments: ['solicitudes', 'dashboard'],
    quotes:   ['projects'],
    users:    ['users'],
  };
  (affected[resource] || []).forEach(s => _pageCache.delete(s));
}

export function navigateTo(screenName, skipHistory = false) {
  const targetId = SCREEN_MAP[screenName];
  if (!targetId) return;

  // Guarda la pantalla actual antes de salir
  const current = State.currentScreen;
  if (current && current !== screenName) savePageCache(current);

  // Oculta todas las pantallas
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  // Muestra la pantalla destino — restaura cache si existe (instantáneo)
  const target = document.getElementById(targetId);
  if (target) {
    const cached = CACHEABLE.has(screenName) && _pageCache.get(screenName);
    if (cached) target.innerHTML = cached;
    target.classList.add('active');
  }

  // Título del header
  const headerTitle = document.getElementById('header-title');
  if (headerTitle) {
    const titles = {
      'dashboard':       'Dashboard',
      'projects':        'Proyectos',
      'project-detail':  'Detalle de Proyecto',
      'notifications':   'Notificaciones',
      'solicitudes':     Auth.isProvider() ? 'Pagos' : 'Solicitudes',
      'pr-detail':       'Revisión de Pago',
      'quote-partidas':  'Detalle de Presupuesto Proveedor',
      'profile':         'Mi Perfil',
      'payment-form':    'Nueva Solicitud',
      'partida-history': 'Historial de Partida',
      'users':           'Usuarios',
    };
    headerTitle.textContent = titles[screenName] || 'CROIBA';
  }

  // Nav activa
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.nav === screenName) item.classList.add('active');
  });

  State.currentScreen = screenName;
  if (!skipHistory) historyStack.push(screenName);
}

export function goBack() {
  if (historyStack.length > 1) {
    historyStack.pop();
    const prev = historyStack.pop();
    navigateTo(prev);
  } else {
    navigateTo('dashboard');
  }
}

export function showApp() {
  document.getElementById('login-screen')?.classList.add('hidden');
  document.getElementById('app')?.classList.remove('hidden');
}

export function showLogin() {
  document.getElementById('app')?.classList.add('hidden');
  document.getElementById('login-screen')?.classList.remove('hidden');
}

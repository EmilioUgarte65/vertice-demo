/**
 * CROIVA - Main Entry Point
 */

import { Auth, API, refreshSystemStatus, isSystemOpen, NotificationsAPI } from './api.js';
import { State } from './state.js';
import { navigateTo, goBack, showApp, showLogin, invalidatePageCache } from './router.js';
import { showToast, setCurrentDate, openModal, closeModal, formatAmount } from './utils.js';
import { renderDashboard } from './ui/dashboard.js';
import {
  setupProfile, doLogout, confirmLogout,
  openChangePasswordModal, changePassword,
  executeNuclearReset
} from './ui/profile.js';
import {
  updateNotificationCount, renderNotifications,
  markAllNotifsRead, clearNotifHistory
} from './ui/notifications.js';
import {
  filterProjects, toggleFilter, switchTab,
  openProject, openPartidaHistory, renderProjectsList,
  assignProviderToProject, removeProviderFromProject
} from './ui/projects.js';
import {
  updateQuoteStatus, openQuotePartidas,
  selectQuoteMethod, backToQuoteMethod,
  addQuoteItemRow, createQuote, openNewQuoteModal,
  addItemToQuote
} from './ui/quotes.js';
import {
  filterSolicitudes, filterProviderSolicitudes,
  openPRDetail, reviewPayment,
  approveFromDetail, rejectFromDetail,
  openPaymentFormForPartida,
  renderSolicitudesList, renderSolicitudesProviderList
} from './ui/payments.js';
import { createUser, copyTempPassword, renderUsersList } from './ui/users.js';
import { renderBudgetTable, createBudgetItem } from './ui/budgets.js';
import {
  submitPaymentRequest, onPaymentProjectChange,
  onPaymentQuoteChange, updateSlider,
  uploadPDF, openCamera, handleFileUpload,
  renderPaymentForm, createProject, resetProjectForm,
  openEditProjectModal
} from './ui/forms.js';

async function initApp() {
  setCurrentDate();
  setupProfile();

  // Role-based navigation adjustment
  if (Auth.isProvider()) {
    const solLabel = document.getElementById('nav-sol-label');
    if (solLabel) solLabel.textContent = 'Pagos';
    const adminBanner = document.querySelector('.financial-banner');
    if (adminBanner) adminBanner.style.display = 'none';
    const qs2 = document.querySelector('#pending-requests-count')?.closest('.qs-card')?.querySelector('.qs-label');
    if (qs2) qs2.textContent = 'Pendientes';
  }

  await refreshSystemStatus();
  updateDashboardActions();
  subscribeToNotifications();
  updateNotificationCount();
  navigateTo('dashboard');
}

function triggerRender(screen) {
  const renders = {
    'dashboard':     () => renderDashboard(),
    'projects':      () => renderProjectsList(),
    'notifications': () => renderNotifications(),
    'solicitudes':   () => Auth.isAdmin() ? renderSolicitudesList('PENDING') : renderSolicitudesProviderList(),
    'payment-form':  () => renderPaymentForm(),
    'users':         () => renderUsersList(),
  };
  renders[screen]?.();
}

function setupEventListeners() {
  // Global click delegator
  document.addEventListener('click', (e) => {
    const target = e.target;
    
    // Navigation
    const navEl = target.closest('[data-nav]');
    if (navEl) {
      const screen = navEl.dataset.nav;
      navigateTo(screen);
      triggerRender(screen);
      return;
    }

    // Modal Actions
    const openModalEl = target.closest('[data-modal-open]');
    if (openModalEl) {
      const modalId = openModalEl.dataset.modalOpen;
      if (modalId === 'modal-new-project' && !openModalEl.id.includes('edit')) {
        resetProjectForm();
        document.querySelector('#modal-new-project .modal-header h3').textContent = 'Nuevo Proyecto';
        document.querySelector('#modal-new-project .btn-submit').textContent = 'Guardar Proyecto';
        document.getElementById('new-project-form')?.reset();
      }
      openModal(modalId);
      return;
    }

    const closeModalEl = target.closest('[data-modal-close]');
    if (closeModalEl) {
      closeModal(closeModalEl.dataset.modalClose);
      return;
    }

    // Back action — usa el historial interno de la app, no el del navegador
    const backEl = target.closest('[data-action="back"]');
    if (backEl) {
      goBack();
      return;
    }

    // Specific Buttons by ID or context
    if (target.id === 'btn-solicitar-pago' || target.closest('#btn-solicitar-pago')) {
      handleSolicitarPago();
    }

    if (target.id === 'btn-toggle-filter' || target.id === 'btn-toggle-filter-projects' || target.closest('#btn-toggle-filter') || target.closest('#btn-toggle-filter-projects')) {
      toggleFilter();
    }

    if (target.id === 'btn-new-quote' || target.closest('#btn-new-quote')) {
      openNewQuoteModal();
    }

    if (target.id === 'btn-assign-provider' || target.closest('#btn-assign-provider')) {
      assignProviderToProject();
    }

    // Toggle formulario agregar partida
    if (target.id === 'btn-toggle-add-item' || target.closest('#btn-toggle-add-item')) {
      const form = document.getElementById('qp-add-item-form');
      if (form) {
        const open = form.style.display === 'none';
        form.style.display = open ? 'block' : 'none';
        if (open) document.getElementById('qp-new-concept')?.focus();
      }
    }

    if (target.id === 'btn-cancel-new-item') {
      document.getElementById('qp-add-item-form').style.display = 'none';
    }

    if (target.id === 'btn-save-new-item' || target.closest('#btn-save-new-item')) {
      addItemToQuote();
    }

    if (target.id === 'btn-logout' || target.closest('#btn-logout')) {
      confirmLogout();
    }

    if (target.id === 'btn-change-password' || target.closest('#btn-change-password')) {
      openChangePasswordModal();
    }

    if (target.id === 'btn-nuclear-reset' || target.closest('#btn-nuclear-reset')) {
      executeNuclearReset();
    }

    // Form triggers
    if (target.id === 'btn-upload-pdf' || target.closest('#btn-upload-pdf')) {
      uploadPDF();
    }
    if (target.id === 'btn-open-camera' || target.closest('#btn-open-camera')) {
      openCamera();
    }

    // Notifications
    if (target.id === 'btn-mark-all-read') markAllNotifsRead();
    if (target.id === 'btn-clear-notifs') clearNotifHistory();

    // Quotes logic
    const quoteMethodEl = target.closest('[data-quote-method]');
    if (quoteMethodEl) selectQuoteMethod(quoteMethodEl.dataset.quoteMethod);

    if (target.closest('[data-action="back-quote-method"]')) backToQuoteMethod();
    if (target.id === 'btn-add-item' || target.id === 'btn-add-quote-row' || target.closest('#btn-add-item') || target.closest('#btn-add-quote-row')) addQuoteItemRow();

    // PR Actions (Detail) — HTML usa btn-prd-approve / btn-prd-reject
    if (target.id === 'btn-approve-full' || target.id === 'btn-prd-approve') approveFromDetail();
    if (target.id === 'btn-reject-full'  || target.id === 'btn-prd-reject')  rejectFromDetail();

    // Quote status
    if (target.id === 'btn-quote-approve') updateQuoteStatus('APPROVED');
    if (target.id === 'btn-quote-reject') updateQuoteStatus('REJECTED');

    // Tab switching (Projects Detail)
    const tabEl = target.closest('[data-tab]');
    if (tabEl) switchTab(tabEl.dataset.tab);

    // Filter switching (Solicitudes Admin)
    const solTabEl = target.closest('.sol-tab[data-filter]');
    if (solTabEl) filterSolicitudes(solTabEl.dataset.filter);

    // Filter switching (Solicitudes Provider)
    const provSolTabEl = target.closest('[data-prov-sol-filter]');
    if (provSolTabEl) filterProviderSolicitudes(provSolTabEl.dataset.provSolFilter, provSolTabEl);

    // Logout confirm
    if (target.id === 'btn-do-logout') doLogout();

    // Copy temp password
    if (target.id === 'btn-copy-temp-pwd') copyTempPassword();
  });

  // Change / Input Listeners
  document.addEventListener('change', (e) => {
    const target = e.target;
    if (target.id === 'project-type-filter') filterProjects();
    if (target.id === 'payment-project-select') onPaymentProjectChange(target.value);
    if (target.id === 'payment-quote-select') onPaymentQuoteChange(target.value);
    if (target.id === 'file-input') handleFileUpload(e);
  });

  document.addEventListener('input', (e) => {
    const target = e.target;
    if (target.id === 'search-projects') filterProjects();
    if (target.id === 'payment-amount') formatAmount(target);
    if (target.id === 'progress-slider') updateSlider(target.value);
  });

  // Submit Listeners
  document.addEventListener('submit', (e) => {
    const id = e.target.id;
    if (id === 'login-form') { handleLogin(e); return; }
    e.preventDefault();
    if (id === 'payment-form') submitPaymentRequest();
    else if (id === 'new-project-form') createProject().catch(err => showToast('Error: ' + err.message));
    else if (id === 'new-user-form') createUser().catch(err => showToast('Error: ' + err.message));
    else if (id === 'new-quote-form' || id === 'quote-form-step') createQuote();
    else if (id === 'form-change-password') changePassword();
  });
}

function updateDashboardActions() {
  const btnSolicitar = document.getElementById('btn-solicitar-pago');
  const alertWindow = document.getElementById('payment-window-alert');
  const btnNewUser = document.getElementById('btn-new-user');
  const btnNewProject = document.getElementById('btn-new-project');

  if (Auth.isAdmin()) {
    btnNewUser?.classList.remove('hidden');
    btnNewProject?.classList.remove('hidden');
    if (btnSolicitar) btnSolicitar.style.setProperty('display', 'none', 'important');
    alertWindow?.classList.add('hidden');
  } else if (Auth.isProvider()) {
    btnNewUser?.classList.add('hidden');
    btnNewProject?.classList.add('hidden');
    
    const btnList = document.getElementById('btn-solicitar-pago-list');

    if (btnSolicitar) btnSolicitar.style.setProperty('display', 'inline-flex', 'important');

    if (isSystemOpen()) {
      btnSolicitar?.removeAttribute('disabled');
      btnList?.removeAttribute('disabled');
      alertWindow?.classList.add('hidden');
    } else {
      btnSolicitar?.setAttribute('disabled', 'true');
      btnList?.setAttribute('disabled', 'true');
      if (btnSolicitar) btnSolicitar.style.opacity = '0.5';
      if (btnList) btnList.style.opacity = '0.5';
      alertWindow?.classList.remove('hidden');
    }
  }
}

async function subscribeToNotifications() {
  let url;
  try {
    url = await NotificationsAPI.getStreamURL();
  } catch (e) {
    // Retry after 5s if token request fails (e.g. network down)
    setTimeout(subscribeToNotifications, 5000);
    return;
  }

  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);

      // Evento de invalidación de cache — refresca datos sin toast
      if (payload._invalidate) {
        const resource = payload._invalidate;
        invalidatePageCache(resource);
        API.clearCache();
        const affected = {
          payments: ['solicitudes', 'dashboard'],
          projects: ['dashboard', 'projects'],
          quotes:   ['projects'],
          users:    ['users'],
        };
        if ((affected[resource] || []).includes(State.currentScreen)) {
          triggerRender(State.currentScreen);
        }
        return;
      }

      // Notificación normal
      if (payload.message) showToast(payload.message);
      updateNotificationCount();
      if (State.currentScreen === 'notifications') renderNotifications();
    } catch (e) { /* ignorar */ }
  };

  eventSource.onerror = (err) => {
    console.error('EventSource failed:', err);
    eventSource.close();
    setTimeout(subscribeToNotifications, 5000);
  };
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// Global login handler
async function handleLogin(event) {
  event.preventDefault();
  const emailVal = document.getElementById('login-email').value?.trim();
  const passVal  = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');

  if (!emailVal || !passVal) {
    if (errorEl) { errorEl.textContent = 'Ingresa correo y contraseña'; errorEl.style.display = 'block'; }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }
  if (errorEl) errorEl.style.display = 'none';

  try {
    const data = await API.post('/auth/login', { email: emailVal, password: passVal });
    Auth.setSession(data.token, data.user);
    
    // Clear login fields
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    
    showApp();
    await initApp();
  } catch (err) {
    if (errorEl) { errorEl.textContent = err.message; errorEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Iniciar Sesión'; }
  }
}

window.handleSolicitarPago = () => {
  if (!isSystemOpen()) {
    showToast("La ventana de pagos está cerrada actualmente.");
    return;
  }
  navigateTo('payment-form');
  triggerRender('payment-form');
};

window.newProject                = () => {
  resetProjectForm();
  document.querySelector('#modal-new-project form')?.reset();
  document.querySelector('#modal-new-project .modal-header h3').textContent = 'Nuevo Proyecto';
  openModal('modal-new-project');
};
window.openProject               = (pid) => openProject(pid);
window.openPartidaHistory        = (id, concept, presupuesto, pagado) => openPartidaHistory(id, concept, presupuesto, pagado);
window.openPaymentFormForPartida = (...args) => openPaymentFormForPartida(...args);
window.openEditProjectModal      = openEditProjectModal;
window.createProject             = createProject;
window.createUser                = createUser;
window.createBudgetItem          = createBudgetItem;
window.renderBudgetTable         = renderBudgetTable;
window.openPRDetail                = openPRDetail;
window.openQuotePartidas           = openQuotePartidas;
window.reviewPayment               = reviewPayment;
window.assignProviderToProject     = assignProviderToProject;
window.removeProviderFromProject   = removeProviderFromProject;

// Boot sequence
window.addEventListener('DOMContentLoaded', () => {
  const splash = document.getElementById('splash-screen');
  
  // Register event listeners immediately so login form works
  setupEventListeners();

  setTimeout(() => {
    if (splash) {
      splash.classList.add('fade-out');
      setTimeout(() => splash.remove(), 500);
    }

    if (Auth.isLoggedIn()) {
      showApp();
      initApp();
    } else {
      showLogin();
    }

    registerSW();
  }, 1800);
});

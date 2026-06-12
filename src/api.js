/**
 * CROIVA - Auth & API Client
 */

export const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : '/api';

export const Auth = {
  token: localStorage.getItem('croiva_token'),
  user: JSON.parse(localStorage.getItem('croiva_user') || 'null'),

  setSession(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('croiva_token', token);
    localStorage.setItem('croiva_user', JSON.stringify(user));
  },

  clearSession() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('croiva_token');
    localStorage.removeItem('croiva_user');
  },

  isLoggedIn() { return !!this.token && !!this.user; },
  isAdmin() { return this.user?.role === 'ADMIN'; },
  isProvider() { return this.user?.role === 'PROVIDER'; },
};

// ── Cache SWR (stale-while-revalidate) ───────────────────────
// GET responses se cachean 45 s. Al navegar se devuelve la cache
// inmediatamente y se refresca en background para la próxima vez.
const _cache = new Map();
const CACHE_TTL = 45_000;

function _cacheGet(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { _cache.delete(key); return null; }
  return e.data;
}
function _cacheSet(key, data) { _cache.set(key, { data, ts: Date.now() }); }
function _cacheInvalidate(prefix) {
  for (const k of _cache.keys()) {
    if (k.startsWith(prefix)) _cache.delete(k);
  }
}

export const API = {
  async request(method, path, body = null, isFormData = false, idempotencyKey = null) {
    const headers = {};
    if (Auth.token) headers['Authorization'] = `Bearer ${Auth.token}`;
    if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;
    if (!isFormData) headers['Content-Type'] = 'application/json';

    const opts = { method, headers };
    if (body) opts.body = isFormData ? body : JSON.stringify(body);

    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, opts);
    } catch (e) {
      throw new Error('Error de red. Verifica tu conexión.');
    }

    if (res.status === 401) {
      Auth.clearSession();
      window.location.reload();
      throw new Error('Sesión expirada');
    }
    if (res.status === 403) {
      throw new Error('No tienes permiso para realizar esta acción');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  },

  // GET con SWR: devuelve cache si existe (rápido) y refresca en background
  async get(path, { swr = true } = {}) {
    if (swr) {
      const cached = _cacheGet(path);
      if (cached) {
        this.request('GET', path).then(d => _cacheSet(path, d)).catch(() => {});
        return cached;
      }
      const data = await this.request('GET', path);
      _cacheSet(path, data);
      return data;
    }
    return this.request('GET', path);
  },

  // Mutaciones invalidan cache relacionada
  post(path, body) {
    _cacheInvalidate(path.split('/').slice(0, 3).join('/'));
    return this.request('POST', path, body);
  },
  put(path, body) {
    _cacheInvalidate(path.split('/').slice(0, 3).join('/'));
    return this.request('PUT', path, body);
  },
  patch(path, body) {
    _cacheInvalidate(path.split('/').slice(0, 3).join('/'));
    return this.request('PATCH', path, body);
  },
  del(path) {
    _cacheInvalidate(path.split('/').slice(0, 3).join('/'));
    return this.request('DELETE', path);
  },
  postForm(path, formData, idempotencyKey = null) {
    _cacheInvalidate(path.split('/').slice(0, 3).join('/'));
    return this.request('POST', path, formData, true, idempotencyKey);
  },
  nuclearReset() {
    _cache.clear();
    return this.request('POST', '/auth/nuclear-reset', { confirmPhrase: 'CONFIRMO LIMPIEZA TOTAL' });
  },
  clearCache() { _cache.clear(); },
};

export let _systemOpen = null;
let _nextOpen = null;

export async function refreshSystemStatus() {
  try {
    const status = await API.get('/payments/status');
    _systemOpen = status.open;
    _nextOpen = status.nextOpen || null;
    return _systemOpen;
  } catch (e) {
    console.error("Error checking system status:", e);
    return false;
  }
}

export function isSystemOpen() {
  return _systemOpen ?? false;
}

export function getNextOpenTime() {
  return _nextOpen || 'el próximo Lunes a las 9:00 AM';
}

export const NotificationsAPI = {
  async getAll() { return API.get('/notifications'); },
  async markAsRead(id) { return API.patch(`/notifications/${id}/read`); },
  async markAllAsRead() { return API.patch('/notifications/mark-all-read'); },
  async deleteAll() { return API.del('/notifications'); },
  async getStreamURL() {
    const { token } = await API.post('/notifications/sse-token', {});
    return `${API_BASE}/notifications/stream?sse_token=${token}`;
  }
};

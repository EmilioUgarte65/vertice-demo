/* ============================================================
   DEMO · Vértice (Croiva real) — capa de datos en memoria.
   Intercepta /api/* y responde con datos de EJEMPLO (no reales).
   Bypass de login, sin backend, sin SSE, sin service worker.
   ============================================================ */
(function () {
  "use strict";

  // ── Sesión demo (admin) — antes de que api.js lea localStorage ──
  if (!localStorage.getItem("croiva_token")) {
    localStorage.setItem("croiva_token", "demo-token");
    localStorage.setItem("croiva_user", JSON.stringify({ id: 1, name: "Administrador Demo", email: "demo@vertice.app", role: "ADMIN" }));
  }
  // Evita que el "cache buster" haga localStorage.clear() y borre la sesión.
  localStorage.setItem("croiva_v3.0_purged", "true");

  // ── Desactivar SSE y Service Worker en la demo ──
  try { window.EventSource = function () { return { close() {}, addEventListener() {}, set onmessage(v) {}, set onerror(v) {} }; }; } catch (e) {}
  try {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.register = function () { return Promise.resolve({ unregister() {} }); };
    }
  } catch (e) {}

  // ── PRNG sembrado para cifras estables y aleatorias (no reales) ──
  function rng(seed) { let s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const rnd = rng(20260612);
  const ri = (a, b) => Math.floor(a + (b - a) * rnd());
  const money = (a, b) => Math.round((a + (b - a) * rnd()) / 100) * 100;
  const daysAgo = (d) => { const x = new Date(); x.setDate(x.getDate() - d); return x.toISOString(); };

  // ── Usuarios (admin + proveedores ficticios) ──
  const users = [
    { id: 1, name: "Administrador Demo", email: "demo@vertice.app", role: "ADMIN", is_active: true, createdAt: daysAgo(120) },
    { id: 2, name: "Cimentaciones del Norte", email: "cimentaciones@demo.app", role: "PROVIDER", is_active: true, createdAt: daysAgo(95) },
    { id: 3, name: "Aceros y Estructuras", email: "aceros@demo.app", role: "PROVIDER", is_active: true, createdAt: daysAgo(88) },
    { id: 4, name: "Instalaciones Eléctricas", email: "electrica@demo.app", role: "PROVIDER", is_active: true, createdAt: daysAgo(70) },
    { id: 5, name: "Acabados Premium", email: "acabados@demo.app", role: "PROVIDER", is_active: false, createdAt: daysAgo(60) },
  ];

  // ── Partidas (line items) para cotizaciones, con progreso ──
  let _id = 1000;
  function items(specs) {
    return specs.map(([description, quantity, unitPrice, progress]) => ({
      id: ++_id, description, quantity, unitPrice,
      amount: Math.round(quantity * unitPrice),
      paymentItems: [{ progress }],
    }));
  }

  // ── Cotizaciones por proyecto ──
  const quotes = [
    { id: 11, projectId: 1, providerId: 2, providerName: "Cimentaciones del Norte", status: "APPROVED", amount: 1850000, createdAt: daysAgo(90),
      items: items([["Excavación y cimentación", 1, 1200000, 80], ["Zapatas y dados de concreto", 60, 10833, 70]]) },
    { id: 12, projectId: 1, providerId: 3, providerName: "Aceros y Estructuras", status: "APPROVED", amount: 2400000, createdAt: daysAgo(75),
      items: items([["Estructura de acero", 1, 1800000, 55], ["Montaje y soldadura", 1, 600000, 40]]) },
    { id: 13, projectId: 2, providerId: 4, providerName: "Instalaciones Eléctricas", status: "APPROVED", amount: 1320000, createdAt: daysAgo(60),
      items: items([["Canalización eléctrica", 1, 720000, 65], ["Tableros y acometida", 1, 600000, 50]]) },
    { id: 14, projectId: 2, providerId: 5, providerName: "Acabados Premium", status: "PENDING", amount: 980000, createdAt: daysAgo(20),
      items: items([["Acabados de pisos", 1, 520000, 0], ["Pintura y recubrimientos", 1, 460000, 0]]) },
    { id: 15, projectId: 3, providerId: 2, providerName: "Cimentaciones del Norte", status: "APPROVED", amount: 740000, createdAt: daysAgo(35),
      items: items([["Plataforma y terracería", 1, 740000, 30]]) },
    { id: 16, projectId: 4, providerId: 3, providerName: "Aceros y Estructuras", status: "APPROVED", amount: 1600000, createdAt: daysAgo(50),
      items: items([["Trabes y columnas", 1, 1600000, 62]]) },
  ];
  const quotesByProject = (pid) => quotes.filter(q => q.projectId === pid);

  // ── Proyectos (con cotizaciones embebidas para el % de avance) ──
  const projects = [
    { id: 1, name: "Torre Residencial Aurora", type: "residential", location: "Zona Centro", description: "Edificio habitacional de 12 niveles", budget: 8500000, spent: 5200000, createdAt: daysAgo(110) },
    { id: 2, name: "Plaza Comercial Norte", type: "commercial", location: "Zona Norte", description: "Centro comercial con 40 locales", budget: 14200000, spent: 9800000, createdAt: daysAgo(95) },
    { id: 3, name: "Nave Industrial Sur", type: "industrial", location: "Parque Industrial Sur", description: "Bodega y planta de 6,000 m²", budget: 6200000, spent: 2100000, createdAt: daysAgo(40) },
    { id: 4, name: "Puente Vehicular Oriente", type: "infrastructure", location: "Av. Oriente", description: "Paso vehicular de 180 m", budget: 4800000, spent: 3050000, createdAt: daysAgo(70) },
  ];
  projects.forEach(p => { p.quotes = quotesByProject(p.id); });
  const projectUsers = { 1: [2, 3], 2: [4, 5], 3: [2], 4: [3] };

  // ── Pagos / estimaciones ──
  const payStatuses = ["APPROVED", "APPROVED", "PENDING", "APPROVED", "REJECTED", "PENDING", "APPROVED"];
  const payments = payStatuses.map((status, i) => {
    const q = quotes[i % quotes.length];
    const amount = money(80000, 620000);
    return {
      id: 100 + i, projectId: q.projectId, quoteId: q.id, providerId: q.providerId, providerName: q.providerName,
      status, amount, authorizedAmount: status === "APPROVED" ? amount : null,
      concept: "Estimación " + (i + 1) + " · " + q.items[0].description,
      createdAt: daysAgo(45 - i * 5),
      items: q.items.slice(0, 2).map(it => ({ id: it.id, description: it.description, amount: Math.round(it.amount * 0.3), progress: it.paymentItems[0].progress })),
      files: [],
    };
  });
  const paymentsByProject = (pid) => payments.filter(p => p.projectId === pid);

  // ── Router del mock ──
  function J(obj, status) { return new Response(JSON.stringify(obj), { status: status || 200, headers: { "Content-Type": "application/json" } }); }
  const num = (s) => { const m = String(s).match(/(\d+)/); return m ? Number(m[1]) : null; };

  function handle(method, path) {
    const [p, qs] = path.split("?");
    const params = new URLSearchParams(qs || "");
    const pid = params.get("projectId") ? Number(params.get("projectId")) : null;

    if (p === "/auth/login" && method === "POST") return J({ token: "demo-token", user: users[0] });
    if (p === "/payments/status") return J({ open: true, nextOpen: null });

    if (p === "/projects" && method === "GET") return J(projects);
    if (p === "/projects" && method === "POST") return J({ id: 99, ...projects[0] });
    if (/^\/projects\/\d+\/users\/\d+$/.test(p)) return J({ ok: true });
    if (/^\/projects\/\d+\/users$/.test(p)) {
      const id = num(p);
      if (method === "GET") return J((projectUsers[id] || []).map(uid => users.find(u => u.id === uid)).filter(Boolean));
      return J({ ok: true });
    }
    if (/^\/projects\/\d+$/.test(p)) {
      const id = num(p);
      if (method === "DELETE") return J({ ok: true });
      if (method === "PUT") return J({ ...projects.find(x => x.id === id), ...{} });
      const proj = projects.find(x => x.id === id) || projects[0];
      return J({ ...proj, quotes: quotesByProject(id), users: (projectUsers[id] || []).map(uid => users.find(u => u.id === uid)) });
    }

    if (p === "/quotes/extract" && method === "POST") return J({ items: [] });
    if (/^\/quotes\/\d+\/items$/.test(p)) { if (method === "GET") { const q = quotes.find(x => x.id === num(p)); return J(q ? q.items : []); } return J({ ok: true }); }
    if (/^\/quotes\/\d+\/status$/.test(p)) return J({ ok: true });
    if (/^\/quotes\/\d+$/.test(p)) { const q = quotes.find(x => x.id === num(p)); return J(q || {}); }
    if (p === "/quotes") { if (method === "POST") return J({ id: 99 }); return J(pid ? quotesByProject(pid) : quotes); }

    if (/^\/payments\/files\/\d+\/url$/.test(p)) return J({ url: "#" });
    if (/^\/payments\/\d+\/(approve|reject)$/.test(p)) return J({ ok: true });
    if (/^\/payments\/\d+\/[a-z]+$/.test(p)) return J({ ok: true });
    if (/^\/payments\/\d+$/.test(p)) { const pay = payments.find(x => x.id === num(p)); return J(pay || {}); }
    if (p === "/payments") { if (method === "POST") return J({ id: 99 }); return J(pid ? paymentsByProject(pid) : payments); }

    if (p === "/budgets") return J([]);
    if (p === "/users" && method === "GET") return J(users);
    if (/^\/users\/\d+$/.test(p)) return J({ ok: true });
    if (p === "/users/me/password") return J({ ok: true });
    if (p === "/users" && method === "POST") return J({ id: 99 });

    if (p === "/notifications" && method === "GET") return J([]);
    if (p === "/notifications/sse-token") return J({ token: "demo" });
    if (p.indexOf("/notifications") === 0) return J({ ok: true });

    // Fallback seguro: GET → lista vacía, mutaciones → ok
    return method === "GET" ? J([]) : J({ ok: true });
  }

  const origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const method = ((init && init.method) || "GET").toUpperCase();
    const idx = url.indexOf("/api/");
    if (idx !== -1) {
      const path = url.slice(idx + 4); // quita "/api"
      try { return Promise.resolve(handle(method, path)); }
      catch (e) { return Promise.resolve(J({ ok: true })); }
    }
    return origFetch(input, init);
  };
})();

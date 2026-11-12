/* ============================================================
   analytics.js — Event tracking, funnel, performance,
   session recording, and privacy controls.
   ============================================================ */

window.MT = window.MT || {};

(function (MT) {
  'use strict';

  if (MT.analytics) return;

  var CONFIG = {
    endpoint: '/api/analytics',
    batchSize: 10,
    flushIntervalMs: 30000,
    storageKey: 'mt_analytics_queue',
    sessionKey: 'mt_analytics_session',
    optOutKey: 'mt_analytics_opt_out',
    maxSessionActions: 50,
    maxLocalStorageItems: 200
  };

  var queue = [];
  var sessionId = null;
  var isOptedOut = false;
  var currentRoute = null;
  var sessionActions = [];
  var flushTimer = null;
  var initialized = false;

  function generateId() {
    try {
      return crypto.randomUUID();
    } catch (e) {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  }

  function getSessionId() {
    if (sessionId) return sessionId;
    try {
      var stored = localStorage.getItem(CONFIG.sessionKey);
      if (stored) {
        sessionId = stored;
      } else {
        sessionId = generateId();
        localStorage.setItem(CONFIG.sessionKey, sessionId);
      }
    } catch (e) {
      sessionId = generateId();
    }
    return sessionId;
  }

  function getDeviceId() {
    try {
      var key = 'mt_device_id';
      var id = localStorage.getItem(key);
      if (!id) {
        id = generateId();
        localStorage.setItem(key, id);
      }
      return id;
    } catch (e) {
      return generateId();
    }
  }

  function loadQueue() {
    try {
      var raw = localStorage.getItem(CONFIG.storageKey);
      queue = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(queue)) queue = [];
    } catch (e) {
      queue = [];
    }
  }

  function saveQueue() {
    try {
      if (queue.length > CONFIG.maxLocalStorageItems) {
        queue = queue.slice(queue.length - CONFIG.maxLocalStorageItems);
      }
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(queue));
    } catch (e) {
      // storage unavailable or full
    }
  }

  function now() {
    return new Date().toISOString();
  }

  function baseEvent(name, category, properties) {
    if (isOptedOut) return null;
    var user = MT.store ? MT.store.penggunaAktif() : null;
    return {
      id: generateId(),
      name: String(name || '').slice(0, 200),
      category: String(category || 'general').slice(0, 100),
      properties: properties || {},
      url: window.location.href,
      userAgent: navigator.userAgent,
      sessionId: getSessionId(),
      deviceId: getDeviceId(),
      userId: user ? user.id : null,
      occurredAt: now(),
      sessionActions: sessionActions.slice(-10)
    };
  }

  function push(event) {
    if (!event || isOptedOut) return;
    queue.push(event);
    if (queue.length >= CONFIG.batchSize) {
      flush();
    } else {
      saveQueue();
    }
  }

  function flush() {
    if (!queue.length || isOptedOut) return;
    var payload = queue.slice();
    queue = [];
    saveQueue();

    if (navigator.sendBeacon) {
      var blob = new Blob([JSON.stringify({ events: payload })], { type: 'application/json' });
      navigator.sendBeacon(CONFIG.endpoint, blob);
    } else {
      fetch(CONFIG.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: payload }),
        keepalive: true
      }).catch(function () {
        // best-effort; avoid blocking the UI on analytics failures
      });
    }
  }

  function startFlushTimer() {
    if (flushTimer) clearInterval(flushTimer);
    flushTimer = setInterval(flush, CONFIG.flushIntervalMs);
  }

  function recordSessionAction(name, category, properties) {
    if (isOptedOut) return;
    sessionActions.push({
      name: name,
      category: category,
      properties: properties || {},
      timestamp: now()
    });
    if (sessionActions.length > CONFIG.maxSessionActions) {
      sessionActions = sessionActions.slice(sessionActions.length - CONFIG.maxSessionActions);
    }
  }

  // ---- Public API ----

  function track(name, category, properties) {
    if (isOptedOut) return;
    if (typeof category === 'object' && !properties) {
      properties = category;
      category = 'general';
    }
    var event = baseEvent(name, category, properties);
    if (event) {
      push(event);
      recordSessionAction(name, category, properties);
    }
  }

  function page(name, properties) {
    if (isOptedOut) return;
    track('page_view', 'navigation', Object.assign({ page: name, route: currentRoute }, properties || {}));
  }

  function funnel(step, properties) {
    track('funnel_step', 'onboarding', Object.assign({ step: step }, properties || {}));
  }

  function performance(metric, value, properties) {
    track('performance', 'perf', Object.assign({ metric: metric, value: value }, properties || {}));
  }

  function error(err, properties) {
    var eventProps = {
      message: err && err.message ? String(err.message).slice(0, 500) : 'Unknown error',
      stack: err && err.stack ? String(err.stack).slice(0, 1000) : null,
      code: err && err.code ? String(err.code).slice(0, 100) : null
    };
    if (properties) Object.assign(eventProps, properties);
    track('error', 'exception', eventProps);
  }

  function optOut() {
    isOptedOut = true;
    try { localStorage.setItem(CONFIG.optOutKey, 'true'); } catch (e) {}
    queue = [];
    saveQueue();
    if (flushTimer) clearInterval(flushTimer);
  }

  function optIn() {
    isOptedOut = false;
    try { localStorage.removeItem(CONFIG.optOutKey); } catch (e) {}
    loadQueue();
    startFlushTimer();
  }

  function getSessionRecording() {
    return sessionActions.slice();
  }

  function patchStoreMethods() {
    if (!MT.store) return;

    // Login
    if (MT.store.masuk) {
      var originalMasuk = MT.store.masuk;
      MT.store.masuk = function () {
        funnel('login_started');
        track('login_attempt', 'auth', { method: 'email' });
        return originalMasuk.apply(this, arguments).then(function (result) {
          if (result && result.ok) {
            funnel('login_success');
            track('login_success', 'auth', { method: 'email' });
          } else {
            funnel('login_failure');
            track('login_failure', 'auth', { method: 'email', reason: result && result.alasan });
          }
          return result;
        }).catch(function (err) {
          funnel('login_failure');
          track('login_failure', 'auth', { method: 'email', code: err && err.code });
          throw err;
        });
      };
    }

    // Registration
    if (MT.store.registrasi) {
      var originalRegistrasi = MT.store.registrasi;
      MT.store.registrasi = function () {
        funnel('register_started');
        track('register_attempt', 'auth', { method: 'email' });
        return originalRegistrasi.apply(this, arguments).then(function (result) {
          if (result && result.ok) {
            funnel('register_success');
            track('register_success', 'auth', { method: 'email' });
          } else {
            funnel('register_failure');
            track('register_failure', 'auth', { method: 'email', reason: result && result.alasan });
          }
          return result;
        }).catch(function (err) {
          funnel('register_failure');
          track('register_failure', 'auth', { method: 'email', code: err && err.code });
          throw err;
        });
      };
    }

    // Logout
    if (MT.store.keluar) {
      var originalKeluar = MT.store.keluar;
      MT.store.keluar = function () {
        track('logout_click', 'auth', { method: 'session' });
        return originalKeluar.apply(this, arguments).then(function () {
          track('logout_success', 'auth', { method: 'session' });
        }).catch(function (err) {
          track('logout_failure', 'auth', { code: err && err.code });
          throw err;
        });
      };
    }

    // CRUD
    var crudEventMap = {
      tambah: { tugas: 'create_task', laporan: 'create_report', pengingat: 'create_reminder', pengguna: 'create_user' },
      ubah: { tugas: 'update_task', laporan: 'update_report', pengingat: 'update_reminder', pengguna: 'update_user' },
      hapus: { tugas: 'delete_task', laporan: 'delete_report', pengingat: 'delete_reminder', pengguna: 'delete_user' }
    };

    ['tambah', 'ubah', 'hapus'].forEach(function (method) {
      if (!MT.store[method]) return;
      var original = MT.store[method];
      var eventMap = crudEventMap[method];
      MT.store[method] = function (koleksi, idOrData, data) {
        var eventName = eventMap[koleksi] || method + '_' + koleksi;
        track(eventName + '_attempt', 'crud', { collection: koleksi });
        return original.apply(this, arguments).then(function (result) {
          track(eventName + '_success', 'crud', { collection: koleksi });
          return result;
        }).catch(function (err) {
          track(eventName + '_failure', 'crud', { collection: koleksi, code: err && err.code });
          throw err;
        });
      };
    });
  }

  function patchModulHandlers() {
    if (!MT.modulHandler) return;
    Object.keys(MT.modulHandler).forEach(function (koleksi) {
      var handler = MT.modulHandler[koleksi];
      if (!handler || handler._analyticsPatched) return;

      if (handler.cari) {
        var originalCari = handler.cari;
        handler.cari = function (nilai) {
          track('search', 'feature', { collection: koleksi, query: String(nilai || '').slice(0, 100) });
          return originalCari.apply(this, arguments);
        };
      }
      if (handler.filter) {
        var originalFilter = handler.filter;
        handler.filter = function (nama, nilai) {
          track('filter', 'feature', { collection: koleksi, filterName: String(nama || '').slice(0, 100), filterValue: String(nilai || '').slice(0, 100) });
          return originalFilter.apply(this, arguments);
        };
      }
      if (handler.urut) {
        var originalUrut = handler.urut;
        handler.urut = function (nilai) {
          track('sort', 'feature', { collection: koleksi, sortValue: String(nilai || '').slice(0, 100) });
          return originalUrut.apply(this, arguments);
        };
      }
      if (handler.halaman) {
        var originalHalaman = handler.halaman;
        handler.halaman = function (h) {
          track('pagination', 'feature', { collection: koleksi, page: h });
          return originalHalaman.apply(this, arguments);
        };
      }
      if (handler.urutKolom) {
        var originalUrutKolom = handler.urutKolom;
        handler.urutKolom = function (kunci) {
          track('sort_column', 'feature', { collection: koleksi, column: String(kunci || '').slice(0, 100) });
          return originalUrutKolom.apply(this, arguments);
        };
      }
      handler._analyticsPatched = true;
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;

    // Privacy: honor Do Not Track and stored opt-out
    try {
      var dnt = navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes' || window.doNotTrack === '1';
      var storedOptOut = localStorage.getItem(CONFIG.optOutKey);
      if (dnt || storedOptOut === 'true') {
        isOptedOut = true;
        return;
      }
    } catch (e) {}

    loadQueue();
    getSessionId();
    startFlushTimer();

    currentRoute = location.hash.replace(/^#\/?/, '') || 'dashboard';
    page(currentRoute);
    funnel('app_initialized');

    // Route change tracking via hashchange
    window.addEventListener('hashchange', function () {
      var next = location.hash.replace(/^#\/?/, '') || 'dashboard';
      if (next !== currentRoute) {
        track('route_change', 'navigation', { from: currentRoute, to: next });
        currentRoute = next;
        page(next);
      }
    });

    // Performance marks from app.js MT.perf.ukur
    if (MT.perf && MT.perf.ukur) {
      var originalUkur = MT.perf.ukur;
      MT.perf.ukur = function (nama, mulai, akhir) {
        var result = originalUkur.apply(this, arguments);
        if (typeof nama === 'string' && nama.indexOf('render-') === 0 && result !== null) {
          performance('route_render', result, { route: nama.replace('render-', '') });
        }
        return result;
      };
    }

    // Click delegation for key UI actions (covers lazy-loaded views too)
    document.addEventListener('click', function (e) {
      if (isOptedOut) return;
      var target = e.target.closest('[data-action]');
      if (!target) return;
      var action = target.getAttribute('data-action');
      if (!action) return;

      if (action.indexOf('tambah') !== -1) {
        track('button_click', 'ui', { action: action, label: (target.textContent || '').trim().slice(0, 100) });
      } else if (action.indexOf('edit') !== -1) {
        track('button_click', 'ui', { action: action, label: (target.textContent || '').trim().slice(0, 100) });
      } else if (action.indexOf('hapus') !== -1) {
        track('button_click', 'ui', { action: action, label: (target.textContent || '').trim().slice(0, 100) });
      } else if (action === 'auth.logout') {
        track('button_click', 'ui', { action: action });
      }
    });

    // Auth form submit tracking
    document.addEventListener('submit', function (e) {
      if (isOptedOut) return;
      var form = e.target;
      if (form && form.id === 'auth-form') {
        var isLogin = !form.querySelector('[data-auth-field="nama"]') || form.querySelector('[data-auth-field="nama"]').hidden;
        track('auth_form_submit', 'auth', { mode: isLogin ? 'login' : 'register' });
      }
    });

    // Global error tracking
    window.addEventListener('unhandledrejection', function (event) {
      error(event.reason, { type: 'unhandled_rejection' });
    });

    window.addEventListener('error', function (event) {
      error(event.error || event.message || 'Unknown error', {
        type: 'window_error',
        filename: event.filename ? String(event.filename).slice(-200) : null,
        lineno: event.lineno
      });
    });

    // Flush on hidden/close
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('beforeunload', flush);

    // Patch existing app logic
    patchStoreMethods();
    patchModulHandlers();

    // Track session boundaries via store subscribers
    if (MT.store && MT.store.langganan) {
      var previousUser = MT.store.penggunaAktif();
      MT.store.langganan(function () {
        var currentUser = MT.store.penggunaAktif();
        if (!previousUser && currentUser) {
          funnel('dashboard_viewed');
          track('session_start', 'session', { userId: currentUser.id });
        } else if (previousUser && !currentUser) {
          track('session_end', 'session', { userId: previousUser.id, actions: getSessionRecording() });
          sessionActions = [];
        }
        previousUser = currentUser;
      });
    }
  }

  MT.analytics = {
    init: init,
    track: track,
    page: page,
    flush: flush,
    optOut: optOut,
    optIn: optIn,
    isOptedOut: function () { return isOptedOut; },
    getSessionRecording: getSessionRecording,
    funnel: funnel,
    performance: performance,
    error: error,
    onViewLoaded: function (viewName) {
      // Re-patch modul handlers for lazy-loaded views
      patchModulHandlers();
      track('view_loaded', 'navigation', { view: viewName });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(init, 0);
    });
  } else {
    setTimeout(init, 0);
  }

})(window.MT);

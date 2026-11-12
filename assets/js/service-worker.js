/* ============================================================
   service-worker.js — Versioned offline support and asset updates.
   ============================================================ */

const CACHE_NAME = 'static-v6';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/assets/css/styles.css',
  '/assets/js/sanitize.js',
  '/assets/js/ui.js',
  '/assets/js/components.js',
  '/assets/js/store.js',
  '/assets/js/empty-states.js',
  '/assets/js/error-boundary.js',
  '/assets/js/views-auth.js',
  '/assets/js/views-dashboard.js',
  '/assets/js/views-modul.js',
  '/assets/js/views-tasks.js',
  '/assets/js/views-reports.js',
  '/assets/js/views-reminders.js',
  '/assets/locales/id.json',
  '/assets/locales/en.json',
  '/assets/js/views-notes.js',
  '/assets/js/views-activity.js',
  '/assets/js/views-users.js',
  '/assets/js/i18n.js',
  '/assets/js/app.js',
  '/assets/js/mobile.js',
  '/assets/dist/neon-auth-client.js',
  '/assets/icons/offline-plug.png',
  '/assets/icons/favicon.svg'
];
const NETWORK_TIMEOUT_MS = 3000;
const OFFLINE_FALLBACK = '/offline.html';

function isApiRequest(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/');
}

function isHtmlPage(pathname) {
  return pathname === '/' || pathname === '/index.html' || pathname.endsWith('.html');
}

function isHashedDistAsset(pathname) {
  return pathname.startsWith('/assets/dist/')
    && /\.[a-z0-9_-]{6,}\./i.test(pathname.slice(pathname.lastIndexOf('/') + 1));
}

function isImageOrFont(pathname) {
  return /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot)$/i.test(pathname);
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(PRECACHE_URLS.map(function (url) {
        return fetch(url, { cache: 'no-cache' }).then(function (response) {
          if (!response.ok) throw new Error('Unable to precache ' + url + ': ' + response.status);
          return cache.put(url, response);
        });
      }));
    })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    deleteOldCaches()
      .then(function () { return self.clients.claim(); })
      .then(function () {
        return new Promise(function (resolve) {
          setTimeout(resolve, NETWORK_TIMEOUT_MS);
        });
      })
      .then(deleteOldCaches)
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  var url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (isApiRequest(url.pathname)) return;

  if (isHashedDistAsset(url.pathname) || isImageOrFont(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request, isHtmlPage(url.pathname)));
});

function fetchWithTimeout(request) {
  var controller = new AbortController();
  var timeout = setTimeout(function () { controller.abort(); }, NETWORK_TIMEOUT_MS);
  return fetch(request, { cache: 'no-cache', signal: controller.signal }).finally(function () {
    clearTimeout(timeout);
  });
}

function storeResponse(request, response) {
  if (!response || response.status !== 200 || request.method !== 'GET') {
    return Promise.resolve(response);
  }
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.put(request, response.clone());
  }).then(function () {
    return response;
  }).catch(function (error) {
    console.warn('Service worker: unable to update asset cache', error);
    return response;
  });
}

function deleteOldCaches() {
  return caches.keys().then(function (keys) {
    return Promise.all(
      keys.filter(function (key) { return key !== CACHE_NAME; })
        .map(function (key) { return caches.delete(key); })
    );
  });
}

function cachedResponse(request, htmlRequest) {
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.match(request, { ignoreVary: true });
  }).then(function (cached) {
    if (cached || !htmlRequest) return cached;
    return caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(OFFLINE_FALLBACK).then(function (offline) {
        return offline || cache.match('/index.html');
      });
    });
  });
}

function networkFirst(request, htmlRequest) {
  return fetchWithTimeout(request).then(function (response) {
    return storeResponse(request, response);
  }).catch(function () {
    return cachedResponse(request, htmlRequest).then(function (cached) {
      return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
    });
  });
}

function cacheFirst(request) {
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.match(request, { ignoreVary: true });
  }).then(function (cached) {
    if (cached) return cached;
    return fetch(request).then(function (response) {
      return storeResponse(request, response);
    }).catch(function () {
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    });
  });
}

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'GET_VERSION' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ cacheName: CACHE_NAME });
    return;
  }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

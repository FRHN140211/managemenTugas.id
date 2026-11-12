import { chromium } from 'playwright';

/**
 * tests/auth-harness.js — Playwright harness untuk pengujian layar auth.
 * 
 * Fitur:
 * - Mock semua endpoint /api/neon-auth/* dengan respons yang bisa diatur per tes
 * - Blokir dan hitung permintaan ke luar localhost
 * - Mock file locale id.json/en.json dari berkas asli
 * - Tunggu MT.i18n.init() selesai sebelum tes dimulai
 */

// External request tracking
const externalRequests = [];
const externalResponses = [];
const localeRequests = [];
let mockNeonAuthResponses = {};
let localeFiles = {};
let localeLoaded = false;

function resetHarness() {
  externalRequests.length = 0;
  externalResponses.length = 0;
  localeRequests.length = 0;
  mockNeonAuthResponses = {};
  localeFiles = {};
  localeLoaded = false;
}

function setMockNeonAuth(endpoint, response) {
  mockNeonAuthResponses[endpoint] = response;
}

function setLocaleFiles(idData, enData) {
  localeFiles.id = idData;
  localeFiles.en = enData;
}

// Neon Auth mock responses
const defaultNeonAuthResponses = {
  'GET:/api/neon-auth/get-session': { ok: false, error: { code: 'NOT_FOUND', message: 'Rute tidak ditemukan.' } },
  'POST:/api/neon-auth/sign-up/email': (url) => {
    const body = url.body || {};
    return {
      token: null,
      user: {
        name: body.name || 'Test User',
        email: body.email || 'test@example.com',
        emailVerified: false,
        image: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        role: 'user',
        banned: false,
        banReason: null,
        banExpires: null,
        id: 'test-' + Date.now()
      }
    };
  },
  'POST:/api/neon-auth/sign-in/email': { token: 'mock-token-' + Date.now(), user: { emailVerified: true } },
  'POST:/api/neon-auth/send-verification-email': { status: true },
  'POST:/api/neon-auth/email-otp/verify-email': { status: true, user: { emailVerified: true } },
  'POST:/api/neon-auth/forgot-password': { status: true },
  'POST:/api/neon-auth/reset-password': { status: true }
};

function getMockResponse(url, method) {
  const path = url.pathname + url.search;
  const key = method + ':' + path;
  
  // Check custom mock first
  if (mockNeonAuthResponses[key]) {
    const resp = mockNeonAuthResponses[key];
    if (typeof resp === 'function') {
      return resp(url);
    }
    return resp;
  }
  
  // Check default mock
  if (defaultNeonAuthResponses[key]) {
    const resp = defaultNeonAuthResponses[key];
    if (typeof resp === 'function') {
      return resp(url);
    }
    return resp;
  }
  
  // Not found
  return { ok: false, error: { code: 'NOT_FOUND', message: 'Rute tidak ditemukan.' } };
}

export async function launchAuthTest(options = {}) {
  const {
    locale = 'id',
    viewport = { width: 1280, height: 800 },
    externalBlockMode = 'block' // 'block' | 'allow' | 'count'
  } = options;

  resetHarness();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport,
    extraHTTPHeaders: { Origin: 'http://localhost:3000' },
    serviceWorkers: 'block'
  });

  // Load locale files
  const fs = await import('fs');
  const path = await import('path');
  const projectRoot = path.dirname(new URL(import.meta.url).pathname);
  
  // Try to load actual locale files
  try {
    const idPath = path.join(projectRoot, '..', 'assets', 'locales', 'id.json');
    const enPath = path.join(projectRoot, '..', 'assets', 'locales', 'en.json');
    if (fs.existsSync(idPath)) localeFiles.id = JSON.parse(fs.readFileSync(idPath, 'utf-8'));
    if (fs.existsSync(enPath)) localeFiles.en = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
  } catch (e) {
    // Fallback minimal locales
    localeFiles.id = { 'auth.login_title': 'Masuk', 'auth.register_title': 'Daftar' };
    localeFiles.en = { 'auth.login_title': 'Sign in', 'auth.register_title': 'Register' };
  }

  // Intercept requests
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    // Track external requests
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' && url.hostname !== '') {
      externalRequests.push({
        url: route.request().url(),
        method,
        type: url.pathname
      });
      
      if (externalBlockMode === 'block') {
        await route.abort();
        return;
      } else if (externalBlockMode === 'count') {
        // Allow but track
      } else {
        await route.continue();
        return;
      }
    }

    // Mock Neon Auth API
    if (url.pathname.startsWith('/api/neon-auth/')) {
      const mockBody = getMockResponse(url, method);
      
      externalResponses.push({
        url: route.request().url(),
        method,
        status: 200,
        body: mockBody
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockBody)
      });
      return;
    }

    // Mock locale files
    if (url.pathname.startsWith('/assets/locales/')) {
      const localeFile = url.pathname.split('/').pop();
      const localeKey = localeFile === 'id.json' ? 'id' : localeFile === 'en.json' ? 'en' : null;
      
      // Track locale request
      localeRequests.push({
        url: route.request().url(),
        method: route.request().method(),
        localeKey,
        mocked: !!(localeKey && localeFiles[localeKey])
      });
      
      if (localeKey && localeFiles[localeKey]) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(localeFiles[localeKey])
        });
        localeLoaded = true;
        return;
      }
    }

    // Allow everything else (local assets, etc.)
    await route.continue();
  });

  const page = await context.newPage();

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Collect page errors
  const pageErrors = [];
  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  // Force-set locale BEFORE any page script runs
  await page.addInitScript((loc) => {
    try { localStorage.setItem('MT.locale', loc); } catch (e) {}
  }, locale);

  // Navigate and wait for i18n to be ready with CORRECT locale
  const knownKey = 'auth.login_title';
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  
  // Poll for locale readiness
  let localeReady = false;
  const startTime = Date.now();
  while (Date.now() - startTime < 15000) {
    const result = await page.evaluate(({ expectedLocale, key }) => {
      try {
        const mt = typeof window.MT !== 'undefined' ? window.MT : null;
        if (!mt || !mt.i18n || typeof mt.i18n.getLocale !== 'function') return { ready: false };
        if (mt.i18n.getLocale() !== expectedLocale) return { ready: false, locale: mt.i18n.getLocale() };
        const val = mt.i18n.t(key);
        if (typeof val === 'string' && val !== key) return { ready: true, value: val };
        return { ready: false, value: val };
      } catch (e) {
        return { ready: false, error: e.message };
      }
    }, { expectedLocale: locale, key: knownKey });
    
    if (result.ready) {
      localeReady = true;
      break;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  
  if (!localeReady) {
    const info = await page.evaluate(({ k }) => {
      try {
        const mt = window.MT;
        return {
          locale: mt && mt.i18n ? mt.i18n.getLocale() : 'undefined',
          knownKeyValue: mt && mt.i18n ? mt.i18n.t(k) : 'undefined'
        };
      } catch (e) {
        return { error: e.message };
      }
    }, { k: knownKey });
    throw new Error(`Locale ${locale} did not load within timeout. ${JSON.stringify(info)}`);
  }

  return {
    browser,
    context,
    page,
    consoleErrors,
    pageErrors,
    externalRequests,
    externalResponses,
    localeRequests,
    localeLoaded,
    reset: () => resetHarness(),
    setMock: (endpoint, response) => setMockNeonAuth(endpoint, response),
    getExternalCount: () => externalRequests.filter(r => 
    r.type !== '/favicon.ico' && 
    !r.url.includes('fonts.googleapis.com') &&
    !r.url.includes('fonts.gstatic.com')
  ).length,
  getBlockedExternalCount: () => externalRequests.filter(r => 
    r.type !== '/favicon.ico'
  ).length
  };
}

export async function closeAuthTest(test) {
  if (test && test.browser) {
    await test.browser.close();
  }
}

export { resetHarness, setMockNeonAuth, defaultNeonAuthResponses };

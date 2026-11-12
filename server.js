import express from 'express';
import path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { handleApiRequest } from './lib/api.js';
import { proxyNeonAuthRequest } from './lib/neon-auth-proxy.js';
import { recordProxySignIn } from './lib/activity-analytics.js';
import { securityHeaders } from './lib/security-headers.js';
import { csrfSetCookie } from './lib/csrf.js';
import {
  rateLimitLogin,
  rateLimitRegistration,
  rateLimitPasswordChange,
  rateLimitApi
} from './lib/rate-limit.js';
import cors from 'cors';

const projectDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendEntry = path.join(projectDirectory, 'index.html');
const app = express();
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');

// Request ID for tracing
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Request logging for observability
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const log = {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      ms,
      ip: req.ip || req.socket.remoteAddress
    };
    if (res.statusCode >= 500 || ms > 1000) {
      console.error(JSON.stringify(log));
    } else if (process.env.NODE_ENV === 'development') {
      console.log(JSON.stringify(log));
    }
  });
  next();
});

// Security headers
app.use(securityHeaders(IS_PRODUCTION));

// CORS: allow trusted origins only; no wildcard with credentials
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://management-tugas.example.com'
    ];
    if (allowed.includes(origin)) return callback(null, true);
    return callback(new Error('Origin tidak diizinkan oleh CORS.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id', 'X-CSRF-Token', 'Origin', 'Accept'],
  maxAge: 86400
};
app.use(cors(corsOptions));

// Rate limiting: database-backed for multi-instance; in-memory fallback
app.use('/api/auth/login', rateLimitLogin);
app.use('/api/auth/register', rateLimitRegistration);
app.use('/api/auth/forgot-password', rateLimitRegistration);
app.use('/api/auth/reset-password', rateLimitRegistration);
app.use('/api/neon-auth/change-password', rateLimitPasswordChange);
app.use('/api', rateLimitApi);

// Neon Auth proxy
function kirimHasilProxy(res, result) {
  for (const [name, value] of Object.entries(result.headers || {})) {
    res.setHeader(name, value);
  }
  res.status(result.status);
  if (result.body === null || result.body === undefined) return res.end();
  return result.raw ? res.send(result.body) : res.json(result.body);
}

// Lupa sandi & reset sandi: UI memanggil /api/auth/forgot-password dan /api/auth/reset-password.
// Rute ini TIDAK ada di dispatch lib/api.js, sehingga dulu dijawab 404 oleh route api.js
// (terbukti: curl -> HTTP 404 NOT_FOUND). Di sini permintaan diteruskan ke endpoint
// Better Auth yang benar di Neon Auth, dengan path tujuan eksplisit, bukan /api/auth/* apa adanya.
app.use(['/api/auth/forgot-password', '/api/auth/reset-password'], rateLimitRegistration,
  express.json({ limit: '64kb' }), async (req, res) => {
    const tujuan = req.path === '/api/auth/forgot-password'
      ? '/forget-password'
      : '/reset-password';
    const asal = new URL(req.originalUrl || req.url, 'http://' + (req.headers.host || 'localhost'));
    try {
      const result = await proxyNeonAuthRequest({
        method: 'POST',
        url: '/api/neon-auth' + tujuan + asal.search,
        headers: Object.assign({}, req.headers, { 'content-type': 'application/json' }),
        body: req.body
      });
      return kirimHasilProxy(res, result);
    } catch {
      return res.status(500).set('Cache-Control', 'no-store').json({
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Permintaan belum dapat diproses. Coba lagi nanti.' }
      });
    }
  });

app.use('/api/neon-auth', rateLimitApi, express.json({ limit: '64kb' }), async (req, res) => {
  try {
    const url = new URL(req.originalUrl || req.url, 'http://' + (req.headers.host || 'localhost'));
    const result = await proxyNeonAuthRequest({
      method: req.method,
      url: url.toString(),
      headers: req.headers,
      body: req.body
    });
    recordProxySignIn({
      method: req.method,
      url: url.toString(),
      headers: req.headers
    }, result).catch((error) => {
      console.error('Successful sign-in activity could not be recorded.', {
        code: typeof error?.code === 'string' ? error.code : 'UNKNOWN'
      });
    });
    return kirimHasilProxy(res, result);
  } catch {
    return res.status(500).set('Cache-Control', 'no-store').json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Permintaan belum dapat diproses. Coba lagi nanti.' }
    });
  }
});

// CSRF protection (set cookie + validate for authenticated requests)
app.use(csrfSetCookie);

app.use('/api', rateLimitApi, express.json({ limit: '64kb' }), async (req, res) => {
  try {
    const host = req.headers.host || 'localhost:3000';
    const url = new URL(req.originalUrl || req.url, `http://${host}`);
    const result = await handleApiRequest({
      method: req.method,
      url: url.toString(),
      headers: {
        ...req.headers,
        cookie: req.headers.cookie || ''
      },
      ip: req.ip,
      body: req.body === undefined ? {} : req.body
    });

    for (const [name, value] of Object.entries(result.headers || {})) {
      res.setHeader(name, value);
    }
    res.status(result.status || 200);
    if (result.body === null || result.body === undefined) return res.end();
    return res.json(result.body);
  } catch (error) {
    console.error('API request handler failed.');
    const message = process.env.NODE_ENV === 'production'
      ? 'Permintaan belum dapat diproses. Coba lagi nanti.'
      : error instanceof Error ? error.message : 'Permintaan belum dapat diproses.';
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message }
    });
  }
});

const isHashedAsset = function (filename) {
  var match = filename.match(/^neon-auth-client\.[a-z0-9_-]{8,}\.js$/i);
  return !!match;
};

app.use('/assets', express.static(path.join(projectDirectory, 'assets'), {
  dotfiles: 'deny',
  index: false,
  setHeaders: function (res, assetPath) {
    var filename = path.basename(assetPath);
    if (path.resolve(assetPath) === path.join(projectDirectory, 'assets', 'js', 'service-worker.js')) {
      res.setHeader('Service-Worker-Allowed', '/');
    }
    if (isHashedAsset(filename)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

const setHtmlCacheControl = function (res) {
  res.setHeader('Cache-Control', 'no-cache');
};

app.get(['/', '/index.html'], (req, res) => {
  setHtmlCacheControl(res);
  res.sendFile(frontendEntry);
});

const legacyPages = {
  '/dashboard.html': 'dashboard.html',
  '/tasks.html': 'tasks.html',
  '/reports.html': 'reports.html',
  '/reminders.html': 'reminders.html',
  '/users.html': 'users.html'
};
for (const [route, file] of Object.entries(legacyPages)) {
  app.get(route, (req, res) => {
    setHtmlCacheControl(res);
    res.sendFile(path.join(projectDirectory, file));
  });
}

app.get('/offline.html', (req, res) => {
  setHtmlCacheControl(res);
  res.sendFile(path.join(projectDirectory, 'offline.html'));
});

app.get('/assets/dist/neon-auth-client.js', (req, res) => {
  const distDir = path.join(projectDirectory, 'assets/dist');
  try {
    const files = readdirSync(distDir).filter(f => f.startsWith('neon-auth-client.') && f.endsWith('.js'));
    if (files.length > 0) {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distDir, files[0]));
      return;
    }
  } catch {
    // fall through to 404
  }
  res.status(404).type('text/plain').send('Not Found');
});

app.get('*path', (req, res, next) => {
  const isApi = req.path === '/api' || req.path.startsWith('/api/');
  const isAsset = req.path === '/assets' || req.path.startsWith('/assets/');
  if (isApi || isAsset || path.extname(req.path) || !/\btext\/html\b/i.test(req.headers.accept || '')) {
    return next();
  }
  setHtmlCacheControl(res);
  return res.sendFile(frontendEntry);
});

app.use((req, res) => {
  if (req.path === '/api' || req.path.startsWith('/api/')) {
    return res.status(404).json({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Rute tidak ditemukan.' }
    });
  }
  return res.status(404).type('text/plain').send('Not Found');
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.status === 413 ? 413 : error.status === 400 ? 400 : 500;
  const apiRequest = req.path === '/api' || req.path.startsWith('/api/');
  if (status === 500) console.error('HTTP request failed.');

  if (apiRequest) {
    const message = status === 413
      ? 'Request body is too large.'
      : status === 400
        ? 'Request body must be valid JSON.'
        : 'Permintaan belum dapat diproses. Coba lagi nanti.';
    return res.status(status).json({
      ok: false,
      error: {
        code: status === 413 ? 'PAYLOAD_TOO_LARGE' : status === 400 ? 'INVALID_REQUEST' : 'INTERNAL_ERROR',
        message
      }
    });
  }

  return res.status(status).type('text/plain').send(
    status === 413 ? 'Request entity too large' : status === 400 ? 'Bad request' : 'Internal server error'
  );
});

if (!existsSync(frontendEntry)) {
  console.error('Cannot start server: frontend entry point index.html was not found in the project root.');
  process.exitCode = 1;
} else {
  // Apply pending database migrations on startup
  import('./scripts/apply-migrations.js').then(function () {
    console.log('Database migrations checked.');
  }).catch(function (err) {
    console.error('Migration check failed:', err.message || err);
  });

  app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
    console.log('Frontend + API siap digunakan');
  });
}

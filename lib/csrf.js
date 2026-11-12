// lib/csrf.js — CSRF protection for cookie-based authentication
// Uses synchronizer token pattern: token stored in httpOnly cookie + hidden field + server-side session
// For Bearer token auth: origin check is sufficient (CSRF is not applicable)

import crypto from 'node:crypto';

const SECRET_KEY_LENGTH = 32;
const COOKIE_NAME = '__Secure-mt-csrf-token';
const TOKEN_LENGTH = 32;

// In production, store CSRF tokens in a server-side session store (Redis/DB)
// For single-instance, in-memory map is acceptable
const tokenStore = new Map();

function generateToken() {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

function getOrCreateToken(sessionId) {
  if (!sessionId) return null;
  if (!tokenStore.has(sessionId)) {
    tokenStore.set(sessionId, generateToken());
  }
  return tokenStore.get(sessionId);
}

function generateCookieToken() {
  return generateToken();
}

/** Create CSRF token for a session (registers session as CSRF-aware) */
export function createCsrfToken(sessionId) {
  return getOrCreateToken(sessionId);
}

/** Get the token value for a session */
export function getCsrfToken(sessionId) {
  return getOrCreateToken(sessionId);
}

/** Mark a session as CSRF-protected (for cookie-based auth) */
export function protectSession(sessionId) {
  if (sessionId) {
    getOrCreateToken(sessionId);
  }
}

/** Middleware: extract CSRF token from request and validate */
export function csrfProtection(req, res, next) {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) {
    // No session → not protected (public endpoints)
    return next();
  }

  const token = req.headers['x-csrf-token'];
  const cookieToken = req.cookies?.[COOKIE_NAME];

  const validToken = token && tokenStore.get(sessionId) === token;
  const validCookie = cookieToken && tokenStore.get(sessionId) === cookieToken;

  if (!validToken && !validCookie) {
    return res.status(403).json({
      ok: false,
      error: {
        code: 'CSRF_TOKEN_MISSING',
        message: 'CSRF token tidak valid atau tidak tersedia.'
      }
    });
  }

  // Token valid — remove it from store to prevent reuse (one-time use)
  tokenStore.delete(sessionId);

  // Continue
  next();
}

/** Middleware: send CSRF token cookie to browser (for cookie-based auth) */
export function csrfSetCookie(req, res, next) {
  // For login (POST /api/auth/login), we don't need CSRF cookie (it's creating a session)
  // For authenticated routes, we need a CSRF token
  if (req.method === 'POST' && (req.path === '/api/auth/login' || req.path === '/api/auth/register')) {
    return next();
  }

  // For authenticated requests, generate CSRF token
  const sessionId = req.headers['x-session-id'] || req.session?.id;
  if (!sessionId) {
    return next(); // No session, no CSRF needed
  }

  const token = getOrCreateToken(sessionId);
  if (token) {
    res.setHeader('Set-Cookie', [
      `${COOKIE_NAME}=${token}; Path=/; Secure; SameSite=Strict; HttpOnly; Max-Age=86400`,
      'X-CSRF-Token=' + token + '; Path=/; SameSite=Strict'
    ].join('; '));
  }
  next();
}

/**
 * CSRF protection strategy:
 *
 * For cookie-based authentication (Neon Auth session cookie):
 * 1. Server sends CSRF token in httpOnly cookie + X-CSRF-Token header
 * 2. Frontend includes token in HTML forms (hidden field) and custom header
 * 3. Server validates token matches session
 *
 * For Bearer token authentication:
 * 1. Origin header check is sufficient
 * 2. CSRF token is NOT required (Bearer token is not automatically sent by cross-origin requests)
 * 3. CORS is configured to only allow trusted origins
 */

// Check origin for state-changing requests
export function validateOrigin(req, res, next) {
  const origin = req.headers.origin;
  if (!origin) {
    // For same-origin requests, this check is bypassed
    // For API requests, require origin header or same-origin
    if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE') {
      // Allow same-origin requests
      const host = req.headers.host || 'localhost';
      const requestOrigin = new URL(`http://${host}`);
      const allowed = origin === requestOrigin.origin ||
        origin === 'http://localhost:3000' ||
        origin === 'http://127.0.0.1:3000' ||
        origin === 'https://management-tugas.example.com' ||
        origin === 'http://localhost:5173';
      if (!allowed) {
        return res.status(403).json({
          ok: false,
          error: { code: 'INVALID_ORIGIN', message: 'Permintaan lintas situs ditolak.' }
        });
      }
    }
    return next();
  }

  try {
    const originUrl = new URL(origin);
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173',
      'https://management-tugas.example.com'
    ];

    if (allowedOrigins.includes(originUrl.origin)) {
      return next();
    }

    // For production, check against a configured list
    // Allow if origin matches the request host
    const host = req.headers.host || 'localhost';
    const requestOrigin = new URL(`http://${host}`).origin;
    if (originUrl.origin === requestOrigin) {
      return next();
    }

    return res.status(403).json({
      ok: false,
      error: { code: 'INVALID_ORIGIN', message: 'Permintaan lintas situs ditolak.' }
    });
  } catch {
    return res.status(400).json({
      ok: false,
      error: { code: 'INVALID_ORIGIN', message: 'Origin tidak valid.' }
    });
  }
}

// lib/security-headers.js — HTTP security headers middleware
// Implements CSP, XSS protection, and other security headers.
// Does NOT enforce HSTS on HTTP (local) environments.

const HSTS_MAX_AGE = 31536000; // 1 year in seconds
const HSTS_INCLUDE_SUBLISTS = false;

export function securityHeaders(isProduction = false) {
  return function securityHeadersMiddleware(req, res, next) {
    // Content-Security-Policy
    // Allows:
    // - Self (same-origin) for scripts, styles, images, fonts
    // - Google Fonts CDN
    // - Inline styles (added by inline-element style attribute)
    // - No external scripts (all JS loaded from same-origin)
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://*.neon.tech",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests"
    ].join('; ');
    res.setHeader('Content-Security-Policy', csp);

    // X-Content-Type-Options
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // X-Frame-Options (deprecated in favor of CSP frame-ancestors, but provides additional protection)
    // CSP frame-ancestors 'self' is primary; X-Frame-Options is a fallback
    // If CSP uses frame-ancestors, don't also set X-Frame-Options to avoid conflict
    // For broad compatibility, set X-Frame-Options: DENY
    if (!isProduction) {
      // In development, allow iframe embedding for local tools
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    } else {
      res.setHeader('X-Frame-Options', 'DENY');
    }

    // Referrer-Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions-Policy
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');

    // Cache-Control for sensitive responses (already set in API responses, but add here for completeness)
    if (req.path === '/api' || req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
    }

    // Strict-Transport-Security (HSTS) only in production/HTTPS
    if (isProduction || process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', `max-age=${HSTS_MAX_AGE}; includeSubDomains=${HSTS_INCLUDE_SUBLISTS ? '; includeSubDomains' : ''}`);
    }

    // Content-Type for responses (already set per-endpoint, but ensure here)
    if (req.path === '/api' || req.path.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }

    next();
  };
}

// Helmet-like wrapper for Express 5
export function helmetMiddleware() {
  // Return the security headers middleware
  return securityHeaders(typeof process !== 'undefined' ? process.env.NODE_ENV === 'production' : false);
}

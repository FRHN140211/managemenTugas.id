import { handleApiRequest } from '../lib/api.js';
import { proxyNeonAuthRequest } from '../lib/neon-auth-proxy.js';
import { recordProxySignIn } from '../lib/activity-analytics.js';
import { rateLimitPasswordChange } from '../lib/rate-limit.js';

export default async function handler(request, response) {
  const url = new URL(request.url || '/', 'https://' + (request.headers.host || 'localhost'));

  if (url.pathname === '/api/neon-auth/change-password') {
    const limit = await rateLimitPasswordChange.check(request);
    for (const [name, value] of Object.entries(limit.headers || {})) {
      response.setHeader(name, value);
    }
    if (!limit.allowed) {
      response.status(429).json({
        ok: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: limit.message,
          retryAfter: limit.retryAfter
        }
      });
      return;
    }
  }

  // Forgot password / reset password (Neon Auth)
  if (url.pathname === '/api/auth/forgot-password') {
    const result = await proxyNeonAuthRequest({
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body
    });
    for (const [name, value] of Object.entries(result.headers || {})) {
      response.setHeader(name, value);
    }
    response.status(result.status);
    if (result.body === null || result.body === undefined) return response.end();
    return result.raw ? response.send(result.body) : response.json(result.body);
  }

  if (url.pathname === '/api/auth/reset-password') {
    const result = await proxyNeonAuthRequest({
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body
    });
    for (const [name, value] of Object.entries(result.headers || {})) {
      response.setHeader(name, value);
    }
    response.status(result.status);
    if (result.body === null || result.body === undefined) return response.end();
    return result.raw ? response.send(result.body) : response.json(result.body);
  }

  if (url.pathname.startsWith('/api/neon-auth/')) {
    const result = await proxyNeonAuthRequest(request);
    recordProxySignIn(request, result).catch((error) => {
      console.error('Successful sign-in activity could not be recorded.', {
        code: typeof error?.code === 'string' ? error.code : 'UNKNOWN'
      });
    });
    for (const [name, value] of Object.entries(result.headers || {})) {
      response.setHeader(name, value);
    }
    response.status(result.status);
    if (result.body === null || result.body === undefined) return response.end();
    return result.raw ? response.send(result.body) : response.json(result.body);
  }
  const result = await handleApiRequest(request);
  for (const [name, value] of Object.entries(result.headers || {})) {
    response.setHeader(name, value);
  }
  response.status(result.status);
  if (result.body === null) return response.end();
  return response.json(result.body);
}

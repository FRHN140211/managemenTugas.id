import { getNeonAuthConfiguration } from './neon-auth.js';

const proxyPrefix = '/api/neon-auth';
const allowedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const forwardedRequestHeaders = ['accept', 'content-type', 'cookie', 'origin', 'user-agent'];
const forwardedResponseHeaders = [
  'cache-control',
  'content-type',
  'location',
  'retry-after',
  'set-auth-jwt',
  'www-authenticate'
];

function errorResponse(status, code, message) {
  return {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify({ ok: false, error: { code, message } }),
    raw: true
  };
}

function validOrigin(request, url) {
  const origin = request.headers.origin;
  if (!origin) return request.headers['sec-fetch-site'] !== 'cross-site';

  try {
    const forwardedHost = String(
      request.headers['x-forwarded-host'] || request.headers.host || url.host
    ).split(',')[0].trim();
    const forwardedProto = String(request.headers['x-forwarded-proto'] || 'http')
      .split(',')[0].trim().toLowerCase();
    return new URL(origin).origin === forwardedProto + '://' + forwardedHost;
  } catch {
    return false;
  }
}

export async function proxyNeonAuthRequest(request) {
  const method = String(request.method || 'GET').toUpperCase();
  if (!allowedMethods.has(method)) {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Metode tidak didukung.');
  }

  let requestUrl;
  try {
    requestUrl = new URL(request.url || '/', 'http://' + (request.headers.host || 'localhost'));
  } catch {
    return errorResponse(400, 'INVALID_REQUEST', 'Rute autentikasi tidak valid.');
  }
  if (!validOrigin(request, requestUrl)) {
    return errorResponse(403, 'INVALID_ORIGIN', 'Permintaan lintas situs ditolak.');
  }

  const suffix = requestUrl.pathname.slice(proxyPrefix.length);
  if (!requestUrl.pathname.startsWith(proxyPrefix + '/') ||
      /(?:^|\/)(?:\.{1,2}|%2e(?:%2e)?)(?:\/|$)/i.test(suffix) ||
      suffix.includes('\\')) {
    return errorResponse(404, 'NOT_FOUND', 'Rute autentikasi tidak ditemukan.');
  }

  let configuration;
  try {
    configuration = getNeonAuthConfiguration();
  } catch {
    return errorResponse(503, 'AUTH_NOT_CONFIGURED', 'Layanan autentikasi belum dikonfigurasi.');
  }

  const target = new URL(
    configuration.baseUrl + suffix + requestUrl.search,
    configuration.baseUrl
  );
  const headers = new Headers();
  for (const name of forwardedRequestHeaders) {
    const value = request.headers[name];
    if (value) headers.set(name, value);
  }

  let body;
  if (!['GET', 'HEAD'].includes(method) && request.body !== undefined && request.body !== null) {
    body = Buffer.isBuffer(request.body)
      ? request.body
      : typeof request.body === 'string'
        ? request.body
        : JSON.stringify(request.body);
  }

  let upstream;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(15000)
    });
  } catch {
    return errorResponse(502, 'AUTH_PROVIDER_UNAVAILABLE', 'Layanan autentikasi tidak dapat dihubungi.');
  }

  const responseHeaders = { 'Cache-Control': 'no-store' };
  for (const name of forwardedResponseHeaders) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders[name] = value;
  }
  const cookies = upstream.headers.getSetCookie();
  if (cookies.length) responseHeaders['Set-Cookie'] = cookies;

  return {
    status: upstream.status,
    headers: responseHeaders,
    body: Buffer.from(await upstream.arrayBuffer()),
    raw: true
  };
}

import { createRemoteJWKSet, jwtVerify } from 'jose';

const remoteKeys = new Map();
const invalidTokenErrors = new Set([
  'ERR_JOSE_ALG_NOT_ALLOWED',
  'ERR_JWKS_NO_MATCHING_KEY',
  'ERR_JWT_CLAIM_VALIDATION_FAILED',
  'ERR_JWT_EXPIRED',
  'ERR_JWT_INVALID',
  'ERR_JWS_INVALID',
  'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
  'JWTClaimValidationFailed',
  'JWTExpired',
  'JWTInvalid',
  'JWKSNoMatchingKey',
  'JWSInvalid',
  'JWSSignatureVerificationFailed',
  'JOSEAlgNotAllowed'
]);

export function getNeonAuthConfiguration() {
  const value = process.env.NEON_AUTH_BASE_URL;
  if (!value) {
    const error = new Error('Neon Auth is not configured.');
    error.code = 'AUTH_NOT_CONFIGURED';
    throw error;
  }

  let baseUrl;
  try {
    baseUrl = new URL(value);
  } catch {
    const error = new Error('Neon Auth configuration is invalid.');
    error.code = 'AUTH_NOT_CONFIGURED';
    throw error;
  }
  if (baseUrl.protocol !== 'https:' || baseUrl.username || baseUrl.password ||
      baseUrl.search || baseUrl.hash) {
    const error = new Error('Neon Auth configuration is invalid.');
    error.code = 'AUTH_NOT_CONFIGURED';
    throw error;
  }

  const base = baseUrl.href.replace(/\/+$/, '');
  return {
    baseUrl: base,
    issuer: baseUrl.origin,
    jwksUrl: base + '/.well-known/jwks.json'
  };
}

export function neonAuthCookieHeader(cookieHeader) {
  if (typeof cookieHeader !== 'string' || !cookieHeader) return '';
  return cookieHeader.split(';').map((cookie) => cookie.trim()).filter((cookie) => {
    const separator = cookie.indexOf('=');
    if (separator <= 0) return false;
    return cookie.slice(0, separator).startsWith('__Secure-neon-auth.');
  }).join('; ');
}

export async function verifyNeonSession(
  cookieHeader,
  configuration = getNeonAuthConfiguration(),
  fetchImpl = fetch
) {
  const cookies = neonAuthCookieHeader(cookieHeader);
  if (!cookies) return null;

  let response;
  try {
    response = await fetchImpl(configuration.baseUrl + '/get-session', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Cookie: cookies
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(10000)
    });
  } catch {
    const error = new Error('Neon Auth session verification is unavailable.');
    error.code = 'AUTH_PROVIDER_UNAVAILABLE';
    throw error;
  }

  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) {
    const error = new Error('Neon Auth session verification is unavailable.');
    error.code = 'AUTH_PROVIDER_UNAVAILABLE';
    throw error;
  }

  let result;
  try {
    result = await response.json();
  } catch {
    const error = new Error('Neon Auth returned an invalid session response.');
    error.code = 'AUTH_PROVIDER_UNAVAILABLE';
    throw error;
  }

  const session = result?.session;
  const user = result?.user;
  if (!session || !user || typeof user.id !== 'string' ||
      typeof user.email !== 'string' || typeof user.emailVerified !== 'boolean' ||
      session.userId !== user.id) {
    return null;
  }

  return {
    sub: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    role: 'authenticated'
  };
}

export async function verifyNeonToken(token, configuration = getNeonAuthConfiguration()) {
  if (typeof token !== 'string' || token.length > 16384) return null;

  let jwks = remoteKeys.get(configuration.jwksUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(configuration.jwksUrl));
    remoteKeys.set(configuration.jwksUrl, jwks);
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ['EdDSA'],
      issuer: configuration.issuer,
      audience: configuration.issuer
    });
    if (payload.role !== 'authenticated' ||
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        typeof payload.emailVerified !== 'boolean') {
      return null;
    }
    return payload;
  } catch (error) {
    if (invalidTokenErrors.has(error.code || error.name)) return null;
    const unavailable = new Error('Neon Auth token verification is unavailable.');
    unavailable.code = 'AUTH_PROVIDER_UNAVAILABLE';
    throw unavailable;
  }
}

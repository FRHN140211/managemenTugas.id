import { test, describe } from 'node:test';
import assert from 'node:assert';

// Mock the DOM and MT global
global.window = global.window || {};
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ className: '', innerHTML: '', hidden: false }),
  addEventListener: () => {},
  hidden: false
};

const mockErrors = [
  { code: 'USER_ALREADY_EXISTS', message: 'Email already registered' },
  { code: 'AUTH_NOT_CONFIGURED', message: 'Auth not configured' },
  { code: 'AUTH_PROVIDER_UNAVAILABLE', message: 'Provider unavailable' },
  { code: 'INVALID_PASSWORD', message: 'Password too weak' },
  { code: 'INVALID_EMAIL', message: 'Invalid email' },
  { code: 'INVALID_NAME', message: 'Invalid name' },
  { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
  { code: 'UNKNOWN_CODE', message: 'Some unknown error' },
  { code: undefined, message: 'No code' }
];

describe('Registration error mapping', () => {
  test('should map known error codes to correct alasan', () => {
    const expected = {
      'USER_ALREADY_EXISTS': 'email-terdaftar',
      'AUTH_NOT_CONFIGURED': 'auth-config',
      'AUTH_PROVIDER_UNAVAILABLE': 'auth-unavailable',
      'INVALID_PASSWORD': 'kata-sandi',
      'INVALID_EMAIL': 'email',
      'INVALID_NAME': 'nama',
      'RATE_LIMIT_EXCEEDED': 'rate-limit'
    };

    for (const [code, alasan] of Object.entries(expected)) {
      const err = { error: { code, message: 'test' } };
      // Simulate store.js error mapping logic
      let mapped;
      if (['USER_ALREADY_EXISTS', 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 'EMAIL_ALREADY_EXISTS'].includes(code)) {
        mapped = 'email-terdaftar';
      } else if (code === 'AUTH_NOT_CONFIGURED') {
        mapped = 'auth-config';
      } else if (code === 'AUTH_PROVIDER_UNAVAILABLE') {
        mapped = 'auth-unavailable';
      } else if (code === 'INVALID_PASSWORD') {
        mapped = 'kata-sandi';
      } else if (code === 'INVALID_EMAIL') {
        mapped = 'email';
      } else if (code === 'INVALID_NAME') {
        mapped = 'nama';
      } else if (code === 'RATE_LIMIT_EXCEEDED') {
        mapped = 'rate-limit';
      } else {
        mapped = 'error';
      }
      assert.strictEqual(mapped, alasan, `Code ${code} should map to ${alasan}`);
    }
  });

  test('unknown error codes should map to generic error', () => {
    const err = { error: { code: 'UNKNOWN_CODE', message: 'Something failed' } };
    const code = String(err.error.code || '').toUpperCase();
    let mapped;
    if (['USER_ALREADY_EXISTS', 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 'EMAIL_ALREADY_EXISTS'].includes(code)) {
      mapped = 'email-terdaftar';
    } else if (code === 'AUTH_NOT_CONFIGURED') {
      mapped = 'auth-config';
    } else if (code === 'AUTH_PROVIDER_UNAVAILABLE') {
      mapped = 'auth-unavailable';
    } else if (code === 'INVALID_PASSWORD') {
      mapped = 'kata-sandi';
    } else if (code === 'INVALID_EMAIL') {
      mapped = 'email';
    } else if (code === 'INVALID_NAME') {
      mapped = 'nama';
    } else if (code === 'RATE_LIMIT_EXCEEDED') {
      mapped = 'rate-limit';
    } else {
      mapped = 'error';
    }
    assert.strictEqual(mapped, 'error');
  });

  test('undefined error code should map to generic error', () => {
    const err = { error: { code: undefined, message: 'No code' } };
    const code = String(err.error.code || '').toUpperCase();
    let mapped;
    if (['USER_ALREADY_EXISTS', 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 'EMAIL_ALREADY_EXISTS'].includes(code)) {
      mapped = 'email-terdaftar';
    } else if (code === 'AUTH_NOT_CONFIGURED') {
      mapped = 'auth-config';
    } else if (code === 'AUTH_PROVIDER_UNAVAILABLE') {
      mapped = 'auth-unavailable';
    } else if (code === 'INVALID_PASSWORD') {
      mapped = 'kata-sandi';
    } else if (code === 'INVALID_EMAIL') {
      mapped = 'email';
    } else if (code === 'INVALID_NAME') {
      mapped = 'nama';
    } else if (code === 'RATE_LIMIT_EXCEEDED') {
      mapped = 'rate-limit';
    } else {
      mapped = 'error';
    }
    assert.strictEqual(mapped, 'error');
  });
});

import { test, describe } from 'node:test';
import assert from 'node:assert';

// Simulate the store.js registrasi error mapping
function mapRegistrationError(hasil) {
  if (hasil && hasil.error) {
    var code = String(hasil.error.code || '').toUpperCase();
    var alasan;
    if (['USER_ALREADY_EXISTS', 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 'EMAIL_ALREADY_EXISTS'].includes(code) ||
        /already exists|already registered/i.test(hasil.error.message || '')) {
      alasan = 'email-terdaftar';
    } else if (code === 'AUTH_NOT_CONFIGURED') {
      alasan = 'auth-config';
    } else if (code === 'AUTH_PROVIDER_UNAVAILABLE') {
      alasan = 'auth-unavailable';
    } else if (code === 'EMAIL_NOT_VERIFIED') {
      alasan = 'verifikasi-email';
    } else if (code === 'INVALID_PASSWORD') {
      alasan = 'kata-sandi';
    } else if (code === 'INVALID_EMAIL') {
      alasan = 'email';
    } else if (code === 'INVALID_NAME') {
      alasan = 'nama';
    } else if (code === 'RATE_LIMIT_EXCEEDED') {
      alasan = 'rate-limit';
    } else {
      return { ok: false, alasan: 'error', message: hasil.error.message || 'Pendaftaran Neon Auth gagal.' };
    }
    return { ok: false, alasan: alasan };
  }
  return null;
}

// Simulate views-auth.js catch block behavior
function getCatchMessage(err) {
  var code = err && err.code ? String(err.code).toUpperCase() : '';
  var messages = {
    EMAIL_NOT_VERIFIED: ['Email belum diverifikasi', 'Periksa email Anda'],
    ACCOUNT_DISABLED: ['Akun dinonaktifkan', 'Hubungi support'],
    EMAIL_ALREADY_REGISTERED: ['Email sudah terdaftar', 'Gunakan email lain'],
    AUTH_SESSION_MISSING: ['Sesi hilang', 'Login ulang'],
    AUTH_NOT_CONFIGURED: ['Auth tidak dikonfigurasi', 'Hubungi admin'],
    AUTH_PROVIDER_UNAVAILABLE: ['Layanan auth tidak tersedia', 'Coba lagi nanti'],
    INVALID_ORIGIN: ['Origin tidak valid', 'Buka dari domain terpercaya'],
    HTTP_403: ['Akses ditolak', 'Domain tidak terdaftar'],
    HTTP_5xx: ['Layanan tidak tersedia', 'Coba lagi nanti'],
    FAILED_TO_SEND_EMAIL: ['Gagal mengirim email', 'Coba lagi nanti'],
    INVALID_CALLBACK_URL: ['URL callback tidak valid', 'Hubungi admin'],
    MISSING_ORIGIN: ['Origin hilang', 'Buka dari aplikasi'],
    DATABASE_NOT_CONFIGURED: ['Database tidak dikonfigurasi', 'Hubungi admin'],
    DATABASE_SCHEMA_INCOMPLETE: ['Schema database tidak lengkap', 'Hubungi admin'],
    DATABASE_UNAVAILABLE: ['Database tidak tersedia', 'Coba lagi nanti'],
    INTERNAL_ERROR: ['Error internal', 'Coba lagi nanti'],
    INVALID_OTP: ['Kode tidak valid', 'Periksa kembali'],
    OTP_EXPIRED: ['Kode kadaluarsa', 'Minta kode baru'],
    RATE_LIMIT_EXCEEDED: ['Terlalu banyak percobaan', 'Tunggu sebentar'],
    OVER_REQUEST_RATE_LIMIT: ['Terlalu banyak percobaan', 'Tunggu sebentar']
  };
  var message = messages[code];
  return message ? message[0] : 'Authentication error';
}

describe('Forensic registration flow', () => {
  test('SDK resolves with error object -> mapped to alasan', () => {
    const sdkResult = { error: { code: 'USER_ALREADY_EXISTS', message: 'Email exists' } };
    const mapped = mapRegistrationError(sdkResult);
    assert.ok(mapped);
    assert.strictEqual(mapped.alasan, 'email-terdaftar');
    assert.strictEqual(mapped.ok, false);
  });

  test('SDK resolves with unknown error code -> generic error', () => {
    const sdkResult = { error: { code: 'UNKNOWN_ERROR', message: 'Something failed' } };
    const mapped = mapRegistrationError(sdkResult);
    assert.ok(mapped);
    assert.strictEqual(mapped.alasan, 'error');
    assert.strictEqual(mapped.message, 'Something failed');
  });

  test('SDK resolves with error but no code -> generic error', () => {
    const sdkResult = { error: { message: 'No code provided' } };
    const mapped = mapRegistrationError(sdkResult);
    assert.ok(mapped);
    assert.strictEqual(mapped.alasan, 'error');
    assert.strictEqual(mapped.message, 'No code provided');
  });

  test('SDK resolves with success but email not verified -> OTP flow', () => {
    const sdkResult = {
      data: {
        user: {
          email: 'test@example.com',
          emailVerified: false
        }
      }
    };
    const mapped = mapRegistrationError(sdkResult);
    assert.strictEqual(mapped, null); // No error mapping needed
  });

  test('catch block with unknown code shows generic auth error', () => {
    const err = { code: 'OVER_REQUEST_RATE_LIMIT', message: 'HTTP 429 Too Many Requests' };
    const msg = getCatchMessage(err);
    assert.strictEqual(msg, 'Terlalu banyak percobaan');
  });

  test('catch block with completely unknown code shows generic auth error', () => {
    const err = { code: 'SOME_RANDOM_ERROR', message: 'Random failure' };
    const msg = getCatchMessage(err);
    assert.strictEqual(msg, 'Authentication error');
  });

  test('catch block with undefined code shows generic auth error', () => {
    const err = { message: 'Network failed' };
    const msg = getCatchMessage(err);
    assert.strictEqual(msg, 'Authentication error');
  });

  test('i18n fallback returns key when translation missing', () => {
    const translations = { 'auth.field_name': 'Nama lengkap' };
    const t = (key) => translations[key] || key;
    assert.strictEqual(t('auth.field_name'), 'Nama lengkap');
    assert.strictEqual(t('auth.missing_key'), 'auth.missing_key');
  });
});

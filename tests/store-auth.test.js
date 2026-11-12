import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const storeSource = readFileSync(new URL('../assets/js/store.js', import.meta.url), 'utf8');

test('registration store flow provisions an app profile without colliding with collection listing', async () => {
  const requests = [];
  let meRequests = 0;
  const user = {
    id: 'app-user-1',
    nama: 'Nama Pengguna',
    email: 'pengguna@example.test',
    role: 'user',
    statusAkun: 'Aktif'
  };
  const window = {
    location: { origin: 'https://management.example.test' },
    MT: {
      neonAuthClient: {
        signUp: {
          email: async (input) => ({
            data: { user: { name: input.name, email: input.email, emailVerified: true } }
          })
        },
        token: async () => ({ data: { token: 'verified-token' } })
      },
      // store.js increments MT.perf.requestCounter on every API request; in the
      // browser app.js provides this. The store must not require it to be
      // pre-populated, but the fixture supplies it to mirror the real runtime.
      perf: { requestCounter: 0 }
    }
  };
  const fetch = async (path, options) => {
    requests.push({ path, options });
    if (path === '/api/auth/me') {
      meRequests += 1;
      if (meRequests === 1) {
        return {
          ok: false,
          status: 403,
          json: async () => ({ ok: false, error: { code: 'ACCOUNT_NOT_PROVISIONED' } })
        };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true, data: { user } }) };
    }
    if (path === '/api/auth/register') {
      return { ok: true, status: 201, json: async () => ({ ok: true, data: {} }) };
    }
    throw new Error(`Unexpected request: ${path}`);
  };

  runInNewContext(storeSource, { window, fetch });

  const result = await window.MT.store.registrasi(
    'Nama Pengguna',
    'pengguna@example.test',
    'PasswordUji123'
  );

  assert.deepEqual(
    requests.map(({ path }) => path),
    ['/api/auth/me', '/api/auth/register', '/api/auth/me']
  );
  assert.equal(requests[1].options.method, 'POST');
  assert.equal(requests[1].options.headers.Authorization, 'Bearer verified-token');
  assert.deepEqual(JSON.parse(requests[1].options.body), { nama: 'Nama Pengguna' });
  assert.equal(result.ok, true);
  assert.equal(result.pengguna.email, user.email);
  assert.equal(window.MT.store.penggunaAktif().email, user.email);
  assert.equal(window.MT.store.daftar('tugas').length, 0);
});

test('saving account preferences updates the active app profile through the authenticated API', async () => {
  let request;
  const updatedUser = {
    id: 'app-user-1',
    nama: 'Nama Baru',
    email: 'pengguna@example.test',
    role: 'user',
    statusAkun: 'Aktif',
    tema: 'dark',
    bahasa: 'en'
  };
  const window = {
    location: { origin: 'https://management.example.test' },
    MT: {
      neonAuthClient: {
        token: async () => ({ data: { token: 'verified-token' } })
      },
      perf: { requestCounter: 0 }
    }
  };
  const fetch = async (path, options) => {
    request = { path, options };
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: { user: updatedUser } })
    };
  };

  runInNewContext(storeSource, { window, fetch });
  const result = await window.MT.store.simpanProfil({
    nama: 'Nama Baru',
    tema: 'dark',
    bahasa: 'en'
  });

  assert.equal(request.path, '/api/profile');
  assert.equal(request.options.method, 'PATCH');
  assert.equal(request.options.headers.Authorization, 'Bearer verified-token');
  assert.deepEqual(JSON.parse(request.options.body), {
    nama: 'Nama Baru',
    tema: 'dark',
    bahasa: 'en'
  });
  assert.equal(result.tema, 'dark');
  assert.equal(window.MT.store.penggunaAktif().bahasa, 'en');
});

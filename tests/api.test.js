import test from 'node:test';
import assert from 'node:assert/strict';
import healthHandler from '../api/health.js';
import { neonAuthCookieHeader, verifyNeonSession, verifyNeonToken } from '../lib/neon-auth.js';
import { proxyNeonAuthRequest } from '../lib/neon-auth-proxy.js';
import {
  buildRecordListQueries,
  buildUserListQueries,
  handleApiRequest,
  parsePagination,
  registerAppUser,
  resolveAppUser,
  validateRecord,
  validateProfile,
  validateUser
} from '../lib/api.js';
import { loadEnvironmentFile, validateDatabaseUrl } from '../lib/database.js';
import { databaseHealthFailure } from '../lib/health.js';
import { createServer } from 'node:http';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

const taskStatuses = ['Belum Dimulai', 'Sedang Dikerjakan', 'Selesai'];

test('loads non-empty local environment values without overriding configured values', async (t) => {
  const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = mkdtempSync(join(tmpdir(), 'management-tugas-env-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, '.env.local');
  writeFileSync(file, [
    'DATABASE_URL=postgresql://db.example.test/app?sslmode=require',
    'EMPTY_RUNTIME_VALUE=from-file',
    'EMPTY_FILE_VALUE=',
    ''
  ].join('\n'));
  const environment = {
    DATABASE_URL: 'postgresql://runtime-db.example.test/app',
    EMPTY_RUNTIME_VALUE: '',
    PRESERVED: 'runtime'
  };

  assert.deepEqual(loadEnvironmentFile(file, environment), { error: null });
  assert.equal(environment.DATABASE_URL, 'postgresql://runtime-db.example.test/app');
  assert.equal(environment.EMPTY_RUNTIME_VALUE, 'from-file');
  assert.equal(Object.hasOwn(environment, 'EMPTY_FILE_VALUE'), false);
  assert.equal(environment.PRESERVED, 'runtime');
});

test('validates PostgreSQL URLs and distinguishes missing from malformed configuration', () => {
  assert.equal(
    validateDatabaseUrl('postgresql://db.example.test/app?sslmode=require').startsWith('postgresql://'),
    true
  );
  for (const [value, code] of [
    ['', 'DATABASE_NOT_CONFIGURED'],
    ['https://example.test/database', 'DATABASE_URL_INVALID'],
    ['postgresql://', 'DATABASE_URL_INVALID']
  ]) {
    assert.throws(() => validateDatabaseUrl(value), (error) => error.code === code);
  }
});

test('classifies health failures without returning underlying database details', () => {
  const notConfigured = databaseHealthFailure(Object.assign(new Error('missing'), {
    code: 'DATABASE_NOT_CONFIGURED'
  }));
  assert.equal(notConfigured.body.code, 'DATABASE_NOT_CONFIGURED');

  const malformedUrl = databaseHealthFailure(Object.assign(new Error('invalid'), {
    code: 'DATABASE_URL_INVALID'
  }));
  assert.equal(malformedUrl.body.code, 'DATABASE_URL_INVALID');

  const authentication = new Error('password authentication failed for private-user');
  authentication.code = '28P01';
  const rejected = databaseHealthFailure(authentication);
  assert.equal(rejected.body.code, 'DATABASE_AUTHENTICATION_FAILED');
  assert.doesNotMatch(JSON.stringify(rejected.body), /private-user|password authentication failed/);

  const refused = new Error('private host and credential details');
  refused.code = 'ECONNREFUSED';
  const unavailable = databaseHealthFailure(refused);
  assert.equal(unavailable.body.code, 'DATABASE_CONNECTION_FAILED');
  assert.doesNotMatch(JSON.stringify(unavailable.body), /private host|credential details/);

  const incompleteSchema = databaseHealthFailure(Object.assign(new Error('missing relation'), {
    code: '42P01'
  }));
  assert.equal(incompleteSchema.body.code, 'DATABASE_SCHEMA_INCOMPLETE');
});

test('accepts a valid task and preserves its calendar date', () => {
  const result = validateRecord({
    nama: 'Rapat tim',
    deskripsi: 'Membahas progres pekerjaan.',
    deadline: '2026-10-25',
    status: 'Belum Dimulai'
  }, taskStatuses);

  assert.deepEqual(result.fields, {});
  assert.equal(result.value.deadline, '2026-10-25');
});

test('rejects invalid task status and calendar date', () => {
  const result = validateRecord({
    nama: 'Rapat tim',
    deskripsi: 'Membahas progres pekerjaan.',
    deadline: '2026-02-30',
    status: 'Selesai otomatis'
  }, taskStatuses);

  assert.ok(result.fields.deadline);
  assert.ok(result.fields.status);
});

test('validates account profile fields without allowing email or role changes', () => {
  const valid = validateProfile({ nama: 'Nama Baru', tema: 'system', bahasa: 'en' });
  assert.deepEqual(valid.fields, {});
  assert.deepEqual(valid.value, { nama: 'Nama Baru', tema: 'system', bahasa: 'en' });

  const invalid = validateProfile({ email: 'new@example.com', role: 'owner' });
  assert.ok(invalid.fields.email);
  assert.ok(invalid.fields.role);
  assert.deepEqual(invalid.value, {});
});

test('account profile API updates only the authenticated user and protects role and email', async () => {
  const payload = {
    sub: 'neon-profile-user',
    email: 'profile@example.com',
    emailVerified: true,
    role: 'authenticated'
  };
  const user = {
    id: 'app-profile-user',
    auth_subject: payload.sub,
    name: 'Nama Lama',
    email: payload.email,
    role: 'user',
    account_status: 'Aktif',
    theme_preference: null,
    language_preference: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  };
  const updates = [];
  const dependencies = {
    verifyToken: async (token) => token === 'valid-profile-token' ? payload : null,
    query: async (statement, parameters = []) => {
      if (/WHERE auth_subject = \$1/.test(statement)) return [user];
      if (/UPDATE users SET/.test(statement)) {
        updates.push({ statement, parameters });
        const row = { ...user };
        statement.match(/\b(name|theme_preference|language_preference) = \$(\d+)/g).forEach((assignment) => {
          const [, column, position] = assignment.match(/\b(name|theme_preference|language_preference) = \$(\d+)/);
          row[column] = parameters[Number(position) - 1];
        });
        return [row];
      }
      assert.fail('Unexpected profile query: ' + statement);
    }
  };
  const headers = {
    host: 'localhost:3000',
    origin: 'http://localhost:3000',
    authorization: 'Bearer valid-profile-token'
  };

  const saved = await handleApiRequest({
    method: 'PATCH',
    url: '/api/profile',
    headers,
    body: { nama: 'Nama Baru', tema: 'dark', bahasa: 'en' }
  }, dependencies);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.user.nama, 'Nama Baru');
  assert.equal(saved.body.data.user.tema, 'dark');
  assert.equal(saved.body.data.user.bahasa, 'en');
  assert.equal(saved.body.data.user.role, 'user');
  assert.match(updates[0].statement, /WHERE id = \$1/);
  assert.deepEqual(updates[0].parameters, ['app-profile-user', 'Nama Baru', 'dark', 'en']);

  const forbidden = await handleApiRequest({
    method: 'PATCH',
    url: '/api/profile',
    headers,
    body: { role: 'owner', email: 'new@example.com' }
  }, dependencies);
  assert.equal(forbidden.status, 400);
  assert.equal(forbidden.body.error.code, 'INVALID_PROFILE');
  assert.equal(updates.length, 1);
});

test('validates user creation input without accepting a local-auth password', () => {
  const validUser = validateUser({
    nama: 'Owner Utama',
    email: 'owner@example.com',
    role: 'owner',
    statusAkun: 'Aktif'
  });
  assert.deepEqual(validUser.fields, {});
  assert.equal(Object.hasOwn(validUser.value, 'kataSandi'), false);

  const defaultStatus = validateUser({
    nama: 'User Baru',
    email: 'user@example.com',
    role: 'user'
  });
  assert.deepEqual(defaultStatus.fields, {});
  assert.equal(defaultStatus.value.statusAkun, 'Aktif');
});

test('maps verified Neon identities to Owner and User roles from the application database', async () => {
  const payload = {
    sub: 'neon-user-id',
    email: 'OWNER@example.com',
    emailVerified: true,
    role: 'authenticated'
  };
  const ownerRow = {
    id: 'app-owner-id',
    auth_subject: payload.sub,
    name: 'Owner',
    email: 'owner@example.com',
    role: 'owner',
    account_status: 'Aktif',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  };
  const ownerQueries = [];
  const executeQuery = async (statement, parameters) => {
    ownerQueries.push({ statement, parameters });
    if (/WHERE auth_subject = \$1/.test(statement)) {
      assert.match(statement, /FROM users/);
      assert.deepEqual(parameters, [payload.sub]);
      return [];
    }
    if (/WHERE lower\(email\) = lower\(\$1\)/.test(statement)) {
      assert.match(statement, /FROM users/);
      assert.deepEqual(parameters, [payload.email]);
      return [Object.assign({}, ownerRow, { auth_subject: null })];
    }
    if (/UPDATE users SET auth_subject/.test(statement)) {
      assert.match(statement, /UPDATE users/);
      assert.deepEqual(parameters, [payload.sub, ownerRow.id]);
      return [ownerRow];
    }
    assert.fail('Unexpected application user query.');
  };
  const owner = await resolveAppUser(payload, executeQuery);
  assert.equal(owner.user.role, 'owner');
  assert.equal(owner.user.id, 'app-owner-id');
  assert.equal(owner.user.nama, 'Owner');
  assert.equal(ownerQueries.length, 3);

  const user = await resolveAppUser({
    ...payload,
    email: 'member@example.com',
    role: 'owner'
  }, async (statement, parameters) => {
    assert.match(statement, /WHERE auth_subject = \$1/);
    assert.deepEqual(parameters, [payload.sub]);
    return [{
      id: 'app-user-id',
      auth_subject: payload.sub,
      name: 'Member',
      email: 'member@example.com',
      role: 'user',
      account_status: 'Aktif'
    }];
  });
  assert.equal(user.user.role, 'user');
});

test('blocks unverified, inactive, and unprovisioned Neon identities', async () => {
  let queryCalled = false;
  const unverified = await resolveAppUser({
    sub: 'neon-id',
    email: 'member@example.com',
    emailVerified: false
  }, async () => {
    queryCalled = true;
    return [];
  });
  assert.equal(unverified.error.status, 403);
  assert.equal(unverified.error.body.error.code, 'EMAIL_NOT_VERIFIED');
  assert.equal(queryCalled, false);

  const unprovisioned = await resolveAppUser({
    sub: 'neon-id',
    email: 'unknown@example.com',
    emailVerified: true
  }, async () => []);
  assert.equal(unprovisioned.error.body.error.code, 'ACCOUNT_NOT_PROVISIONED');

  const inactive = await resolveAppUser({
    sub: 'neon-id',
    email: 'inactive@example.com',
    emailVerified: true
  }, async (statement, parameters) => /WHERE auth_subject = \$1/.test(statement) ? [{
    id: 'inactive-user',
    auth_subject: parameters[0],
    name: 'Inactive',
    email: 'inactive@example.com',
    role: 'owner',
    account_status: 'Nonaktif'
  }] : []);
  assert.equal(inactive.error.body.error.code, 'ACCOUNT_DISABLED');
});

function registrationDatabase() {
  const users = [];
  return {
    users,
    async query(statement, parameters = []) {
      if (/SELECT [\s\S]*FROM users WHERE auth_subject = \$1/.test(statement)) {
        return users.filter((user) => user.auth_subject === parameters[0]);
      }
      if (/SELECT [\s\S]*FROM users WHERE lower\(email\) = lower\(\$1\)/.test(statement)) {
        return users.filter((user) => user.email.toLowerCase() === parameters[0].toLowerCase());
      }
      if (/UPDATE users SET auth_subject/.test(statement)) {
        const user = users.find((item) => item.id === parameters[1] && !item.auth_subject);
        if (!user) return [];
        user.auth_subject = parameters[0];
        return [user];
      }
      if (/INSERT INTO users/.test(statement)) {
        const [id, subject, name, email, passwordHash] = parameters;
        if (users.some((user) => user.email === email || user.auth_subject === subject)) {
          const error = new Error('unique constraint conflict');
          error.code = '23505';
          throw error;
        }
        const user = {
          id,
          auth_subject: subject,
          name,
          email,
          password_hash: passwordHash,
          role: 'user',
          account_status: 'Aktif',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z'
        };
        users.push(user);
        return [user];
      }
      assert.fail('Unexpected registration query: ' + statement);
    }
  };
}

test('creates ManagenTugas.id profiles only from a verified provider identity', async () => {
  const database = registrationDatabase();
  const payload = {
    sub: 'neon-new-user',
    email: 'member@example.com',
    emailVerified: true,
    role: 'authenticated'
  };
  const created = await registerAppUser(payload, 'Member Baru', database.query.bind(database));
  assert.equal(created.created, true);
  assert.equal(created.user.nama, 'Member Baru');
  assert.equal(created.user.email, payload.email);
  assert.equal(created.user.role, 'user');
  assert.equal(database.users.length, 1);
  assert.match(database.users[0].password_hash, /^\$2[aby]\$/);

  const repeated = await registerAppUser(
    payload, 'Nama yang tidak boleh menimpa', database.query.bind(database)
  );
  assert.equal(repeated.created, false);
  assert.equal(repeated.user.id, created.user.id);
  assert.equal(repeated.user.nama, 'Member Baru');
  assert.equal(repeated.user.role, 'user');
});

test('does not create profiles for unverified identities or take over linked email profiles', async () => {
  let queries = 0;
  const noDatabase = async () => {
    queries += 1;
    return [];
  };
  const unverified = await registerAppUser({
    sub: 'neon-unverified',
    email: 'member@example.com',
    emailVerified: false
  }, 'Member Baru', noDatabase);
  assert.equal(unverified.error.body.error.code, 'EMAIL_NOT_VERIFIED');
  assert.equal(queries, 0);

  const database = registrationDatabase();
  database.users.push({
    id: 'existing-profile',
    auth_subject: 'another-neon-id',
    name: 'Existing Owner',
    email: 'owner@example.com',
    role: 'owner',
    account_status: 'Aktif'
  });
  const duplicate = await registerAppUser({
    sub: 'unrelated-neon-id',
    email: 'owner@example.com',
    emailVerified: true
  }, 'Nama Tidak Sah', database.query.bind(database));
  assert.equal(duplicate.error.status, 409);
  assert.equal(duplicate.error.body.error.code, 'IDENTITY_ALREADY_LINKED');
  assert.equal(database.users.length, 1);
  assert.equal(database.users[0].name, 'Existing Owner');
  assert.equal(database.users[0].role, 'owner');
});

test('auth registration endpoint provisions a User profile and restores its session', async () => {
  const database = registrationDatabase();
  const payload = {
    sub: 'neon-api-user',
    email: 'api-user@example.com',
    emailVerified: true,
    role: 'authenticated'
  };
  const dependencies = {
    query: database.query.bind(database),
    verifyToken: async (token) => token === 'valid-test-token' ? payload : null
  };
  const headers = {
    host: 'localhost:3000',
    origin: 'http://localhost:3000',
    authorization: 'Bearer valid-test-token'
  };
  const registered = await handleApiRequest({
    method: 'POST',
    url: '/api/auth/register',
    headers,
    body: {
      nama: 'API User',
      email: 'forged@example.com',
      role: 'owner'
    }
  }, dependencies);
  assert.equal(registered.status, 201);
  assert.equal(registered.body.data.user.email, payload.email);
  assert.equal(registered.body.data.user.role, 'user');

  const session = await handleApiRequest({
    method: 'GET',
    url: '/api/auth/me',
    headers
  }, dependencies);
  assert.equal(session.status, 200);
  assert.equal(session.body.data.user.id, registered.body.data.user.id);

  const duplicate = await handleApiRequest({
    method: 'POST',
    url: '/api/auth/register',
    headers,
    body: { nama: 'Different Name', role: 'owner' }
  }, dependencies);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.data.user.role, 'user');
  assert.equal(database.users.length, 1);
});

test('registration rejects missing sessions and returns safe errors when the database is unavailable', async () => {
  const payload = {
    sub: 'neon-api-user',
    email: 'api-user@example.com',
    emailVerified: true
  };
  const unauthenticated = await handleApiRequest({
    method: 'POST',
    url: '/api/auth/register',
    headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
    body: { nama: 'API User' }
  }, {
    verifyToken: async () => payload,
    query: async () => assert.fail('Unauthenticated registration must not access the database.')
  });
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticated.body.error.code, 'UNAUTHENTICATED');

  const databaseFailure = new Error('secret database endpoint and password');
  databaseFailure.code = 'ECONNRESET';
  const failed = await handleApiRequest({
    method: 'POST',
    url: '/api/auth/register',
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      authorization: 'Bearer valid-test-token'
    },
    body: { nama: 'API User' }
  }, {
    verifyToken: async () => payload,
    query: async () => { throw databaseFailure; }
  });
  assert.equal(failed.status, 503);
  assert.equal(failed.body.error.code, 'DATABASE_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(failed.body), /secret database endpoint|password/);
});

test('verifies Neon EdDSA tokens against JWKS, issuer, audience, expiry, and token role', async (t) => {
  const { publicKey, privateKey } = await generateKeyPair('EdDSA');
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = 'test-neon-key';
  publicJwk.alg = 'EdDSA';

  const server = createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' });
    response.end(JSON.stringify({ keys: [publicJwk] }));
  });
  server.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  const configuration = {
    issuer: 'https://auth.example.test',
    jwksUrl: `http://127.0.0.1:${server.address().port}/.well-known/jwks.json`
  };
  const tokenFor = (claims) => new SignJWT({
    role: 'authenticated',
    email: 'member@example.com',
    emailVerified: true,
    ...claims
  }).setProtectedHeader({ alg: 'EdDSA', kid: 'test-neon-key' })
    .setIssuer(configuration.issuer)
    .setAudience(configuration.issuer)
    .setSubject('neon-user-id')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);

  const valid = await verifyNeonToken(await tokenFor({}), configuration);
  assert.equal(valid.email, 'member@example.com');

  const forgedRole = await verifyNeonToken(await tokenFor({ role: 'owner' }), configuration);
  assert.equal(forgedRole, null);

  const wrongAudience = await new SignJWT({
    role: 'authenticated',
    email: 'member@example.com',
    emailVerified: true
  }).setProtectedHeader({ alg: 'EdDSA', kid: 'test-neon-key' })
    .setIssuer(configuration.issuer)
    .setAudience('https://other.example.test')
    .setSubject('neon-user-id')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
  assert.equal(await verifyNeonToken(wrongAudience, configuration), null);
});

test('auth proxy rejects cross-origin writes and hides missing configuration', async () => {
  const previousBaseUrl = process.env.NEON_AUTH_BASE_URL;
  delete process.env.NEON_AUTH_BASE_URL;
  try {
    const denied = await proxyNeonAuthRequest({
      method: 'POST',
      url: '/api/neon-auth/sign-in/email',
      headers: {
        host: 'localhost:3000',
        origin: 'https://attacker.example'
      },
      body: { email: 'user@example.com' }
    });
    assert.equal(denied.status, 403);

    const missing = await proxyNeonAuthRequest({
      method: 'GET',
      url: '/api/neon-auth/get-session',
      headers: { host: 'localhost:3000' }
    });
    assert.equal(missing.status, 503);
    assert.doesNotMatch(missing.body, /NEON_AUTH_BASE_URL|https:\/\//);
  } finally {
    if (previousBaseUrl === undefined) delete process.env.NEON_AUTH_BASE_URL;
    else process.env.NEON_AUTH_BASE_URL = previousBaseUrl;
  }
});

test('auth proxy forwards SDK requests and session cookies without exposing its upstream URL', async () => {
  const previousBaseUrl = process.env.NEON_AUTH_BASE_URL;
  const previousFetch = globalThis.fetch;
  process.env.NEON_AUTH_BASE_URL = 'https://auth.example.test/project/auth';
  let forwardedUrl;
  let forwardedCookie;
  globalThis.fetch = async (url, options) => {
    forwardedUrl = new URL(url);
    forwardedCookie = options.headers.get('cookie');
    return new Response(JSON.stringify({ session: null }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'neonauth_session=opaque; HttpOnly; Secure; SameSite=None'
      }
    });
  };
  try {
    const result = await proxyNeonAuthRequest({
      method: 'POST',
      url: '/api/neon-auth/sign-in/email?source=spa',
      headers: {
        host: 'app.example.test',
        'x-forwarded-proto': 'https',
        origin: 'https://app.example.test',
        cookie: 'neonauth_session=existing'
      },
      body: { email: 'member@example.com', password: 'not-logged' }
    });
    assert.equal(result.status, 200);
    assert.equal(forwardedUrl.pathname, '/project/auth/sign-in/email');
    assert.equal(forwardedUrl.search, '?source=spa');
    assert.equal(forwardedCookie, 'neonauth_session=existing');
    assert.match(result.headers['Set-Cookie'][0], /HttpOnly/);
    assert.equal(JSON.parse(result.body.toString()).session, null);
    assert.doesNotMatch(result.body.toString(), /auth\.example\.test/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousBaseUrl === undefined) delete process.env.NEON_AUTH_BASE_URL;
    else process.env.NEON_AUTH_BASE_URL = previousBaseUrl;
  }
});

test('validates page and page-size inputs and caps only one response page', () => {
  assert.deepEqual(parsePagination(new URLSearchParams()), {
    page: 1, pageSize: 8, offset: 0
  });
  assert.deepEqual(parsePagination(new URLSearchParams('page=2&pageSize=100')), {
    page: 2, pageSize: 100, offset: 100
  });
  for (const value of ['page=0', 'page=-1', 'page=1.5', 'page=9007199254740992', 'pageSize=101', 'pageSize=0']) {
    assert.ok(parsePagination(new URLSearchParams(value)).error, value);
  }
});

test('builds all record list queries with bound filters and deterministic pagination', () => {
  const [count, rows] = buildRecordListQueries('tasks', { role: 'owner', id: 'owner-id' }, {
    page: 6,
    pageSize: 25,
    offset: 125,
    search: 'special task%',
    status: 'Selesai',
    sort: 'deadline-asc',
    from: '',
    to: ''
  });

  assert.deepEqual(count.parameters, ['owner', 'owner-id', 'Selesai', '%special task%%']);
  assert.match(count.statement, /count\(\*\)::int AS total/);
  assert.match(rows.statement, /ORDER BY r\.deadline ASC, r\.id ASC/);
  assert.match(rows.statement, /LIMIT \$5 OFFSET \$6/);
  assert.doesNotMatch(rows.statement, /LIMIT 500/);
  assert.deepEqual(rows.parameters, ['owner', 'owner-id', 'Selesai', '%special task%%', 25, 125]);
});

test('builds a user list query with server-side filters and stable ordering', () => {
  const [count, rows] = buildUserListQueries({
    role: 'user',
    status: 'Aktif',
    search: 'target@example.test',
    sort: 'email',
    pageSize: 8,
    offset: 8
  });
  assert.deepEqual(count.parameters, ['user', 'Aktif', '%target@example.test%']);
  assert.match(rows.statement, /ORDER BY u\.email ASC, u\.id ASC/);
  assert.match(rows.statement, /LIMIT \$4 OFFSET \$5/);
  assert.deepEqual(rows.parameters, ['user', 'Aktif', '%target@example.test%', 8, 8]);
});

test('unauthenticated collection access is rejected', async () => {
  const result = await handleApiRequest({
    method: 'GET',
    url: '/api/tasks',
    headers: { host: 'localhost:3000' }
  });

  assert.equal(result.status, 401);
  assert.equal(result.body.error.code, 'UNAUTHENTICATED');
});

test('health-independent auth session lookup returns a signed-out state', async () => {
  const result = await handleApiRequest({
    method: 'GET',
    url: '/api/auth/me',
    headers: { host: 'localhost:3000' }
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data, { user: null });
  assert.equal(result.headers['Cache-Control'], 'no-store');
});

test('auth session lookup validates Neon Auth cookies with the provider when no bearer token is available', async () => {
  const cookie = '__Secure-neon-auth.session_token=opaque-session; app-cookie=not-forwarded';
  const payload = {
    sub: 'neon-cookie-user',
    email: 'cookie-user@example.com',
    emailVerified: true,
    role: 'authenticated'
  };
  const userRow = {
    id: 'app-cookie-user',
    auth_subject: payload.sub,
    name: 'Cookie User',
    email: payload.email,
    role: 'user',
    account_status: 'Aktif',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  };
  const result = await handleApiRequest({
    method: 'GET',
    url: '/api/auth/me',
    headers: { host: 'localhost:3000', cookie }
  }, {
    verifySession: async (requestCookie) => {
      assert.equal(requestCookie, cookie);
      return payload;
    },
    query: async (statement, parameters) => {
      assert.match(statement, /WHERE auth_subject = \$1/);
      assert.deepEqual(parameters, [payload.sub]);
      return [userRow];
    }
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.data.user.id, userRow.id);
  assert.equal(result.body.data.user.email, payload.email);
});

test('Neon session verification forwards only provider cookies and maps the verified identity', async () => {
  const cookie = [
    'application-cookie=do-not-forward',
    '__Secure-neon-auth.session_token=opaque-session',
    '__Secure-neon-auth.local.session_data=signed-session'
  ].join('; ');
  assert.equal(
    neonAuthCookieHeader(cookie),
    '__Secure-neon-auth.session_token=opaque-session; __Secure-neon-auth.local.session_data=signed-session'
  );

  let requestUrl;
  let requestOptions;
  const payload = {
    session: { userId: 'neon-session-user' },
    user: {
      id: 'neon-session-user',
      email: 'session@example.com',
      emailVerified: true
    }
  };
  const identity = await verifyNeonSession(cookie, {
    baseUrl: 'https://auth.example.test'
  }, async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return {
      ok: true,
      status: 200,
      json: async () => payload
    };
  });

  assert.equal(requestUrl, 'https://auth.example.test/get-session');
  assert.equal(requestOptions.headers.Cookie, neonAuthCookieHeader(cookie));
  assert.equal(requestOptions.redirect, 'manual');
  assert.deepEqual(identity, {
    sub: 'neon-session-user',
    email: 'session@example.com',
    emailVerified: true,
    role: 'authenticated'
  });
});

test('Neon session verification treats missing sessions as unauthenticated and reports provider outages safely', async () => {
  let fetchCalls = 0;
  assert.equal(await verifyNeonSession('app-cookie=value', {
    baseUrl: 'https://auth.example.test'
  }, async () => {
    fetchCalls++;
  }), null);
  assert.equal(fetchCalls, 0);

  assert.equal(await verifyNeonSession('__Secure-neon-auth.session_token=expired', {
    baseUrl: 'https://auth.example.test'
  }, async () => ({
    ok: true,
    status: 200,
    json: async () => null
  })), null);

  await assert.rejects(
    verifyNeonSession('__Secure-neon-auth.session_token=session', {
      baseUrl: 'https://auth.example.test'
    }, async () => {
      throw new Error('private upstream details');
    }),
    (error) => error.code === 'AUTH_PROVIDER_UNAVAILABLE' &&
      !error.message.includes('private upstream details')
  );
});

test('disables the previous password-login endpoint', async () => {
  const result = await handleApiRequest({
    method: 'POST',
    url: '/api/auth/login',
    headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
    body: { email: 'owner@example.com', kataSandi: 'legacy-password' }
  });

  assert.equal(result.status, 404);
  assert.equal(result.body.error.code, 'NOT_FOUND');
  assert.equal(result.headers['Cache-Control'], 'no-store');
});

test('does not treat a legacy session cookie as authenticated', async () => {
  const result = await handleApiRequest({
    method: 'GET',
    url: '/api/tasks',
    headers: { host: 'localhost:3000', cookie: 'mt_session=old-session' }
  });

  assert.equal(result.status, 401);
  assert.equal(result.body.error.code, 'UNAUTHENTICATED');
});

test('returns a JSON 404 for unknown API endpoints without requiring a session', async () => {
  for (const endpoint of ['/api/test-db', '/api/not-a-route']) {
    const result = await handleApiRequest({
      method: 'GET',
      url: endpoint,
      headers: { host: 'localhost:3000' }
    });
    assert.equal(result.status, 404, endpoint);
    assert.equal(result.body.error.code, 'NOT_FOUND', endpoint);
  }
});

test('keeps the database health endpoint public and rejects unsupported methods', async () => {
  const result = await handleApiRequest({
    method: 'POST',
    url: '/api/health',
    headers: { host: 'localhost:3000' }
  });

  assert.equal(result.status, 405);
  assert.equal(result.body.error.code, 'METHOD_NOT_ALLOWED');
  assert.equal(result.headers.Allow, 'GET');

  const headers = {};
  const response = {
    setHeader(name, value) {
      headers[name] = value;
    },
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  await healthHandler({ method: 'POST' }, response);

  assert.equal(response.statusCode, result.status);
  assert.deepEqual(response.body, result.body);
  assert.equal(headers.Allow, result.headers.Allow);
  assert.equal(headers['Cache-Control'], 'no-store');

  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'https://example.invalid/not-a-postgres-database';
  try {
    const localHealth = await handleApiRequest({
      method: 'GET',
      url: '/api/health',
      headers: { host: 'localhost:3000' }
    });
    const serverlessResponseHeaders = {};
    const serverlessResponse = {
      setHeader(name, value) {
        serverlessResponseHeaders[name] = value;
      },
      status(status) {
        this.statusCode = status;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      }
    };
    await healthHandler({ method: 'GET' }, serverlessResponse);

    assert.equal(localHealth.status, 503);
    assert.equal(localHealth.body.code, 'DATABASE_URL_INVALID');
    assert.equal(serverlessResponse.statusCode, localHealth.status);
    assert.deepEqual(serverlessResponse.body, localHealth.body);
    assert.equal(serverlessResponseHeaders['Cache-Control'], 'no-store');
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test('does not accept passwords through the retired local login endpoint', async () => {
  const result = await handleApiRequest({
    method: 'POST',
    url: '/api/auth/login',
    headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
    body: { email: 'owner@menajemen tugas.id', kataSandi: 'legacy-password' }
  });

  assert.equal(result.status, 404);
  assert.equal(result.body.error.code, 'NOT_FOUND');
});

test('rejects malformed auth routes without checking the database', async () => {
  const result = await handleApiRequest({
    method: 'GET',
    url: '/api/auth/me/extra',
    headers: { host: 'localhost:3000' }
  });

  assert.equal(result.status, 404);
  assert.equal(result.body.error.code, 'NOT_FOUND');
});

test('rejects cross-origin writes before checking the session', async () => {
  const result = await handleApiRequest({
    method: 'POST',
    url: '/api/auth/login',
    headers: {
      host: 'localhost:3000',
      origin: 'https://attacker.example'
    },
    body: { email: 'owner@example.com', kataSandi: 'long-password' }
  });

  assert.equal(result.status, 403);
  assert.equal(result.body.error.code, 'INVALID_ORIGIN');
});

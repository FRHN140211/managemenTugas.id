import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { handleApiRequest } from '../lib/api.js';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const RECORD_COUNT = 1237;
const BATCH_SIZE = 100;
const RECORD_TABLES = ['tasks', 'reports', 'reminders'];

function apiRequest(path, token, method = 'GET', body) {
  return handleApiRequest({
    method,
    url: path,
    headers: {
      host: 'localhost:3000',
      authorization: 'Bearer ' + token
    },
    body
  });
}

async function neonTokenFor(email, subject, privateKey, issuer) {
  return new SignJWT({
    role: 'authenticated',
    email,
    emailVerified: true
  }).setProtectedHeader({ alg: 'EdDSA', kid: 'test-neon-key' })
    .setIssuer(issuer)
    .setAudience(issuer)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

async function insertBatch(query, table, columns, rows) {
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    const parameters = [];
    const values = batch.map((row) => {
      const placeholders = row.map((value) => {
        parameters.push(value);
        return '$' + parameters.length;
      });
      return '(' + placeholders.join(', ') + ')';
    });
    await query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${values.join(', ')}`,
      parameters
    );
  }
}

test('isolated Neon integration: paginates 1,237 rows and protects concurrent Owners', {
  skip: !TEST_DATABASE_URL
}, async (t) => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const previousAuthBaseUrl = process.env.NEON_AUTH_BASE_URL;
  const previousFetch = globalThis.fetch;
  const issuer = 'https://auth.integration.test';
  const { publicKey, privateKey } = await generateKeyPair('EdDSA');
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = 'test-neon-key';
  publicJwk.alg = 'EdDSA';
  const jwksUrl = issuer + '/.well-known/jwks.json';
  process.env.NEON_AUTH_BASE_URL = issuer;
  globalThis.fetch = async (input, options) => {
    if (new URL(input).href === jwksUrl) {
      return new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' }
      });
    }
    return previousFetch(input, options);
  };
  t.after(() => {
    globalThis.fetch = previousFetch;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousAuthBaseUrl === undefined) delete process.env.NEON_AUTH_BASE_URL;
    else process.env.NEON_AUTH_BASE_URL = previousAuthBaseUrl;
  });

  const { query } = await import('../lib/database.js');
  const database = await query('SELECT current_database() AS name');
  assert.match(database[0].name, /(^|[_-])test([_-]|$)/i,
    'TEST_DATABASE_URL must connect to a database whose name clearly identifies it as test-only.');

  const tables = await query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN
            ('users', 'tasks', 'reports', 'reminders', 'sessions', 'login_rate_limits', 'activity_logs')`
  );
  assert.equal(tables.length, 7, 'Apply the canonical database schema to the disposable test database first.');
  const authSubjectColumn = await query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'auth_subject'`
  );
  assert.equal(authSubjectColumn.length, 1, 'Apply database/migrations/003_neon_auth_subject.sql first.');
  const existing = await query(
    'SELECT (SELECT count(*) FROM users) + (SELECT count(*) FROM tasks) + ' +
    '(SELECT count(*) FROM reports) + (SELECT count(*) FROM reminders) + ' +
    '(SELECT count(*) FROM sessions) + (SELECT count(*) FROM login_rate_limits) + ' +
    '(SELECT count(*) FROM activity_logs) AS total'
  );
  assert.equal(Number(existing[0].total), 0, 'Every table in the disposable test database must be empty before this test runs.');

  const prefix = 'test-' + randomUUID();
  const ownerId = prefix + '-owner';
  const ownerToken = await neonTokenFor(
    `${prefix}-owner@example.test`, `${prefix}-owner-identity`, privateKey, issuer
  );
  const passwordHash = await bcrypt.hash('integration-only-password', 4);
  let createdTaskId;
  const users = Array.from({ length: RECORD_COUNT }, (_, index) => {
    const suffix = String(index).padStart(4, '0');
    return [
      `${prefix}-user-${suffix}`,
      `${prefix} user ${suffix}`,
      `${prefix}-user-${suffix}@example.test`,
      passwordHash,
      'user',
      'Aktif',
      '2026-01-01T00:00:00.000Z'
    ];
  });
  const owner = [
    ownerId, 'Integration Owner', `${prefix}-owner@example.test`,
    passwordHash, 'owner', 'Aktif', '2026-01-01T00:00:00.000Z'
  ];
  const taskRows = Array.from({ length: RECORD_COUNT }, (_, index) => [
    `${prefix}-task-${String(index).padStart(4, '0')}`,
    `${prefix} task ${String(index).padStart(4, '0')}`,
    index === RECORD_COUNT - 1 ? `unique-search-${prefix}-last` : 'synthetic task description',
    '2040-12-01',
    ['Belum Dimulai', 'Sedang Dikerjakan', 'Selesai'][index % 3],
    ownerId,
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  ]);
  const reportRows = Array.from({ length: RECORD_COUNT }, (_, index) => [
    `${prefix}-report-${String(index).padStart(4, '0')}`,
    `${prefix} report ${String(index).padStart(4, '0')}`,
    index === RECORD_COUNT - 1 ? `unique-report-search-${prefix}-last` : 'synthetic report description',
    '2040-12-01',
    ['Belum Dimulai', 'Sedang Dikerjakan', 'Selesai'][index % 3],
    ownerId,
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  ]);
  const reminderRows = Array.from({ length: RECORD_COUNT }, (_, index) => [
    `${prefix}-reminder-${String(index).padStart(4, '0')}`,
    `${prefix} reminder ${String(index).padStart(4, '0')}`,
    'synthetic reminder description',
    '2040-12-01',
    ['Aktif', 'Nonaktif', 'Selesai'][index % 3],
    ownerId,
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  ]);

  t.after(async () => {
    if (createdTaskId) await query('DELETE FROM tasks WHERE id = $1', [createdTaskId]);
    await query('DELETE FROM tasks WHERE id LIKE $1', [prefix + '-%']);
    await query('DELETE FROM reports WHERE id LIKE $1', [prefix + '-%']);
    await query('DELETE FROM reminders WHERE id LIKE $1', [prefix + '-%']);
    await query(
      `DELETE FROM activity_logs
        WHERE object_name LIKE $1 OR actor_id IN (SELECT id FROM users WHERE id LIKE $1)`,
      [prefix + '-%']
    );
    // The registration subtest creates a user whose id is a server-assigned UUID
    // (not prefixed), so match on the prefixed email / auth_subject too.
    await query(
      `DELETE FROM users
        WHERE id LIKE $1 OR email LIKE $1 OR auth_subject LIKE $1`,
      [prefix + '-%']
    );
  });

  await insertBatch(query, 'users',
    ['id', 'name', 'email', 'password_hash', 'role', 'account_status', 'updated_at'],
    [owner, ...users]);
  await insertBatch(query, 'tasks',
    ['id', 'name', 'description', 'deadline', 'status', 'created_by', 'created_at', 'updated_at'], taskRows);
  await insertBatch(query, 'reports',
    ['id', 'name', 'description', 'deadline', 'status', 'created_by', 'created_at', 'updated_at'], reportRows);
  await insertBatch(query, 'reminders',
    ['id', 'name', 'description', 'deadline', 'status', 'created_by', 'created_at', 'updated_at'], reminderRows);
  await t.test('enumerates every page for Users, Tasks, Reports, and Reminders', async () => {
    const cases = [
      { endpoint: 'users', marker: `${prefix} user`, expectedFirst: `${prefix}-user-0000`, expectedLast: `${prefix}-user-1236` },
      { endpoint: 'tasks', marker: `${prefix} task`, expectedFirst: `${prefix}-task-0000`, expectedLast: `${prefix}-task-1236` },
      { endpoint: 'reports', marker: `${prefix} report`, expectedFirst: `${prefix}-report-0000`, expectedLast: `${prefix}-report-1236` },
      { endpoint: 'reminders', marker: `${prefix} reminder`, expectedFirst: `${prefix}-reminder-0000`, expectedLast: `${prefix}-reminder-1236` }
    ];

    for (const item of cases) {
      const ids = [];
      let page = 1;
      let reportedTotal;
      while (true) {
        const search = item.endpoint === 'users' ? `${prefix} user` : prefix;
        const response = await apiRequest(
          `/api/${item.endpoint}?page=${page}&pageSize=97&sort=name&q=${encodeURIComponent(search)}`,
          ownerToken
        );
        assert.equal(response.status, 200, item.endpoint);
        assert.equal(response.body.ok, true, item.endpoint);
        const result = response.body.data;
        reportedTotal = result.pagination.total;
        ids.push(...result.items.map((record) => record.id));
        if (!result.pagination.hasNext) break;
        page += 1;
      }

      assert.equal(reportedTotal, RECORD_COUNT, item.endpoint + ' count metadata');
      assert.equal(ids.length, RECORD_COUNT, item.endpoint + ' rows enumerated');
      assert.equal(new Set(ids).size, RECORD_COUNT, item.endpoint + ' contains no duplicate rows');
      assert.equal(ids[0], item.expectedFirst, item.endpoint + ' first record');
      assert.equal(ids[RECORD_COUNT - 1], item.expectedLast, item.endpoint + ' last record beyond row 500');
    }

    const taskDatabaseCount = await query('SELECT count(*)::int AS count FROM tasks WHERE id LIKE $1', [prefix + '-task-%']);
    const filtered = await apiRequest(
      `/api/tasks?page=1&pageSize=8&q=${encodeURIComponent('unique-search-' + prefix + '-last')}`,
      ownerToken
    );
    assert.equal(filtered.body.data.pagination.total, Number(taskDatabaseCount[0].count) - RECORD_COUNT + 1);
    assert.equal(filtered.body.data.items.some((item) => item.id === `${prefix}-task-1236`), true);

    const statusCount = await query(
      'SELECT count(*)::int AS count FROM reports WHERE id LIKE $1 AND status = $2',
      [prefix + '-report-%', 'Selesai']
    );
    const filteredReports = await apiRequest(
      `/api/reports?page=1&pageSize=100&status=Selesai&q=${encodeURIComponent(prefix)}`,
      ownerToken
    );
    assert.equal(filteredReports.body.data.pagination.total, Number(statusCount[0].count));

    const reportSummary = await apiRequest(
      '/api/reports/summary?mode=range&from=2040-12-01&to=2040-12-01',
      ownerToken
    );
    assert.equal(reportSummary.status, 200);
    assert.equal(reportSummary.body.data.summary.total, RECORD_COUNT);
    assert.equal(reportSummary.body.data.items.length, 10);

    const bootstrap = await apiRequest('/api/bootstrap', ownerToken);
    const directTaskCount = await query('SELECT count(*)::int AS count FROM tasks');
    assert.equal(bootstrap.body.data.summary.tasks.total, Number(directTaskCount[0].count));
    assert.equal(bootstrap.body.data.priorityTasks.length <= 5, true);
  });

  await t.test('creates, reads, updates, and deletes a task through the API', async () => {
    const created = await apiRequest('/api/tasks', ownerToken, 'POST', {
      nama: `${prefix} CRUD task`,
      deskripsi: 'API CRUD integration test',
      deadline: '2040-12-02',
      status: 'Belum Dimulai'
    });
    assert.equal(created.status, 201);
    createdTaskId = created.body.data.id;

    const read = await apiRequest('/api/tasks/' + createdTaskId, ownerToken);
    assert.equal(read.status, 200);
    assert.equal(read.body.data.nama, `${prefix} CRUD task`);

    const updated = await apiRequest('/api/tasks/' + createdTaskId, ownerToken, 'PATCH', {
      nama: `${prefix} CRUD updated task`,
      status: 'Selesai'
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.status, 'Selesai');

    const deleted = await apiRequest('/api/tasks/' + createdTaskId, ownerToken, 'DELETE');
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.data.deleted, true);

    const missing = await apiRequest('/api/tasks/' + createdTaskId, ownerToken);
    assert.equal(missing.status, 404);
  });

  await t.test('rejects unauthorized edits and stale writes; concurrent Owner demotions keep one active Owner', async () => {
    const userToken = await neonTokenFor(
      users[0][2], `${users[0][0]}-identity`, privateKey, issuer
    );
    const userTarget = await query(
      'SELECT id, name, email, role, account_status, updated_at::text AS updated_at FROM users WHERE id = $1',
      [users[0][0]]
    );
    const unauthorized = await apiRequest('/api/users/' + users[0][0], userToken, 'PATCH', {
      nama: userTarget[0].name,
      email: userTarget[0].email,
      role: 'owner',
      statusAkun: 'Aktif',
      expectedUpdatedAt: userTarget[0].updated_at
    });
    assert.equal(unauthorized.status, 403);
    const ownerBId = prefix + '-owner-b';
    const ownerBEmail = `${prefix}-owner-b@example.test`;
    const ownerBToken = await neonTokenFor(
      ownerBEmail, `${ownerBId}-identity`, privateKey, issuer
    );
    await query(
      `INSERT INTO users (id, name, email, password_hash, role, account_status, updated_at)
       VALUES ($1, $2, $3, $4, 'owner', 'Aktif', '2026-01-01T00:00:00.000Z')`,
      [ownerBId, 'Second Integration Owner', ownerBEmail, passwordHash]
    );

    const sameTarget = await query(
      'SELECT id, name, email, role, account_status, updated_at::text AS updated_at FROM users WHERE id = $1',
      [users[1][0]]
    );
    const staleBodyA = {
      nama: 'Concurrent update A',
      email: sameTarget[0].email,
      role: 'user',
      statusAkun: 'Aktif',
      expectedUpdatedAt: sameTarget[0].updated_at
    };
    const staleBodyB = Object.assign({}, staleBodyA, { nama: 'Concurrent update B' });
    const concurrentSameTarget = await Promise.all([
      apiRequest('/api/users/' + users[1][0], ownerToken, 'PATCH', staleBodyA),
      apiRequest('/api/users/' + users[1][0], ownerBToken, 'PATCH', staleBodyB)
    ]);
    assert.equal(concurrentSameTarget.filter((response) => response.status === 200).length, 1);
    assert.equal(concurrentSameTarget.filter((response) => response.status === 409).length, 1);
    assert.equal(concurrentSameTarget.find((response) => response.status === 409).body.error.code, 'USER_CHANGED');

    const failureTarget = await query(
      'SELECT id, name, email, role, account_status, updated_at::text AS updated_at FROM users WHERE id = $1',
      [users[2][0]]
    );
    const auditBefore = await query(
      `SELECT count(*)::int AS count FROM activity_logs
        WHERE action = 'Memperbarui user' AND object_name = $1`,
      [failureTarget[0].name]
    );
    const failedTransaction = await apiRequest('/api/users/' + users[2][0], ownerToken, 'PATCH', {
      nama: 'Should roll back',
      email: `${prefix}-owner@example.test`,
      role: 'owner',
      statusAkun: 'Aktif',
      expectedUpdatedAt: failureTarget[0].updated_at
    });
    assert.equal(failedTransaction.status, 409);
    assert.equal(failedTransaction.body.error.code, 'EMAIL_EXISTS');
    const afterFailure = await query('SELECT name, role FROM users WHERE id = $1', [users[2][0]]);
    const auditAfter = await query(
      `SELECT count(*)::int AS count FROM activity_logs
        WHERE action = 'Memperbarui user' AND object_name = $1`,
      [failureTarget[0].name]
    );
    assert.equal(afterFailure[0].name, failureTarget[0].name);
    assert.equal(afterFailure[0].role, 'user');
    assert.equal(Number(auditAfter[0].count), Number(auditBefore[0].count));

    const ownerA = await query(
      'SELECT id, name, email, role, account_status, updated_at::text AS updated_at FROM users WHERE id = $1',
      [ownerId]
    );
    const ownerB = await query(
      'SELECT id, name, email, role, account_status, updated_at::text AS updated_at FROM users WHERE id = $1',
      [ownerBId]
    );
    const demoteA = {
      nama: ownerA[0].name, email: ownerA[0].email, role: 'user', statusAkun: 'Aktif',
      expectedUpdatedAt: ownerA[0].updated_at
    };
    const demoteB = {
      nama: ownerB[0].name, email: ownerB[0].email, role: 'user', statusAkun: 'Aktif',
      expectedUpdatedAt: ownerB[0].updated_at
    };
    const concurrentDemotions = await Promise.all([
      apiRequest('/api/users/' + ownerBId, ownerToken, 'PATCH', demoteB),
      apiRequest('/api/users/' + ownerId, ownerBToken, 'PATCH', demoteA)
    ]);
    assert.equal(concurrentDemotions.filter((response) => response.status === 200).length, 1);
    assert.equal(concurrentDemotions.every((response) => [200, 403, 409].includes(response.status)), true);
    const remainingOwners = await query(
      `SELECT id, updated_at::text AS updated_at FROM users
        WHERE role = 'owner' AND account_status = 'Aktif'`
    );
    assert.equal(remainingOwners.length, 1);

    const lastOwnerToken = remainingOwners[0].id === ownerId ? ownerToken : ownerBToken;
    const blockedDemotion = await apiRequest(
      '/api/users/' + remainingOwners[0].id,
      lastOwnerToken,
      'PATCH',
      {
        nama: remainingOwners[0].id === ownerId ? ownerA[0].name : ownerB[0].name,
        email: remainingOwners[0].id === ownerId ? ownerA[0].email : ownerB[0].email,
        role: 'user',
        statusAkun: 'Aktif',
        expectedUpdatedAt: remainingOwners[0].updated_at
      }
    );
    assert.equal(blockedDemotion.status, 409);
    assert.equal(blockedDemotion.body.error.code, 'LAST_OWNER');
  });

  await t.test('registers a verified identity once with User role and supports later authenticated requests', async () => {
    const subject = prefix + '-new-identity';
    const email = `${prefix}-new-user@example.test`;
    const token = await neonTokenFor(email, subject, privateKey, issuer);
    const registration = await apiRequest('/api/auth/register', token, 'POST', {
      nama: 'Integration Registrant',
      email: `${prefix}-forged@example.test`,
      role: 'owner'
    });
    assert.equal(registration.status, 201);
    assert.equal(registration.body.data.user.role, 'user');
    assert.equal(registration.body.data.user.email, email);

    const stored = await query(
      'SELECT id, auth_subject, name, email, role, account_status FROM users WHERE auth_subject = $1',
      [subject]
    );
    assert.equal(stored.length, 1);
    assert.equal(stored[0].name, 'Integration Registrant');
    assert.equal(stored[0].role, 'user');
    assert.equal(stored[0].account_status, 'Aktif');

    const repeated = await apiRequest('/api/auth/register', token, 'POST', {
      nama: 'Attempted Name Change',
      role: 'owner'
    });
    assert.equal(repeated.status, 200);
    assert.equal(repeated.body.data.user.id, stored[0].id);
    assert.equal(repeated.body.data.user.nama, 'Integration Registrant');

    const session = await apiRequest('/api/auth/me', token);
    assert.equal(session.status, 200);
    assert.equal(session.body.data.user.id, stored[0].id);

    const protectedRequest = await apiRequest('/api/tasks', token);
    assert.equal(protectedRequest.status, 200);

    const otherIdentity = await neonTokenFor(email, subject + '-other', privateKey, issuer);
    const takeover = await apiRequest('/api/auth/register', otherIdentity, 'POST', {
      nama: 'Another Person'
    });
    assert.equal(takeover.status, 409);
    assert.equal(takeover.body.error.code, 'IDENTITY_ALREADY_LINKED');
    assert.equal((await query('SELECT count(*)::int AS count FROM users WHERE email = $1', [email]))[0].count, 1);
  });
});

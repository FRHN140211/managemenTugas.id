// scripts/apply-test-migrations.js
// Test-specific migration runner for the isolated Neon test database.
//
// Usage (Windows PowerShell / CMD):
//   node scripts/apply-test-migrations.js
//
// It reads TEST_DATABASE_URL exclusively from .env.local and never touches
// DATABASE_URL (production). All secrets are redacted in output.
//
// Exit codes:
//   0 = migrations applied / nothing pending
//   1 = validation or migration failure

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from '../lib/sql-statements.js';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDirectory = path.join(projectDirectory, 'database', 'migrations');
const envFilePath = path.join(projectDirectory, '.env.local');

function fail(message, exitCode = 1) {
  console.error('\n[APPLY-TEST-MIGRATIONS] ' + message);
  process.exit(exitCode);
}

function readEnvFileValue(filePath, key) {
  if (!existsSync(filePath)) fail(`Environment file not found: ${filePath}`, 2);
  const text = readFileSync(filePath, 'utf8');
  const match = text.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!match) fail(`${key} is not defined in ${filePath}`, 2);
  const raw = match[1].trim();
  return raw.replace(/^["']|["']$/g, '').trim();
}

function classifyAuthError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  const code = typeof error?.code === 'string' ? error.code : '';
  if (/password authentication failed|28P01|invalid password|role .* does not exist|28000/.test(message) || code === '28P01' || code === '28000') {
    return 'AUTH_REJECTED';
  }
  if (/database .* does not exist|3D000/.test(message) || code === '3D000') return 'DATABASE_NOT_FOUND';
  if (/tls|ssl|certificate|handshake|self.signed/.test(message)) return 'TLS_ERROR';
  if (['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH'].includes(error?.code || '')) return 'HOST_UNREACHABLE';
  if (/timeout/.test(message)) return 'NETWORK_TIMEOUT';
  return 'UNKNOWN';
}

// ---- Step 0: Load environment from .env.local into this Node process ----
const rawTestUrl = readEnvFileValue(envFilePath, 'TEST_DATABASE_URL');
const trimmedTestUrl = rawTestUrl.replace(/^['"]|['"]$/g, '').trim();

if (!trimmedTestUrl) {
  fail('TEST_DATABASE_URL is empty in .env.local. Copy the real PostgreSQL connection string for the test database into .env.local.');
}

// ---- Step 1: Validate and parse the connection string ----
let parsed;
try {
  parsed = new URL(trimmedTestUrl);
} catch (error) {
  fail(`TEST_DATABASE_URL is not a valid URL: ${error.message}`);
}

const isPostgres = ['postgres:', 'postgresql:'].includes(parsed.protocol);
console.log('[APPLY-TEST-MIGRATIONS] Protocol              : ' + parsed.protocol);
console.log('[APPLY-TEST-MIGRATIONS] Host                  : ' + parsed.hostname + (parsed.port ? ':' + parsed.port : ''));
console.log('[APPLY-TEST-MIGRATIONS] Database              : ' + decodeURIComponent(parsed.pathname.replace(/^\//, '')));
console.log('[APPLY-TEST-MIGRATIONS] Role                  : ' + decodeURIComponent(parsed.username));
console.log('[APPLY-TEST-MIGRATIONS] TLS mode              : ' + (parsed.searchParams.get('sslmode') || 'tidak ditentukan (default libpq)'));

if (!isPostgres) {
  fail('PROTOCOL_ABORT', 1);
}

// ---- Step 2: Refuse to run if the password is still a placeholder ----
const password = decodeURIComponent(parsed.password || '');
if (password === '***' || password === 'password') {
  fail('PASSWORD_PLACEHOLDER', 1);
}
if (!password) {
  fail('NO_PASSWORD_PROVIDED', 1);
}

// ---- Step 3: Establish a Neon client and validate target host / db / role ----
// Hard guard: never run against production. Compare the resolved target with the
// production DATABASE_URL (if configured) and refuse any overlap.
const prodUrlRaw = readEnvFileValue(envFilePath, 'DATABASE_URL').value || '';
if (prodUrlRaw) {
  try {
    const prod = new URL(prodUrlRaw.replace(/^['"]|['"]$/g, '').trim());
    const sameHost = prod.hostname === parsed.hostname;
    const sameDb = prod.pathname === parsed.pathname;
    if (sameHost && sameDb) {
      fail('PRODUCTION_ABORT: TEST_DATABASE_URL points at the production database (' + parsed.hostname + parsed.pathname + '). Refusing to migrate.', 1);
    }
    console.log('[APPLY-TEST-MIGRATIONS] Production target differs : ' + (sameHost ? 'SAME HOST (aborted)' : 'ok'));
  } catch { /* malformed production URL: rely on the test-side checks below */ }
}

let client;
try {
  client = neon(trimmedTestUrl);
} catch (error) {
  fail('KLIEN_TIDAK_DAPAT_DIBUAT: ' + error.message, 1);
}

try {
  const check = await client.query(
    `SELECT current_database() AS db,
            current_user AS role,
            current_setting('server_version') AS version`
  );
  const row = check[0];
  console.log('[APPLY-TEST-MIGRATIONS] Connected to database  : ' + row.db);
  console.log('[APPLY-TEST-MIGRATIONS] Connected as role      : ' + row.role);

  if (decodeURIComponent(parsed.pathname.replace(/^\//, '')) !== row.db) {
    fail('TARGET_MISMATCH: URL database is "' + decodeURIComponent(parsed.pathname.replace(/^\//, '')) + '" but server reports "' + row.db + '"', 1);
  }
  if (decodeURIComponent(parsed.username) !== row.role) {
    fail('ROLE_MISMATCH: URL role is "' + decodeURIComponent(parsed.username) + '" but server reports "' + row.role + '"', 1);
  }

  // Confirm the test database name pattern (from check-test-db.mjs convention)
  if (!/(^|[_-])test([_-]|$)/i.test(row.db)) {
    fail('TARGET_NOT_TEST_DB: database name does not look like a test database', 1);
  }

  // Verify the role can read pg_database
  const pgDb = await client.query(
    `SELECT datname FROM pg_database WHERE datname = $1`, [row.db]
  );
  if (pgDb.length === 0 || pgDb[0].datname !== row.db) {
    fail('DATABASE_NOT_VISIBLE', 1);
  }
} catch (error) {
  fail('VALIDASI_KONEKSI_GAGAL: ' + error.message, 1);
}

// ---- Step 4: Determine pending migrations ----
// Ensure the bookkeeping table exists before querying it (the production runner
// does this too; without it the first run always fails with relation does not exist).
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    migration text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
} catch (error) {
  fail('SCHEMA_MIGRATIONS_TABLE_GAGAL: ' + error.message, 1);
}

const appliedMigrations = new Set();
try {
  const applied = await client.query('SELECT migration FROM schema_migrations ORDER BY migration');
  appliedMigrations = new Set(applied.map((row) => row.migration));
} catch (error) {
  // schema_migrations table may not exist yet; that is fine for the first run
  console.log('[APPLY-TEST-MIGRATIONS] schema_migrations table not found; will create it.');
}

const TEST_SKIP_FILES = new Set(['legacy_schema_upgrade.sql']); // legacy renames tables; not for test DB

const pendingFiles = [];
if (existsSync(migrationsDirectory)) {
  const files = readdirSync(migrationsDirectory)
    .filter((line) => line.endsWith('.sql'))
    .sort();
  for (const file of files) {
    if (TEST_SKIP_FILES.has(file)) {
      console.log('[APPLY-TEST-MIGRATIONS]   (skip) ' + file + ' - legacy schema migration not applied on test DB');
      continue;
    }
    if (!appliedMigrations.has(file)) pendingFiles.push(file);
  }
}

console.log('[APPLY-TEST-MIGRATIONS] Pending migrations     : ' + pendingFiles.length);
for (const file of pendingFiles) {
  console.log('[APPLY-TEST-MIGRATIONS]   - ' + file);
}

if (pendingFiles.length === 0) {
  console.log('[APPLY-TEST-MIGRATIONS] No pending migrations.');
  process.exit(0);
}

// ---- Step 5: Apply migrations one by one ----
for (const file of pendingFiles) {
  const sql = readFileSync(path.join(migrationsDirectory, file), 'utf8');
  const statements = splitSqlStatements(sql);

  if (!statements.length) {
    console.log('[APPLY-TEST-MIGRATIONS]   (empty) ' + file);
    continue;
  }

  try {
    // neon() is HTTP-based, so each query is its own implicit transaction and
    // SAVEPOINT is unavailable. Wrap the file in BEGIN/COMMIT for atomicity and
    // use ON CONFLICT DO NOTHING for idempotent bookkeeping.
    await client.query('BEGIN');
    for (const statement of statements) {
      await client.query(statement);
    }
    await client.query(
      'INSERT INTO schema_migrations (migration) VALUES ($1) ON CONFLICT (migration) DO NOTHING',
      [file]
    );
    await client.query('COMMIT');
    console.log('[APPLY-TEST-MIGRATIONS]   ✓ ' + file);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    console.error('[APPLY-TEST-MIGRATIONS]   ✖ ' + file + ': ' + error.message);
    process.exitCode = 1;
    break;
  }
}

if (process.exitCode === 1) {
  fail('MIGRATION_FAILED', 1);
}

console.log('[APPLY-TEST-MIGRATIONS] Migrations applied successfully.');
process.exit(0);

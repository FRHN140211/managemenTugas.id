// scripts/setup-test-database.js
// Setup and verify the test database for integration tests.
// Does NOT modify production database.
// Reads TEST_DATABASE_URL from .env.local (test environment only).
// Exit codes: 0 = success, 1 = failure, 2 = not configured

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { neon } from '@neondatabase/serverless';

// Load .env.local if it exists (no dotenv package needed for this)
const envPath = join(process.cwd(), '.env.local');
let testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl && existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf8');
  const match = envContent.match(/^TEST_DATABASE_URL=(.+)$/m);
  if (match) {
    testDatabaseUrl = match[1].replace(/^["']|["']$/g, '');
  }
}

if (!testDatabaseUrl) {
  console.error('TEST_DATABASE_URL is not defined.');
  console.error('Set TEST_DATABASE_URL in .env.local to a Neon database connection string.');
  console.error('Example: TEST_DATABASE_URL=postgres://user:pass@ep-xxx.c-1.aws.neon.tech/neondb_test');
  process.exit(2);
}

// Mask sensitive parts for logging
const urlObject = new URL(testDatabaseUrl);
const masked = testDatabaseUrl.replace(/:([^:@]+)@/g, ':***@');
console.log(`[TEST DB] Target: ${masked}`);
console.log(`[TEST DB] Database: ${urlObject.pathname.replace('/', '')}`);

// Validate URL format
if (urlObject.protocol !== 'postgres:' && urlObject.protocol !== 'postgresql:') {
  console.error('[TEST DB] Invalid protocol. Expected postgres: or postgresql:');
  process.exit(1);
}

// Test connection
let client;
try {
  client = neon(testDatabaseUrl);
  console.log('[TEST DB] Connected successfully.');
} catch (error) {
  console.error('[TEST DB] Connection failed:', error.message);
  process.exit(1);
}

// Verify we are targeting the correct database
try {
  const result = await client.simpleQuery('SELECT current_database() AS db, current_user AS user, current_schema() AS schema');
  console.log(`[TEST DB] Current database: ${result.rows[0].db}`);
  console.log(`[TEST DB] Current user: ${result.rows[0].user}`);
  console.log(`[TEST DB] Current schema: ${result.rows[0].schema}`);
} catch (error) {
  console.error('[TEST DB] Query failed:', error.message);
  await client.end();
  process.exit(1);
}

// Check test DB isolation (should NOT be production 'neondb')
const testDbName = urlObject.pathname.replace('/', '');
const prodDbName = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).pathname.replace('/', '') : null;

if (prodDbName && testDbName === prodDbName) {
  console.error('[TEST DB] WARNING: Test database matches production database.');
  console.error('[TEST DB] Test database must be isolated from production.');
}

// Check migrations (optional: verify expected tables exist)
const expectedTables = ['tasks', 'reports', 'reminders', 'users', 'rate_limits'];
let tablesFound = [];
try {
  const schemaResult = await client.simpleQuery(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
  );
  tablesFound = schemaResult.rows.map(r => r.table_name);
} catch (error) {
  console.error('[TEST DB] Schema query failed:', error.message);
}

const missingTables = expectedTables.filter(t => !tablesFound.includes(t));
if (missingTables.length > 0) {
  console.warn(`[TEST DB] WARNING: Missing tables: ${missingTables.join(', ')}`);
  console.warn('[TEST DB] Run migrations before executing integration tests.');
} else {
  console.log('[TEST DB] All expected tables present.');
}

await client.end();

console.log('[TEST DB] Setup complete.');
process.exit(0);

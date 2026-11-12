import * as fs from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = 'C:/laragon/www/Management_Tugas_Redesign_Terbaru';
const envFile = join(root, '.env.local');
const envContent = fs.readFileSync(envFile, 'utf8');

// Parse .env.local
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    value = value.slice(1, -1);
  }
  env[key] = value;
}

const testDbUrl = env.TEST_DATABASE_URL;
if (!testDbUrl) {
  console.error('TEST_DATABASE_URL not set in .env.local');
  process.exit(1);
}

// Extract host, dbname, etc. from connection string (mask password in output)
const url = new URL(testDbUrl);
console.log(`Target database: ${url.host}/${url.pathname.replace('/', '')}`);

const sql = neon(testDbUrl);
const migrationsDir = join(root, 'database', 'migrations');
const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql') && f.startsWith('00'))
  .sort();

console.log('\nApplying migrations to test database:');
for (const file of files) {
  const filePath = join(migrationsDir, file);
  const sqlText = fs.readFileSync(filePath, 'utf8');
  console.log(`  Applying ${file} (${sqlText.length} chars)`);
  await sql.query(sqlText);
}
console.log('\nMigrations applied successfully');

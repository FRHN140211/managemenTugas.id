import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { query, transaction } from '../lib/database.js';
import { splitSqlStatements } from '../lib/sql-statements.js';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDirectory = path.join(projectDirectory, 'database/migrations');

async function appliedMigrations() {
  const rows = await query(`SELECT migration FROM schema_migrations ORDER BY migration`);
  return new Set(rows.map((row) => row.migration));
}

async function ensureMigrationsTable() {
  await query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    migration text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
}

async function pendingMigrations() {
  const applied = await appliedMigrations();
  const files = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort();
  return files.filter((file) => !applied.has(file));
}

async function applyMigration(file) {
  const sql = readFileSync(path.join(migrationsDirectory, file), 'utf8');
  const statements = splitSqlStatements(sql);
  if (!statements.length) return;

  await transaction(
    statements.map((statement) => ({ statement })),
    { isolationLevel: 'ReadCommitted' }
  );

  await query('INSERT INTO schema_migrations (migration) VALUES ($1)', [file]);
}

async function main() {
  await ensureMigrationsTable();
  const pending = await pendingMigrations();
  if (!pending.length) {
    console.log('No pending migrations.');
    return;
  }

  console.log(`Applying ${pending.length} migration(s):`);
  for (const file of pending) {
    try {
      await applyMigration(file);
      console.log(`  ✔ ${file}`);
    } catch (error) {
      console.error(`  ✖ ${file}: ${error.message}`);
      process.exitCode = 1;
      return;
    }
  }
  console.log('Migrations applied successfully.');
}

main().catch((error) => {
  console.error('Migration failed:', error.message || error);
  process.exitCode = 1;
});

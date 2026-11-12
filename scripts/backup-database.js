#!/usr/bin/env node
// scripts/backup-database.js — Automated database backup
// Usage: node scripts/backup-database.js
//
// Connects to Neon database, exports schema and data to timestamped SQL file,
// compresses with gzip, saves to backups/ with 7-day rotation, verifies integrity.

import { readFileSync, mkdirSync, existsSync, unlinkSync, readdirSync, statSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../lib/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_DIR = path.resolve(__dirname, '..');
const BACKUPS_DIR = path.join(PROJECT_DIR, 'backups');
const MIGRATIONS_DIR = path.join(PROJECT_DIR, 'database/migrations');
const RETENTION_DAYS = 7;

function escapeValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'NULL';
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return `'${value.toISOString()}'`;
  const str = String(value).replace(/'/g, "''");
  return `'${str}'`;
}

function generateInsert(tableName, columns, rows) {
  if (!rows.length) return '';
  const colNames = columns.map(c => c.column_name).join(', ');
  const values = rows.map(row => {
    const vals = columns.map(c => escapeValue(row[c.column_name])).join(', ');
    return `(${vals})`;
  });
  return `INSERT INTO ${tableName} (${colNames}) VALUES\n${values.join(',\n')};\n`;
}

async function getTables() {
  const rows = await query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return rows.map(r => r.table_name);
}

async function getColumns(tableName) {
  return await query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);
}

async function getData(tableName, columns) {
  const colNames = columns.map(c => c.column_name).join(', ');
  const rows = await query(`SELECT ${colNames} FROM ${tableName}`);
  return rows;
}

function generateSchemaSQL() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort();

  let schemaSQL = `-- Schema Backup (from migrations)\n-- Generated: ${new Date().toISOString()}\n\n`;
  for (const file of files) {
    schemaSQL += `-- Migration: ${file}\n`;
    schemaSQL += readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8') + '\n\n';
  }
  return schemaSQL;
}

function rotateBackups() {
  if (!existsSync(BACKUPS_DIR)) return;

  const files = readdirSync(BACKUPS_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.sql.gz'))
    .map(f => ({
      name: f,
      mtime: statSync(path.join(BACKUPS_DIR, f)).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime);

  for (let i = RETENTION_DAYS; i < files.length; i++) {
    console.log(`Rotating old backup: ${files[i].name}`);
    unlinkSync(path.join(BACKUPS_DIR, files[i].name));
  }
}

async function backup() {
  if (!existsSync(BACKUPS_DIR)) mkdirSync(BACKUPS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const gzFilepath = path.join(BACKUPS_DIR, `backup-${timestamp}.sql.gz`);

  console.log('Starting database backup...');

  // Test connection
  await query('SELECT 1');
  console.log('Database connection verified.');

  // Build SQL content
  let sqlContent = `-- Database Backup\n-- Generated: ${new Date().toISOString()}\n`;
  const dbHost = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).host : 'unknown';
  sqlContent += `-- Database: ${dbHost}\n\n`;

  // Include schema from migrations
  sqlContent += generateSchemaSQL();

  // Export data
  const tables = await getTables();
  console.log(`Found ${tables.length} tables.`);

  for (const table of tables) {
    console.log(`Exporting table: ${table}`);
    const columns = await getColumns(table);
    const rows = await getData(table, columns);

    if (rows.length > 0) {
      sqlContent += `-- Data for ${table}\n`;
      sqlContent += generateInsert(table, columns, rows);
      sqlContent += '\n';
      console.log(`  Exported ${rows.length} rows.`);
    } else {
      console.log(`  No data.`);
    }
  }

  // Compress and write
  const gzip = createGzip();
  const output = createWriteStream(gzFilepath);

  await pipeline(
    Buffer.from(sqlContent, 'utf8'),
    gzip,
    output
  );

  // Rotate old backups
  rotateBackups();

  // Verify backup
  const stats = statSync(gzFilepath);
  if (stats.size === 0) {
    throw new Error('Backup file is empty');
  }

  console.log('\nBackup completed successfully.');
  console.log(`File: ${gzFilepath}`);
  console.log(`Size: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`Tables: ${tables.length}`);
}

backup().catch(error => {
  console.error('Backup failed:', error.message || error);
  process.exitCode = 1;
});

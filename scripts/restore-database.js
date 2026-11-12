#!/usr/bin/env node
// scripts/restore-database.js — Restore database from backup
// Usage: node scripts/restore-database.js [backup-file]
//
// If no backup file is specified, lists available backups and prompts for selection.

import { readdirSync, statSync, existsSync, createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, transaction } from '../lib/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUPS_DIR = path.join(path.resolve(__dirname, '..'), 'backups');

async function listBackups() {
  if (!existsSync(BACKUPS_DIR)) {
    console.log('No backups directory found.');
    return [];
  }

  const files = readdirSync(BACKUPS_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.sql.gz'))
    .map(f => ({
      name: f,
      path: path.join(BACKUPS_DIR, f),
      size: statSync(path.join(BACKUPS_DIR, f)).size,
      date: statSync(path.join(BACKUPS_DIR, f)).mtime
    }))
    .sort((a, b) => b.date - a.date);

  if (!files.length) {
    console.log('No backups found.');
    return [];
  }

  console.log('\nAvailable backups:');
  files.forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.name} (${(f.size / 1024).toFixed(2)} KB) - ${f.date.toLocaleString()}`);
  });
  return files;
}

function validateBackup(filepath) {
  if (!existsSync(filepath)) {
    throw new Error(`Backup file not found: ${filepath}`);
  }
  if (!filepath.endsWith('.sql.gz')) {
    throw new Error('Backup file must be a .sql.gz file');
  }
  const stats = statSync(filepath);
  if (stats.size === 0) {
    throw new Error('Backup file is empty');
  }
  return stats.size;
}

async function extractBackup(filepath) {
  const sqlFilename = filepath.replace(/\.gz$/, '');
  const gunzip = createGunzip();
  const input = createReadStream(filepath);
  const output = createWriteStream(sqlFilename);

  await pipeline(input, gunzip, output);
  return sqlFilename;
}

async function parseStatements(sqlContent) {
  const statements = [];
  const lines = sqlContent.split('\n');
  let current = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--') || trimmed === '') {
      continue;
    }
    current.push(line);
    if (trimmed.endsWith(';')) {
      statements.push(current.join('\n'));
      current = [];
    }
  }

  if (current.length) {
    const last = current.join('\n').trim();
    if (last) statements.push(last);
  }

  return statements.filter(s => s.trim().length > 0);
}

async function restore(backupFile) {
  console.log(`Validating backup: ${backupFile}`);
  validateBackup(backupFile);

  console.log('Extracting backup...');
  const sqlFile = await extractBackup(backupFile);
  console.log(`Extracted to: ${sqlFile}`);

  const sqlContent = await fsReadFile(sqlFile, 'utf8');
  const statements = await parseStatements(sqlContent);
  console.log(`Found ${statements.length} SQL statements.`);

  console.log('Starting restore...');
  await query('SELECT 1'); // Test connection
  console.log('Database connection verified.');

  let executed = 0;
  let failed = 0;

  for (const statement of statements) {
    try {
      await query(statement);
      executed++;
    } catch (error) {
      failed++;
      console.error(`Failed to execute statement: ${error.message}`);
      console.error(`Statement: ${statement.slice(0, 200)}...`);
    }
  }

  console.log(`\nRestore completed.`);
  console.log(`Executed: ${executed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.error('\nWARNING: Some statements failed. Review errors above.');
    process.exitCode = 1;
  } else {
    console.log('Restore completed successfully.');
  }
}

async function fsReadFile(filepath, encoding) {
  const { readFileSync } = await import('node:fs');
  return readFileSync(filepath, encoding);
}

async function main() {
  const args = process.argv.slice(2);
  const backupFile = args[0];

  if (backupFile) {
    await restore(backupFile);
    return;
  }

  const backups = await listBackups();
  if (!backups.length) {
    process.exit(1);
  }

  const rl = createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question('\nEnter backup number to restore: ')).trim();
  rl.close();

  const index = Number(answer) - 1;
  if (Number.isNaN(index) || index < 0 || index >= backups.length) {
    console.error('Invalid selection.');
    process.exit(1);
  }

  const selected = backups[index];
  console.log(`\nYou selected: ${selected.name}`);
  console.log('WARNING: This will overwrite existing data in the database.');
  
  const confirm = (await rl.question('Type "yes" to confirm: ')).trim().toLowerCase();
  if (confirm !== 'yes') {
    console.log('Restore cancelled.');
    return;
  }

  await restore(selected.path);
}

main().catch(error => {
  console.error('Restore failed:', error.message || error);
  process.exitCode = 1;
});

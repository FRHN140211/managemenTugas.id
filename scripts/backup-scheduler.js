#!/usr/bin/env node
// scripts/backup-scheduler.js — Scheduled database backups using node-cron
// Usage: node scripts/backup-scheduler.js
//
// Runs daily at 2 AM. Keeps the process alive to execute scheduled backups.

import cron from 'node-cron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runBackup() {
  return new Promise((resolve, reject) => {
    const backupScript = path.join(__dirname, 'backup-database.js');
    const child = spawn('node', [backupScript], {
      stdio: 'inherit',
      env: { ...process.env }
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`[${new Date().toISOString()}] Scheduled backup completed successfully.`);
        resolve();
      } else {
        console.error(`[${new Date().toISOString()}] Scheduled backup failed with code ${code}.`);
        reject(new Error(`Backup exited with code ${code}`));
      }
    });

    child.on('error', (error) => {
      console.error(`[${new Date().toISOString()}] Failed to start backup process:`, error.message);
      reject(error);
    });
  });
}

async function main() {
  console.log('Starting backup scheduler...');
  console.log('Schedule: Daily at 2:00 AM');

  // Run backup on startup for immediate verification
  console.log('Running initial backup...');
  try {
    await runBackup();
  } catch (error) {
    console.error('Initial backup failed:', error.message);
  }

  // Schedule daily at 2 AM
  const job = cron.schedule('0 2 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled backup...`);
    try {
      await runBackup();
    } catch (error) {
      console.error('Scheduled backup failed:', error.message);
    }
  }, {
    timezone: 'Asia/Bangkok' // Adjust as needed
  });

  console.log('Backup scheduler is running. Press Ctrl+C to stop.');

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nStopping backup scheduler...');
    job.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nStopping backup scheduler...');
    job.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Scheduler failed:', error);
  process.exitCode = 1;
});

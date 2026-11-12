# Disaster Recovery Runbook

## Overview

This runbook provides step-by-step procedures for recovering the Management Tugas database from backups in case of data loss, corruption, or infrastructure failure.

## Prerequisites

- Node.js 18+ installed
- Access to the project repository
- `DATABASE_URL` environment variable configured for the target database
- Latest verified backup file from `backups/` directory

## Recovery Procedures

### 1. Complete Database Recovery (Data Loss / Corruption)

Use this procedure when the database is lost, corrupted, or needs to be replaced.

**Steps:**

1. **Stop the application**
   ```bash
   # Stop any running application servers
   # Ensure no new writes are happening during restore
   ```

2. **Verify backup integrity**
   ```bash
   node scripts/restore-database.js --verify ./backups/backup-YYYY-MM-DD-HH-MM-SS.sql.gz
   ```
   Or manually verify using:
   ```bash
   gunzip -t ./backups/backup-YYYY-MM-DD-HH-MM-SS.sql.gz
   ```

3. **Create a safety backup of current state (if any data exists)**
   ```bash
   node scripts/backup-database.js
   ```

4. **Drop and recreate the database** (if needed)
   ```bash
   # Via Neon console or psql
   psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   ```

5. **Restore from backup**
   ```bash
   node scripts/restore-database.js ./backups/backup-YYYY-MM-DD-HH-MM-SS.sql.gz
   ```

6. **Apply any pending migrations** (if restore was from an older backup)
   ```bash
   npm run migrate
   ```

7. **Verify restoration**
   ```bash
   # Check row counts for critical tables
   psql $DATABASE_URL -c "SELECT count(*) FROM users;"
   psql $DATABASE_URL -c "SELECT count(*) FROM tasks;"
   psql $DATABASE_URL -c "SELECT count(*) FROM reports;"
   psql $DATABASE_URL -c "SELECT count(*) FROM reminders;"
   psql $DATABASE_URL -c "SELECT count(*) FROM activity_logs;"
   ```

8. **Restart the application**
   ```bash
   npm start
   ```

9. **Verify application health**
   ```bash
   curl http://localhost:3000/api/health
   ```

### 2. Point-in-Time Recovery

Use this procedure to restore to a specific backup point.

**Steps:**

1. List available backups:
   ```bash
   node scripts/restore-database.js
   ```

2. Select the desired backup from the interactive list.

3. Follow steps 3-9 from Complete Database Recovery above.

### 3. Single Table Recovery

Use this procedure to recover only a specific table without affecting others.

**Steps:**

1. **Extract the backup**
   ```bash
   gunzip -k ./backups/backup-YYYY-MM-DD-HH-MM-SS.sql.gz
   ```

2. **Identify table data** in the extracted SQL file.

3. **Restore only the target table**
   ```bash
   psql $DATABASE_URL -c "TRUNCATE TABLE table_name RESTART IDENTITY CASCADE;"
   psql $DATABASE_URL -f table_data.sql
   ```

4. **Verify the table**
   ```bash
   psql $DATABASE_URL -c "SELECT count(*) FROM table_name;"
   ```

### 4. Disaster Recovery Testing

Perform these tests quarterly to ensure recovery procedures work.

**Tests:**

1. **Backup file validation**
   - Verify backup file is not corrupted
   - Verify backup file size is reasonable
   - Verify backup contains expected tables

2. **Restore to staging**
   - Restore latest backup to a staging database
   - Verify all tables and data are present
   - Verify application starts and functions correctly

3. **Measure recovery time**
   - Time the full restore process
   - Document RTO (Recovery Time Objective)
   - Optimize if RTO exceeds business requirements

## Backup Schedule

- **Automated backups**: Daily at 2:00 AM (Asia/Bangkok timezone)
- **Backup retention**: 7 days
- **Backup location**: `backups/` directory
- **Backup format**: Gzipped SQL (`backup-YYYY-MM-DD-HH-MM-SS.sql.gz`)

## Verification Queries

After restore, run the verification queries in `database/backup-verification.sql` to confirm data integrity.

## Escalation

If recovery fails:
1. Check application logs for errors
2. Try restoring from an older backup
3. Contact database administrator
4. Escalate to infrastructure team if database-level issues persist

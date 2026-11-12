-- Backup Verification SQL
-- Run these queries against a restored database to verify backup completeness.

-- 1. Verify all expected tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Verify expected columns exist in each table
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 3. Row counts for each table
SELECT 'users' AS table_name, count(*) AS row_count FROM users
UNION ALL
SELECT 'tasks', count(*) FROM tasks
UNION ALL
SELECT 'reports', count(*) FROM reports
UNION ALL
SELECT 'reminders', count(*) FROM reminders
UNION ALL
SELECT 'sessions', count(*) FROM sessions
UNION ALL
SELECT 'login_rate_limits', count(*) FROM login_rate_limits
UNION ALL
SELECT 'activity_logs', count(*) FROM activity_logs
UNION ALL
SELECT 'schema_migrations', count(*) FROM schema_migrations
ORDER BY table_name;

-- 4. Verify foreign key constraints exist
SELECT tc.table_name, tc.constraint_name, kcu.column_name,
       ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- 5. Verify indexes exist
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 6. Check for orphaned records (referential integrity)
-- Tasks with invalid creator
SELECT count(*) AS orphaned_tasks FROM tasks t
LEFT JOIN users u ON u.id = t.created_by
WHERE u.id IS NULL;

-- Reports with invalid creator
SELECT count(*) AS orphaned_reports FROM reports r
LEFT JOIN users u ON u.id = r.created_by
WHERE u.id IS NULL;

-- Reminders with invalid creator
SELECT count(*) AS orphaned_reminders FROM reminders r
LEFT JOIN users u ON u.id = r.created_by
WHERE u.id IS NULL;

-- Sessions with invalid user
SELECT count(*) AS orphaned_sessions FROM sessions s
LEFT JOIN users u ON u.id = s.user_id
WHERE u.id IS NULL;

-- 7. Verify check constraints
SELECT tc.table_name, tc.constraint_name, ck.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints ck
  ON tc.constraint_name = ck.constraint_name
WHERE tc.constraint_type = 'CHECK'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 8. Verify schema migrations are applied
SELECT migration, applied_at FROM schema_migrations
ORDER BY migration;

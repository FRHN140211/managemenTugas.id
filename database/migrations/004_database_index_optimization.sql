-- Database Quality: index optimization for common query patterns
-- Improves pagination, filtering, dashboard bootstrap, and activity log queries
-- Safe to run on existing data; uses CREATE INDEX IF NOT EXISTS

-- Record collections: optimize owner-scoped list queries with status filtering
CREATE INDEX IF NOT EXISTS tasks_created_by_status_idx
  ON tasks (created_by, status);
CREATE INDEX IF NOT EXISTS reports_created_by_status_idx
  ON reports (created_by, status);
CREATE INDEX IF NOT EXISTS reminders_created_by_status_idx
  ON reminders (created_by, status);

-- Activity logs: support actor-scoped listing and module/action trend queries
CREATE INDEX IF NOT EXISTS activity_logs_actor_occurred_at_idx
  ON activity_logs (actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_module_action_occurred_at_idx
  ON activity_logs (module, action, occurred_at DESC);

-- Users: support role/status filtering for owner management
CREATE INDEX IF NOT EXISTS users_role_status_idx
  ON users (role, account_status);

-- Sessions: partial index for active session cleanup/lookup.
-- NOTE: the predicate must only use IMMUTABLE functions. now() is STABLE, so a
-- predicate of "expires_at > now()" is rejected by PostgreSQL ("functions in
-- index predicate must be marked IMMUTABLE"). A constant cutoff is immutable and
-- still serves the active-session lookup pattern (sessions expire in hours, and
-- the index is rebuilt by the next migration/deployment anyway).
CREATE INDEX IF NOT EXISTS sessions_active_idx
  ON sessions (expires_at)
  WHERE expires_at > '2000-01-01 00:00:00+00';

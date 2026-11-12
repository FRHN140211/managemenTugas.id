-- Migrate the legacy Indonesian-column schema without deleting its source data.
-- Run only after a Neon backup/branch, and do not run 001/002 first.
BEGIN;

DO $migration$
DECLARE
  required record;
  legacy_applicable boolean := true;
BEGIN
  -- Legacy schema exists (Indonesian-column canonical names are not present)
  IF to_regclass('public.users') IS NULL
     OR to_regclass('public.tasks') IS NULL
     OR to_regclass('public.reports') IS NULL
     OR to_regclass('public.reminders') IS NULL
     OR to_regclass('public.activity_logs') IS NULL THEN
    legacy_applicable := false;
  END IF;

  -- Legacy backup tables already exist (migration was partially applied)
  IF to_regclass('public.management_legacy_users_backup') IS NOT NULL
     OR to_regclass('public.management_legacy_tasks_backup') IS NOT NULL
     OR to_regclass('public.management_legacy_reports_backup') IS NOT NULL
     OR to_regclass('public.management_legacy_reminders_backup') IS NOT NULL
     OR to_regclass('public.management_legacy_activity_logs_backup') IS NOT NULL THEN
    legacy_applicable := false;
  END IF;

  -- Neon Auth tables (sessions, login_rate_limits) already exist.
  -- Legacy schema migration is not applicable for this managed-auth setup.
  -- Skip instead of raising an exception so the server can start normally.
  IF to_regclass('public.sessions') IS NOT NULL
     OR to_regclass('public.login_rate_limits') IS NOT NULL THEN
    legacy_applicable := false;
  END IF;

  IF NOT legacy_applicable THEN
    RAISE NOTICE 'Legacy schema migration skipped (legacy_applicable = false; Neon Auth tables present).';
    RETURN;
  END IF;

  FOR required IN
    SELECT expected.table_name, expected.column_name
      FROM (VALUES
        ('users', 'id'), ('users', 'nama'), ('users', 'email'),
        ('users', 'password_hash'), ('users', 'role'), ('users', 'status_akun'),
        ('users', 'dibuat_pada'),
        ('tasks', 'id'), ('tasks', 'nama'), ('tasks', 'deskripsi'),
        ('tasks', 'deadline'), ('tasks', 'status'), ('tasks', 'pemilik_id'),
        ('tasks', 'dibuat_pada'), ('tasks', 'diperbarui_pada'),
        ('reports', 'id'), ('reports', 'nama'), ('reports', 'deskripsi'),
        ('reports', 'deadline'), ('reports', 'status'), ('reports', 'pemilik_id'),
        ('reports', 'dibuat_pada'), ('reports', 'diperbarui_pada'),
        ('reminders', 'id'), ('reminders', 'nama'), ('reminders', 'deskripsi'),
        ('reminders', 'deadline'), ('reminders', 'status'), ('reminders', 'pemilik_id'),
        ('reminders', 'dibuat_pada'), ('reminders', 'diperbarui_pada'),
        ('activity_logs', 'id'), ('activity_logs', 'aksi'), ('activity_logs', 'objek'),
        ('activity_logs', 'aktor_id'), ('activity_logs', 'modul'), ('activity_logs', 'dibuat_pada')
      ) AS expected(table_name, column_name)
      LEFT JOIN information_schema.columns actual
        ON actual.table_schema = 'public'
       AND actual.table_name = expected.table_name
       AND actual.column_name = expected.column_name
     WHERE actual.column_name IS NULL
  LOOP
    RAISE EXCEPTION 'Legacy schema is not recognized: missing %.%.', required.table_name, required.column_name;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM users
     WHERE email <> lower(btrim(email))
        OR role NOT IN ('owner', 'user')
        OR status_akun NOT IN ('Aktif', 'Nonaktif')
  ) THEN
    RAISE EXCEPTION 'Normalize legacy user emails and resolve unsupported roles/account statuses before migrating.';
  END IF;

  IF EXISTS (
    SELECT lower(btrim(email))
      FROM users
     GROUP BY lower(btrim(email))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate normalized user emails must be resolved before migrating.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM tasks
     WHERE status NOT IN ('Belum Dimulai', 'Sedang Dikerjakan', 'Selesai')
    UNION ALL
    SELECT 1
      FROM reports
     WHERE status NOT IN ('Belum Dimulai', 'Sedang Dikerjakan', 'Selesai')
    UNION ALL
    SELECT 1
      FROM reminders
     WHERE status NOT IN ('Aktif', 'Nonaktif', 'Selesai')
  ) THEN
    RAISE EXCEPTION 'Resolve legacy records with unsupported statuses before migrating.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_constraint constraint_row
      JOIN pg_class referenced_table ON referenced_table.oid = constraint_row.confrelid
      JOIN pg_namespace schema_row ON schema_row.oid = referenced_table.relnamespace
     WHERE constraint_row.contype = 'f'
       AND schema_row.nspname = 'public'
       AND referenced_table.relname IN ('users', 'tasks', 'reports', 'reminders', 'activity_logs')
       AND constraint_row.conrelid NOT IN (
         'public.users'::regclass,
         'public.tasks'::regclass,
         'public.reports'::regclass,
         'public.reminders'::regclass,
         'public.activity_logs'::regclass
       )
  ) THEN
    RAISE EXCEPTION 'Additional tables reference the legacy data; migrate those foreign keys separately first.';
  END IF;
END;
$migration$;

ALTER TABLE users RENAME TO management_legacy_users_backup;
ALTER TABLE tasks RENAME TO management_legacy_tasks_backup;
ALTER TABLE reports RENAME TO management_legacy_reports_backup;
ALTER TABLE reminders RENAME TO management_legacy_reminders_backup;
ALTER TABLE activity_logs RENAME TO management_legacy_activity_logs_backup;
ALTER SEQUENCE IF EXISTS activity_logs_id_seq RENAME TO management_legacy_activity_logs_id_seq;

CREATE TABLE users (
  id text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL,
  account_status text NOT NULL DEFAULT 'Aktif',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_pk_canonical PRIMARY KEY (id),
  CONSTRAINT users_email_unique_canonical UNIQUE (email),
  CONSTRAINT users_role_check_canonical CHECK (role IN ('owner', 'user')),
  CONSTRAINT users_status_check_canonical CHECK (account_status IN ('Aktif', 'Nonaktif')),
  CONSTRAINT users_email_normalized_check_canonical CHECK (email = lower(btrim(email)))
);

CREATE TABLE tasks (
  id text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  deadline date NOT NULL,
  status text NOT NULL CHECK (status IN ('Belum Dimulai', 'Sedang Dikerjakan', 'Selesai')),
  created_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_pk_canonical PRIMARY KEY (id)
);

CREATE TABLE reports (
  id text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  deadline date NOT NULL,
  status text NOT NULL CHECK (status IN ('Belum Dimulai', 'Sedang Dikerjakan', 'Selesai')),
  created_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_pk_canonical PRIMARY KEY (id)
);

CREATE TABLE reminders (
  id text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  deadline date NOT NULL,
  status text NOT NULL CHECK (status IN ('Aktif', 'Nonaktif', 'Selesai')),
  created_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reminders_pk_canonical PRIMARY KEY (id)
);

CREATE TABLE sessions (
  session_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE login_rate_limits (
  bucket text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts > 0)
);

CREATE TABLE activity_logs (
  id bigint GENERATED ALWAYS AS IDENTITY,
  actor_id text REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  object_name text NOT NULL,
  module text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_logs_pk_canonical PRIMARY KEY (id)
);

INSERT INTO users (id, name, email, password_hash, role, account_status, created_at, updated_at)
SELECT id::text, nama, lower(btrim(email)), password_hash, role, status_akun, dibuat_pada, dibuat_pada
  FROM management_legacy_users_backup;

INSERT INTO tasks (id, name, description, deadline, status, created_by, created_at, updated_at)
SELECT id::text, nama, coalesce(deskripsi, ''), deadline, status, pemilik_id::text, dibuat_pada, diperbarui_pada
  FROM management_legacy_tasks_backup;

INSERT INTO reports (id, name, description, deadline, status, created_by, created_at, updated_at)
SELECT id::text, nama, coalesce(deskripsi, ''), deadline, status, pemilik_id::text, dibuat_pada, diperbarui_pada
  FROM management_legacy_reports_backup;

INSERT INTO reminders (id, name, description, deadline, status, created_by, created_at, updated_at)
SELECT id::text, nama, coalesce(deskripsi, ''), deadline, status, pemilik_id::text, dibuat_pada, diperbarui_pada
  FROM management_legacy_reminders_backup;

INSERT INTO activity_logs (id, actor_id, action, object_name, module, occurred_at)
OVERRIDING SYSTEM VALUE
SELECT id, aktor_id::text, aksi, coalesce(objek, ''), modul, dibuat_pada
  FROM management_legacy_activity_logs_backup;

SELECT setval(
  pg_get_serial_sequence('public.activity_logs', 'id'),
  greatest(coalesce((SELECT max(id) FROM activity_logs), 0), 1),
  coalesce((SELECT max(id) FROM activity_logs), 0) > 0
);

CREATE UNIQUE INDEX users_email_lower_unique_canonical_idx ON users (lower(email));
CREATE INDEX tasks_created_by_deadline_canonical_idx ON tasks (created_by, deadline);
CREATE INDEX reports_created_by_deadline_canonical_idx ON reports (created_by, deadline);
CREATE INDEX reminders_created_by_deadline_canonical_idx ON reminders (created_by, deadline);
CREATE INDEX sessions_user_expires_canonical_idx ON sessions (user_id, expires_at);
CREATE INDEX login_rate_limits_window_canonical_idx ON login_rate_limits (window_started_at);
CREATE INDEX activity_logs_occurred_canonical_idx ON activity_logs (occurred_at DESC);

DO $verification$
BEGIN
  IF (SELECT count(*) FROM users) <> (SELECT count(*) FROM management_legacy_users_backup)
     OR (SELECT count(*) FROM tasks) <> (SELECT count(*) FROM management_legacy_tasks_backup)
     OR (SELECT count(*) FROM reports) <> (SELECT count(*) FROM management_legacy_reports_backup)
     OR (SELECT count(*) FROM reminders) <> (SELECT count(*) FROM management_legacy_reminders_backup)
     OR (SELECT count(*) FROM activity_logs) <> (SELECT count(*) FROM management_legacy_activity_logs_backup) THEN
    RAISE EXCEPTION 'Migrated row counts do not match legacy backup tables; rolling back.';
  END IF;
END;
$verification$;

COMMIT;

-- Canonical fresh-install schema. For an existing installation, apply the
-- ordered, versioned migrations under database/migrations instead.
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  auth_subject text UNIQUE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'user')),
  account_status text NOT NULL DEFAULT 'Aktif'
    CHECK (account_status IN ('Aktif', 'Nonaktif')),
  theme_preference text CHECK (theme_preference IN ('light', 'dark', 'system')),
  language_preference text CHECK (language_preference IN ('id', 'en')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_normalized CHECK (email = lower(btrim(email)))
);

CREATE TABLE IF NOT EXISTS tasks (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  deadline date NOT NULL,
  status text NOT NULL
    CHECK (status IN ('Belum Dimulai', 'Sedang Dikerjakan', 'Selesai')),
  created_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  deadline date NOT NULL,
  status text NOT NULL
    CHECK (status IN ('Belum Dimulai', 'Sedang Dikerjakan', 'Selesai')),
  created_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reminders (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  deadline date NOT NULL,
  status text NOT NULL CHECK (status IN ('Aktif', 'Nonaktif', 'Selesai')),
  created_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  session_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login_rate_limits (
  bucket text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts > 0)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id text REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  object_name text NOT NULL,
  module text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'tugas_dibuat', 'tugas_diubah', 'tugas_selesai', 'tugas_dihapus',
    'laporan_dibuat', 'laporan_diubah', 'laporan_dikirim', 'laporan_dihapus',
    'pengingat_dibuat', 'pengingat_diubah', 'pengingat_selesai', 'pengingat_dihapus',
    'login'
  )),
  entity_type text NOT NULL CHECK (entity_type IN ('task', 'report', 'reminder', 'session')),
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  source_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_created_by_deadline_idx
  ON tasks (created_by, deadline);
CREATE INDEX IF NOT EXISTS reports_created_by_deadline_idx
  ON reports (created_by, deadline);
CREATE INDEX IF NOT EXISTS reminders_created_by_deadline_idx
  ON reminders (created_by, deadline);
CREATE INDEX IF NOT EXISTS sessions_user_expires_idx
  ON sessions (user_id, expires_at);
CREATE INDEX IF NOT EXISTS login_rate_limits_window_idx
  ON login_rate_limits (window_started_at);
CREATE INDEX IF NOT EXISTS activity_logs_occurred_at_idx
  ON activity_logs (occurred_at DESC);
CREATE INDEX IF NOT EXISTS activity_events_user_created_at_idx
  ON activity_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_events_created_at_idx
  ON activity_events (created_at DESC);

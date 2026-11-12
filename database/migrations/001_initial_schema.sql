CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  auth_subject text UNIQUE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'user')),
  account_status text NOT NULL DEFAULT 'Aktif'
    CHECK (account_status IN ('Aktif', 'Nonaktif')),
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
  status text NOT NULL
    CHECK (status IN ('Aktif', 'Nonaktif', 'Selesai')),
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

CREATE INDEX IF NOT EXISTS sessions_user_expires_idx
  ON sessions (user_id, expires_at);
CREATE INDEX IF NOT EXISTS login_rate_limits_window_idx
  ON login_rate_limits (window_started_at);
CREATE INDEX IF NOT EXISTS activity_logs_occurred_at_idx
  ON activity_logs (occurred_at DESC);

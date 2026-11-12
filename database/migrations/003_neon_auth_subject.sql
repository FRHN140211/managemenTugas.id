ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_subject text;

CREATE UNIQUE INDEX IF NOT EXISTS users_auth_subject_unique_idx
  ON users (auth_subject);

-- Analytics events storage with privacy-friendly defaults
CREATE TABLE IF NOT EXISTS analytics_events (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  session_id text,
  device_id text,
  event_name text NOT NULL,
  category text NOT NULL,
  properties jsonb,
  url text,
  user_agent text,
  ip_hash text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_user_id_idx
  ON analytics_events (user_id);

CREATE INDEX IF NOT EXISTS analytics_events_session_id_idx
  ON analytics_events (session_id);

CREATE INDEX IF NOT EXISTS analytics_events_event_name_idx
  ON analytics_events (event_name);

CREATE INDEX IF NOT EXISTS analytics_events_occurred_at_idx
  ON analytics_events (occurred_at DESC);

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

CREATE INDEX IF NOT EXISTS activity_events_user_created_at_idx
  ON activity_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_events_created_at_idx
  ON activity_events (created_at DESC);

INSERT INTO activity_events (user_id, event_type, entity_type, entity_id, metadata, source_key, created_at)
SELECT created_by, 'tugas_dibuat', 'task', id,
       jsonb_build_object('name', name, 'deadline', deadline::text),
       'backfill:task:' || id || ':created', created_at
  FROM tasks
ON CONFLICT (source_key) DO NOTHING;

INSERT INTO activity_events (user_id, event_type, entity_type, entity_id, metadata, source_key, created_at)
SELECT created_by,
       CASE WHEN status = 'Selesai' THEN 'tugas_selesai' ELSE 'tugas_diubah' END,
       'task', id, jsonb_build_object('name', name, 'deadline', deadline::text),
       'backfill:task:' || id || ':updated', updated_at
  FROM tasks
 WHERE updated_at > created_at
ON CONFLICT (source_key) DO NOTHING;

INSERT INTO activity_events (user_id, event_type, entity_type, entity_id, metadata, source_key, created_at)
SELECT created_by, 'laporan_dibuat', 'report', id,
       jsonb_build_object('name', name, 'deadline', deadline::text),
       'backfill:report:' || id || ':created', created_at
  FROM reports
ON CONFLICT (source_key) DO NOTHING;

INSERT INTO activity_events (user_id, event_type, entity_type, entity_id, metadata, source_key, created_at)
SELECT created_by,
       CASE WHEN status = 'Selesai' THEN 'laporan_dikirim' ELSE 'laporan_diubah' END,
       'report', id, jsonb_build_object('name', name, 'deadline', deadline::text),
       'backfill:report:' || id || ':updated', updated_at
  FROM reports
 WHERE updated_at > created_at
ON CONFLICT (source_key) DO NOTHING;

INSERT INTO activity_events (user_id, event_type, entity_type, entity_id, metadata, source_key, created_at)
SELECT created_by, 'pengingat_dibuat', 'reminder', id,
       jsonb_build_object('name', name, 'deadline', deadline::text),
       'backfill:reminder:' || id || ':created', created_at
  FROM reminders
ON CONFLICT (source_key) DO NOTHING;

INSERT INTO activity_events (user_id, event_type, entity_type, entity_id, metadata, source_key, created_at)
SELECT created_by,
       CASE WHEN status = 'Selesai' THEN 'pengingat_selesai' ELSE 'pengingat_diubah' END,
       'reminder', id, jsonb_build_object('name', name, 'deadline', deadline::text),
       'backfill:reminder:' || id || ':updated', updated_at
  FROM reminders
 WHERE updated_at > created_at
ON CONFLICT (source_key) DO NOTHING;

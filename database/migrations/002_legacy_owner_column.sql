DO $$
DECLARE
  relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['tasks', 'reports', 'reminders'] LOOP
    IF to_regclass('public.' || relation_name) IS NOT NULL
       AND EXISTS (
         SELECT 1
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = relation_name
            AND column_name = 'owner_id'
       )
       AND NOT EXISTS (
         SELECT 1
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = relation_name
            AND column_name = 'created_by'
       ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD COLUMN created_by text REFERENCES users(id) ON DELETE RESTRICT',
        relation_name
      );
      EXECUTE format(
        'UPDATE %I SET created_by = owner_id WHERE created_by IS NULL',
        relation_name
      );
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN created_by SET NOT NULL',
        relation_name
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I (created_by, deadline)',
        relation_name || '_created_by_deadline_idx',
        relation_name
      );
    END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS tasks_created_by_deadline_idx
  ON tasks (created_by, deadline);
CREATE INDEX IF NOT EXISTS reports_created_by_deadline_idx
  ON reports (created_by, deadline);
CREATE INDEX IF NOT EXISTS reminders_created_by_deadline_idx
  ON reminders (created_by, deadline);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique_idx
  ON users (lower(email));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS theme_preference text
    CHECK (theme_preference IN ('light', 'dark', 'system')),
  ADD COLUMN IF NOT EXISTS language_preference text
    CHECK (language_preference IN ('id', 'en'));

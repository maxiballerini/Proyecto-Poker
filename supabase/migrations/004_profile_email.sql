-- Migration 004: Add email to profile for member lookup by email
-- Backfills from auth.users and updates the trigger so new signups populate it automatically.

ALTER TABLE profile ADD COLUMN IF NOT EXISTS email text;

-- Backfill existing rows from auth.users
UPDATE profile p
SET email = u.email
FROM auth.users u
WHERE u.id = p.user_id;

-- Add index for fast email lookups
CREATE INDEX IF NOT EXISTS profile_email_idx ON profile (email);

-- Update trigger function to also store email on new signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profile (user_id, nombre, alias_pago, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NULL,
    NEW.email
  )
  ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

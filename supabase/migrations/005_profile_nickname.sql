-- Migration 005: Add unique nickname to profile for member lookup
ALTER TABLE profile ADD COLUMN IF NOT EXISTS nickname text;
CREATE UNIQUE INDEX IF NOT EXISTS profile_nickname_unique_idx ON profile (lower(nickname)) WHERE nickname IS NOT NULL;
CREATE INDEX IF NOT EXISTS profile_nickname_idx ON profile (nickname);

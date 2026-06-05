-- Migration 001: Add guest_player support
-- Allows the host to add players without Supabase accounts.
-- We drop the FK constraints that tie player_id to auth.users so that
-- guest UUIDs (from guest_player) can be stored in the same columns.

-- 1. New table for guest players (managed by the host)
CREATE TABLE IF NOT EXISTS guest_player (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  alias_pago text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE guest_player ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gp_select" ON guest_player FOR SELECT USING (host_id = auth.uid());
CREATE POLICY "gp_insert" ON guest_player FOR INSERT WITH CHECK (host_id = auth.uid());
CREATE POLICY "gp_update" ON guest_player FOR UPDATE USING (host_id = auth.uid());
CREATE POLICY "gp_delete" ON guest_player FOR DELETE USING (host_id = auth.uid());

-- 2. Drop FK constraints that require auth.users IDs on player columns.
--    The backend validates player existence server-side instead.
ALTER TABLE session_player DROP CONSTRAINT IF EXISTS session_player_player_id_fkey;
ALTER TABLE buyin          DROP CONSTRAINT IF EXISTS buyin_player_id_fkey;
ALTER TABLE cashout        DROP CONSTRAINT IF EXISTS cashout_player_id_fkey;
ALTER TABLE settlement     DROP CONSTRAINT IF EXISTS settlement_deudor_id_fkey;
ALTER TABLE settlement     DROP CONSTRAINT IF EXISTS settlement_acreedor_id_fkey;

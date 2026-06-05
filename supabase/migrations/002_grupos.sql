-- Migration 002: Groups model
-- Replaces one-off sessions with persistent grupos that contain multiple partidas.

-- 1. Clear old session data (clean slate as requested)
TRUNCATE cash_session CASCADE;

-- 2. grupo — the persistent friend group
CREATE TABLE grupo (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE grupo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grupo_select" ON grupo FOR SELECT USING (host_id = auth.uid());
CREATE POLICY "grupo_insert" ON grupo FOR INSERT WITH CHECK (host_id = auth.uid());
CREATE POLICY "grupo_update" ON grupo FOR UPDATE USING (host_id = auth.uid());
CREATE POLICY "grupo_delete" ON grupo FOR DELETE USING (host_id = auth.uid());

-- 3. grupo_member — players belonging to a grupo (real users or guests)
CREATE TABLE grupo_member (
  grupo_id  uuid NOT NULL REFERENCES grupo(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,  -- no FK: supports auth users + guest_player UUIDs
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (grupo_id, player_id)
);

ALTER TABLE grupo_member ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gm_select" ON grupo_member FOR SELECT USING (
  EXISTS (SELECT 1 FROM grupo g WHERE g.id = grupo_id AND g.host_id = auth.uid())
);
CREATE POLICY "gm_insert" ON grupo_member FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM grupo g WHERE g.id = grupo_id AND g.host_id = auth.uid())
);
CREATE POLICY "gm_delete" ON grupo_member FOR DELETE USING (
  EXISTS (SELECT 1 FROM grupo g WHERE g.id = grupo_id AND g.host_id = auth.uid())
);

-- 4. Link cash_session to a grupo (every partida belongs to a grupo)
ALTER TABLE cash_session ADD COLUMN grupo_id uuid NOT NULL REFERENCES grupo(id) ON DELETE CASCADE;

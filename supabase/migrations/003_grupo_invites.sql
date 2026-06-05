-- Migration 003: Invite links for grupos
-- Each grupo can have one active invite token (UUID). The host can regenerate or revoke it.
-- The token is public-readable so the invite page can show group info before auth.

CREATE TABLE grupo_invite (
  token      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id   uuid NOT NULL REFERENCES grupo(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grupo_id)
);

ALTER TABLE grupo_invite ENABLE ROW LEVEL SECURITY;

-- Public read: anyone with the token can see group info
CREATE POLICY "gi_select" ON grupo_invite FOR SELECT USING (true);

-- Only the grupo host can create/delete invites
CREATE POLICY "gi_insert" ON grupo_invite FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM grupo g WHERE g.id = grupo_id AND g.host_id = auth.uid())
);
CREATE POLICY "gi_delete" ON grupo_invite FOR DELETE USING (
  EXISTS (SELECT 1 FROM grupo g WHERE g.id = grupo_id AND g.host_id = auth.uid())
);

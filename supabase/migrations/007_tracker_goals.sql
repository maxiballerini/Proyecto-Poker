-- Migration 007: Personal tracker goals (monthly profit / hours targets)
-- One row per user per calendar month ('YYYY-MM'); owner-only RLS, same pattern as 006.

CREATE TABLE tracker_goal (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  periodo                     text NOT NULL,
  objetivo_ganancia_centavos  integer,
  objetivo_horas              numeric,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tracker_goal_periodo_format CHECK (periodo ~ '^\d{4}-\d{2}$'),
  CONSTRAINT tracker_goal_user_periodo_unique UNIQUE (user_id, periodo)
);

ALTER TABLE tracker_goal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tracker_goal_select" ON tracker_goal FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "tracker_goal_insert" ON tracker_goal FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "tracker_goal_update" ON tracker_goal FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "tracker_goal_delete" ON tracker_goal FOR DELETE USING (user_id = auth.uid());

CREATE INDEX tracker_goal_user_periodo_idx ON tracker_goal (user_id, periodo);

-- ============================================================
-- PokerNoche — Database Schema
-- Supabase / PostgreSQL
-- ============================================================


-- ============================================================
-- === TABLES ===
-- ============================================================

-- 1. profile — extends auth.users
CREATE TABLE profile (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  alias_pago text
);

-- 2. cash_session
CREATE TABLE cash_session (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id    uuid NOT NULL REFERENCES auth.users(id),
  nombre     text NOT NULL,
  fecha      date NOT NULL DEFAULT CURRENT_DATE,
  lugar      text,
  estado     text NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','cerrada')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. session_player (bridge table)
-- player_id may reference auth.users (real user) OR guest_player (guest).
-- FK to auth.users is intentionally omitted to support both.
CREATE TABLE session_player (
  session_id uuid REFERENCES cash_session(id) ON DELETE CASCADE,
  player_id  uuid NOT NULL,
  PRIMARY KEY (session_id, player_id)
);

-- 4. buyin (multiple rows per player = re-buys)
-- player_id may be a real user OR a guest (no FK to auth.users).
CREATE TABLE buyin (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES cash_session(id) ON DELETE CASCADE,
  player_id  uuid NOT NULL,
  monto      integer NOT NULL CHECK (monto > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. cashout (one per player per session)
CREATE TABLE cashout (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES cash_session(id) ON DELETE CASCADE,
  player_id  uuid NOT NULL,
  monto      integer NOT NULL CHECK (monto >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, player_id)
);

-- 6. settlement (computed when session closes)
-- deudor_id / acreedor_id may be real users OR guests.
CREATE TABLE settlement (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES cash_session(id),
  deudor_id   uuid NOT NULL,
  acreedor_id uuid NOT NULL,
  monto       integer NOT NULL CHECK (monto > 0),
  estado      text NOT NULL DEFAULT 'pendiente'
              CHECK (estado IN ('pendiente','confirmado_deudor','confirmado_host')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 7. guest_player — players without a Supabase account (managed by host)
CREATE TABLE guest_player (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  alias_pago text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. tournament
CREATE TABLE tournament (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id           uuid NOT NULL REFERENCES auth.users(id),
  nombre            text NOT NULL,
  fecha             date NOT NULL DEFAULT CURRENT_DATE,
  buyin_centavos    integer NOT NULL CHECK (buyin_centavos > 0),
  stack_inicial     integer NOT NULL,
  permite_reentry   boolean NOT NULL DEFAULT false,
  estado            text NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','en_curso','finalizado')),
  total_entradas    integer NOT NULL DEFAULT 0,
  jugadores_activos integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- 8. blind_level
CREATE TABLE blind_level (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournament(id) ON DELETE CASCADE,
  orden         integer NOT NULL,
  sb            integer NOT NULL CHECK (sb > 0),
  bb            integer NOT NULL CHECK (bb > 0),
  ante          integer NOT NULL DEFAULT 0,
  duracion_seg  integer NOT NULL CHECK (duracion_seg > 0),
  es_break      boolean NOT NULL DEFAULT false,
  UNIQUE (tournament_id, orden)
);

-- 9. prize (porcentaje in centesimas: 5000 = 50.00%)
CREATE TABLE prize (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournament(id) ON DELETE CASCADE,
  puesto        integer NOT NULL CHECK (puesto > 0),
  porcentaje    integer NOT NULL CHECK (porcentaje > 0 AND porcentaje <= 10000),
  UNIQUE (tournament_id, puesto)
);

-- 10. tournament_clock (1 row per tournament — drives Realtime sync)
CREATE TABLE tournament_clock (
  tournament_id      uuid PRIMARY KEY REFERENCES tournament(id) ON DELETE CASCADE,
  nivel_actual       integer NOT NULL DEFAULT 0,
  segundos_restantes integer NOT NULL DEFAULT 0,
  corriendo          boolean NOT NULL DEFAULT false,
  updated_at         timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- === RLS — ENABLE ===
-- ============================================================

ALTER TABLE profile          ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_player      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_session      ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_player    ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyin             ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashout           ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament        ENABLE ROW LEVEL SECURITY;
ALTER TABLE blind_level       ENABLE ROW LEVEL SECURITY;
ALTER TABLE prize             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_clock  ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- === RLS — POLICIES ===
-- ============================================================

-- profile
CREATE POLICY "profile_select" ON profile FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "profile_insert" ON profile FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "profile_update" ON profile FOR UPDATE USING (user_id = auth.uid());

-- guest_player
CREATE POLICY "gp_select" ON guest_player FOR SELECT USING (host_id = auth.uid());
CREATE POLICY "gp_insert" ON guest_player FOR INSERT WITH CHECK (host_id = auth.uid());
CREATE POLICY "gp_update" ON guest_player FOR UPDATE USING (host_id = auth.uid());
CREATE POLICY "gp_delete" ON guest_player FOR DELETE USING (host_id = auth.uid());

-- cash_session
CREATE POLICY "session_select" ON cash_session FOR SELECT USING (
  host_id = auth.uid() OR
  EXISTS (SELECT 1 FROM session_player sp WHERE sp.session_id = id AND sp.player_id = auth.uid())
);
CREATE POLICY "session_insert" ON cash_session FOR INSERT WITH CHECK (host_id = auth.uid());
CREATE POLICY "session_update" ON cash_session FOR UPDATE USING (host_id = auth.uid());
CREATE POLICY "session_delete" ON cash_session FOR DELETE USING (host_id = auth.uid());

-- session_player
CREATE POLICY "sp_select" ON session_player FOR SELECT USING (
  player_id = auth.uid() OR
  EXISTS (SELECT 1 FROM cash_session cs WHERE cs.id = session_id AND cs.host_id = auth.uid())
);
CREATE POLICY "sp_insert" ON session_player FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM cash_session cs WHERE cs.id = session_id AND cs.host_id = auth.uid())
);
CREATE POLICY "sp_delete" ON session_player FOR DELETE USING (
  EXISTS (SELECT 1 FROM cash_session cs WHERE cs.id = session_id AND cs.host_id = auth.uid())
);

-- buyin
CREATE POLICY "buyin_select" ON buyin FOR SELECT USING (
  player_id = auth.uid() OR
  EXISTS (SELECT 1 FROM cash_session cs WHERE cs.id = session_id AND cs.host_id = auth.uid())
);
CREATE POLICY "buyin_insert" ON buyin FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM cash_session cs WHERE cs.id = session_id AND cs.host_id = auth.uid())
);
CREATE POLICY "buyin_update" ON buyin FOR UPDATE USING (
  EXISTS (SELECT 1 FROM cash_session cs WHERE cs.id = session_id AND cs.host_id = auth.uid())
);
CREATE POLICY "buyin_delete" ON buyin FOR DELETE USING (
  EXISTS (SELECT 1 FROM cash_session cs WHERE cs.id = session_id AND cs.host_id = auth.uid())
);

-- cashout
CREATE POLICY "cashout_select" ON cashout FOR SELECT USING (
  player_id = auth.uid() OR
  EXISTS (SELECT 1 FROM cash_session cs WHERE cs.id = session_id AND cs.host_id = auth.uid())
);
CREATE POLICY "cashout_insert" ON cashout FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM cash_session cs WHERE cs.id = session_id AND cs.host_id = auth.uid())
);
CREATE POLICY "cashout_update" ON cashout FOR UPDATE USING (
  EXISTS (SELECT 1 FROM cash_session cs WHERE cs.id = session_id AND cs.host_id = auth.uid())
);
CREATE POLICY "cashout_delete" ON cashout FOR DELETE USING (
  EXISTS (SELECT 1 FROM cash_session cs WHERE cs.id = session_id AND cs.host_id = auth.uid())
);

-- settlement
CREATE POLICY "settlement_select" ON settlement FOR SELECT USING (
  deudor_id = auth.uid() OR acreedor_id = auth.uid() OR
  EXISTS (SELECT 1 FROM cash_session cs WHERE cs.id = session_id AND cs.host_id = auth.uid())
);
CREATE POLICY "settlement_insert" ON settlement FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM cash_session cs WHERE cs.id = session_id AND cs.host_id = auth.uid())
);
CREATE POLICY "settlement_update" ON settlement FOR UPDATE USING (
  deudor_id = auth.uid() OR
  EXISTS (SELECT 1 FROM cash_session cs WHERE cs.id = session_id AND cs.host_id = auth.uid())
);
CREATE POLICY "settlement_delete" ON settlement FOR DELETE USING (
  EXISTS (SELECT 1 FROM cash_session cs WHERE cs.id = session_id AND cs.host_id = auth.uid())
);

-- tournament (public read, host writes)
CREATE POLICY "tournament_select" ON tournament FOR SELECT USING (true);
CREATE POLICY "tournament_insert" ON tournament FOR INSERT WITH CHECK (host_id = auth.uid());
CREATE POLICY "tournament_update" ON tournament FOR UPDATE USING (host_id = auth.uid());
CREATE POLICY "tournament_delete" ON tournament FOR DELETE USING (host_id = auth.uid());

-- blind_level (public read, host writes)
CREATE POLICY "blind_select" ON blind_level FOR SELECT USING (true);
CREATE POLICY "blind_insert" ON blind_level FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM tournament t WHERE t.id = tournament_id AND t.host_id = auth.uid())
);
CREATE POLICY "blind_update" ON blind_level FOR UPDATE USING (
  EXISTS (SELECT 1 FROM tournament t WHERE t.id = tournament_id AND t.host_id = auth.uid())
);
CREATE POLICY "blind_delete" ON blind_level FOR DELETE USING (
  EXISTS (SELECT 1 FROM tournament t WHERE t.id = tournament_id AND t.host_id = auth.uid())
);

-- prize (public read, host writes)
CREATE POLICY "prize_select" ON prize FOR SELECT USING (true);
CREATE POLICY "prize_insert" ON prize FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM tournament t WHERE t.id = tournament_id AND t.host_id = auth.uid())
);
CREATE POLICY "prize_update" ON prize FOR UPDATE USING (
  EXISTS (SELECT 1 FROM tournament t WHERE t.id = tournament_id AND t.host_id = auth.uid())
);
CREATE POLICY "prize_delete" ON prize FOR DELETE USING (
  EXISTS (SELECT 1 FROM tournament t WHERE t.id = tournament_id AND t.host_id = auth.uid())
);

-- tournament_clock (public read — needed for Realtime; host writes)
CREATE POLICY "clock_select" ON tournament_clock FOR SELECT USING (true);
CREATE POLICY "clock_insert" ON tournament_clock FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM tournament t WHERE t.id = tournament_id AND t.host_id = auth.uid())
);
CREATE POLICY "clock_update" ON tournament_clock FOR UPDATE USING (
  EXISTS (SELECT 1 FROM tournament t WHERE t.id = tournament_id AND t.host_id = auth.uid())
);


-- ============================================================
-- === REALTIME ===
-- ============================================================

-- Enable Realtime on tournament_clock for live sync
ALTER PUBLICATION supabase_realtime ADD TABLE tournament_clock;


-- ============================================================
-- === TRIGGERS ===
-- ============================================================

-- Auto-create tournament_clock row on tournament INSERT
CREATE OR REPLACE FUNCTION create_tournament_clock()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO tournament_clock (tournament_id, nivel_actual, segundos_restantes, corriendo)
  VALUES (NEW.id, 0, 0, false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_create_tournament_clock
  AFTER INSERT ON tournament
  FOR EACH ROW EXECUTE FUNCTION create_tournament_clock();

-- Auto-create profile row on auth.users INSERT (new user signup)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profile (user_id, nombre, alias_pago)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Migration 006: Personal poker tracker (sessions, bankroll, tournament/bounty detail)
-- Single-user namespace: every row belongs to exactly one auth.users — RLS is owner-only,
-- no host/jugador split like cash_session/tournament.

-- ============================================================
-- 1. bankroll — user's bankroll accounts (can have several, e.g. per site/currency)
-- ============================================================
CREATE TABLE bankroll (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre                 text NOT NULL,
  moneda                 text NOT NULL DEFAULT 'ARS',
  saldo_inicial_centavos integer NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bankroll ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bankroll_select" ON bankroll FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "bankroll_insert" ON bankroll FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "bankroll_update" ON bankroll FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "bankroll_delete" ON bankroll FOR DELETE USING (user_id = auth.uid());

CREATE INDEX bankroll_user_idx ON bankroll (user_id);


-- ============================================================
-- 2. bankroll_transaction — manual movements (deposit/withdrawal/transfer)
--    Session results are NOT stored here; balance = saldo_inicial + Σ transacciones + Σ resultado_neto de sesiones
-- ============================================================
CREATE TABLE bankroll_transaction (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bankroll_id    uuid NOT NULL REFERENCES bankroll(id) ON DELETE CASCADE,
  tipo           text NOT NULL CHECK (tipo IN ('deposito', 'retiro', 'transferencia_entrada', 'transferencia_salida')),
  monto_centavos integer NOT NULL CHECK (monto_centavos > 0),
  nota           text,
  fecha          date NOT NULL DEFAULT CURRENT_DATE,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bankroll_transaction ENABLE ROW LEVEL SECURITY;
CREATE POLICY "btx_select" ON bankroll_transaction FOR SELECT USING (
  EXISTS (SELECT 1 FROM bankroll b WHERE b.id = bankroll_id AND b.user_id = auth.uid())
);
CREATE POLICY "btx_insert" ON bankroll_transaction FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM bankroll b WHERE b.id = bankroll_id AND b.user_id = auth.uid())
);
CREATE POLICY "btx_update" ON bankroll_transaction FOR UPDATE USING (
  EXISTS (SELECT 1 FROM bankroll b WHERE b.id = bankroll_id AND b.user_id = auth.uid())
);
CREATE POLICY "btx_delete" ON bankroll_transaction FOR DELETE USING (
  EXISTS (SELECT 1 FROM bankroll b WHERE b.id = bankroll_id AND b.user_id = auth.uid())
);

CREATE INDEX btx_bankroll_idx ON bankroll_transaction (bankroll_id, fecha);


-- ============================================================
-- 3. poker_session — central log; cash and tournament share this row,
--    tournament-specific detail lives in tournament_entry (1:1)
-- ============================================================
CREATE TABLE poker_session (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bankroll_id              uuid REFERENCES bankroll(id) ON DELETE SET NULL,
  tipo                     text NOT NULL CHECK (tipo IN ('cash', 'torneo')),
  modalidad                text NOT NULL CHECK (modalidad IN ('online', 'vivo')),
  variante                 text NOT NULL DEFAULT 'NLHE',
  fecha                    date NOT NULL DEFAULT CURRENT_DATE,
  ubicacion                text,
  duracion_min             integer CHECK (duracion_min IS NULL OR duracion_min >= 0),
  -- cash-only fields (NULL when tipo = 'torneo')
  stakes_sb_centavos       integer,
  stakes_bb_centavos       integer,
  buyin_total_centavos     integer,
  cashout_centavos         integer,
  mesa_size                integer,
  -- unifies cash & torneo for bankroll/stats — computed server-side on write
  resultado_neto_centavos  integer NOT NULL,
  notas                    text,
  mood                     smallint CHECK (mood IS NULL OR (mood BETWEEN 1 AND 5)),
  created_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE poker_session ENABLE ROW LEVEL SECURITY;
CREATE POLICY "psession_select" ON poker_session FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "psession_insert" ON poker_session FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "psession_update" ON poker_session FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "psession_delete" ON poker_session FOR DELETE USING (user_id = auth.uid());

CREATE INDEX psession_user_idx ON poker_session (user_id, fecha);
CREATE INDEX psession_tipo_idx ON poker_session (user_id, tipo, modalidad);
CREATE INDEX psession_bankroll_idx ON poker_session (bankroll_id);


-- ============================================================
-- 4. tournament_entry — tournament-specific detail (incl. bounty split), 1:1 with poker_session
-- ============================================================
CREATE TABLE tournament_entry (
  session_id                uuid PRIMARY KEY REFERENCES poker_session(id) ON DELETE CASCADE,
  nombre_torneo             text,
  buyin_centavos            integer NOT NULL DEFAULT 0 CHECK (buyin_centavos >= 0),
  comision_centavos         integer NOT NULL DEFAULT 0 CHECK (comision_centavos >= 0),
  rebuys                    integer NOT NULL DEFAULT 0 CHECK (rebuys >= 0),
  addons                    integer NOT NULL DEFAULT 0 CHECK (addons >= 0),
  costo_total_centavos      integer NOT NULL DEFAULT 0 CHECK (costo_total_centavos >= 0),
  es_bounty                 boolean NOT NULL DEFAULT false,
  tipo_bounty               text CHECK (tipo_bounty IS NULL OR tipo_bounty IN ('normal', 'progressive')),
  bounties_cobrados         integer NOT NULL DEFAULT 0 CHECK (bounties_cobrados >= 0),
  ganancia_bounty_centavos  integer NOT NULL DEFAULT 0 CHECK (ganancia_bounty_centavos >= 0),
  premio_pozo_centavos      integer NOT NULL DEFAULT 0 CHECK (premio_pozo_centavos >= 0),
  entrantes_totales         integer CHECK (entrantes_totales IS NULL OR entrantes_totales > 0),
  posicion_final            integer CHECK (posicion_final IS NULL OR posicion_final > 0),
  estructura                text CHECK (estructura IS NULL OR estructura IN ('regular', 'turbo', 'hyper', 'deepstack')),
  late_reg                  boolean NOT NULL DEFAULT false
);

ALTER TABLE tournament_entry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tentry_select" ON tournament_entry FOR SELECT USING (
  EXISTS (SELECT 1 FROM poker_session s WHERE s.id = session_id AND s.user_id = auth.uid())
);
CREATE POLICY "tentry_insert" ON tournament_entry FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM poker_session s WHERE s.id = session_id AND s.user_id = auth.uid())
);
CREATE POLICY "tentry_update" ON tournament_entry FOR UPDATE USING (
  EXISTS (SELECT 1 FROM poker_session s WHERE s.id = session_id AND s.user_id = auth.uid())
);
CREATE POLICY "tentry_delete" ON tournament_entry FOR DELETE USING (
  EXISTS (SELECT 1 FROM poker_session s WHERE s.id = session_id AND s.user_id = auth.uid())
);

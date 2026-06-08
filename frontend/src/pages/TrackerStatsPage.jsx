import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api } from '../lib/api'
import Toast from '../components/tracker/Toast'
import ActivityHeatmap from '../components/tracker/ActivityHeatmap'

const selectCls = 'bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500'

const PERIODOS = [
  { value: '', label: 'Todo' },
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: 'ytd', label: 'Este año' },
]

function fmt(centavos) {
  if (centavos == null) return '—'
  const n = (centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return `$ ${n}`
}
function fmtPct(v) { return v == null ? '—' : `${v}%` }
function fmtNum(v, suffix = '') { return v == null ? '—' : `${v}${suffix}` }

function netoColor(v) { return v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-gray-300' }

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color || 'text-white'}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-0.5">{sub}</p>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 mb-4">
      <h2 className="text-white font-semibold mb-3">{title}</h2>
      {children}
    </div>
  )
}

function BreakdownChart({ items }) {
  if (!items?.length) return <p className="text-gray-400 text-sm">Sin datos para este filtro.</p>
  const data = items.map((i) => ({ name: i.clave, neto: i.resultado_neto_centavos / 100, sesiones: i.sesiones }))
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} />
          <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} width={50} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#d1d5db' }}
            formatter={(value, key) => [key === 'neto' ? `$ ${value.toLocaleString('es-AR')}` : value, key === 'neto' ? 'Resultado' : 'Sesiones']}
          />
          <Bar dataKey="neto" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.neto >= 0 ? '#10b981' : '#ef4444'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function TrackerStatsPage() {
  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toastMsg, setToastMsg] = useState(null)

  const [periodo, setPeriodo] = useState('')
  const [tipo, setTipo] = useState('')
  const [modalidad, setModalidad] = useState('')

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 4000)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams()
    if (tipo) params.set('tipo', tipo)
    if (modalidad) params.set('modalidad', modalidad)
    if (periodo === 'ytd') {
      params.set('desde', `${new Date().getFullYear()}-01-01`)
    } else if (periodo) {
      const d = new Date()
      d.setDate(d.getDate() - parseInt(periodo, 10))
      params.set('desde', d.toISOString().slice(0, 10))
    }
    const qs = params.toString()
    api.get(`/tracker/stats${qs ? `?${qs}` : ''}`)
      .then((data) => { if (!cancelled) { setStats(data); setError(null) } })
      .catch((err) => { if (!cancelled) { setError(err.message); showToast(err.message) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [periodo, tipo, modalidad])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (tipo) params.set('tipo', tipo)
    if (modalidad) params.set('modalidad', modalidad)
    const qs = params.toString()
    api.get(`/tracker/sessions${qs ? `?${qs}` : ''}`)
      .then((data) => { if (!cancelled) setSessions(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [tipo, modalidad])

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-4">
        <Link to="/tracker" className="text-emerald-400 text-sm hover:underline">&larr; Tracker</Link>
        <h1 className="text-2xl font-bold text-white mt-1">Estadísticas</h1>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {PERIODOS.map((p) => (
            <button key={p.value} onClick={() => setPeriodo(p.value)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${periodo === p.value ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={selectCls}>
          <option value="">Todos los tipos</option>
          <option value="cash">Cash</option>
          <option value="torneo">Torneo</option>
        </select>
        <select value={modalidad} onChange={(e) => setModalidad(e.target.value)} className={selectCls}>
          <option value="">Todas las modalidades</option>
          <option value="online">Online</option>
          <option value="vivo">En vivo</option>
        </select>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {loading || !stats ? (
        <p className="text-gray-400 text-sm">Cargando…</p>
      ) : stats.general.total_sesiones === 0 ? (
        <div className="text-center py-16 bg-gray-800/50 rounded-xl">
          <p className="text-gray-400">No hay sesiones para este filtro todavía.</p>
        </div>
      ) : (
        <>
          <Section title="General">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Sesiones" value={stats.general.total_sesiones} />
              <StatCard label="Resultado neto" value={fmt(stats.general.resultado_neto_centavos)} color={netoColor(stats.general.resultado_neto_centavos)} />
              <StatCard label="Horas jugadas" value={fmtNum(stats.general.horas_jugadas)} />
              <StatCard label="Ganancia / hora" value={fmt(stats.general.ganancia_hora_centavos)} color={stats.general.ganancia_hora_centavos == null ? '' : netoColor(stats.general.ganancia_hora_centavos)} />
              <StatCard label="% sesiones ganadoras" value={fmtPct(stats.general.pct_ganadoras)} />
              <StatCard label="Mejor sesión" value={fmt(stats.general.mejor_sesion_centavos)} color="text-emerald-400" />
              <StatCard label="Peor sesión" value={fmt(stats.general.peor_sesion_centavos)} color="text-red-400" />
              <StatCard label="Desvío estándar" value={fmt(stats.general.desvio_estandar_centavos)} />
              <StatCard label="Racha actual" value={fmtNum(Math.abs(stats.general.racha_actual), stats.general.racha_actual === 0 ? '' : stats.general.racha_actual > 0 ? ' ganando' : ' perdiendo')}
                color={stats.general.racha_actual > 0 ? 'text-emerald-400' : stats.general.racha_actual < 0 ? 'text-red-400' : ''} />
              <StatCard label="Mejor racha ganadora" value={fmtNum(stats.general.mejor_racha_ganadora)} color="text-emerald-400" />
              <StatCard label="Peor racha perdedora" value={fmtNum(stats.general.peor_racha_perdedora)} color="text-red-400" />
            </div>
          </Section>

          {sessions.length > 0 && (
            <Section title="Actividad (últimas 18 semanas)">
              <ActivityHeatmap sessions={sessions} />
            </Section>
          )}

          <Section title="Resultado por tipo">
            <BreakdownChart items={stats.por_tipo} />
          </Section>
          <Section title="Resultado por modalidad">
            <BreakdownChart items={stats.por_modalidad} />
          </Section>
          <Section title="Resultado por variante">
            <BreakdownChart items={stats.por_variante} />
          </Section>

          {stats.torneos.jugados > 0 && (
            <Section title="Torneos">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Torneos jugados" value={stats.torneos.jugados} />
                <StatCard label="Cashes (ITM)" value={`${stats.torneos.cashes}`} sub={fmtPct(stats.torneos.pct_itm)} />
                <StatCard label="ROI" value={fmtPct(stats.torneos.roi_pct)} color={stats.torneos.roi_pct == null ? '' : netoColor(stats.torneos.roi_pct)} />
                <StatCard label="Buy-in promedio" value={fmt(stats.torneos.buyin_promedio_centavos)} />
                <StatCard label="Total invertido" value={fmt(stats.torneos.total_invertido_centavos)} color="text-red-400" />
                <StatCard label="Total retornado" value={fmt(stats.torneos.total_retornado_centavos)} color="text-emerald-400" />
                <StatCard label="Posición promedio" value={fmtNum(stats.torneos.posicion_promedio)} />
                <StatCard label="% mesa final" value={fmtPct(stats.torneos.pct_mesa_final)} />
                <StatCard label="% victorias (1°)" value={fmtPct(stats.torneos.pct_victorias)} />
              </div>
            </Section>
          )}

          {stats.bounty.jugados > 0 && (
            <Section title="Torneos bounty / knockout">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Torneos bounty" value={stats.bounty.jugados} sub={`${fmtPct(stats.bounty.pct_sobre_torneos)} del total`} />
                <StatCard label="Ganancia por bounties" value={fmt(stats.bounty.ganancia_bounty_centavos)} color="text-amber-400" />
                <StatCard label="Bounties cobrados" value={stats.bounty.bounties_cobrados} />
                <StatCard label="Valor promedio / bounty" value={fmt(stats.bounty.valor_promedio_bounty_centavos)} />
                <StatCard label="% resultado vía bounty" value={fmtPct(stats.bounty.pct_resultado_via_bounty)} sub="vs. premios del pozo" />
                <StatCard label="ROI (torneos bounty)" value={fmtPct(stats.bounty.roi_pct)} color={stats.bounty.roi_pct == null ? '' : netoColor(stats.bounty.roi_pct)} />
              </div>
            </Section>
          )}

          {stats.cash.sesiones > 0 && (
            <Section title="Cash games">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Sesiones cash" value={stats.cash.sesiones} />
                <StatCard label="Ganancia / hora" value={fmt(stats.cash.ganancia_hora_centavos)} color={stats.cash.ganancia_hora_centavos == null ? '' : netoColor(stats.cash.ganancia_hora_centavos)} />
                <StatCard label="Buy-in promedio" value={fmt(stats.cash.buyin_promedio_centavos)} />
                <StatCard label="Cash-out promedio" value={fmt(stats.cash.cashout_promedio_centavos)} />
              </div>
            </Section>
          )}
        </>
      )}
      <Toast msg={toastMsg} />
    </div>
  )
}

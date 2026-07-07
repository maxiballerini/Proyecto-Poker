import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import AmountDisplay from '../components/AmountDisplay'
import Toast from '../components/tracker/Toast'
import SessionFormModal from '../components/tracker/SessionFormModal'
import GoalsCard from '../components/tracker/GoalsCard'

function NavCard({ to, title, desc }) {
  return (
    <Link to={to} className="bg-gray-800 hover:bg-gray-750 rounded-xl p-4 transition-colors block">
      <p className="text-white font-semibold">{title}</p>
      <p className="text-gray-400 text-sm mt-1">{desc}</p>
    </Link>
  )
}

function StatBox({ label, value, positive }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
      {typeof value === 'number' || (typeof value === 'object' && value !== null)
        ? <div className={`text-xl font-bold mt-1 ${positive === undefined ? 'text-white' : positive ? 'text-emerald-400' : 'text-red-400'}`}>{value}</div>
        : <p className="text-xl font-bold text-white mt-1">{value}</p>}
    </div>
  )
}

export default function TrackerPage() {
  const [sessions, setSessions] = useState([])
  const [bankrolls, setBankrolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toastMsg, setToastMsg] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 4000)
  }

  const load = async () => {
    setLoading(true)
    try {
      const [sessionsData, bankrollsData] = await Promise.all([
        api.get('/tracker/sessions'),
        api.get('/tracker/bankrolls'),
      ])
      setSessions(sessionsData)
      setBankrolls(bankrollsData)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSaved = (saved) => {
    const list = Array.isArray(saved) ? saved : [saved]
    setSessions((prev) => [...list, ...prev])
    setShowModal(false)
  }

  const handleDelete = async (id) => {
    if (deletingId !== id) { setDeletingId(id); return }
    const snap = sessions
    setSessions((prev) => prev.filter((s) => s.id !== id))
    setDeletingId(null)
    try {
      await api.delete(`/tracker/sessions/${id}`)
    } catch (err) {
      setSessions(snap)
      showToast(err.message)
    }
  }

  const totalNeto = sessions.reduce((acc, s) => acc + s.resultado_neto_centavos, 0)
  const ganadoras = sessions.filter((s) => s.resultado_neto_centavos > 0).length
  const winRate = sessions.length ? Math.round((ganadoras / sessions.length) * 100) : 0
  const totalHoras = sessions.reduce((acc, s) => acc + (s.duracion_min || 0), 0) / 60
  const torneos = sessions.filter((s) => s.tipo === 'torneo')
  const cashes = torneos.filter((s) => s.torneo?.posicion_final && s.torneo?.entrantes_totales && s.torneo.posicion_final <= Math.ceil(s.torneo.entrantes_totales * 0.15))
  const itm = torneos.length ? Math.round((cashes.length / torneos.length) * 100) : null

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Mi tracker de poker</h1>
          <p className="text-gray-400 text-sm mt-1">Tus sesiones, bankroll y estadísticas — todo privado, solo vos lo ves.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0">
          + Nueva sesión
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {!loading && sessions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatBox label="Resultado total" value={<AmountDisplay centavos={totalNeto} />} positive={totalNeto >= 0} />
          <StatBox label="Sesiones" value={sessions.length} />
          <StatBox label="% sesiones ganadoras" value={`${winRate}%`} />
          <StatBox label="Horas jugadas" value={totalHoras.toFixed(1)} />
        </div>
      )}

      <GoalsCard />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <NavCard to="/tracker/sessions" title="Sesiones" desc="Historial completo con filtros por tipo y modalidad" />
        <NavCard to="/tracker/bankroll" title="Bankroll" desc={bankrolls.length ? `${bankrolls.length} cuenta${bankrolls.length > 1 ? 's' : ''} · gestioná tus saldos` : 'Creá tu primera cuenta de bankroll'} />
        <NavCard to="/tracker/stats" title="Estadísticas" desc={itm != null ? `ITM ${itm}% · ROI, rachas, breakdown por bounty y más` : 'ITM%, ROI, rachas, breakdown por bounty y más'} />
      </div>

      <div className="bg-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold">Sesiones recientes</h2>
          <Link to="/tracker/sessions" className="text-emerald-400 text-sm hover:underline">Ver todas</Link>
        </div>
        {loading ? (
          <p className="text-gray-400 text-sm">Cargando…</p>
        ) : sessions.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-400">Todavía no cargaste ninguna sesión.</p>
            <button onClick={() => setShowModal(true)} className="mt-3 text-emerald-400 text-sm hover:underline">Cargar tu primera sesión</button>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                <div className="min-w-0">
                  <p className="text-white text-sm truncate">
                    {s.tipo === 'torneo' ? (s.torneo?.nombre_torneo || 'Torneo') : (s.variante || 'Cash game')}
                    <span className="text-gray-500"> · {s.fecha}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <AmountDisplay centavos={s.resultado_neto_centavos} className={`font-semibold text-sm ${s.resultado_neto_centavos >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                  <button
                    onClick={() => handleDelete(s.id)}
                    className={`text-xs transition-colors ${deletingId === s.id ? 'text-red-400 font-semibold' : 'text-gray-500 hover:text-red-400'}`}
                  >
                    {deletingId === s.id ? '¿Confirmar?' : 'Borrar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <SessionFormModal
          bankrolls={bankrolls}
          initial={null}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
      <Toast msg={toastMsg} />
    </div>
  )
}

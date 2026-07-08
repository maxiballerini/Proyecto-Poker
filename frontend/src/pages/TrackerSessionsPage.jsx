import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import AmountDisplay from '../components/AmountDisplay'
import Toast from '../components/tracker/Toast'
import SessionFormModal from '../components/tracker/SessionFormModal'

const selectCls = 'bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500'

function badge(text, color) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{text}</span>
}

const CSV_HEADERS = [
  'fecha', 'tipo', 'modalidad', 'variante', 'ubicacion', 'duracion_min',
  'resultado_neto', 'buyin_total', 'cashout',
  'nombre_torneo', 'posicion_final', 'entrantes_totales', 'es_bounty',
  'premio_pozo', 'ganancia_bounty', 'bounties_cobrados',
]

function csvCell(value) {
  if (value == null) return ''
  const s = String(value)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function exportSessionsToCsv(sessions) {
  const toUnits = (c) => (c == null ? '' : (c / 100).toFixed(2))
  const rows = sessions.map((s) => {
    const t = s.torneo
    return [
      s.fecha, s.tipo, s.modalidad, s.variante || '', s.ubicacion || '', s.duracion_min ?? '',
      toUnits(s.resultado_neto_centavos), toUnits(s.buyin_total_centavos), toUnits(s.cashout_centavos),
      t?.nombre_torneo || '', t?.posicion_final ?? '', t?.entrantes_totales ?? '', t?.es_bounty ? 'si' : 'no',
      toUnits(t?.premio_pozo_centavos), toUnits(t?.ganancia_bounty_centavos), t?.bounties_cobrados ?? '',
    ]
  })
  const csv = [CSV_HEADERS, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sesiones_poker_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function SessionCard({ s, onEdit, onDelete, deleting }) {
  const torneo = s.torneo
  const positivo = s.resultado_neto_centavos >= 0

  return (
    <div className="bg-gray-800 rounded-xl p-4 hover:bg-gray-750 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {badge(s.tipo === 'cash' ? 'Cash' : 'Torneo', s.tipo === 'cash' ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300')}
            {badge(s.modalidad === 'online' ? 'Online' : 'En vivo', 'bg-gray-700 text-gray-300')}
            {torneo?.es_bounty && badge(torneo.tipo_bounty === 'progressive' ? 'PKO' : 'Bounty', 'bg-amber-900/50 text-amber-300')}
            <span className="text-gray-400 text-xs">{s.fecha}</span>
          </div>
          <p className="text-white font-medium truncate">
            {s.tipo === 'torneo' ? (torneo?.nombre_torneo || 'Torneo sin nombre') : (s.variante || 'Cash game')}
            {s.ubicacion && <span className="text-gray-400 font-normal"> · {s.ubicacion}</span>}
          </p>
          <p className="text-gray-400 text-xs mt-0.5">
            {s.tipo === 'torneo' && torneo ? (
              <>
                {torneo.posicion_final ? `Posición ${torneo.posicion_final}` : 'Sin resultado'}
                {torneo.entrantes_totales ? ` de ${torneo.entrantes_totales}` : ''}
                {torneo.es_bounty && (torneo.ganancia_bounty_centavos > 0 || torneo.bounties_cobrados > 0) && (
                  <> · {torneo.bounties_cobrados} KOs (<AmountDisplay centavos={torneo.ganancia_bounty_centavos} className="text-amber-400" />)</>
                )}
              </>
            ) : (
              <>
                {s.duracion_min ? `${s.duracion_min} min` : ''}
                {s.mesa_size ? ` · mesa de ${s.mesa_size}` : ''}
              </>
            )}
          </p>
        </div>
        <div className="text-right shrink-0">
          <AmountDisplay centavos={s.resultado_neto_centavos} className={`font-bold text-lg ${positivo ? 'text-emerald-400' : 'text-red-400'}`} />
          <div className="flex gap-2 mt-2 justify-end">
            <button onClick={() => onEdit(s)} className="text-xs text-gray-400 hover:text-white transition-colors">Editar</button>
            <button onClick={() => onDelete(s.id)} className={`text-xs transition-colors ${deleting === s.id ? 'text-red-400 font-semibold' : 'text-gray-400 hover:text-red-400'}`}>
              {deleting === s.id ? '¿Confirmar?' : 'Borrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TrackerSessionsPage() {
  const [sessions, setSessions] = useState([])
  const [bankrolls, setBankrolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toastMsg, setToastMsg] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const [filterTipo, setFilterTipo] = useState('')
  const [filterModalidad, setFilterModalidad] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 4000)
  }

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterTipo) params.set('tipo', filterTipo)
      if (filterModalidad) params.set('modalidad', filterModalidad)
      const qs = params.toString()
      const [sessionsData, bankrollsData] = await Promise.all([
        api.get(`/tracker/sessions${qs ? `?${qs}` : ''}`),
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

  useEffect(() => { load() }, [filterTipo, filterModalidad])

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

  const handleSaved = (saved) => {
    const list = Array.isArray(saved) ? saved : [saved]
    setSessions((prev) => {
      if (list.length === 1 && prev.some((s) => s.id === list[0].id)) {
        return prev.map((s) => (s.id === list[0].id ? list[0] : s))
      }
      return [...list, ...prev]
    })
    setShowModal(false)
    setEditing(null)
  }

  const openEdit = (s) => { setEditing(s); setShowModal(true) }
  const openCreate = () => { setEditing(null); setShowModal(true) }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link to="/tracker" className="text-emerald-400 text-sm hover:underline">&larr; Tracker</Link>
          <h1 className="text-2xl font-bold text-white mt-1">Historial de sesiones</h1>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => exportSessionsToCsv(sessions)}
            disabled={!sessions.length}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Exportar CSV
          </button>
          <button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            + Nueva sesión
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className={selectCls}>
          <option value="">Todos los tipos</option>
          <option value="cash">Cash</option>
          <option value="torneo">Torneo</option>
        </select>
        <select value={filterModalidad} onChange={(e) => setFilterModalidad(e.target.value)} className={selectCls}>
          <option value="">Todas las modalidades</option>
          <option value="online">Online</option>
          <option value="vivo">En vivo</option>
        </select>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando…</p>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 bg-gray-800/50 rounded-xl">
          <p className="text-gray-400">No hay sesiones cargadas todavía.</p>
          <button onClick={openCreate} className="mt-3 text-emerald-400 text-sm hover:underline">Cargar tu primera sesión</button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <SessionCard key={s.id} s={s} onEdit={openEdit} onDelete={handleDelete} deleting={deletingId} />
          ))}
        </div>
      )}

      {showModal && (
        <SessionFormModal
          bankrolls={bankrolls}
          initial={editing}
          existingSessions={sessions}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={handleSaved}
        />
      )}
      <Toast msg={toastMsg} />
    </div>
  )
}

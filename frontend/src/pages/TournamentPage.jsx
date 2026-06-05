import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import AmountDisplay from '../components/AmountDisplay'

function formatTime(s) {
  const secs = Math.max(0, s)
  return (
    String(Math.floor(secs / 60)).padStart(2, '0') +
    ':' +
    String(secs % 60).padStart(2, '0')
  )
}

function StatusBadge({ estado }) {
  const map = {
    pendiente: 'bg-blue-700 text-blue-100',
    en_curso: 'bg-yellow-600 text-yellow-100',
    finalizado: 'bg-gray-600 text-gray-200',
  }
  return (
    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${map[estado] ?? 'bg-gray-600 text-gray-200'}`}>
      {estado}
    </span>
  )
}

function BlindLevelsEditor({ levels, onSave }) {
  const [rows, setRows] = useState(levels || [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const updateRow = (i, field, val) => {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }

  const addRow = () => {
    setRows((prev) => [...prev, { nivel: prev.length + 1, sb: 0, bb: 0, ante: 0, duracion: 15 }])
  }

  const removeRow = (i) => {
    setRows((prev) => prev.filter((_, idx) => idx !== i))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(rows)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-2">Nivel</th>
              <th className="text-right py-2 px-2">SB</th>
              <th className="text-right py-2 px-2">BB</th>
              <th className="text-right py-2 px-2">Ante</th>
              <th className="text-right py-2 px-2">Min</th>
              <th className="py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-gray-700/50">
                <td className="py-1.5 pr-2">
                  <input type="number" value={r.nivel} onChange={(e) => updateRow(i, 'nivel', +e.target.value)}
                    className="w-12 bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs" />
                </td>
                {['sb', 'bb', 'ante'].map((f) => (
                  <td key={f} className="py-1.5 px-2">
                    <input type="number" value={r[f]} onChange={(e) => updateRow(i, f, +e.target.value)}
                      className="w-20 bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs text-right" />
                  </td>
                ))}
                <td className="py-1.5 px-2">
                  <input type="number" value={r.duracion} onChange={(e) => updateRow(i, 'duracion', +e.target.value)}
                    className="w-16 bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs text-right" />
                </td>
                <td className="py-1.5">
                  <button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-300 text-xs px-1">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3 mt-3">
        <button onClick={addRow} className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
          + Nivel
        </button>
        <button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
          {saving ? 'Guardando…' : 'Guardar estructura'}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  )
}

function PrizesEditor({ prizes, onSave }) {
  const [rows, setRows] = useState(prizes || [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const updateRow = (i, field, val) => {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }

  const addRow = () => {
    setRows((prev) => [...prev, { posicion: prev.length + 1, monto: 0, porcentaje: 0 }])
  }

  const removeRow = (i) => setRows((prev) => prev.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(rows)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-2">Posición</th>
              <th className="text-right py-2 px-2">Monto (centavos)</th>
              <th className="text-right py-2 px-2">%</th>
              <th className="py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-gray-700/50">
                <td className="py-1.5 pr-2">
                  <input type="number" value={r.posicion} onChange={(e) => updateRow(i, 'posicion', +e.target.value)}
                    className="w-16 bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs" />
                </td>
                <td className="py-1.5 px-2">
                  <input type="number" value={r.monto} onChange={(e) => updateRow(i, 'monto', +e.target.value)}
                    className="w-28 bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs text-right" />
                </td>
                <td className="py-1.5 px-2">
                  <input type="number" value={r.porcentaje} onChange={(e) => updateRow(i, 'porcentaje', +e.target.value)}
                    className="w-16 bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs text-right" />
                </td>
                <td className="py-1.5">
                  <button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-300 text-xs px-1">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3 mt-3">
        <button onClick={addRow} className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
          + Premio
        </button>
        <button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
          {saving ? 'Guardando…' : 'Guardar premios'}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  )
}

export default function TournamentPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tournament, setTournament] = useState(null)
  const [clock, setClock] = useState(null)
  const [levels, setLevels] = useState([])
  const [prizes, setPrizes] = useState([])
  const [localSeconds, setLocalSeconds] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const intervalRef = useRef(null)

  const fetchData = useCallback(async () => {
    try {
      const [t, lvls, prz] = await Promise.all([
        api.get(`/mtt/tournaments/${id}`),
        api.get(`/mtt/tournaments/${id}/levels`).catch(() => []),
        api.get(`/mtt/tournaments/${id}/prizes`).catch(() => []),
      ])
      setTournament(t)
      setLevels(lvls)
      setPrizes(prz)
      if (t.clock) {
        setClock(t.clock)
        setLocalSeconds(t.clock.segundos_restantes ?? 0)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`clock-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tournament_clock', filter: `tournament_id=eq.${id}` },
        (payload) => {
          setClock(payload.new)
          setLocalSeconds(payload.new.segundos_restantes ?? 0)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [id])

  // Local countdown
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (clock?.corriendo) {
      intervalRef.current = setInterval(() => {
        setLocalSeconds((s) => Math.max(0, s - 1))
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [clock?.corriendo, clock?.segundos_restantes])

  const clockAction = async (action) => {
    setActionError(null)
    try {
      await api.put(`/mtt/tournaments/${id}/clock`, { action })
      await fetchData()
    } catch (err) {
      setActionError(err.message)
    }
  }

  const handleAdjustTime = async (deltaSecs) => {
    setActionError(null)
    try {
      await api.put(`/mtt/tournaments/${id}/clock`, {
        action: 'adjust',
        delta: deltaSecs,
      })
      await fetchData()
    } catch (err) {
      setActionError(err.message)
    }
  }

  const handleEntry = async (reentry = false) => {
    setActionError(null)
    try {
      await api.post(`/mtt/tournaments/${id}/entries`, { reentry })
      await fetchData()
    } catch (err) {
      setActionError(err.message)
    }
  }

  const handleEliminate = async () => {
    setActionError(null)
    try {
      await api.post(`/mtt/tournaments/${id}/eliminate`, {})
      await fetchData()
    } catch (err) {
      setActionError(err.message)
    }
  }

  const handleStart = async () => {
    setActionError(null)
    try {
      await api.post(`/mtt/tournaments/${id}/start`, {})
      await fetchData()
    } catch (err) {
      setActionError(err.message)
    }
  }

  const handleSaveLevels = async (rows) => {
    await api.put(`/mtt/tournaments/${id}/levels`, { levels: rows })
    await fetchData()
  }

  const handleSavePrizes = async (rows) => {
    await api.put(`/mtt/tournaments/${id}/prizes`, { prizes: rows })
    await fetchData()
  }

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Cargando…</div>
  if (error) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-red-400">{error}</div>
  if (!tournament) return null

  const isHost = user?.id === tournament.host_id
  const currentLevel = levels.find((l) => l.nivel === clock?.nivel_actual) || levels[0]
  const nextLevel = levels.find((l) => l.nivel === (clock?.nivel_actual ?? 0) + 1)

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white text-sm mb-4 transition-colors">
          ← Volver
        </button>

        {/* Header */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg mb-6">
          <div className="flex items-start justify-between mb-2">
            <h1 className="text-2xl font-bold text-white">{tournament.nombre}</h1>
            <div className="flex items-center gap-3">
              <StatusBadge estado={tournament.estado} />
              <Link
                to={`/tournaments/${id}/tv`}
                className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
              >
                Modo TV
              </Link>
            </div>
          </div>
          <p className="text-gray-400 text-sm">{new Date(tournament.fecha).toLocaleDateString('es-AR')}</p>

          {isHost && tournament.estado === 'pendiente' && (
            <button onClick={handleStart} className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">
              Iniciar torneo
            </button>
          )}
        </div>

        {/* Clock */}
        {clock && (
          <div className="bg-gray-800 rounded-xl p-6 shadow-lg mb-6">
            <div className="text-center mb-4">
              <div className="text-gray-400 text-sm mb-1">NIVEL {clock.nivel_actual}</div>
              <div className="text-7xl font-mono font-bold text-white mb-2">{formatTime(localSeconds)}</div>
              {currentLevel && (
                <div className="text-gray-300 text-lg">
                  SB: {currentLevel.sb} / BB: {currentLevel.bb}
                  {currentLevel.ante > 0 && ` / Ante: ${currentLevel.ante}`}
                </div>
              )}
              {nextLevel && (
                <div className="text-gray-500 text-sm mt-1">
                  Próximo: SB {nextLevel.sb} / BB {nextLevel.bb}
                </div>
              )}
            </div>

            {isHost && (
              <div className="space-y-3">
                <div className="flex gap-2 justify-center flex-wrap">
                  <button
                    onClick={() => clockAction(clock.corriendo ? 'pause' : 'play')}
                    className={`${clock.corriendo ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors`}
                  >
                    {clock.corriendo ? 'Pausar' : 'Iniciar'}
                  </button>
                  <button onClick={() => clockAction('prev')} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                    ← Nivel ant.
                  </button>
                  <button onClick={() => clockAction('next')} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                    Nivel sig. →
                  </button>
                </div>
                <div className="flex gap-2 justify-center">
                  <button onClick={() => handleAdjustTime(60)} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-xs transition-colors">
                    +1 min
                  </button>
                  <button onClick={() => handleAdjustTime(-60)} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-xs transition-colors">
                    -1 min
                  </button>
                </div>
              </div>
            )}
            {actionError && <p className="text-red-400 text-xs text-center mt-3">{actionError}</p>}
          </div>
        )}

        {/* Entries */}
        {isHost && tournament.estado === 'en_curso' && (
          <div className="bg-gray-800 rounded-xl p-6 shadow-lg mb-6">
            <h2 className="text-lg font-bold text-white mb-3">
              Jugadores: {tournament.jugadores_activos ?? 0}
            </h2>
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => handleEntry(false)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-2 rounded-lg transition-colors">
                Registrar entrada
              </button>
              <button onClick={() => handleEntry(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition-colors">
                Re-entry
              </button>
              <button onClick={handleEliminate} className="bg-red-600 hover:bg-red-500 text-white text-sm px-4 py-2 rounded-lg transition-colors">
                Eliminar jugador
              </button>
            </div>
          </div>
        )}

        {/* Blind structure (host edit) */}
        {isHost && (
          <div className="bg-gray-800 rounded-xl p-6 shadow-lg mb-6">
            <h2 className="text-lg font-bold text-white mb-4">Estructura de ciegas</h2>
            <BlindLevelsEditor levels={levels} onSave={handleSaveLevels} />
          </div>
        )}

        {/* Prizes */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg mb-6">
          <h2 className="text-lg font-bold text-white mb-4">Premios</h2>
          {isHost ? (
            <PrizesEditor prizes={prizes} onSave={handleSavePrizes} />
          ) : (
            prizes.length === 0 ? (
              <p className="text-gray-400 text-sm">Sin premios definidos.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2">Posición</th>
                    <th className="text-right py-2">Monto</th>
                    <th className="text-right py-2">%</th>
                  </tr>
                </thead>
                <tbody>
                  {prizes.map((p) => (
                    <tr key={p.posicion} className="border-b border-gray-700/50">
                      <td className="py-2 text-gray-300">{p.posicion}°</td>
                      <td className="py-2 text-right text-white"><AmountDisplay centavos={p.monto} /></td>
                      <td className="py-2 text-right text-gray-400">{p.porcentaje}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>

        {/* Read-only clock for players */}
        {!isHost && clock && (
          <div className="bg-gray-800 rounded-xl p-6 shadow-lg mb-6">
            <h2 className="text-lg font-bold text-white mb-3 text-center">Reloj</h2>
            <div className="text-center">
              <div className="text-gray-400 text-sm">NIVEL {clock.nivel_actual}</div>
              <div className="text-6xl font-mono font-bold text-white my-2">{formatTime(localSeconds)}</div>
              {currentLevel && (
                <div className="text-gray-300">
                  SB: {currentLevel.sb} / BB: {currentLevel.bb}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'

function formatTime(s) {
  const secs = Math.max(0, s)
  return (
    String(Math.floor(secs / 60)).padStart(2, '0') +
    ':' +
    String(secs % 60).padStart(2, '0')
  )
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.5, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 1.2)
  } catch {
    // Audio not supported — silently ignore
  }
}

export default function ClockTVPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tournament, setTournament] = useState(null)
  const [clock, setClock] = useState(null)
  const [levels, setLevels] = useState([])
  const [prizes, setPrizes] = useState([])
  const [localSeconds, setLocalSeconds] = useState(0)
  const [loading, setLoading] = useState(true)
  const prevLevelRef = useRef(null)
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
        prevLevelRef.current = t.clock.nivel_actual
      }
    } catch {
      // silent fail for TV mode
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
      .channel(`tv-clock-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tournament_clock', filter: `tournament_id=eq.${id}` },
        (payload) => {
          const newClock = payload.new
          if (prevLevelRef.current !== null && newClock.nivel_actual !== prevLevelRef.current) {
            playBeep()
          }
          prevLevelRef.current = newClock.nivel_actual
          setClock(newClock)
          setLocalSeconds(newClock.segundos_restantes ?? 0)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white text-4xl">
        Cargando…
      </div>
    )
  }

  const currentLevel = levels.find((l) => l.nivel === clock?.nivel_actual) || levels[0]
  const nextLevel = levels.find((l) => l.nivel === (clock?.nivel_actual ?? 0) + 1)
  const totalPot = prizes.reduce((acc, p) => acc + (p.monto || 0), 0)
  const topPrizes = prizes.slice(0, 3)

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center relative px-8">
      {/* Exit button */}
      <button
        onClick={() => navigate(`/tournaments/${id}`)}
        className="absolute top-4 right-4 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
      >
        Salir
      </button>

      {/* Tournament name */}
      <div className="text-gray-400 text-2xl font-medium mb-6 tracking-wide uppercase">
        {tournament?.nombre}
      </div>

      {/* Level */}
      <div className="text-gray-300 text-4xl font-bold mb-4 tracking-widest">
        NIVEL {clock?.nivel_actual ?? '—'}
        {clock && (
          <span className={`ml-4 text-2xl ${clock.corriendo ? 'text-emerald-400' : 'text-yellow-400'}`}>
            {clock.corriendo ? '● corriendo' : '⏸ pausado'}
          </span>
        )}
      </div>

      {/* Blinds */}
      {currentLevel && (
        <div className="text-gray-200 text-5xl font-semibold mb-6">
          SB: {currentLevel.sb.toLocaleString('es-AR')}
          {'  '}BB: {currentLevel.bb.toLocaleString('es-AR')}
          {currentLevel.ante > 0 && (
            <span className="text-gray-400 text-4xl">{'  '}Ante: {currentLevel.ante.toLocaleString('es-AR')}</span>
          )}
        </div>
      )}

      {/* Big countdown timer */}
      <div className="text-8xl font-mono font-black text-white mb-6 tabular-nums">
        {formatTime(localSeconds)}
      </div>

      {/* Next level */}
      {nextLevel && (
        <div className="text-gray-500 text-3xl mb-8">
          Próximo: SB {nextLevel.sb.toLocaleString('es-AR')} / BB {nextLevel.bb.toLocaleString('es-AR')}
        </div>
      )}

      {/* Stats row */}
      <div className="flex gap-12 text-gray-300 text-2xl mb-8">
        {tournament && (
          <div>
            <span className="text-gray-500 text-xl">Jugadores: </span>
            <span className="font-bold">{tournament.jugadores_activos ?? 0}</span>
          </div>
        )}
        {totalPot > 0 && (
          <div>
            <span className="text-gray-500 text-xl">Pozo: </span>
            <span className="font-bold text-emerald-400">
              $ {(totalPot / 100).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
            </span>
          </div>
        )}
      </div>

      {/* Prizes strip */}
      {topPrizes.length > 0 && (
        <div className="flex gap-8 text-xl">
          <span className="text-gray-500">PREMIOS:</span>
          {topPrizes.map((p, i) => (
            <span key={p.posicion} className={i === 0 ? 'text-yellow-400 font-bold' : 'text-gray-300'}>
              {p.posicion}° ${(p.monto / 100).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

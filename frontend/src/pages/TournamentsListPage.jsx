import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

function StatusBadge({ estado }) {
  const map = {
    pendiente: 'bg-blue-700 text-blue-100',
    en_curso: 'bg-yellow-600 text-yellow-100',
    finalizado: 'bg-gray-600 text-gray-200',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[estado] ?? 'bg-gray-600 text-gray-200'}`}>
      {estado}
    </span>
  )
}

function NewTournamentModal({ onClose, onCreated }) {
  const [nombre, setNombre] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.post('/mtt/tournaments', { nombre, fecha })
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 rounded-xl p-6 shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold text-white mb-4">Nuevo torneo</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-gray-300 text-sm mb-1">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
              placeholder="Torneo mensual"
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white py-2 rounded-lg transition-colors">
              {loading ? 'Creando…' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function TournamentsListPage() {
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState(null)

  const fetchTournaments = async () => {
    try {
      const data = await api.get('/mtt/tournaments')
      setTournaments(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTournaments()
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-900/20 border border-red-700 text-red-400 rounded-lg px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">Torneos</h1>
          <button
            onClick={() => setShowNew(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Nuevo torneo
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400">Cargando torneos…</p>
        ) : tournaments.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-10 text-center text-gray-400">
            No hay torneos todavía. ¡Creá el primero!
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/tournaments/${t.id}`)}
                className="bg-gray-800 hover:bg-gray-700 rounded-xl p-5 shadow-lg text-left transition-colors group"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-white group-hover:text-emerald-300 transition-colors">
                    {t.nombre}
                  </h3>
                  <StatusBadge estado={t.estado} />
                </div>
                <p className="text-gray-400 text-sm">
                  {new Date(t.fecha).toLocaleDateString('es-AR')}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {showNew && (
        <NewTournamentModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); fetchTournaments() }}
        />
      )}
    </div>
  )
}

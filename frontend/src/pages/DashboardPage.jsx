import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import NotificationBell from '../components/NotificationBell'

function MyIdCard({ userId }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(userId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="mt-10 bg-gray-800 rounded-xl p-5 shadow-lg">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Mi ID de jugador</h2>
      <p className="text-gray-500 text-xs mb-3">
        Compartí este código con el host para que pueda vincular tu cuenta a un invitado que creó para vos.
      </p>
      <div className="flex items-center gap-3">
        <code className="flex-1 text-xs font-mono text-emerald-300 bg-gray-900 rounded-lg px-3 py-2 overflow-x-auto whitespace-nowrap">
          {userId}
        </code>
        <button
          onClick={copy}
          className="shrink-0 text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors"
        >
          {copied ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}

function NewGrupoModal({ onClose, onCreated }) {
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const grupo = await api.post('/grupos', { nombre })
      onClose()
      onCreated(grupo)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 rounded-xl p-6 shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold text-white mb-4">Nuevo grupo</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-gray-300 text-sm mb-1">Nombre del grupo</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              autoFocus
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
              placeholder="Amigos del trabajo"
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

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [grupos, setGrupos] = useState([])
  const [memberGrupos, setMemberGrupos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState(null)

  const fetchGrupos = async () => {
    try {
      const [data, memberData] = await Promise.all([
        api.get('/grupos'),
        api.get('/grupos/member').catch(() => []),
      ])
      setGrupos(data)
      setMemberGrupos(memberData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchGrupos() }, [])

  const handleDelete = async (e, grupoId) => {
    e.stopPropagation()
    if (deletingId !== grupoId) { setDeletingId(grupoId); return }
    const snap = grupos
    setGrupos((prev) => prev.filter((g) => g.id !== grupoId))
    setDeletingId(null)
    try {
      await api.delete(`/grupos/${grupoId}`)
    } catch (err) {
      setGrupos(snap)
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-900/20 border border-red-700 text-red-400 rounded-lg px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">Mis grupos</h1>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => setShowNew(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              + Nuevo grupo
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400">Cargando…</p>
        ) : grupos.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-10 text-center">
            <p className="text-gray-400 mb-2">No tenés grupos todavía.</p>
            <p className="text-gray-500 text-sm">Creá uno para empezar a registrar sesiones cash con tus amigos.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grupos.map((g) => {
              const confirming = deletingId === g.id
              return (
                <div key={g.id} className="relative bg-gray-800 rounded-xl shadow-lg hover:bg-gray-750 group">
                  <button
                    onClick={() => navigate(`/grupos/${g.id}`)}
                    className="w-full p-6 text-left"
                  >
                    <h3 className="font-bold text-lg text-white group-hover:text-emerald-300 transition-colors mb-3 pr-6">
                      {g.nombre}
                    </h3>
                    <div className="flex gap-4 text-sm text-gray-400">
                      <span>{g.total_miembros} {g.total_miembros === 1 ? 'miembro' : 'miembros'}</span>
                      <span>·</span>
                      <span>{g.total_partidas} {g.total_partidas === 1 ? 'sesión' : 'sesiones'}</span>
                    </div>
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, g.id)}
                    onBlur={() => setDeletingId(null)}
                    className={`absolute top-3 right-3 text-xs px-2 py-1 rounded-lg transition-colors ${
                      confirming ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-red-400 hover:bg-gray-700'
                    }`}
                  >
                    {confirming ? '¿Eliminar?' : '✕'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <MyIdCard userId={user?.id ?? ''} />

        {memberGrupos.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-bold text-white mb-4">Grupos en los que participo</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {memberGrupos.map((g) => (
                <button
                  key={g.id}
                  onClick={() => navigate(`/grupos/${g.id}`)}
                  className="bg-gray-800 rounded-xl shadow-lg p-6 text-left hover:bg-gray-750 transition-colors group"
                >
                  <h3 className="font-bold text-lg text-white group-hover:text-blue-300 transition-colors mb-3">{g.nombre}</h3>
                  <div className="flex gap-4 text-sm text-gray-400">
                    <span>{g.total_miembros} {g.total_miembros === 1 ? 'miembro' : 'miembros'}</span>
                    <span>·</span>
                    <span>{g.total_partidas} {g.total_partidas === 1 ? 'sesión' : 'sesiones'}</span>
                  </div>
                  <span className="inline-block mt-2 text-xs bg-blue-800/40 text-blue-300 px-2 py-0.5 rounded-full">miembro</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {showNew && (
        <NewGrupoModal
          onClose={() => setShowNew(false)}
          onCreated={(grupo) => setGrupos((prev) => [grupo, ...prev])}
        />
      )}
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

export default function InvitePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [info, setInfo] = useState(null)
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const autoJoined = useRef(false)

  useEffect(() => {
    api.get(`/invite/${token}`)
      .then(setInfo)
      .catch((err) => {
        if (err.message?.includes('no encontrado') || err.message?.includes('404')) {
          setNotFound(true)
        } else {
          setError(err.message)
        }
      })
      .finally(() => setLoadingInfo(false))
  }, [token])

  const handleJoin = async () => {
    setError(null)
    setJoining(true)
    try {
      await api.post(`/invite/${token}/join`, {})
      navigate(`/grupos/${info.grupo_id}`)
    } catch (err) {
      if (err.message?.includes('Ya sos miembro')) {
        navigate(`/grupos/${info.grupo_id}`)
      } else {
        setError(err.message)
        setJoining(false)
      }
    }
  }

  // Auto-join when user is logged in and invite info is loaded
  useEffect(() => {
    if (user && info && !autoJoined.current) {
      autoJoined.current = true
      handleJoin()
    }
  }, [user, info])

  if (authLoading || loadingInfo) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        Cargando…
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-4xl mb-4">🃏</p>
          <h1 className="text-xl font-bold text-white mb-2">Link inválido o expirado</h1>
          <p className="text-gray-400 text-sm mb-6">Este link de invitación ya no existe. Pedile al host que genere uno nuevo.</p>
          <Link to="/" className="text-emerald-400 hover:text-emerald-300 text-sm transition-colors">Ir al inicio</Link>
        </div>
      </div>
    )
  }

  if (error && !info) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center">
        <p className="text-5xl mb-4">🃏</p>
        <p className="text-gray-400 text-sm mb-1">Te invitaron al grupo</p>
        <h1 className="text-2xl font-bold text-white mb-6">{info?.grupo_nombre}</h1>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {user ? (
          <p className="text-gray-400 text-sm">{joining ? 'Uniéndote al grupo…' : 'Procesando…'}</p>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-400 text-sm">Para unirte necesitás una cuenta.</p>
            <Link
              to="/register"
              state={{ redirect: `/invite/${token}` }}
              className="block w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Registrarme
            </Link>
            <Link
              to="/login"
              state={{ redirect: `/invite/${token}` }}
              className="block w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Iniciar sesión
            </Link>
          </div>
        )}

        {user && (
          <Link to="/" className="block mt-4 text-gray-500 hover:text-gray-400 text-sm transition-colors">
            Cancelar
          </Link>
        )}
      </div>
    </div>
  )
}

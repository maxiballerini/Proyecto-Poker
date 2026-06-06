import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'

export default function RegisterPage() {
  const [nombre, setNombre] = useState('')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.post('/auth/register', { email, password, nombre, nickname: nickname.trim().toLowerCase() || undefined })
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError
      navigate(location.state?.redirect || '/')
    } catch (err) {
      setError(err.message || 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-gray-800 rounded-xl p-8 shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-bold text-emerald-400 text-center mb-2">
          Poker Nights
        </h1>
        <p className="text-gray-400 text-center mb-8 text-sm">Creá tu cuenta</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-1">
              Nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-emerald-500 placeholder-gray-500"
              placeholder="Tu nombre"
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-1">
              Nickname
              <span className="text-gray-500 font-normal ml-1 text-xs">(para que otros te encuentren)</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">@</span>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg pl-8 pr-4 py-2.5 focus:outline-none focus:border-emerald-500 placeholder-gray-500"
                placeholder="minombre"
                maxLength={30}
              />
            </div>
          </div>
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-emerald-500 placeholder-gray-500"
              placeholder="tu@email.com"
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-emerald-500 placeholder-gray-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-700 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? 'Registrando…' : 'Registrarse'}
          </button>
        </form>

        <p className="text-gray-400 text-sm text-center mt-6">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300 transition-colors">
            Ingresá
          </Link>
        </p>
      </div>
    </div>
  )
}

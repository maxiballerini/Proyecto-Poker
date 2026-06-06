import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

export default function SettingsModal({ onClose }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [nombre, setNombre] = useState('')
  const [nickname, setNickname] = useState('')
  const [alias, setAlias] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get('/auth/me')
      .then((p) => {
        setNombre(p.nombre || '')
        setNickname(p.nickname || '')
        setAlias(p.alias_pago || '')
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await api.put('/auth/me', {
        nombre: nombre.trim() || undefined,
        nickname: nickname.trim().toLowerCase() || undefined,
        alias_pago: alias.trim() || undefined,
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-end z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mt-14">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-lg font-bold text-white">Configuración</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-4">
          {loading ? (
            <p className="text-gray-400 text-sm">Cargando…</p>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">Nombre</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="Tu nombre"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">
                  Nickname
                  <span className="text-gray-500 font-normal ml-1 text-xs">(otros te buscan por esto)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    placeholder="minombre"
                    maxLength={30}
                  />
                </div>
                <p className="text-gray-500 text-xs mt-1">Solo letras, números y _</p>
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">
                  Alias de pago
                  <span className="text-gray-500 font-normal ml-1 text-xs">(Mercado Pago, CVU, etc.)</span>
                </label>
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="alias.mercadopago"
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}
              {success && <p className="text-emerald-400 text-sm">Guardado ✓</p>}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-semibold py-2 rounded-lg transition-colors text-sm"
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </form>
          )}
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={handleSignOut}
            className="w-full bg-red-900/40 hover:bg-red-800/60 border border-red-700/50 text-red-400 hover:text-red-300 font-medium py-2 rounded-lg transition-colors text-sm"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

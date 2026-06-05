import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const linkClass = ({ isActive }) =>
    `text-sm transition-colors ${isActive ? 'text-emerald-400 font-semibold' : 'text-gray-300 hover:text-white'}`

  return (
    <nav className="bg-gray-900 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <NavLink to="/" className="text-emerald-400 font-bold text-xl tracking-tight">
          Poker Nights
        </NavLink>
        {user && (
          <div className="flex items-center gap-4">
            <NavLink to="/" end className={linkClass}>
              Sesiones Cash
            </NavLink>
            <NavLink to="/torneos" className={linkClass}>
              Torneos
            </NavLink>
          </div>
        )}
      </div>
      {user && (
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm hidden sm:block">{user.email}</span>
          <button
            onClick={handleSignOut}
            className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </nav>
  )
}

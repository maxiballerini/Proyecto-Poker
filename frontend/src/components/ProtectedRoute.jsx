import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        Cargando…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

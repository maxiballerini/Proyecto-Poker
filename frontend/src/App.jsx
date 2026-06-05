import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Navbar from './components/Navbar'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import TournamentsListPage from './pages/TournamentsListPage'
import GrupoPage from './pages/GrupoPage'
import SessionPage from './pages/SessionPage'
import TournamentPage from './pages/TournamentPage'
import ClockTVPage from './pages/ClockTVPage'
import InvitePage from './pages/InvitePage'
import ProtectedRoute from './components/ProtectedRoute'

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        Cargando…
      </div>
    )
  }
  return (
    <Routes>
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" />} />
      <Route path="/register" element={!user ? <RegisterPage /> : <Navigate to="/" />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <>
              <Navbar />
              <DashboardPage />
            </>
          </ProtectedRoute>
        }
      />
      <Route
        path="/grupos/:id"
        element={
          <ProtectedRoute>
            <>
              <Navbar />
              <GrupoPage />
            </>
          </ProtectedRoute>
        }
      />
      <Route
        path="/torneos"
        element={
          <ProtectedRoute>
            <>
              <Navbar />
              <TournamentsListPage />
            </>
          </ProtectedRoute>
        }
      />
      <Route
        path="/sessions/:id"
        element={
          <ProtectedRoute>
            <>
              <Navbar />
              <SessionPage />
            </>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tournaments/:id"
        element={
          <ProtectedRoute>
            <>
              <Navbar />
              <TournamentPage />
            </>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tournaments/:id/tv"
        element={
          <ProtectedRoute>
            <ClockTVPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}

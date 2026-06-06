import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const fetchNotifications = async () => {
    try {
      const data = await api.get('/notifications')
      setNotifications(data)
    } catch {
      // silently fail
    }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const unread = notifications.filter((n) => !n.read).length

  const markAllRead = async () => {
    await api.post('/notifications/read-all', {})
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`, {})
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors"
        title="Notificaciones"
      >
        <span className="text-xl">🔔</span>
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-80 max-w-[calc(100vw-16px)] bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <span className="text-white font-semibold text-sm">Notificaciones</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                Marcar todo como leído
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">Sin notificaciones</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  className={`px-4 py-3 border-b border-gray-700/50 last:border-0 cursor-pointer transition-colors ${n.read ? 'opacity-60' : 'bg-emerald-900/10 hover:bg-emerald-900/20'}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg shrink-0">💰</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm leading-snug">{n.message}</p>
                      <p className="text-gray-500 text-xs mt-1">
                        {new Date(n.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1.5" />}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

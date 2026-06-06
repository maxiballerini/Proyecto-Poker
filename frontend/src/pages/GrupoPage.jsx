import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import AmountDisplay from '../components/AmountDisplay'
import NotificationBell from '../components/NotificationBell'

function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-2xl w-full max-w-sm mx-4">
        <h3 className="text-white font-semibold text-base mb-2">{title}</h3>
        <p className="text-gray-300 text-sm mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm px-4 py-2 rounded-lg transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="bg-red-600 hover:bg-red-500 text-white text-sm px-4 py-2 rounded-lg transition-colors">Eliminar</button>
        </div>
      </div>
    </div>
  )
}

function Toast({ msg }) {
  if (!msg) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-700 text-white text-sm px-5 py-3 rounded-xl shadow-xl z-50">
      {msg}
    </div>
  )
}

function StatusBadge({ estado }) {
  const map = { abierta: 'bg-emerald-700 text-emerald-100', cerrada: 'bg-gray-600 text-gray-200' }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[estado] ?? 'bg-gray-600 text-gray-200'}`}>
      {estado}
    </span>
  )
}

function LinkGuestModal({ guest, onClose, onLinked }) {
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isEmail = (v) => v.includes('@')

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const val = identifier.trim()
    const body = isEmail(val) ? { email: val } : { nickname: val }
    try {
      const player = await api.post(`/guests/${guest.id}/link`, body)
      onLinked(guest.id, player)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 rounded-xl p-6 shadow-xl w-full max-w-md">
        <h2 className="text-lg font-bold text-white mb-1">Vincular cuenta a {guest.nombre}</h2>
        <p className="text-gray-400 text-sm mb-4">
          Ingresá el nickname (@nombre) o el email del usuario registrado.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            placeholder="nickname o email"
            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white py-2 rounded-lg text-sm transition-colors">
              {loading ? 'Vinculando…' : 'Vincular'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddMemberForm({ grupoId, onAddMember, onError }) {
  const [tab, setTab] = useState('guest')
  const [nombre, setNombre] = useState('')
  const [alias, setAlias] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(false)

  const isEmail = (v) => v.includes('@')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      let member
      if (tab === 'guest') {
        member = await api.post(`/grupos/${grupoId}/guests`, { nombre: nombre.trim(), alias_pago: alias.trim() || null })
        setNombre(''); setAlias('')
      } else {
        const val = identifier.trim()
        const body = isEmail(val) ? { email: val } : { nickname: val }
        member = await api.post(`/grupos/${grupoId}/members`, body)
        setIdentifier('')
      }
      onAddMember(member)
    } catch (err) {
      onError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4">
      <div className="flex gap-2 mb-3">
        <button type="button" onClick={() => setTab('guest')}
          className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${tab === 'guest' ? 'bg-emerald-700 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}>
          + Invitado
        </button>
        <button type="button" onClick={() => setTab('registered')}
          className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${tab === 'registered' ? 'bg-blue-700 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}>
          + Registrado
        </button>
      </div>
      <form onSubmit={submit} className="flex gap-2 flex-wrap">
        {tab === 'guest' ? (
          <>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Nombre"
              className="flex-1 min-w-28 bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
            <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Alias de pago (opcional)"
              className="flex-1 min-w-28 bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
          </>
        ) : (
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required
            placeholder="Nickname o email"
            className="flex-1 bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
        )}
        <button type="submit" disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-3 py-2 rounded-lg transition-colors">
          {loading ? '…' : 'Agregar'}
        </button>
      </form>
    </div>
  )
}

function NewSesionModal({ grupoId, members, onClose, onCreated }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [nombre, setNombre] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set(members.map((m) => m.id)))
  const [initialBuyin, setInitialBuyin] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const allSelected = members.length > 0 && members.every((m) => selectedIds.has(m.id))

  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(members.map((m) => m.id)))

  const toggle = (id) => setSelectedIds((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const partida = await api.post(`/grupos/${grupoId}/partidas`, { fecha, nombre: nombre || null })
      const sessionId = partida.id

      if (selectedIds.size > 0) {
        await Promise.all(
          [...selectedIds].map((pid) =>
            api.post(`/cash/sessions/${sessionId}/add-member`, { player_id: pid }).catch(() => {})
          )
        )
        const buyinCentavos = Math.round(parseFloat((initialBuyin || '0').replace(',', '.')) * 100)
        if (buyinCentavos > 0) {
          await Promise.all(
            [...selectedIds].map((pid) =>
              api.post(`/cash/sessions/${sessionId}/buyins`, { player_id: pid, monto: buyinCentavos }).catch(() => {})
            )
          )
        }
      }

      onCreated(sessionId)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 rounded-xl p-6 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-4">Nueva sesión cash</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-gray-300 text-sm mb-1">Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required
                className="w-full h-10 bg-gray-700 border border-gray-600 text-white rounded-lg px-3 focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-gray-300 text-sm mb-1">Nombre (opcional)</label>
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
                className="w-full h-10 bg-gray-700 border border-gray-600 text-white rounded-lg px-3 focus:outline-none focus:border-emerald-500"
                placeholder="ej. Viernes" />
            </div>
          </div>

          {members.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-gray-300 text-sm">Jugadores</label>
                <button type="button" onClick={toggleAll}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                  {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              </div>
              <div className="space-y-1">
                {members.map((m) => (
                  <label key={m.id} className="flex items-center gap-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg px-3 py-2 cursor-pointer transition-colors">
                    <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggle(m.id)}
                      className="accent-emerald-500 w-4 h-4 shrink-0" />
                    <span className="text-white text-sm">{m.nombre}</span>
                    {m.is_guest && <span className="text-xs bg-amber-800/60 text-amber-300 px-1.5 py-0.5 rounded-full">invitado</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          {selectedIds.size > 0 && (
            <div>
              <label className="block text-gray-300 text-sm mb-1">Buy-in inicial (opcional)</label>
              <input type="number" min="0" step="0.01" value={initialBuyin}
                onChange={(e) => setInitialBuyin(e.target.value)}
                placeholder="0.00"
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
              <p className="text-gray-500 text-xs mt-1">Se registra un buy-in de este monto para cada jugador seleccionado</p>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white py-2 rounded-lg">
              {loading ? 'Creando…' : 'Crear sesión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function GrupoPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [detail, setDetail] = useState(null)
  const [ranking, setRanking] = useState([])
  const [mySettlements, setMySettlements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showNewSesion, setShowNewSesion] = useState(false)
  const [confirmRemoveMember, setConfirmRemoveMember] = useState(null)
  const [confirmDeleteSession, setConfirmDeleteSession] = useState(null)
  const [linkGuestTarget, setLinkGuestTarget] = useState(null)
  const [inviteUrl, setInviteUrl] = useState(null)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 4000) }

  const fetchDetail = async () => {
    try {
      const [data, rank, settlements] = await Promise.all([
        api.get(`/grupos/${id}`),
        api.get(`/grupos/${id}/ranking`).catch(() => []),
        api.get(`/grupos/${id}/my-settlements`).catch(() => []),
      ])
      setDetail(data)
      setRanking(rank)
      setMySettlements(settlements)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDetail() }, [id, location.key])

  const handleRemoveMember = async (playerId) => {
    const snap = detail.miembros
    setDetail((prev) => ({ ...prev, miembros: prev.miembros.filter((m) => m.id !== playerId) }))
    try {
      await api.delete(`/grupos/${id}/members/${playerId}`)
    } catch (err) {
      setDetail((prev) => ({ ...prev, miembros: snap }))
      showToast(err.message)
    }
  }

  const handleAddMember = (member) => {
    setDetail((prev) => ({ ...prev, miembros: [...prev.miembros, member] }))
  }

  const handleLinkGuest = (guestId, realPlayer) => {
    setDetail((prev) => ({
      ...prev,
      miembros: prev.miembros.map((m) => m.id === guestId ? realPlayer : m),
    }))
    setLinkGuestTarget(null)
  }

  const handleGenerateInvite = async () => {
    try {
      const info = await api.post(`/grupos/${id}/invite`, {})
      setInviteUrl(`${window.location.origin}/invite/${info.token}`)
    } catch (err) {
      showToast(err.message)
    }
  }

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteUrl)
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
  }

  const handleRevokeInvite = async () => {
    try {
      await api.delete(`/grupos/${id}/invite`)
      setInviteUrl(null)
    } catch (err) {
      showToast(err.message)
    }
  }

  const handleDeleteSession = async (sessionId) => {
    const snap = detail.partidas
    setDetail((prev) => ({ ...prev, partidas: prev.partidas.filter((p) => p.id !== sessionId) }))
    try {
      await api.delete(`/cash/sessions/${sessionId}`)
    } catch (err) {
      setDetail((prev) => ({ ...prev, partidas: snap }))
      showToast(err.message)
    }
  }

  const handleMarkPaid = async (settlementId) => {
    const snap = mySettlements
    setMySettlements((prev) => prev.map((s) => s.id === settlementId ? { ...s, estado: 'pagado' } : s))
    try {
      await api.patch(`/cash/settlements/${settlementId}/pay`, {})
    } catch (err) {
      setMySettlements(snap)
      showToast(err.message)
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Cargando…</div>
  if (error) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-red-400">{error}</div>
  if (!detail) return null

  const { grupo, miembros, partidas } = detail
  const isHost = user?.id === grupo.host_id

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Toast msg={toast} />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white text-sm mb-4 transition-colors">
          ← Volver
        </button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">{grupo.nombre}</h1>
          <div className="flex items-center gap-2">
            <button onClick={fetchDetail} className="text-gray-400 hover:text-white p-2 rounded-lg transition-colors" title="Actualizar">
              ↻
            </button>
            <NotificationBell />
            {isHost && (
              <button
                onClick={() => setShowNewSesion(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                + Nueva sesión cash
              </button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Members */}
          <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
            <h2 className="text-lg font-bold text-white mb-3">
              Miembros <span className="text-gray-500 font-normal text-sm">({miembros.length})</span>
            </h2>
            {miembros.length === 0 ? (
              <p className="text-gray-400 text-sm">Sin miembros todavía.</p>
            ) : (
              <ul className="space-y-2 mb-2">
                {miembros.map((m) => {
                  const isGroupHost = m.id === grupo.host_id
                  return (
                    <li key={m.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-200">{m.nombre}</span>
                        {isGroupHost && <span className="text-xs bg-emerald-900/60 text-emerald-400 px-2 py-0.5 rounded-full">host</span>}
                        {m.is_guest && <span className="text-xs bg-amber-800/60 text-amber-300 px-2 py-0.5 rounded-full">invitado</span>}
                        {m.alias_pago && <span className="text-xs text-gray-500">{m.alias_pago}</span>}
                      </div>
                      {isHost && !isGroupHost && (
                        <div className="flex items-center gap-1">
                          {m.is_guest && (
                            <button
                              onClick={() => setLinkGuestTarget(m)}
                              title="Vincular a cuenta registrada"
                              className="text-gray-500 hover:text-blue-400 text-xs transition-colors px-1">
                              🔗
                            </button>
                          )}
                          <button onClick={() => setConfirmRemoveMember(m)}
                            className="text-gray-600 hover:text-red-400 text-xs transition-colors px-1">✕</button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {isHost && <AddMemberForm grupoId={id} onAddMember={handleAddMember} onError={showToast} />}

            {isHost && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                {inviteUrl ? (
                  <div>
                    <p className="text-gray-400 text-xs mb-2">Link de invitación activo:</p>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={inviteUrl}
                        className="flex-1 min-w-0 bg-gray-900 border border-gray-600 text-emerald-300 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none"
                      />
                      <button onClick={handleCopyInvite}
                        className="shrink-0 text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition-colors">
                        {inviteCopied ? '✓' : 'Copiar'}
                      </button>
                      <button onClick={handleRevokeInvite}
                        className="shrink-0 text-xs text-gray-600 hover:text-red-400 px-2 transition-colors" title="Revocar link">
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={handleGenerateInvite}
                    className="text-xs text-gray-400 hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                    <span>🔗</span> Generar link de invitación
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sesiones */}
          <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
            <h2 className="text-lg font-bold text-white mb-3">
              Sesiones cash <span className="text-gray-500 font-normal text-sm">({partidas.length})</span>
            </h2>
            {partidas.length === 0 ? (
              <p className="text-gray-400 text-sm">Sin sesiones todavía.</p>
            ) : (
              <ul className="space-y-2">
                {partidas.map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/sessions/${p.id}`)}
                      className="flex-1 flex items-center justify-between bg-gray-700/50 hover:bg-gray-700 rounded-lg px-4 py-3 transition-colors text-left"
                    >
                      <div>
                        <p className="text-white text-sm font-medium">{p.nombre}</p>
                        <p className="text-gray-400 text-xs mt-0.5">
                          {new Date(p.fecha).toLocaleDateString('es-AR')}
                          {p.lugar && ` · ${p.lugar}`}
                        </p>
                      </div>
                      <StatusBadge estado={p.estado} />
                    </button>
                    {isHost && (
                      <button
                        onClick={() => setConfirmDeleteSession(p)}
                        className="text-gray-600 hover:text-red-400 transition-colors px-1 py-3 shrink-0"
                        title="Eliminar sesión"
                      >
                        🗑
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {mySettlements.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-6 shadow-lg mt-6">
            <h2 className="text-lg font-bold text-white mb-4">Mis saldos</h2>
            <div className="space-y-2">
              {mySettlements.map((s) => (
                <div key={s.id} className={`flex items-center gap-3 rounded-xl px-4 py-3 ${s.estado === 'pagado' ? 'bg-gray-700/30 opacity-60' : s.role === 'deudor' ? 'bg-red-900/20 border border-red-800/30' : 'bg-emerald-900/20 border border-emerald-800/30'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">
                      {s.role === 'deudor' ? (
                        <>Le debés a <span className="text-red-300">{s.other_nombre}</span></>
                      ) : (
                        <><span className="text-emerald-300">{s.other_nombre}</span> te debe</>
                      )}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">{s.session_nombre}{s.other_alias && s.role === 'deudor' ? ` · ${s.other_alias}` : ''}</p>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${s.role === 'deudor' ? 'text-red-400' : 'text-emerald-400'}`}>
                    {s.role === 'deudor' ? '-' : '+'}<AmountDisplay centavos={s.monto} />
                  </span>
                  {s.estado === 'pagado' ? (
                    <span className="text-xs text-gray-500 shrink-0">✓ pagado</span>
                  ) : s.role === 'deudor' ? (
                    <button
                      onClick={() => handleMarkPaid(s.id)}
                      className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg transition-colors shrink-0"
                    >
                      Marcar pagado
                    </button>
                  ) : (
                    <span className="text-xs text-yellow-500 shrink-0">pendiente</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-gray-800 rounded-xl p-6 shadow-lg mt-6">
          <h2 className="text-lg font-bold text-white mb-6">Ranking</h2>
          {ranking.length === 0 ? (
            <p className="text-gray-500 text-sm">Sin partidas cerradas todavía. El ranking aparecerá cuando se cierre la primera sesión.</p>
          ) : (
            <>
              {/* Podio top 3 */}
              <div className="flex items-end justify-center gap-2 mb-6">
                {[1, 0, 2].map((ri, di) => {
                  const p = ranking[ri]
                  const medals = ['🥈', '🥇', '🥉']
                  const labels = ['2°', '1°', '3°']
                  const blockH = ['h-16', 'h-24', 'h-12']
                  const cardBg = [
                    'bg-gray-600/40 border-gray-500/40',
                    'bg-yellow-500/10 border-yellow-400/40',
                    'bg-amber-800/30 border-amber-700/40',
                  ]
                  const blockBg = ['bg-gray-600/40', 'bg-yellow-500/20', 'bg-amber-700/30']
                  const labelColor = ['text-gray-400', 'text-yellow-400', 'text-amber-600']
                  if (!p) return <div key={di} className="w-28" />
                  return (
                    <div key={p.player_id} className="flex flex-col items-center">
                      <div className={`w-28 border rounded-xl px-2 py-3 flex flex-col items-center mb-2 ${cardBg[di]}`}>
                        <span className="text-2xl mb-1">{medals[di]}</span>
                        <span className="text-white font-semibold text-sm text-center leading-tight w-full truncate px-1">{p.nombre}</span>
                        <span className={`text-xs font-bold mt-1.5 ${p.neto > 0 ? 'text-emerald-400' : p.neto < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                          {p.neto > 0 ? '+' : ''}<AmountDisplay centavos={p.neto} />
                        </span>
                        <span className="text-gray-500 text-xs mt-0.5">{p.sesiones} {p.sesiones === 1 ? 'sesión' : 'sesiones'}</span>
                      </div>
                      <div className={`w-28 ${blockH[di]} ${blockBg[di]} rounded-t-lg flex items-start justify-center pt-2`}>
                        <span className={`text-xl font-black opacity-60 ${labelColor[di]}`}>{labels[di]}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Posiciones 4+ */}
              {ranking.length > 3 && (
                <div className="space-y-1.5 mt-2">
                  <div className="border-t border-gray-700 mb-3" />
                  {ranking.slice(3).map((r, i) => (
                    <div key={r.player_id} className="flex items-center gap-3 rounded-lg px-3 py-2 bg-gray-700/30">
                      <span className="text-gray-500 text-xs w-5 text-right shrink-0">{i + 4}</span>
                      <span className="text-gray-200 text-sm flex-1">{r.nombre}</span>
                      <span className="text-gray-500 text-xs shrink-0">{r.sesiones} {r.sesiones === 1 ? 'sesión' : 'sesiones'}</span>
                      <span className={`text-sm font-semibold shrink-0 ${r.neto > 0 ? 'text-emerald-400' : r.neto < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {r.neto > 0 ? '+' : ''}<AmountDisplay centavos={r.neto} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {ranking.length > 0 && (() => {
          const byAvg = [...ranking].sort((a, b) => (b.neto / b.sesiones) - (a.neto / a.sesiones))
          const bySesiones = [...ranking].sort((a, b) => b.sesiones - a.sesiones)
          const byBuyin = [...ranking].sort((a, b) => b.total_buyin - a.total_buyin)
          const byMejorSesion = [...ranking].sort((a, b) => (b.mejor_sesion ?? -Infinity) - (a.mejor_sesion ?? -Infinity))
          const winner = ranking[0]
          const ms = byMejorSesion[0]?.mejor_sesion
          const stats = [
            { emoji: '🏆', label: 'Mayor ganancia', name: winner?.nombre, sub: <span className="text-emerald-400 font-bold">+<AmountDisplay centavos={winner?.neto} /></span> },
            { emoji: '⚡', label: 'Mejor sesión única', name: byMejorSesion[0]?.nombre, sub: ms != null ? <span className={ms > 0 ? 'text-emerald-400 font-bold' : 'text-gray-400'}>{ms > 0 ? '+' : ''}<AmountDisplay centavos={ms} /></span> : <span className="text-gray-500">sin datos</span> },
            { emoji: '📈', label: 'Mejor promedio', name: byAvg[0]?.nombre, sub: <><span className={byAvg[0]?.neto/byAvg[0]?.sesiones >= 0 ? 'text-emerald-400' : 'text-red-400'}>{byAvg[0]?.neto/byAvg[0]?.sesiones > 0 ? '+' : ''}<AmountDisplay centavos={Math.round(byAvg[0]?.neto / byAvg[0]?.sesiones)} /></span><span className="text-gray-500 text-xs ml-1">/ sesión</span></> },
            { emoji: '🎯', label: 'Más activo', name: bySesiones[0]?.nombre, sub: <span className="text-blue-400 font-bold">{bySesiones[0]?.sesiones} {bySesiones[0]?.sesiones === 1 ? 'sesión' : 'sesiones'}</span> },
            { emoji: '💸', label: 'Mayor inversor', name: byBuyin[0]?.nombre, sub: <span className="text-purple-400 font-bold"><AmountDisplay centavos={byBuyin[0]?.total_buyin} /></span> },
            { emoji: '🤑', label: 'Mayor cobrador', name: [...ranking].sort((a,b) => b.total_cashout - a.total_cashout)[0]?.nombre, sub: <span className="text-yellow-400 font-bold"><AmountDisplay centavos={[...ranking].sort((a,b) => b.total_cashout - a.total_cashout)[0]?.total_cashout} /></span> },
          ]
          return (
            <div className="mt-4 bg-gray-800 rounded-xl p-6 shadow-lg">
              <h2 className="text-lg font-bold text-white mb-4">Estadísticas</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {stats.map((s, i) => (
                  <div key={i} className="bg-gray-700/50 rounded-xl p-4 flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide">
                      <span>{s.emoji}</span>
                      <span>{s.label}</span>
                    </div>
                    <p className="text-white font-semibold text-sm truncate">{s.name}</p>
                    <p className="text-sm">{s.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </div>

      {confirmRemoveMember && (
        <ConfirmModal
          title="¿Quitar miembro?"
          message={`¿Querés quitar a ${confirmRemoveMember.nombre} del grupo?`}
          onConfirm={() => { handleRemoveMember(confirmRemoveMember.id); setConfirmRemoveMember(null) }}
          onCancel={() => setConfirmRemoveMember(null)}
        />
      )}
      {confirmDeleteSession && (
        <ConfirmModal
          title="¿Eliminar sesión?"
          message={
            confirmDeleteSession.estado === 'cerrada'
              ? `¿Querés eliminar "${confirmDeleteSession.nombre}"? Si hay saldos pendientes también se borrarán. Esta acción no se puede deshacer.`
              : `¿Querés eliminar "${confirmDeleteSession.nombre}"? Se borrarán todos los buy-ins y cashouts.`
          }
          onConfirm={() => { handleDeleteSession(confirmDeleteSession.id); setConfirmDeleteSession(null) }}
          onCancel={() => setConfirmDeleteSession(null)}
        />
      )}
      {showNewSesion && (
        <NewSesionModal
          grupoId={id}
          members={miembros}
          onClose={() => setShowNewSesion(false)}
          onCreated={(sessionId) => { setShowNewSesion(false); navigate(`/sessions/${sessionId}`) }}
        />
      )}
      {linkGuestTarget && (
        <LinkGuestModal
          guest={linkGuestTarget}
          onClose={() => setLinkGuestTarget(null)}
          onLinked={handleLinkGuest}
        />
      )}
    </div>
  )
}

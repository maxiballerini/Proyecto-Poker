import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import AmountDisplay from '../components/AmountDisplay'

function Toast({ msg }) {
  if (!msg) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-700 text-white text-sm px-5 py-3 rounded-xl shadow-xl z-50">
      {msg}
    </div>
  )
}

function CashoutModal({ player, existingMonto, onConfirm, onCancel }) {
  const [input, setInput] = useState(existingMonto != null ? String(existingMonto / 100) : '')
  const handleSubmit = (e) => {
    e.preventDefault()
    const centavos = Math.round(parseFloat(input.replace(',', '.')) * 100)
    if (isNaN(centavos) || centavos < 0) return
    onConfirm(centavos)
  }
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-2xl w-full max-w-sm mx-4">
        <h3 className="text-white font-semibold text-base mb-1">Cashout — {player.nombre}</h3>
        <p className="text-gray-400 text-xs mb-4">Ingresá el total de fichas con las que se va</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="number" min="0" step="0.01" autoFocus
            value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="0.00"
            className="w-full bg-gray-700 border border-gray-600 text-white text-xl text-right rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500"
          />
          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 rounded-lg text-sm transition-colors">Cancelar</button>
            <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-sm transition-colors">Guardar cashout</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ConfirmModal({ title, message, confirmLabel = 'Eliminar', onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-2xl w-full max-w-sm mx-4">
        <h3 className="text-white font-semibold text-base mb-2">{title}</h3>
        <p className="text-gray-300 text-sm mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm px-4 py-2 rounded-lg transition-colors">Cancelar</button>
          <button onClick={onConfirm} disabled={loading} className="bg-red-600 hover:bg-red-500 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
            {loading ? 'Eliminando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function PendingCashoutsModal({ players, buyins, onConfirm, onCancel, loading }) {
  const [inputs, setInputs] = useState({})

  const handleSubmit = (e) => {
    e.preventDefault()
    const cashouts = players.map((p) => ({
      player_id: p.id,
      monto: Math.round(parseFloat((inputs[p.id] ?? '').replace(',', '.')) * 100),
    }))
    if (cashouts.some((c) => isNaN(c.monto) || c.monto < 0)) return
    onConfirm(cashouts)
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-2xl w-full max-w-md mx-4">
        <h3 className="text-white font-semibold text-base mb-1">Cashouts pendientes</h3>
        <p className="text-gray-400 text-xs mb-5">
          {players.length === 1
            ? 'Este jugador todavía no registró su cashout'
            : 'Estos jugadores todavía no registraron su cashout'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          {players.map((p) => {
            const total = buyins.filter((b) => b.player_id === p.id).reduce((s, b) => s + b.monto, 0)
            return (
              <div key={p.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{p.nombre}</p>
                  <p className="text-gray-500 text-xs">Puesto: <AmountDisplay centavos={total} /></p>
                </div>
                <input
                  type="number" min="0" step="0.01" required autoFocus={players.indexOf(p) === 0}
                  value={inputs[p.id] ?? ''}
                  onChange={(e) => setInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  placeholder="0.00"
                  className="w-32 bg-gray-700 border border-gray-600 text-white text-right rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            )
          })}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 rounded-lg text-sm transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
              {loading ? 'Terminando…' : 'Terminar sesión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ResumenTable({ sessionId, players, buyins, cashouts, onRemovePlayer, onDeleteBuyin, onAddBuyin, onReplaceBuyin, onUpdateCashout, onRemoveCashout, onError }) {
  const [buyinInputs, setBuyinInputs] = useState({})
  const [buyinError, setBuyinError] = useState({})
  const [expandedId, setExpandedId] = useState(null)
  const [cashoutModal, setCashoutModal] = useState(null)
  const [confirmDeleteBuyin, setConfirmDeleteBuyin] = useState(null)
  const [removingBuyin, setRemovingBuyin] = useState(null)
  const [removingCashout, setRemovingCashout] = useState(null)

  const cashedOutIds = new Set(cashouts.map((c) => c.player_id))
  const activePlayers = players.filter((p) => !cashedOutIds.has(p.id))
  const cashedOutPlayers = players.filter((p) => cashedOutIds.has(p.id))

  const saveBuyin = async (playerId) => {
    const raw = buyinInputs[playerId] ?? ''
    if (raw === '') return
    const centavos = Math.round(parseFloat(raw.replace(',', '.')) * 100)
    if (isNaN(centavos) || centavos <= 0) return
    const tempId = `__temp__${Date.now()}`
    onAddBuyin({ id: tempId, session_id: sessionId, player_id: playerId, monto: centavos, created_at: new Date().toISOString() })
    setBuyinInputs((prev) => ({ ...prev, [playerId]: '' }))
    setBuyinError((prev) => ({ ...prev, [playerId]: false }))
    try {
      const buyin = await api.post(`/cash/sessions/${sessionId}/buyins`, { player_id: playerId, monto: centavos })
      onReplaceBuyin(tempId, buyin)
    } catch {
      onDeleteBuyin(tempId)
      setBuyinInputs((prev) => ({ ...prev, [playerId]: String(centavos / 100) }))
      setBuyinError((prev) => ({ ...prev, [playerId]: true }))
    }
  }

  const handleCashout = async (centavos) => {
    const { id: playerId } = cashoutModal
    const prevCashout = cashouts.find((c) => c.player_id === playerId)
    const tempCashout = { id: `__temp__${Date.now()}`, session_id: sessionId, player_id: playerId, monto: centavos, created_at: new Date().toISOString() }
    onUpdateCashout(tempCashout)
    setCashoutModal(null)
    try {
      const cashout = await api.post(`/cash/sessions/${sessionId}/cashouts`, { player_id: playerId, monto: centavos })
      onUpdateCashout(cashout)
    } catch (err) {
      prevCashout ? onUpdateCashout(prevCashout) : onRemoveCashout(playerId)
      onError(err.message)
    }
  }

  const handleDeleteCashout = async (playerId) => {
    const snap = cashouts.find((c) => c.player_id === playerId)
    onRemoveCashout(playerId)
    setRemovingCashout(playerId)
    try {
      await api.delete(`/cash/sessions/${sessionId}/cashouts/${playerId}`)
    } catch (err) {
      if (snap) onUpdateCashout(snap)
      onError(err.message)
    } finally {
      setRemovingCashout(null)
    }
  }

  const handleDeleteBuyin = async (buyinId) => {
    const snapBuyins = buyins
    onDeleteBuyin(buyinId)
    setRemovingBuyin(buyinId)
    try {
      await api.delete(`/cash/buyins/${buyinId}`)
    } catch (err) {
      onDeleteBuyin('__restore__', snapBuyins)
      onError(err.message)
    } finally {
      setRemovingBuyin(null)
    }
  }

  const inputClass = "w-28 bg-gray-700 border border-gray-600 text-white text-right rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-emerald-500"

  const renderBuyinDetail = (pBuyins) => (
    <tr className="bg-gray-700/30">
      <td colSpan={5} className="px-4 py-3">
        {pBuyins.length === 0 ? <p className="text-gray-500 text-xs">Sin buy-ins registrados.</p> : (
          <ul className="space-y-1">
            {pBuyins.map((b) => (
              <li key={b.id} className="flex items-center gap-3 text-xs text-gray-300">
                <span className="text-gray-500 w-12 shrink-0">
                  {b.id.startsWith('__temp__') ? 'ahora' : new Date(b.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-white font-medium w-20 text-right shrink-0"><AmountDisplay centavos={b.monto} /></span>
                <span className="flex-1" />
                {!b.id.startsWith('__temp__') && (
                  <button onClick={() => setConfirmDeleteBuyin(b.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-base leading-none">
                    🗑
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  )

  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-lg mb-4">
      <h2 className="text-lg font-bold text-white mb-3">Resumen</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2">Jugador</th>
              <th className="text-right py-2">Entradas</th>
              <th className="text-right py-2">Total puesto</th>
              <th className="text-right py-2 w-36">Buy-in ($)</th>
              <th className="w-32" />
            </tr>
          </thead>
          <tbody>
            {activePlayers.map((p) => {
              const pBuyins = buyins.filter((b) => b.player_id === p.id)
              const total = pBuyins.reduce((s, b) => s + b.monto, 0)
              const isExpanded = expandedId === p.id
              return (
                <React.Fragment key={p.id}>
                  <tr className="border-b border-gray-700/50">
                    <td className="py-2">
                      <button onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        className="flex items-center gap-1.5 text-gray-200 hover:text-white transition-colors">
                        <span className="text-gray-500 text-xs">{isExpanded ? 'v' : '>'}</span>
                        {p.nombre}
                      </button>
                    </td>
                    <td className="py-2 text-right text-gray-400 text-xs cursor-pointer select-none" onClick={() => setExpandedId(isExpanded ? null : p.id)}>{pBuyins.length}×</td>
                    <td className="py-2 text-right text-white font-medium cursor-pointer select-none" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                      {total > 0 ? <AmountDisplay centavos={total} /> : <span className="text-gray-500">—</span>}
                    </td>
                    <td className="py-2 pl-3">
                      <div className="flex items-center justify-end gap-1">
                        {buyinError[p.id] && <span className="text-red-400 text-xs">!</span>}
                        <input type="number" min="0" step="0.01"
                          value={buyinInputs[p.id] ?? ''}
                          onChange={(e) => setBuyinInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          onBlur={() => saveBuyin(p.id)}
                          onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                          placeholder="0" className={inputClass} />
                      </div>
                    </td>
                    <td className="py-2 pl-2">
                      <button onClick={() => setCashoutModal(p)}
                        className="w-full bg-blue-700 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                        Cashout
                      </button>
                    </td>
                  </tr>
                  {isExpanded && renderBuyinDetail(pBuyins)}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {cashedOutPlayers.length > 0 && (
        <div className="mt-5">
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Se fueron</p>
          <ul className="space-y-2">
            {cashedOutPlayers.map((p) => {
              const cashout = cashouts.find((c) => c.player_id === p.id)
              const totalBuyins = buyins.filter((b) => b.player_id === p.id).reduce((s, b) => s + b.monto, 0)
              const neto = (cashout?.monto ?? 0) - totalBuyins
              return (
                <li key={p.id} className="flex items-center justify-between bg-gray-700/40 rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 text-xs">✓</span>
                    <span className="text-gray-200 text-sm">{p.nombre}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-400 text-xs">Puesto: <AmountDisplay centavos={totalBuyins} /></span>
                    <span className="text-gray-400 text-xs">CO: <AmountDisplay centavos={cashout?.monto ?? 0} /></span>
                    <span className={`font-semibold ${neto > 0 ? 'text-emerald-400' : neto < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {neto > 0 ? '+' : ''}<AmountDisplay centavos={neto} />
                    </span>
                    <button onClick={() => setCashoutModal(p)}
                      className="bg-gray-600 hover:bg-gray-500 text-gray-200 text-xs px-3 py-1 rounded-lg transition-colors ml-1">
                      editar
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {cashoutModal && (
        <CashoutModal
          player={cashoutModal}
          existingMonto={cashouts.find((c) => c.player_id === cashoutModal.id)?.monto}
          onConfirm={handleCashout}
          onCancel={() => setCashoutModal(null)}
        />
      )}
      {confirmDeleteBuyin && (
        <ConfirmModal
          title="¿Eliminar buy-in?"
          message="¿Querés borrar este buy-in? No se puede deshacer."
          loading={removingBuyin === confirmDeleteBuyin}
          onConfirm={() => { handleDeleteBuyin(confirmDeleteBuyin); setConfirmDeleteBuyin(null) }}
          onCancel={() => setConfirmDeleteBuyin(null)}
        />
      )}
    </div>
  )
}

function StatusBadge({ estado }) {
  const map = {
    abierta: 'bg-emerald-700 text-emerald-100',
    cerrada: 'bg-gray-600 text-gray-200',
  }
  return (
    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${map[estado] ?? 'bg-gray-600 text-gray-200'}`}>
      {estado}
    </span>
  )
}

function AddFromGroupForm({ grupoId, sessionId, players, onAddPlayer, onRemovePlayer, onError }) {
  const [grupoMembers, setGrupoMembers] = useState([])

  useEffect(() => {
    api.get(`/grupos/${grupoId}/members`).then(setGrupoMembers).catch(() => {})
  }, [grupoId])

  const playerIds = new Set(players.map((p) => p.id))
  const available = grupoMembers.filter((m) => !playerIds.has(m.id))

  const handleAdd = async (playerId) => {
    if (!playerId) return
    const member = grupoMembers.find((m) => m.id === playerId)
    if (!member) return
    onAddPlayer(member)
    try {
      await api.post(`/cash/sessions/${sessionId}/add-member`, { player_id: playerId })
    } catch (err) {
      onRemovePlayer(playerId)
      onError(err.message)
    }
  }

  if (grupoMembers.length > 0 && available.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <select
        value=""
        onChange={(e) => handleAdd(e.target.value)}
        disabled={available.length === 0}
        className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50"
      >
        <option value="" disabled hidden>+ Agregar jugador…</option>
        {available.map((m) => (
          <option key={m.id} value={m.id}>{m.nombre}</option>
        ))}
      </select>
    </div>
  )
}

function AddBuyinForm({ sessionId, players, onAdded }) {
  const [playerId, setPlayerId] = useState('')
  const [monto, setMonto] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.post(`/cash/sessions/${sessionId}/buyins`, {
        player_id: playerId,
        monto: Math.round(parseFloat(monto) * 100),
      })
      setMonto('')
      onAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-3 flex-wrap">
      <select
        value={playerId}
        onChange={(e) => setPlayerId(e.target.value)}
        required
        className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
      >
        <option value="">Jugador…</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>{p.nombre || p.id}</option>
        ))}
      </select>
      <input
        type="number"
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
        required
        min="0"
        step="0.01"
        placeholder="Monto ($)"
        className="w-32 bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
      />
      <button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-3 py-2 rounded-lg transition-colors">
        {loading ? '…' : 'Registrar'}
      </button>
      {error && <p className="text-red-400 text-xs self-center">{error}</p>}
    </form>
  )
}

function AddCashoutForm({ sessionId, players, onAdded }) {
  const [playerId, setPlayerId] = useState('')
  const [monto, setMonto] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.post(`/cash/sessions/${sessionId}/cashouts`, {
        player_id: playerId,
        monto: Math.round(parseFloat(monto) * 100),
      })
      setMonto('')
      onAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-3 flex-wrap">
      <select
        value={playerId}
        onChange={(e) => setPlayerId(e.target.value)}
        required
        className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
      >
        <option value="">Jugador…</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>{p.nombre || p.id}</option>
        ))}
      </select>
      <input
        type="number"
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
        required
        min="0"
        step="0.01"
        placeholder="Monto ($)"
        className="w-32 bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
      />
      <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-2 rounded-lg transition-colors">
        {loading ? '…' : 'Cashout'}
      </button>
      {error && <p className="text-red-400 text-xs self-center">{error}</p>}
    </form>
  )
}

function SummarySection({ summary, userId, onUpdateSettlement, onError }) {
  if (!summary) return null

  const hostId = summary.session?.host_id

  const isPagado = (estado) => estado === 'confirmado_deudor' || estado === 'confirmado_host'

  const shareWhatsApp = () => {
    const nombre = summary.session?.nombre || 'Sesión'
    const pending = (summary.settlements || []).filter(s => !isPagado(s.estado))
    const fmt = (c) => {
      const p = c / 100
      return '$' + (p % 1 === 0 ? p.toLocaleString('es-AR') : p.toLocaleString('es-AR', { minimumFractionDigits: 2 }))
    }
    const lines = pending.length === 0
      ? ['Todos los saldos están al día ✓']
      : pending.map(s => {
          const alias = s.alias_acreedor ? ` (alias: ${s.alias_acreedor})` : ''
          return `• ${s.nombre_deudor} le debe ${fmt(s.monto)} a ${s.nombre_acreedor}${alias}`
        })
    const text = `🃏 *${nombre}* — saldos:\n${lines.join('\n')}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const handleConfirm = async (settlementId) => {
    const original = summary.settlements.find(s => s.id === settlementId)?.estado
    onUpdateSettlement(settlementId, 'confirmado_deudor')
    try {
      await api.patch(`/cash/settlements/${settlementId}/confirm`, {})
    } catch (err) {
      onUpdateSettlement(settlementId, original)
      onError(err.message)
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-bold text-white mb-4">Balances</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2">Jugador</th>
                <th className="text-right py-2">Buy-ins</th>
                <th className="text-right py-2">Cashout</th>
                <th className="text-right py-2">Neto</th>
              </tr>
            </thead>
            <tbody>
              {(summary.balances || []).map((b) => (
                <tr key={b.player_id} className="border-b border-gray-700/50">
                  <td className="py-2 text-white">{b.nombre || b.player_id}</td>
                  <td className="py-2 text-right text-gray-300"><AmountDisplay centavos={b.total_buyins} /></td>
                  <td className="py-2 text-right text-gray-300"><AmountDisplay centavos={b.cashout} /></td>
                  <td className={`py-2 text-right font-semibold ${b.neto > 0 ? 'text-emerald-400' : b.neto < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    {b.neto > 0 ? '+' : ''}<AmountDisplay centavos={b.neto} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Saldos</h3>
          {(summary.settlements || []).length > 0 && (
            <button
              onClick={shareWhatsApp}
              className="flex items-center gap-1.5 text-xs bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Compartir
            </button>
          )}
        </div>
        {(summary.settlements || []).length === 0 ? (
          <p className="text-gray-400 text-sm">No hay saldos.</p>
        ) : (() => {
          const visible = (summary.settlements || []).filter(s => s.deudor_id === userId || userId === hostId)
          const pending = visible.filter(s => !isPagado(s.estado))
          const settled = visible.filter(s => isPagado(s.estado))

          const renderRow = (s, done) => {
            const canMark = !done && (s.deudor_id === userId || userId === hostId)
            return (
              <li key={s.id} className={`flex items-center justify-between rounded-lg px-4 py-3 ${done ? 'bg-gray-700/20 opacity-60' : 'bg-gray-700/50'}`}>
                <span className="text-sm text-gray-200">
                  <span className="font-semibold text-white">{s.nombre_deudor || s.deudor_id}</span>
                  {' le debe '}
                  <span className={`font-semibold ${done ? 'text-gray-400' : 'text-emerald-400'}`}><AmountDisplay centavos={s.monto} /></span>
                  {' a '}
                  <span className="font-semibold text-white">{s.nombre_acreedor || s.acreedor_id}</span>
                  {s.alias_acreedor && <span className="text-gray-400"> · {s.alias_acreedor}</span>}
                </span>
                {canMark && (
                  <button onClick={() => handleConfirm(s.id)}
                    className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors shrink-0 ml-3">
                    Marcar saldado
                  </button>
                )}
                {done && <span className="text-emerald-400 text-xs font-semibold shrink-0 ml-3">Saldado ✓</span>}
              </li>
            )
          }

          return (
            <div className="space-y-5">
              {pending.length > 0 && (
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Pendientes</p>
                  <ul className="space-y-2">{pending.map(s => renderRow(s, false))}</ul>
                </div>
              )}
              {settled.length > 0 && (
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Saldados</p>
                  <ul className="space-y-2">{settled.map(s => renderRow(s, true))}</ul>
                </div>
              )}
              {pending.length === 0 && settled.length > 0 && (
                <p className="text-emerald-400 text-sm font-medium">Todos los saldos fueron saldados ✓</p>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}

export default function SessionPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [summary, setSummary] = useState(null)
  const [players, setPlayers] = useState([])
  const [buyins, setBuyins] = useState([])
  const [cashouts, setCashouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [closeConfirm, setCloseConfirm] = useState(false)
  const [closing, setClosing] = useState(false)
  const [pendingCashoutsPlayers, setPendingCashoutsPlayers] = useState([])
  const [pendingClosing, setPendingClosing] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const ops = {
    addPlayer: (player) => setPlayers((p) => [...p, player]),
    removePlayer: (playerId, rp, rb, rc) => {
      if (playerId === '__restore__') { setPlayers(rp); setBuyins(rb); setCashouts(rc); return }
      setPlayers((p) => p.filter((x) => x.id !== playerId))
      setBuyins((b) => b.filter((x) => x.player_id !== playerId))
      setCashouts((c) => c.filter((x) => x.player_id !== playerId))
    },
    addBuyin: (buyin) => setBuyins((b) => [...b, buyin]),
    replaceBuyin: (tempId, buyin) => setBuyins((b) => b.map((x) => x.id === tempId ? buyin : x)),
    updateCashout: (cashout) => setCashouts((c) => {
      const idx = c.findIndex((x) => x.player_id === cashout.player_id)
      if (idx >= 0) { const n = [...c]; n[idx] = cashout; return n }
      return [...c, cashout]
    }),
    deleteBuyin: (buyinId, snap) => {
      if (buyinId === '__restore__') { setBuyins(snap); return }
      setBuyins((b) => b.filter((x) => x.id !== buyinId))
    },
    removeCashout: (playerId) => setCashouts((c) => c.filter((x) => x.player_id !== playerId)),
    error: showToast,
  }

  const fetchData = async () => {
    try {
      const [sess, playersData, buyinsData, cashoutsData] = await Promise.all([
        api.get(`/cash/sessions/${id}`),
        api.get(`/cash/sessions/${id}/players`).catch(() => []),
        api.get(`/cash/sessions/${id}/buyins`).catch(() => []),
        api.get(`/cash/sessions/${id}/cashouts`).catch(() => []),
      ])
      setSession(sess)
      setPlayers(playersData)
      setBuyins(buyinsData)
      setCashouts(cashoutsData)

      if (sess.estado === 'cerrada') {
        const sum = await api.get(`/cash/sessions/${id}/summary`).catch(() => null)
        setSummary(sum)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [id])

  const handleClose = async () => {
    setSession(prev => ({ ...prev, estado: 'cerrada' }))
    setCloseConfirm(false)
    try {
      await api.post(`/cash/sessions/${id}/close`, {})
      const sum = await api.get(`/cash/sessions/${id}/summary`).catch(() => null)
      setSummary(sum)
    } catch (err) {
      setSession(prev => ({ ...prev, estado: 'abierta' }))
      showToast(err.message)
    }
  }

  const handleConfirmClose = () => {
    const playersWithNoBuyins = players.filter((p) => buyins.filter((b) => b.player_id === p.id).length === 0)
    const playersWithBuyins = players.filter((p) => buyins.filter((b) => b.player_id === p.id).length > 0)

    playersWithNoBuyins.forEach((p) => {
      ops.removePlayer(p.id)
      api.delete(`/cash/sessions/${id}/players/${p.id}`).catch(() => {})
    })

    const cashedOutIds = new Set(cashouts.map((c) => c.player_id))
    const needsCashout = playersWithBuyins.filter((p) => !cashedOutIds.has(p.id))

    if (needsCashout.length > 0) {
      setPendingCashoutsPlayers(needsCashout)
      setCloseConfirm(false)
      return
    }

    handleClose()
  }

  const handlePendingCashoutsSubmit = async (pending) => {
    setPendingClosing(true)
    pending.forEach((co) => {
      ops.updateCashout({ id: `__temp__${Date.now()}_${co.player_id}`, session_id: id, player_id: co.player_id, monto: co.monto, created_at: new Date().toISOString() })
    })
    try {
      const saved = await Promise.all(
        pending.map((co) => api.post(`/cash/sessions/${id}/cashouts`, { player_id: co.player_id, monto: co.monto }))
      )
      saved.forEach((co) => ops.updateCashout(co))
      setSession(prev => ({ ...prev, estado: 'cerrada' }))
      setPendingCashoutsPlayers([])
      await api.post(`/cash/sessions/${id}/close`, {})
      const sum = await api.get(`/cash/sessions/${id}/summary`).catch(() => null)
      setSummary(sum)
    } catch (err) {
      pending.forEach((co) => ops.removeCashout(co.player_id))
      setSession(prev => ({ ...prev, estado: 'abierta' }))
      showToast(err.message)
    } finally {
      setPendingClosing(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Cargando…</div>
  if (error) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-red-400">{error}</div>
  if (!session) return null

  const isHost = user?.id === session.host_id

  const maxPot = (() => {
    const events = [
      ...buyins.map((b) => ({ ts: b.created_at, delta: b.monto })),
      ...cashouts.map((c) => ({ ts: c.created_at, delta: -c.monto })),
    ].sort((a, b) => (a.ts < b.ts ? -1 : 1))
    let pot = 0, max = 0
    for (const e of events) {
      pot += e.delta
      if (pot > max) max = pot
    }
    return max
  })()

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Toast msg={toast} />
      {pendingCashoutsPlayers.length > 0 && (
        <PendingCashoutsModal
          players={pendingCashoutsPlayers}
          buyins={buyins}
          onConfirm={handlePendingCashoutsSubmit}
          onCancel={() => setPendingCashoutsPlayers([])}
          loading={pendingClosing}
        />
      )}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(session.grupo_id ? `/grupos/${session.grupo_id}` : '/')}
          className="text-gray-400 hover:text-white text-sm mb-4 transition-colors"
        >
          ← Volver
        </button>

        <div className="bg-gray-800 rounded-xl p-6 shadow-lg mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">
                {session.estado === 'cerrada' ? 'Pozo máximo alcanzado' : 'Pozo'}
              </p>
              <p className="text-4xl font-bold text-white">
                <AmountDisplay centavos={
                  session.estado === 'cerrada'
                    ? maxPot
                    : buyins.reduce((s, b) => s + b.monto, 0) - cashouts.reduce((s, c) => s + c.monto, 0)
                } />
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge estado={session.estado} />
              {isHost && session.estado === 'abierta' && (
                closeConfirm ? (
                  <div className="flex gap-2 items-center flex-wrap justify-end">
                    <span className="text-sm text-gray-300">¿Terminar?</span>
                    <button onClick={handleConfirmClose} disabled={closing} className="bg-red-600 hover:bg-red-500 text-white text-sm px-3 py-1.5 rounded-lg transition-colors">
                      {closing ? 'Terminando…' : 'Confirmar'}
                    </button>
                    <button onClick={() => setCloseConfirm(false)} className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-1.5 rounded-lg transition-colors">
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setCloseConfirm(true)} className="bg-red-600 hover:bg-red-500 text-white text-sm px-3 py-1.5 rounded-lg transition-colors">
                    Terminar sesión
                  </button>
                )
              )}
            </div>
          </div>
          {isHost && session.estado === 'abierta' && session.grupo_id && (
            <div className="mt-3">
              <AddFromGroupForm grupoId={session.grupo_id} sessionId={id} players={players} onAddPlayer={ops.addPlayer} onRemovePlayer={ops.removePlayer} onError={ops.error} />
            </div>
          )}
        </div>

        {isHost && session.estado === 'abierta' && players.length > 0 && (
          <ResumenTable
            sessionId={id}
            players={players}
            buyins={buyins}
            cashouts={cashouts}
            onRemovePlayer={ops.removePlayer}
            onDeleteBuyin={ops.deleteBuyin}
            onAddBuyin={ops.addBuyin}
            onReplaceBuyin={ops.replaceBuyin}
            onUpdateCashout={ops.updateCashout}
            onRemoveCashout={ops.removeCashout}
            onError={ops.error}
          />
        )}

        {session.estado === 'cerrada' && !summary && (
          <div className="bg-gray-800 rounded-xl p-6 shadow-lg mt-6 text-center">
            <p className="text-gray-400 text-sm">Calculando saldos…</p>
          </div>
        )}
        {session.estado === 'cerrada' && summary && (
          <SummarySection
            summary={summary}
            userId={user?.id}
            onUpdateSettlement={(settlementId, estado) =>
              setSummary(prev => ({
                ...prev,
                settlements: prev.settlements.map(s => s.id === settlementId ? { ...s, estado } : s),
              }))
            }
            onError={showToast}
          />
        )}

        {!isHost && session.estado === 'abierta' && (
          <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
            <p className="text-gray-400 text-sm">La sesión está en curso. El resumen estará disponible cuando el host la cierre.</p>
          </div>
        )}
      </div>
    </div>
  )
}

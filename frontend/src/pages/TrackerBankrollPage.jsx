import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../lib/api'
import AmountDisplay from '../components/AmountDisplay'
import Toast from '../components/tracker/Toast'

const inputCls = 'w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500'
const labelCls = 'block text-gray-300 text-xs mb-1'

const toCentavos = (s) => {
  if (s === '' || s == null) return 0
  let str = String(s).trim().replace(/\s/g, '')
  const lastComma = str.lastIndexOf(',')
  const lastDot = str.lastIndexOf('.')
  if (lastComma !== -1 && lastDot !== -1) {
    // el separador que aparece último es el decimal
    if (lastComma > lastDot) str = str.replace(/\./g, '').replace(',', '.')
    else str = str.replace(/,/g, '')
  } else if (lastComma !== -1) {
    str = str.replace(',', '.')
  } else if (lastDot !== -1) {
    // punto con exactamente 3 dígitos detrás = separador de miles (10.000)
    const parts = str.split('.')
    if (parts.length > 2 || parts[parts.length - 1].length === 3) str = str.replace(/\./g, '')
  }
  const n = parseFloat(str)
  return isNaN(n) ? 0 : Math.round(n * 100)
}

const TX_TIPOS = [
  { value: 'deposito', label: 'Depósito', sign: 1 },
  { value: 'retiro', label: 'Retiro', sign: -1 },
  { value: 'transferencia_entrada', label: 'Transferencia (entrada)', sign: 1 },
  { value: 'transferencia_salida', label: 'Transferencia (salida)', sign: -1 },
]

function signFor(tipo) {
  return tipo === 'deposito' || tipo === 'transferencia_entrada' ? 1 : -1
}

function fmtMoney(centavos, moneda) {
  const n = (centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 0 })
  return `${moneda} ${n}`
}

function NewBankrollModal({ onClose, onSaved }) {
  const [nombre, setNombre] = useState('')
  const [moneda, setMoneda] = useState('USD')
  const [saldoInicial, setSaldoInicial] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const saved = await api.post('/tracker/bankrolls', {
        nombre,
        moneda,
        saldo_inicial_centavos: toCentavos(saldoInicial),
      })
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 rounded-xl p-6 shadow-xl w-full max-w-sm">
        <h2 className="text-lg font-bold text-white mb-4">Nueva cuenta de bankroll</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>Nombre</label>
            <input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} placeholder="Online USD" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Moneda</label>
              <input type="text" required value={moneda} onChange={(e) => setMoneda(e.target.value.toUpperCase())} className={inputCls} placeholder="USD" maxLength={6} />
            </div>
            <div>
              <label className={labelCls}>Saldo inicial</label>
              <input type="text" inputMode="decimal" value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} className={inputCls} placeholder="0" />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white py-2 rounded-lg transition-colors">
              {loading ? 'Creando…' : 'Crear cuenta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditBankrollModal({ bankroll, onClose, onSaved }) {
  const [nombre, setNombre] = useState(bankroll.nombre)
  const [moneda, setMoneda] = useState(bankroll.moneda)
  const [saldoInicial, setSaldoInicial] = useState(String(bankroll.saldo_inicial_centavos / 100))
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const saved = await api.put(`/tracker/bankrolls/${bankroll.id}`, {
        nombre,
        moneda,
        saldo_inicial_centavos: toCentavos(saldoInicial),
      })
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 rounded-xl p-6 shadow-xl w-full max-w-sm">
        <h2 className="text-lg font-bold text-white mb-4">Editar cuenta — {bankroll.nombre}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>Nombre</label>
            <input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Moneda</label>
              <input type="text" required value={moneda} onChange={(e) => setMoneda(e.target.value.toUpperCase())} className={inputCls} maxLength={6} />
            </div>
            <div>
              <label className={labelCls}>Saldo inicial</label>
              <input type="text" inputMode="decimal" value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} className={inputCls} placeholder="0" />
            </div>
          </div>
          <p className="text-gray-500 text-xs">El saldo actual se recalcula solo: saldo inicial + resultados de sesiones + movimientos.</p>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white py-2 rounded-lg transition-colors">
              {loading ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function NewTransactionModal({ bankroll, onClose, onSaved }) {
  const [tipo, setTipo] = useState('deposito')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [nota, setNota] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const saved = await api.post(`/tracker/bankrolls/${bankroll.id}/transactions`, {
        tipo,
        monto_centavos: toCentavos(monto),
        fecha,
        nota: nota || null,
      })
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 rounded-xl p-6 shadow-xl w-full max-w-sm">
        <h2 className="text-lg font-bold text-white mb-4">Nuevo movimiento — {bankroll.nombre}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
              {TX_TIPOS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Monto ({bankroll.moneda})</label>
              <input type="text" inputMode="decimal" required value={monto} onChange={(e) => setMonto(e.target.value)} className={inputCls} placeholder="100" />
            </div>
            <div>
              <label className={labelCls}>Fecha</label>
              <input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Nota (opcional)</label>
            <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} className={inputCls} placeholder="Transferencia desde banco…" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white py-2 rounded-lg transition-colors">
              {loading ? 'Guardando…' : 'Registrar movimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EvolutionChart({ bankroll, sessions, transactions }) {
  const data = useMemo(() => {
    const events = [
      ...sessions.map((s) => ({ fecha: s.fecha, delta: s.resultado_neto_centavos })),
      ...transactions.map((t) => ({ fecha: t.fecha, delta: signFor(t.tipo) * t.monto_centavos })),
    ].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))

    let saldo = bankroll.saldo_inicial_centavos
    const points = [{ fecha: 'Inicio', saldo }]
    for (const ev of events) {
      saldo += ev.delta
      points.push({ fecha: ev.fecha, saldo })
    }
    return points
  }, [bankroll, sessions, transactions])

  if (data.length <= 1) {
    return <p className="text-gray-400 text-sm py-8 text-center">Todavía no hay movimientos para graficar la evolución.</p>
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="bankrollFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="fecha" stroke="#9ca3af" fontSize={11} tickLine={false} />
          <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} tickFormatter={(v) => (v / 100).toLocaleString('es-AR')} width={60} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#d1d5db' }}
            formatter={(value) => [fmtMoney(value, bankroll.moneda), 'Saldo']}
          />
          <Area type="monotone" dataKey="saldo" stroke="#10b981" strokeWidth={2} fill="url(#bankrollFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function TrackerBankrollPage() {
  const [bankrolls, setBankrolls] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState(null)
  const [toastMsg, setToastMsg] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [deletingTxId, setDeletingTxId] = useState(null)

  const [showNewBankroll, setShowNewBankroll] = useState(false)
  const [showEditBankroll, setShowEditBankroll] = useState(false)
  const [showNewTx, setShowNewTx] = useState(false)

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 4000)
  }

  const loadBankrolls = async () => {
    setLoading(true)
    try {
      const data = await api.get('/tracker/bankrolls')
      setBankrolls(data)
      setError(null)
      if (data.length && !selectedId) setSelectedId(data[0].id)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadBankrolls() }, [])

  const selected = bankrolls.find((b) => b.id === selectedId) || null

  useEffect(() => {
    if (!selectedId) { setTransactions([]); setSessions([]); return }
    let cancelled = false
    setDetailLoading(true)
    Promise.all([
      api.get(`/tracker/bankrolls/${selectedId}/transactions`),
      api.get(`/tracker/sessions?bankroll_id=${selectedId}`),
    ])
      .then(([txs, sess]) => {
        if (cancelled) return
        setTransactions(txs)
        setSessions(sess)
      })
      .catch((err) => !cancelled && showToast(err.message))
      .finally(() => !cancelled && setDetailLoading(false))
    return () => { cancelled = true }
  }, [selectedId])

  const handleBankrollSaved = (saved) => {
    setBankrolls((prev) => [...prev, saved])
    setSelectedId(saved.id)
    setShowNewBankroll(false)
  }

  const handleBankrollEdited = (saved) => {
    setBankrolls((prev) => prev.map((b) => (b.id === saved.id ? saved : b)))
    setShowEditBankroll(false)
  }

  const handleTxSaved = (saved) => {
    setTransactions((prev) => [saved, ...prev])
    setShowNewTx(false)
    loadBankrolls()
  }

  const handleDeleteBankroll = async (id) => {
    if (deletingId !== id) { setDeletingId(id); return }
    const snap = bankrolls
    setBankrolls((prev) => prev.filter((b) => b.id !== id))
    setDeletingId(null)
    if (selectedId === id) setSelectedId(null)
    try {
      await api.delete(`/tracker/bankrolls/${id}`)
    } catch (err) {
      setBankrolls(snap)
      showToast(err.message)
    }
  }

  const handleDeleteTx = async (txId) => {
    if (deletingTxId !== txId) { setDeletingTxId(txId); return }
    const snap = transactions
    setTransactions((prev) => prev.filter((t) => t.id !== txId))
    setDeletingTxId(null)
    try {
      await api.delete(`/tracker/bankrolls/${selectedId}/transactions/${txId}`)
      loadBankrolls()
    } catch (err) {
      setTransactions(snap)
      showToast(err.message)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link to="/tracker" className="text-emerald-400 text-sm hover:underline">&larr; Tracker</Link>
          <h1 className="text-2xl font-bold text-white mt-1">Bankroll</h1>
        </div>
        <button onClick={() => setShowNewBankroll(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + Nueva cuenta
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando…</p>
      ) : bankrolls.length === 0 ? (
        <div className="text-center py-16 bg-gray-800/50 rounded-xl">
          <p className="text-gray-400">Todavía no creaste ninguna cuenta de bankroll.</p>
          <button onClick={() => setShowNewBankroll(true)} className="mt-3 text-emerald-400 text-sm hover:underline">Crear tu primera cuenta</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {bankrolls.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedId(b.id)}
                className={`text-left rounded-xl p-4 transition-colors border ${selectedId === b.id ? 'bg-gray-800 border-emerald-500' : 'bg-gray-800/60 border-transparent hover:border-gray-600'}`}
              >
                <p className="text-white font-semibold">{b.nombre}</p>
                <p className="text-gray-400 text-xs mb-2">{b.moneda}</p>
                <p className={`text-lg font-bold ${b.saldo_actual_centavos >= b.saldo_inicial_centavos ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmtMoney(b.saldo_actual_centavos, b.moneda)}
                </p>
              </button>
            ))}
          </div>

          {selected && (
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-white font-semibold">{selected.nombre}</h2>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowNewTx(true)} className="text-emerald-400 text-sm hover:underline">+ Movimiento</button>
                  <button onClick={() => setShowEditBankroll(true)} className="text-gray-400 text-xs hover:text-white transition-colors">Editar</button>
                  <button onClick={() => handleDeleteBankroll(selected.id)} className={`text-xs transition-colors ${deletingId === selected.id ? 'text-red-400 font-semibold' : 'text-gray-400 hover:text-red-400'}`}>
                    {deletingId === selected.id ? '¿Confirmar borrado?' : 'Borrar cuenta'}
                  </button>
                </div>
              </div>
              <p className="text-gray-400 text-xs mb-3">
                Saldo inicial: {fmtMoney(selected.saldo_inicial_centavos, selected.moneda)} · Saldo actual: <span className={selected.saldo_actual_centavos >= selected.saldo_inicial_centavos ? 'text-emerald-400' : 'text-red-400'}>{fmtMoney(selected.saldo_actual_centavos, selected.moneda)}</span>
              </p>

              {detailLoading ? (
                <p className="text-gray-400 text-sm py-8 text-center">Cargando…</p>
              ) : (
                <>
                  <EvolutionChart bankroll={selected} sessions={sessions} transactions={transactions} />

                  <h3 className="text-white text-sm font-semibold mt-6 mb-2">Movimientos manuales</h3>
                  {transactions.length === 0 ? (
                    <p className="text-gray-400 text-sm">No hay movimientos manuales cargados.</p>
                  ) : (
                    <div className="space-y-1">
                      {transactions.map((t) => (
                        <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                          <div className="min-w-0">
                            <p className="text-white text-sm">
                              {TX_TIPOS.find((o) => o.value === t.tipo)?.label || t.tipo}
                              <span className="text-gray-500"> · {t.fecha}</span>
                            </p>
                            {t.nota && <p className="text-gray-500 text-xs truncate">{t.nota}</p>}
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-3">
                            <span className={`font-semibold text-sm ${signFor(t.tipo) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {signFor(t.tipo) > 0 ? '+' : '−'} {fmtMoney(t.monto_centavos, selected.moneda)}
                            </span>
                            <button onClick={() => handleDeleteTx(t.id)} className={`text-xs transition-colors ${deletingTxId === t.id ? 'text-red-400 font-semibold' : 'text-gray-400 hover:text-red-400'}`}>
                              {deletingTxId === t.id ? '¿Confirmar?' : 'Borrar'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {showNewBankroll && <NewBankrollModal onClose={() => setShowNewBankroll(false)} onSaved={handleBankrollSaved} />}
      {showEditBankroll && selected && <EditBankrollModal bankroll={selected} onClose={() => setShowEditBankroll(false)} onSaved={handleBankrollEdited} />}
      {showNewTx && selected && <NewTransactionModal bankroll={selected} onClose={() => setShowNewTx(false)} onSaved={handleTxSaved} />}
      <Toast msg={toastMsg} />
    </div>
  )
}

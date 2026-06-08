import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

const inputCls = 'w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500'

const toCentavos = (s) => {
  if (s === '' || s == null) return null
  const n = parseFloat(String(s).replace(',', '.'))
  return isNaN(n) ? null : Math.round(n * 100)
}
const fromCentavos = (c) => (c == null ? '' : String(c / 100))

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function periodoActual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function ProgressBar({ progreso, objetivo, label, formatProgreso, formatObjetivo }) {
  const pct = objetivo > 0 ? Math.min(Math.round((progreso / objetivo) * 100), 100) : 0
  const logrado = objetivo > 0 && progreso >= objetivo
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-300">{label}</span>
        <span className={logrado ? 'text-emerald-400 font-medium' : 'text-gray-400'}>
          {formatProgreso(progreso)} / {formatObjetivo(objetivo)}
        </span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${logrado ? 'bg-emerald-400' : progreso < 0 ? 'bg-red-500' : 'bg-emerald-600'}`} style={{ width: `${Math.max(pct, progreso < 0 ? 100 : 0)}%` }} />
      </div>
    </div>
  )
}

function GoalForm({ periodo, initial, onSaved, onCancel }) {
  const [ganancia, setGanancia] = useState(fromCentavos(initial?.objetivo_ganancia_centavos))
  const [horas, setHoras] = useState(initial?.objetivo_horas != null ? String(initial.objetivo_horas) : '')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const objetivoGanancia = toCentavos(ganancia)
    const objetivoHoras = horas === '' ? null : parseFloat(horas)
    if (objetivoGanancia == null && objetivoHoras == null) {
      setError('Definí al menos un objetivo: ganancia y/o horas')
      return
    }
    setLoading(true)
    try {
      const saved = await api.put(`/tracker/goals/${periodo}`, {
        periodo,
        objetivo_ganancia_centavos: objetivoGanancia,
        objetivo_horas: objetivoHoras,
      })
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-gray-300 text-xs mb-1">Objetivo de ganancia</label>
          <input type="text" inputMode="decimal" value={ganancia} onChange={(e) => setGanancia(e.target.value)} className={inputCls} placeholder="500" />
        </div>
        <div>
          <label className="block text-gray-300 text-xs mb-1">Objetivo de horas</label>
          <input type="text" inputMode="decimal" value={horas} onChange={(e) => setHoras(e.target.value)} className={inputCls} placeholder="40" />
        </div>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-3">
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm transition-colors">Cancelar</button>
        )}
        <button type="submit" disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white py-2 rounded-lg text-sm transition-colors">
          {loading ? 'Guardando…' : 'Guardar meta'}
        </button>
      </div>
    </form>
  )
}

export default function GoalsCard() {
  const [goal, setGoal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  const periodo = periodoActual()
  const mes = MESES[parseInt(periodo.split('-')[1], 10) - 1]

  useEffect(() => {
    let cancelled = false
    api.get(`/tracker/goals/${periodo}`)
      .then((data) => { if (!cancelled) setGoal(data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [periodo])

  const handleSaved = (saved) => {
    setGoal(saved)
    setEditing(false)
  }

  if (loading) return null

  return (
    <div className="bg-gray-800 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-semibold">Meta de {mes}</h2>
        {goal && !editing && (
          <button onClick={() => setEditing(true)} className="text-emerald-400 text-sm hover:underline">Editar</button>
        )}
      </div>

      {editing || !goal ? (
        <GoalForm periodo={periodo} initial={goal} onSaved={handleSaved} onCancel={goal ? () => setEditing(false) : null} />
      ) : (
        <div className="space-y-3">
          {goal.objetivo_ganancia_centavos != null && (
            <ProgressBar
              label="Ganancia"
              progreso={goal.progreso_ganancia_centavos}
              objetivo={goal.objetivo_ganancia_centavos}
              formatProgreso={(c) => `$ ${(c / 100).toLocaleString('es-AR')}`}
              formatObjetivo={(c) => `$ ${(c / 100).toLocaleString('es-AR')}`}
            />
          )}
          {goal.objetivo_horas != null && (
            <ProgressBar
              label="Horas jugadas"
              progreso={goal.progreso_horas}
              objetivo={goal.objetivo_horas}
              formatProgreso={(h) => `${h} h`}
              formatObjetivo={(h) => `${h} h`}
            />
          )}
        </div>
      )}
    </div>
  )
}

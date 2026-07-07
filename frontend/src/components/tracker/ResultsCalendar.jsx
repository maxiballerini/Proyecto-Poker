import { useMemo, useState } from 'react'
import AmountDisplay from '../AmountDisplay'

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// Intensidad creciente según el tamaño del resultado del día (1/3, 2/3, 3/3 del máximo del mes)
const GAIN_BG = ['bg-emerald-900/60 text-emerald-200', 'bg-emerald-700 text-white', 'bg-emerald-500 text-white']
const LOSS_BG = ['bg-red-900/60 text-red-200', 'bg-red-700 text-white', 'bg-red-500 text-white']

function fmtCompact(centavos) {
  const abs = Math.abs(centavos / 100)
  const num = abs >= 1000
    ? `${(abs / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}k`
    : abs.toLocaleString('es-AR', { maximumFractionDigits: 0 })
  return `${centavos > 0 ? '+' : '−'}${num}`
}

export default function ResultsCalendar({ sessions }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-11

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1) } else setMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1) } else setMonth((m) => m + 1)
  }

  const { byDay, maxAbs, monthTotal } = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
    const byDay = new Map()
    for (const s of sessions) {
      if (!s.fecha?.startsWith(prefix)) continue
      const day = parseInt(s.fecha.slice(8, 10), 10)
      const cur = byDay.get(day) ?? { neto: 0, count: 0 }
      byDay.set(day, { neto: cur.neto + s.resultado_neto_centavos, count: cur.count + 1 })
    }
    let maxAbs = 0
    let monthTotal = 0
    for (const { neto } of byDay.values()) {
      maxAbs = Math.max(maxAbs, Math.abs(neto))
      monthTotal += neto
    }
    return { byDay, maxAbs, monthTotal }
  }, [sessions, year, month])

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7 // semana empieza lunes

  const cellCls = (neto) => {
    const ratio = maxAbs ? Math.abs(neto) / maxAbs : 0
    const idx = ratio > 0.66 ? 2 : ratio > 0.33 ? 1 : 0
    return neto >= 0 ? GAIN_BG[idx] : LOSS_BG[idx]
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-semibold">Calendario</h2>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="text-gray-400 hover:text-white px-2 py-1 rounded transition-colors" aria-label="Mes anterior">‹</button>
          <span className="text-white text-sm font-medium w-32 text-center">{MESES[month]} {year}</span>
          <button onClick={nextMonth} className="text-gray-400 hover:text-white px-2 py-1 rounded transition-colors" aria-label="Mes siguiente">›</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DIAS.map((d, i) => (
          <div key={i} className="text-gray-500 text-xs py-1">{d}</div>
        ))}
        {Array.from({ length: firstOffset }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const data = byDay.get(day)
          if (!data) {
            return (
              <div key={day} className="rounded-lg bg-gray-900/40 py-1.5 min-h-[3rem]">
                <span className="text-gray-600 text-xs">{day}</span>
              </div>
            )
          }
          return (
            <div
              key={day}
              title={`${data.count} sesi${data.count > 1 ? 'ones' : 'ón'} · $ ${(data.neto / 100).toLocaleString('es-AR')}`}
              className={`rounded-lg py-1.5 min-h-[3rem] cursor-default transition-transform hover:scale-105 ${cellCls(data.neto)}`}
            >
              <span className="text-xs opacity-70">{day}</span>
              <p className="text-[11px] font-semibold leading-tight">{fmtCompact(data.neto)}</p>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-end gap-2 mt-3 text-sm">
        <span className="text-gray-400">Total del mes:</span>
        <AmountDisplay centavos={monthTotal} className={`font-semibold ${monthTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
      </div>
    </div>
  )
}

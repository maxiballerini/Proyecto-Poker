import { useMemo } from 'react'

const WEEKS = 18
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function colorFor(neto, maxAbs) {
  if (neto == null) return 'bg-gray-800'
  if (neto === 0) return 'bg-gray-600'
  const intensidad = maxAbs > 0 ? Math.min(Math.abs(neto) / maxAbs, 1) : 0
  if (neto > 0) {
    if (intensidad > 0.66) return 'bg-emerald-400'
    if (intensidad > 0.33) return 'bg-emerald-600'
    return 'bg-emerald-900'
  }
  if (intensidad > 0.66) return 'bg-red-400'
  if (intensidad > 0.33) return 'bg-red-600'
  return 'bg-red-900'
}

function fmtMoney(centavos) {
  return `$ ${(centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`
}

export default function ActivityHeatmap({ sessions }) {
  const { weeks, maxAbs } = useMemo(() => {
    const porDia = new Map()
    for (const s of sessions) {
      const acc = porDia.get(s.fecha) || { count: 0, neto: 0 }
      acc.count += 1
      acc.neto += s.resultado_neto_centavos
      porDia.set(s.fecha, acc)
    }

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const fin = new Date(hoy)
    fin.setDate(fin.getDate() + (6 - fin.getDay()))
    const inicio = new Date(fin)
    inicio.setDate(inicio.getDate() - WEEKS * 7 + 1)

    const cols = []
    let cursor = new Date(inicio)
    let max = 0
    for (let w = 0; w < WEEKS; w++) {
      const col = []
      for (let d = 0; d < 7; d++) {
        const key = cursor.toISOString().slice(0, 10)
        const info = porDia.get(key) || null
        if (info) max = Math.max(max, Math.abs(info.neto))
        col.push({ fecha: key, info, futuro: cursor > hoy })
        cursor = new Date(cursor)
        cursor.setDate(cursor.getDate() + 1)
      }
      cols.push(col)
    }
    return { weeks: cols, maxAbs: max }
  }, [sessions])

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        <div className="flex flex-col gap-1 mr-1 shrink-0">
          {DIAS.map((d, i) => (
            <div key={d} className="h-3.5 w-7 text-[10px] text-gray-500 leading-[14px]">{i % 2 === 1 ? d : ''}</div>
          ))}
        </div>
        {weeks.map((col, wi) => (
          <div key={wi} className="flex flex-col gap-1 shrink-0">
            {col.map((cell) => (
              <div
                key={cell.fecha}
                title={
                  cell.futuro
                    ? ''
                    : cell.info
                      ? `${cell.fecha} · ${cell.info.count} sesión${cell.info.count > 1 ? 'es' : ''} · ${fmtMoney(cell.info.neto)}`
                      : `${cell.fecha} · sin actividad`
                }
                className={`h-3.5 w-3.5 rounded-sm ${cell.futuro ? 'bg-transparent' : colorFor(cell.info?.neto ?? null, maxAbs)}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-500">
        <span>Menos</span>
        <span className="h-3 w-3 rounded-sm bg-gray-800" />
        <span className="h-3 w-3 rounded-sm bg-red-600" />
        <span className="h-3 w-3 rounded-sm bg-gray-600" />
        <span className="h-3 w-3 rounded-sm bg-emerald-600" />
        <span className="h-3 w-3 rounded-sm bg-emerald-400" />
        <span>Más</span>
        <span className="ml-2">· rojo = días en pérdida, verde = días en ganancia</span>
      </div>
    </div>
  )
}

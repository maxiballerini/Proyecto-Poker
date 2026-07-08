import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'

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
const fromCentavos = (c) => (c == null ? '' : String(c / 100))
const toIntOrNull = (s) => (s === '' || s == null ? null : parseInt(s, 10))

// Fecha de hoy en hora LOCAL — toISOString() usa UTC y de noche ya devuelve el día siguiente
const hoyLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col">
      <label className={labelCls}>{label}</label>
      <div className="mt-auto">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PokerCraft .txt parser
// ---------------------------------------------------------------------------

function parsePokerCraftFile(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return null

  // Line 0: "Tournament #ID, Name, Hold'em No Limit" — a veces con código: "Tournament #ID, 336-L: Name, ..."
  const tidMatch = lines[0].match(/Tournament #(\d+)/)
  const nameMatch = lines[0].match(/Tournament #\d+,\s*(.+)/i)
  const nombreTorneo = nameMatch
    ? nameMatch[1]
        .replace(/,\s*[^,]*(Hold'em|Holdem|Omaha|Short Deck)[^,]*\s*$/i, '') // saca ", Hold'em No Limit" final
        .replace(/^[A-Za-z0-9-]+:\s*/, '') // saca el código tipo "336-L:"
        .trim()
    : ''

  const isBounty = /bounty|mystery bounty|secret ko|progressive ko|\bpko\b|\bko\b/i.test(nombreTorneo)
  const estructura = /hyper/i.test(nombreTorneo) ? 'hyper' : /turbo/i.test(nombreTorneo) ? 'turbo' : 'regular'

  // "Buy-in: $11.5+$2+$11.5" → sum all parts as total cost per entry
  const buyinLine = lines.find((l) => l.startsWith('Buy-in:')) || ''
  const buyinParts = (buyinLine.match(/\$[\d.]+/g) || []).map((p) => parseFloat(p.slice(1)))
  const totalBuyin = buyinParts.reduce((a, b) => a + b, 0)

  // "18953 Players"
  const playersMatch = lines.find((l) => /Players/.test(l))?.match(/^([\d,]+)\s+Players/)
  const entrantes = playersMatch ? parseInt(playersMatch[1].replace(/,/g, ''), 10) : null

  // "Tournament started 2026/06/06 14:30:00"
  const dateMatch = lines.find((l) => l.startsWith('Tournament started'))?.match(/(\d{4})\/(\d{2})\/(\d{2})/)
  const fecha = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null

  // "You finished the tournament in 533th place."
  const posMatch = lines.find((l) => l.startsWith('You finished'))?.match(/in (\d+)/)
  const posicion = posMatch ? parseInt(posMatch[1], 10) : null

  // "You made 1 re-entries and received..." or "You received..."
  const receivedLine = lines.find((l) => l.includes('received a total'))
  const reentryMatch = receivedLine?.match(/made (\d+) re-entr/)
  const rebuys = reentryMatch ? parseInt(reentryMatch[1], 10) : 0

  // Prize: "$0" or "$1,234.56" — chips-based tournaments have no $ amount
  const prizeMatch = receivedLine?.match(/received a total of \$([0-9.,]+)/)
  const premioPozo = prizeMatch ? Math.round(parseFloat(prizeMatch[1].replace(/,/g, '')) * 100) : 0

  return {
    nombreTorneo,
    buyinTorneo: totalBuyin > 0 ? String(totalBuyin) : '',
    comision: '0',
    rebuys,
    addons: 0,
    premioPozo: premioPozo > 0 ? String(premioPozo / 100) : '',
    entrantes: entrantes ? String(entrantes) : '',
    posicion: posicion ? String(posicion) : '',
    estructura,
    lateReg: false,
    esBounty: isBounty,
    tipoBounty: 'normal',
    bountiesCobrados: 0,
    gananciaBounty: '',
    _fecha: fecha,
    _tid: tidMatch ? tidMatch[1] : null,
  }
}

// ---------------------------------------------------------------------------
// Tournament block state helpers
// ---------------------------------------------------------------------------

function emptyTorneo(t = null) {
  return {
    _key: Date.now() + Math.random(),
    _tid: null,
    fecha: null, // fecha propia (importada); si es null usa la fecha general del form
    nombreTorneo: t?.nombre_torneo ?? '',
    buyinTorneo: fromCentavos(t?.buyin_centavos),
    comision: fromCentavos(t?.comision_centavos),
    rebuys: t?.rebuys ?? 0,
    addons: t?.addons ?? 0,
    premioPozo: fromCentavos(t?.premio_pozo_centavos),
    entrantes: t?.entrantes_totales != null ? String(t.entrantes_totales) : '',
    puestosPagos: t?.puestos_pagos != null ? String(t.puestos_pagos) : '',
    posicion: t?.posicion_final != null ? String(t.posicion_final) : '',
    estructura: t?.estructura ?? 'regular',
    lateReg: t?.late_reg ?? false,
    esBounty: t?.es_bounty ?? false,
    tipoBounty: t?.tipo_bounty ?? 'normal',
    bountiesCobrados: t?.bounties_cobrados ?? 0,
    gananciaBounty: fromCentavos(t?.ganancia_bounty_centavos),
  }
}

function buildTorneoPayload(t) {
  return {
    nombre_torneo: t.nombreTorneo || (t.esBounty ? 'Torneo bounty' : 'Torneo'),
    buyin_centavos: toCentavos(t.buyinTorneo),
    comision_centavos: toCentavos(t.comision),
    rebuys: parseInt(t.rebuys, 10) || 0,
    addons: parseInt(t.addons, 10) || 0,
    es_bounty: t.esBounty,
    tipo_bounty: t.esBounty ? t.tipoBounty : null,
    bounties_cobrados: t.esBounty ? (parseInt(t.bountiesCobrados, 10) || 0) : 0,
    ganancia_bounty_centavos: t.esBounty ? toCentavos(t.gananciaBounty) : 0,
    premio_pozo_centavos: toCentavos(t.premioPozo),
    entrantes_totales: toIntOrNull(t.entrantes),
    puestos_pagos: toIntOrNull(t.puestosPagos),
    posicion_final: toIntOrNull(t.posicion),
    estructura: t.estructura,
    late_reg: t.lateReg,
  }
}

// ---------------------------------------------------------------------------
// TorneoBlock
// ---------------------------------------------------------------------------

function TorneoBlock({ torneo, onChange, onRemove, canRemove, index }) {
  const set = (field) => (e) =>
    onChange(index, field, e.target.type === 'checkbox' ? e.target.checked : e.target.value)

  return (
    <div className="bg-gray-900/50 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-emerald-400">
          {canRemove ? `Torneo ${index + 1}` : 'Detalle torneo'}
        </h3>
        {canRemove && (
          <button type="button" onClick={() => onRemove(index)}
            className="text-gray-500 hover:text-red-400 text-xs transition-colors">
            Eliminar
          </button>
        )}
      </div>

      <Field label="Nombre del torneo">
        <input type="text" value={torneo.nombreTorneo} onChange={set('nombreTorneo')} className={inputCls} placeholder="Sunday Million" />
      </Field>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {torneo.fecha != null && (
          <Field label="Fecha">
            <input type="date" value={torneo.fecha} onChange={set('fecha')} className={inputCls} />
          </Field>
        )}
        <Field label="Buy-in total">
          <input type="text" inputMode="decimal" value={torneo.buyinTorneo} onChange={set('buyinTorneo')} className={inputCls} placeholder="25" />
        </Field>
        <Field label="Cashout">
          <input type="text" inputMode="decimal" value={torneo.premioPozo} onChange={set('premioPozo')} className={inputCls} placeholder="0" />
        </Field>
        <Field label="Re-entries">
          <input type="number" min="0" value={torneo.rebuys} onChange={set('rebuys')} className={inputCls} />
        </Field>
        <Field label="Add-ons">
          <input type="number" min="0" value={torneo.addons} onChange={set('addons')} className={inputCls} />
        </Field>
        <Field label="Entrantes">
          <input type="number" min="1" value={torneo.entrantes} onChange={set('entrantes')} className={inputCls} placeholder="450" />
        </Field>
        <Field label="Posición final">
          <input type="number" min="1" value={torneo.posicion} onChange={set('posicion')} className={inputCls} placeholder="12" />
        </Field>
        <Field label="Puestos pagos">
          <input type="number" min="1" value={torneo.puestosPagos} onChange={set('puestosPagos')} className={inputCls} placeholder="63" />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-300 pt-1 border-t border-gray-700">
        <input type="checkbox" checked={torneo.esBounty} onChange={set('esBounty')} className="rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500" />
        Es un torneo bounty / knockout
      </label>

      {torneo.esBounty && (
        <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Tipo de bounty">
            <select value={torneo.tipoBounty} onChange={set('tipoBounty')} className={inputCls}>
              <option value="normal">Normal</option>
              <option value="progressive">Progressive (PKO)</option>
            </select>
          </Field>
          <Field label="Bounties cobrados">
            <input type="number" min="0" value={torneo.bountiesCobrados} onChange={set('bountiesCobrados')} className={inputCls} />
          </Field>
          <Field label="Ganancia por bounties">
            <input type="text" inputMode="decimal" value={torneo.gananciaBounty} onChange={set('gananciaBounty')} className={inputCls} placeholder="35" />
          </Field>
          <p className="col-span-full text-xs text-amber-200/70">
            Cargá por separado lo que ganaste por knockouts y lo que ganaste del pozo de premios.
          </p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

export default function SessionFormModal({ onClose, onSaved, bankrolls, initial, defaultBankrollId, existingSessions = [] }) {
  const [tipo, setTipo] = useState(initial?.tipo ?? 'torneo')
  const [modalidad, setModalidad] = useState(initial?.modalidad ?? 'online')
  const [bankrollId, setBankrollId] = useState(initial?.bankroll_id ?? defaultBankrollId ?? '')
  const [variante, setVariante] = useState(initial?.variante ?? '')
  const [fecha, setFecha] = useState(initial?.fecha ?? hoyLocal())
  const [ubicacion, setUbicacion] = useState(initial ? (initial.ubicacion ?? '') : 'GGpoker')
  const [duracionMin, setDuracionMin] = useState(initial?.duracion_min != null ? String(initial.duracion_min) : '')
  const [notas, setNotas] = useState(initial?.notas ?? '')
  const [mood, setMood] = useState(initial?.mood ?? null)

  // cash-only
  const [stakesSb, setStakesSb] = useState(fromCentavos(initial?.stakes_sb_centavos))
  const [stakesBb, setStakesBb] = useState(fromCentavos(initial?.stakes_bb_centavos))
  const [buyinTotal, setBuyinTotal] = useState(fromCentavos(initial?.buyin_total_centavos))
  const [cashout, setCashout] = useState(fromCentavos(initial?.cashout_centavos))
  const [mesaSize, setMesaSize] = useState(initial?.mesa_size != null ? String(initial.mesa_size) : '')

  // tournament list
  const [torneos, setTorneos] = useState([emptyTorneo(initial?.torneo)])
  const [importError, setImportError] = useState(null)

  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const updateTorneo = (index, field, value) =>
    setTorneos((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)))
  const addTorneo = () => setTorneos((prev) => [...prev, emptyTorneo()])
  const removeTorneo = (index) => setTorneos((prev) => prev.filter((_, i) => i !== index))

  const handleImportFiles = (e) => {
    const files = Array.from(e.target.files).filter((f) => f.name.endsWith('.txt'))
    if (!files.length) { setImportError('No se encontraron archivos .txt.'); return }
    setImportError(null)

    Promise.all(
      files.map((file) => new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (ev) => resolve(parsePokerCraftFile(ev.target.result))
        reader.readAsText(file)
      }))
    ).then((parsed) => {
      const valid = parsed.filter(Boolean)
      if (!valid.length) { setImportError('No se pudo leer ningún archivo.'); return }

      const onlyEmpty = torneos.length === 1 && !torneos[0].nombreTorneo && !torneos[0].buyinTorneo
      const base = onlyEmpty ? [] : torneos
      const tidsEnForm = new Set(base.map((t) => t._tid).filter(Boolean))
      const nuevos = []
      let omitidos = 0

      for (const { _fecha, _tid, ...t } of valid) {
        const yaEnForm = _tid && tidsEnForm.has(_tid)
        const yaGuardado = existingSessions.some((s) =>
          s.fecha === _fecha &&
          s.torneo?.nombre_torneo === t.nombreTorneo &&
          String(s.torneo?.posicion_final ?? '') === t.posicion
        )
        if (yaEnForm || yaGuardado) { omitidos++; continue }
        if (_tid) tidsEnForm.add(_tid)
        nuevos.push({ ...emptyTorneo(), ...t, fecha: _fecha, _tid, _key: Date.now() + Math.random() })
      }

      if (nuevos.length) {
        if (nuevos[0].fecha) setFecha(nuevos[0].fecha)
        setModalidad('online')
        setTipo('torneo')
        setTorneos([...base, ...nuevos])
      }
      setImportError(omitidos ? `${omitidos} torneo${omitidos > 1 ? 's' : ''} ya cargado${omitidos > 1 ? 's' : ''} — se omitieron para no duplicar.` : null)

      e.target.value = ''
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const shared = {
      bankroll_id: bankrollId || null,
      tipo,
      modalidad,
      variante: variante || null,
      fecha,
      ubicacion: ubicacion || null,
      duracion_min: toIntOrNull(duracionMin),
      notas: notas || null,
      mood: mood || null,
    }

    try {
      if (tipo === 'cash') {
        const payload = {
          ...shared,
          stakes_sb_centavos: stakesSb ? toCentavos(stakesSb) : null,
          stakes_bb_centavos: stakesBb ? toCentavos(stakesBb) : null,
          buyin_total_centavos: toCentavos(buyinTotal),
          cashout_centavos: toCentavos(cashout),
          mesa_size: toIntOrNull(mesaSize),
        }
        const saved = initial
          ? await api.put(`/tracker/sessions/${initial.id}`, payload)
          : await api.post('/tracker/sessions', payload)
        onSaved(saved)
      } else if (initial) {
        const payload = { ...shared, torneo: buildTorneoPayload(torneos[0]) }
        const saved = await api.put(`/tracker/sessions/${initial.id}`, payload)
        onSaved(saved)
      } else {
        const results = await Promise.all(
          torneos.map((t) => api.post('/tracker/sessions', { ...shared, fecha: t.fecha || fecha, torneo: buildTorneoPayload(t) }))
        )
        onSaved(results.length === 1 ? results[0] : results)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const submitLabel = loading
    ? 'Guardando…'
    : initial
    ? 'Guardar cambios'
    : tipo === 'torneo' && torneos.length > 1
    ? `Cargar ${torneos.length} torneos`
    : 'Cargar sesión'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4 py-8 overflow-y-auto">
      <div className="bg-gray-800 rounded-xl p-6 shadow-xl w-full max-w-2xl my-auto">
        <h2 className="text-xl font-bold text-white mb-4">{initial ? 'Editar sesión' : 'Nueva sesión'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          {!initial && (
            <>
              <input ref={fileInputRef} type="file" multiple accept=".txt" className="hidden" onChange={handleImportFiles} />
              <input ref={folderInputRef} type="file" webkitdirectory="" className="hidden" onChange={handleImportFiles} />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="py-2.5 rounded-lg border border-dashed border-blue-600/60 text-blue-400 hover:border-blue-500 hover:text-blue-300 text-sm transition-colors">
                  Importar archivos .txt
                </button>
                <button type="button" onClick={() => folderInputRef.current?.click()}
                  className="py-2.5 rounded-lg border border-dashed border-blue-600/60 text-blue-400 hover:border-blue-500 hover:text-blue-300 text-sm transition-colors">
                  Importar carpeta
                </button>
              </div>
              {importError && <p className="text-red-400 text-xs">{importError}</p>}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <div className="flex gap-2">
                {[['cash', 'Cash'], ['torneo', 'Torneo']].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setTipo(v)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tipo === v ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Modalidad">
              <div className="flex gap-2">
                {[['vivo', 'En vivo'], ['online', 'Online']].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setModalidad(v)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${modalidad === v ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha">
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className={inputCls} />
            </Field>
            <Field label="Ubicación / sitio">
              <input type="text" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className={inputCls} placeholder="PokerStars, Casino X…" />
            </Field>
          </div>

          {tipo === 'cash' ? (
            <div className="bg-gray-900/50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-emerald-400">Detalle cash</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Stakes SB">
                  <input type="text" inputMode="decimal" value={stakesSb} onChange={(e) => setStakesSb(e.target.value)} className={inputCls} placeholder="0.50" />
                </Field>
                <Field label="Stakes BB">
                  <input type="text" inputMode="decimal" value={stakesBb} onChange={(e) => setStakesBb(e.target.value)} className={inputCls} placeholder="1" />
                </Field>
                <Field label="Tamaño de mesa">
                  <input type="number" min="2" value={mesaSize} onChange={(e) => setMesaSize(e.target.value)} className={inputCls} placeholder="6" />
                </Field>
                <Field label="Buy-in total">
                  <input type="text" inputMode="decimal" required value={buyinTotal} onChange={(e) => setBuyinTotal(e.target.value)} className={inputCls} placeholder="100" />
                </Field>
                <Field label="Cash-out">
                  <input type="text" inputMode="decimal" required value={cashout} onChange={(e) => setCashout(e.target.value)} className={inputCls} placeholder="150" />
                </Field>
              </div>
            </div>
          ) : (
            <>
              {torneos.map((t, i) => (
                <TorneoBlock
                  key={t._key}
                  index={i}
                  torneo={t}
                  onChange={updateTorneo}
                  onRemove={removeTorneo}
                  canRemove={torneos.length > 1}
                />
              ))}
              {!initial && (
                <button type="button" onClick={addTorneo}
                  className="w-full py-2 rounded-lg border border-dashed border-gray-600 text-gray-400 hover:text-emerald-400 hover:border-emerald-600 text-sm transition-colors">
                  + Agregar otro torneo
                </button>
              )}
            </>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white py-2 rounded-lg transition-colors">
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

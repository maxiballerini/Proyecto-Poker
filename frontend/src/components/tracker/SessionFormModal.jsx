import { useState } from 'react'
import { api } from '../../lib/api'

const inputCls = 'w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500'
const labelCls = 'block text-gray-300 text-xs mb-1'

const toCentavos = (s) => {
  if (s === '' || s == null) return 0
  const n = parseFloat(String(s).replace(',', '.'))
  return isNaN(n) ? 0 : Math.round(n * 100)
}
const fromCentavos = (c) => (c == null ? '' : String(c / 100))
const toIntOrNull = (s) => (s === '' || s == null ? null : parseInt(s, 10))

const VARIANTES = ['NLHE', 'PLO', 'PLO5', 'Mixto', 'Otro']
const ESTRUCTURAS = [
  { value: 'regular', label: 'Regular' },
  { value: 'turbo', label: 'Turbo' },
  { value: 'hyper', label: 'Hyper' },
  { value: 'deepstack', label: 'Deepstack' },
]

function Field({ label, children }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  )
}

function emptyTorneo(t = null) {
  return {
    _key: Date.now() + Math.random(),
    nombreTorneo: t?.nombre_torneo ?? '',
    buyinTorneo: fromCentavos(t?.buyin_centavos),
    comision: fromCentavos(t?.comision_centavos),
    rebuys: t?.rebuys ?? 0,
    addons: t?.addons ?? 0,
    premioPozo: fromCentavos(t?.premio_pozo_centavos),
    entrantes: t?.entrantes_totales != null ? String(t.entrantes_totales) : '',
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
    nombre_torneo: t.nombreTorneo || null,
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
    posicion_final: toIntOrNull(t.posicion),
    estructura: t.estructura,
    late_reg: t.lateReg,
  }
}

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
        <Field label="Buy-in">
          <input type="text" inputMode="decimal" value={torneo.buyinTorneo} onChange={set('buyinTorneo')} className={inputCls} placeholder="100" />
        </Field>
        <Field label="Comisión">
          <input type="text" inputMode="decimal" value={torneo.comision} onChange={set('comision')} className={inputCls} placeholder="9" />
        </Field>
        <Field label="Re-entries">
          <input type="number" min="0" value={torneo.rebuys} onChange={set('rebuys')} className={inputCls} />
        </Field>
        <Field label="Add-ons">
          <input type="number" min="0" value={torneo.addons} onChange={set('addons')} className={inputCls} />
        </Field>
        <Field label="Entrantes totales">
          <input type="number" min="1" value={torneo.entrantes} onChange={set('entrantes')} className={inputCls} placeholder="450" />
        </Field>
        <Field label="Posición final">
          <input type="number" min="1" value={torneo.posicion} onChange={set('posicion')} className={inputCls} placeholder="12" />
        </Field>
        <Field label="Estructura">
          <select value={torneo.estructura} onChange={set('estructura')} className={inputCls}>
            {ESTRUCTURAS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Premio del pozo">
          <input type="text" inputMode="decimal" value={torneo.premioPozo} onChange={set('premioPozo')} className={inputCls} placeholder="0" />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input type="checkbox" checked={torneo.lateReg} onChange={set('lateReg')} className="rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500" />
        Entré por late registration
      </label>

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
            Cargá por separado lo que ganaste por knockouts y lo que ganaste del pozo de premios — así las estadísticas de bounty quedan precisas.
          </p>
        </div>
      )}
    </div>
  )
}

export default function SessionFormModal({ onClose, onSaved, bankrolls, initial }) {
  const [tipo, setTipo] = useState(initial?.tipo ?? 'cash')
  const [modalidad, setModalidad] = useState(initial?.modalidad ?? 'vivo')
  const [bankrollId, setBankrollId] = useState(initial?.bankroll_id ?? '')
  const [variante, setVariante] = useState(initial?.variante ?? 'NLHE')
  const [fecha, setFecha] = useState(initial?.fecha ?? new Date().toISOString().slice(0, 10))
  const [ubicacion, setUbicacion] = useState(initial?.ubicacion ?? '')
  const [duracionMin, setDuracionMin] = useState(initial?.duracion_min != null ? String(initial.duracion_min) : '')
  const [notas, setNotas] = useState(initial?.notas ?? '')
  const [mood, setMood] = useState(initial?.mood ?? null)

  // cash-only
  const [stakesSb, setStakesSb] = useState(fromCentavos(initial?.stakes_sb_centavos))
  const [stakesBb, setStakesBb] = useState(fromCentavos(initial?.stakes_bb_centavos))
  const [buyinTotal, setBuyinTotal] = useState(fromCentavos(initial?.buyin_total_centavos))
  const [cashout, setCashout] = useState(fromCentavos(initial?.cashout_centavos))
  const [mesaSize, setMesaSize] = useState(initial?.mesa_size != null ? String(initial.mesa_size) : '')

  // tournament list (always at least one)
  const [torneos, setTorneos] = useState([emptyTorneo(initial?.torneo)])

  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const updateTorneo = (index, field, value) =>
    setTorneos((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)))
  const addTorneo = () => setTorneos((prev) => [...prev, emptyTorneo()])
  const removeTorneo = (index) => setTorneos((prev) => prev.filter((_, i) => i !== index))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const shared = {
      bankroll_id: bankrollId || null,
      tipo,
      modalidad,
      variante,
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
          torneos.map((t) => api.post('/tracker/sessions', { ...shared, torneo: buildTorneoPayload(t) }))
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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Fecha">
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className={inputCls} />
            </Field>
            <Field label="Variante">
              <select value={variante} onChange={(e) => setVariante(e.target.value)} className={inputCls}>
                {VARIANTES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Duración total (min)">
              <input type="number" min="0" value={duracionMin} onChange={(e) => setDuracionMin(e.target.value)} className={inputCls} placeholder="120" />
            </Field>
            <Field label="Bankroll">
              <select value={bankrollId} onChange={(e) => setBankrollId(e.target.value)} className={inputCls}>
                <option value="">Sin asignar</option>
                {bankrolls.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Ubicación / sitio">
            <input type="text" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className={inputCls} placeholder="PokerStars, Casino X…" />
          </Field>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Notas">
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className={inputCls} placeholder="Cómo jugaste, leaks, lecturas…" />
            </Field>
            <Field label="Estado de ánimo (opcional)">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((m) => (
                  <button key={m} type="button" onClick={() => setMood(mood === m ? null : m)}
                    className={`flex-1 py-2 rounded-lg text-sm transition-colors ${mood === m ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </Field>
          </div>

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

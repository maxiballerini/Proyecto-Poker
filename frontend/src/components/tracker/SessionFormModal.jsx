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

export default function SessionFormModal({ onClose, onSaved, bankrolls, initial }) {
  const t = initial?.torneo

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

  // tournament-only
  const [nombreTorneo, setNombreTorneo] = useState(t?.nombre_torneo ?? '')
  const [buyinTorneo, setBuyinTorneo] = useState(fromCentavos(t?.buyin_centavos))
  const [comision, setComision] = useState(fromCentavos(t?.comision_centavos))
  const [rebuys, setRebuys] = useState(t?.rebuys ?? 0)
  const [addons, setAddons] = useState(t?.addons ?? 0)
  const [premioPozo, setPremioPozo] = useState(fromCentavos(t?.premio_pozo_centavos))
  const [entrantes, setEntrantes] = useState(t?.entrantes_totales != null ? String(t.entrantes_totales) : '')
  const [posicion, setPosicion] = useState(t?.posicion_final != null ? String(t.posicion_final) : '')
  const [estructura, setEstructura] = useState(t?.estructura ?? 'regular')
  const [lateReg, setLateReg] = useState(t?.late_reg ?? false)
  const [esBounty, setEsBounty] = useState(t?.es_bounty ?? false)
  const [tipoBounty, setTipoBounty] = useState(t?.tipo_bounty ?? 'normal')
  const [bountiesCobrados, setBountiesCobrados] = useState(t?.bounties_cobrados ?? 0)
  const [gananciaBounty, setGananciaBounty] = useState(fromCentavos(t?.ganancia_bounty_centavos))

  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const payload = {
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

    if (tipo === 'cash') {
      payload.stakes_sb_centavos = stakesSb ? toCentavos(stakesSb) : null
      payload.stakes_bb_centavos = stakesBb ? toCentavos(stakesBb) : null
      payload.buyin_total_centavos = toCentavos(buyinTotal)
      payload.cashout_centavos = toCentavos(cashout)
      payload.mesa_size = toIntOrNull(mesaSize)
    } else {
      payload.torneo = {
        nombre_torneo: nombreTorneo || null,
        buyin_centavos: toCentavos(buyinTorneo),
        comision_centavos: toCentavos(comision),
        rebuys: parseInt(rebuys, 10) || 0,
        addons: parseInt(addons, 10) || 0,
        es_bounty: esBounty,
        tipo_bounty: esBounty ? tipoBounty : null,
        bounties_cobrados: esBounty ? (parseInt(bountiesCobrados, 10) || 0) : 0,
        ganancia_bounty_centavos: esBounty ? toCentavos(gananciaBounty) : 0,
        premio_pozo_centavos: toCentavos(premioPozo),
        entrantes_totales: toIntOrNull(entrantes),
        posicion_final: toIntOrNull(posicion),
        estructura,
        late_reg: lateReg,
      }
    }

    setLoading(true)
    try {
      const saved = initial
        ? await api.put(`/tracker/sessions/${initial.id}`, payload)
        : await api.post('/tracker/sessions', payload)
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4 py-8 overflow-y-auto">
      <div className="bg-gray-800 rounded-xl p-6 shadow-xl w-full max-w-2xl my-auto">
        <h2 className="text-xl font-bold text-white mb-4">{initial ? 'Editar sesión' : 'Nueva sesión'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Tipo / modalidad */}
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

          {/* Common fields */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Fecha">
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className={inputCls} />
            </Field>
            <Field label="Variante">
              <select value={variante} onChange={(e) => setVariante(e.target.value)} className={inputCls}>
                {VARIANTES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Duración (min)">
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
            <div className="bg-gray-900/50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-emerald-400">Detalle torneo</h3>
              <Field label="Nombre del torneo">
                <input type="text" value={nombreTorneo} onChange={(e) => setNombreTorneo(e.target.value)} className={inputCls} placeholder="Sunday Million" />
              </Field>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="Buy-in">
                  <input type="text" inputMode="decimal" required value={buyinTorneo} onChange={(e) => setBuyinTorneo(e.target.value)} className={inputCls} placeholder="100" />
                </Field>
                <Field label="Comisión">
                  <input type="text" inputMode="decimal" value={comision} onChange={(e) => setComision(e.target.value)} className={inputCls} placeholder="9" />
                </Field>
                <Field label="Re-entries">
                  <input type="number" min="0" value={rebuys} onChange={(e) => setRebuys(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Add-ons">
                  <input type="number" min="0" value={addons} onChange={(e) => setAddons(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Entrantes totales">
                  <input type="number" min="1" value={entrantes} onChange={(e) => setEntrantes(e.target.value)} className={inputCls} placeholder="450" />
                </Field>
                <Field label="Posición final">
                  <input type="number" min="1" value={posicion} onChange={(e) => setPosicion(e.target.value)} className={inputCls} placeholder="12" />
                </Field>
                <Field label="Estructura">
                  <select value={estructura} onChange={(e) => setEstructura(e.target.value)} className={inputCls}>
                    {ESTRUCTURAS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="Premio del pozo">
                  <input type="text" inputMode="decimal" value={premioPozo} onChange={(e) => setPremioPozo(e.target.value)} className={inputCls} placeholder="0" />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={lateReg} onChange={(e) => setLateReg(e.target.checked)} className="rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500" />
                Entré por late registration
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-300 pt-1 border-t border-gray-700">
                <input type="checkbox" checked={esBounty} onChange={(e) => setEsBounty(e.target.checked)} className="rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500" />
                Es un torneo bounty / knockout
              </label>

              {esBounty && (
                <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Tipo de bounty">
                    <select value={tipoBounty} onChange={(e) => setTipoBounty(e.target.value)} className={inputCls}>
                      <option value="normal">Normal</option>
                      <option value="progressive">Progressive (PKO)</option>
                    </select>
                  </Field>
                  <Field label="Bounties cobrados">
                    <input type="number" min="0" value={bountiesCobrados} onChange={(e) => setBountiesCobrados(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Ganancia por bounties">
                    <input type="text" inputMode="decimal" value={gananciaBounty} onChange={(e) => setGananciaBounty(e.target.value)} className={inputCls} placeholder="35" />
                  </Field>
                  <p className="col-span-full text-xs text-amber-200/70">
                    Cargá por separado lo que ganaste por knockouts y lo que ganaste del pozo de premios — así las estadísticas de bounty quedan precisas (% ITM, ROI, ganancia por recompensas vs. premios).
                  </p>
                </div>
              )}
            </div>
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
              {loading ? 'Guardando…' : initial ? 'Guardar cambios' : 'Cargar sesión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

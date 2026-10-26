import { useMemo, useState } from 'react'
import { ArrowDownUp, Beaker, BookOpenCheck, Info, Leaf, RotateCcw, SlidersHorizontal, Waves } from 'lucide-react'
import { MetabolicFlow } from './MetabolicFlow'

export type Balance = {
  sucroseOutput: number
  piCyt: number
  trioseCyt: number
  piStroma: number
  trioseStroma: number
}

export type Derived = {
  f6p: number; g6p: number; f26bp: number; f26Kinase: number; f26Bisphosphatase: number
  sucrosePool: number; starch: number; sps: number; fbpase: number; agpase: number
  tpt: number; sucroseFlux: number; starchFlux: number
}

const INITIAL: Balance = { sucroseOutput: 55, piCyt: 42, trioseCyt: 58, piStroma: 55, trioseStroma: 45 }
const clamp = (v: number) => Math.max(0, Math.min(100, v))

type Scenario = {
  id: string
  title: string
  question: string
  focus: string
  state: Balance
}

const SCENARIOS: Scenario[] = [
  {
    id: 'baseline',
    title: 'Equilibrio basal',
    question: '¿Cómo se reparte el carbono en una hoja con demanda moderada?',
    focus: 'Compara el flujo a sacarosa y almidón y toma este estado como referencia.',
    state: INITIAL,
  },
  {
    id: 'phloem',
    title: 'Exportación sostenida',
    question: '¿Qué ocurre si el floema retira sacarosa de forma constante?',
    focus: 'Observa la retroinhibición de SPS, el depósito de sacarosa y el sentido del TPT.',
    state: { sucroseOutput: 88, piCyt: 50, trioseCyt: 50, piStroma: 35, trioseStroma: 65 },
  },
  {
    id: 'blocked',
    title: 'Floema interrumpido',
    question: '¿Qué ocurre cuando cesa bruscamente la salida de sacarosa?',
    focus: 'Busca acumulación de sacarosa, retroinhibición de SPS y redistribución hacia el cloroplasto.',
    state: { sucroseOutput: 0, piCyt: 20, trioseCyt: 80, piStroma: 58, trioseStroma: 42 },
  },
  {
    id: 'pi-cyt',
    title: 'Pi alto en citosol',
    question: '¿Cómo responde la ruta si se acumula Pi citosólico?',
    focus: 'Sigue la inhibición de SPS y el control de F6P-2-quinasa, F2,6BPasa y FBPasa.',
    state: { sucroseOutput: 35, piCyt: 82, trioseCyt: 18, piStroma: 30, trioseStroma: 70 },
  },
  {
    id: 'pi-stroma',
    title: 'Pi alto en estroma',
    question: '¿Qué sucede con la síntesis de almidón cuando aumenta el Pi estromático?',
    focus: 'Observa la relación 3-PGA/Pi, la inhibición de AGPasa y la caída del flujo a almidón.',
    state: { sucroseOutput: 55, piCyt: 35, trioseCyt: 65, piStroma: 82, trioseStroma: 18 },
  },
  {
    id: 'starch',
    title: 'Carbono en estroma',
    question: '¿Qué ocurre cuando abundan las triosas-P y escasea el Pi en el estroma?',
    focus: 'Comprueba la activación de AGPasa y el aumento del flujo hacia almidón.',
    state: { sucroseOutput: 35, piCyt: 55, trioseCyt: 45, piStroma: 20, trioseStroma: 80 },
  },
]

function derive(s: Balance): Derived {
  const f6p = clamp(s.trioseCyt * .78)
  const g6p = clamp(f6p * 1.06)
  const f26Kinase = clamp(18 + f6p * .75 + s.piCyt * .22 - s.trioseCyt * .08)
  const f26Bisphosphatase = clamp(72 - s.piCyt * .46)
  const f26bp = clamp(f26Kinase * .72 + (100 - f26Bisphosphatase) * .28)
  const fbpase = clamp(100 - f26bp * .72)
  const sucrosePool = clamp(g6p * .72 - s.sucroseOutput * .28 + 24)
  const feedback = sucrosePool > 70 ? (100 - sucrosePool) * 1.7 : 100
  const sps = clamp((g6p * .62 + (100 - s.piCyt) * .38) * feedback / 100)
  const agpRatio = s.trioseStroma / Math.max(8, s.piStroma)
  const agpase = clamp(agpRatio * 64)
  const starch = clamp(s.trioseStroma * .76 + agpase * .24)
  const outward = s.trioseStroma * s.piCyt
  const inward = s.trioseCyt * s.piStroma
  const tpt = clamp(Math.abs(outward - inward) / 32) * Math.sign(outward - inward)
  const sucroseFlux = clamp(s.sucroseOutput * (sps / 100) * 1.35)
  const starchFlux = clamp(agpase * s.trioseStroma / 76)
  return { f6p, g6p, f26bp, f26Kinase, f26Bisphosphatase, sucrosePool, starch, sps, fbpase, agpase, tpt, sucroseFlux, starchFlux }
}

function Slider({ label, value, color, hint, onChange }: { label: string; value: number; color: string; hint: string; onChange: (v: number) => void }) {
  return <label className="balance-slider" style={{ '--accent': color } as React.CSSProperties}>
    <span><b>{label}</b><output>{value}%</output></span>
    <input type="range" min="0" max="100" value={value} onChange={e => onChange(Number(e.target.value))} />
    <small>{hint}</small>
  </label>
}

export default function App() {
  const [state, setState] = useState<Balance>(INITIAL)
  const [scenarioId, setScenarioId] = useState('baseline')
  const d = useMemo(() => derive(state), [state])
  const activeScenario = SCENARIOS.find(scenario => scenario.id === scenarioId)
  const setCustomState = (updater: (current: Balance) => Balance) => {
    setScenarioId('custom')
    setState(updater)
  }
  const setPiCyt = (v: number) => setCustomState(s => ({ ...s, piCyt: v, trioseCyt: 100 - v }))
  const setTrioseCyt = (v: number) => setCustomState(s => ({ ...s, trioseCyt: v, piCyt: 100 - v }))
  const setPiStroma = (v: number) => setCustomState(s => ({ ...s, piStroma: v, trioseStroma: 100 - v }))
  const setTrioseStroma = (v: number) => setCustomState(s => ({ ...s, trioseStroma: v, piStroma: 100 - v }))
  const setSucroseOutput = (v: number) => {
    setScenarioId('custom')
    setState(s => {
      const piCyt = clamp(22 + v * .58)
      return { ...s, sucroseOutput: v, piCyt, trioseCyt: 100 - piCyt }
    })
  }
  const selectScenario = (scenario: Scenario) => {
    setScenarioId(scenario.id)
    setState({ ...scenario.state })
  }
  const reset = () => selectScenario(SCENARIOS[0])

  return <div className="app">
    <header className="app-header">
      <div className="brand"><span><Leaf /></span><div><b>Destino del carbono</b><small>Mapa metabólico interactivo con React Flow</small></div></div>
      <div className="technology"><Beaker />React Flow · notación bioquímica</div>
    </header>
    <main className="layout">
      <aside className="controls">
        <div className="panel-heading"><SlidersHorizontal /><div><span>CONTROLES</span><h2>Modula el equilibrio</h2></div></div>
        <p className="intro">Los cambios se aplican directamente al mapa: concentraciones, actividad enzimática, regulación y grosor de los flujos.</p>
        <Slider label="Salida de sacarosa" value={state.sucroseOutput} color="#c77626" onChange={setSucroseOutput} hint="Retirada hacia los órganos sumidero." />
        <div className="pair-title"><ArrowDownUp /><span>Citosol</span><small>Pi + triosas-P = 100%</small></div>
        <Slider label="Pi citosólico" value={state.piCyt} color="#477eb2" onChange={setPiCyt} hint="Su aumento disminuye las triosas-P citosólicas." />
        <Slider label="Triosas-P citosólicas" value={state.trioseCyt} color="#b88228" onChange={setTrioseCyt} hint="Sustrato para la síntesis de sacarosa." />
        <div className="pair-sum"><i style={{ width: `${state.piCyt}%` }} /><span>Balance conservado</span></div>
        <div className="pair-title"><Waves /><span>Estroma</span><small>Pi + triosas-P = 100%</small></div>
        <Slider label="Pi estromático" value={state.piStroma} color="#477eb2" onChange={setPiStroma} hint="Modula negativamente AGPasa." />
        <Slider label="Triosas-P estromáticas" value={state.trioseStroma} color="#438357" onChange={setTrioseStroma} hint="Proporcionan carbono para el almidón." />
        <div className="pair-sum stroma"><i style={{ width: `${state.piStroma}%` }} /><span>Balance conservado</span></div>
        <button className="reset" onClick={reset}><RotateCcw />Restablecer</button>
      </aside>

      <section className="workspace">
        <div className="scenario-panel">
          <div className="scenario-heading"><BookOpenCheck /><div><span>CASOS FISIOLÓGICOS</span><h2>Elige una situación y observa la respuesta</h2></div></div>
          <div className="scenario-list" role="list" aria-label="Casos fisiológicos predefinidos">
            {SCENARIOS.map(scenario => <button
              key={scenario.id}
              className={scenarioId === scenario.id ? 'active' : ''}
              aria-pressed={scenarioId === scenario.id}
              onClick={() => selectScenario(scenario)}
            ><b>{scenario.title}</b><span>{scenario.question}</span></button>)}
          </div>
          <div className={`scenario-prompt ${activeScenario ? '' : 'custom'}`}>
            <b>{activeScenario ? activeScenario.question : 'Exploración libre'}</b>
            <span>{activeScenario ? activeScenario.focus : 'Has modificado un control. Compara este estado con cualquiera de los casos predefinidos.'}</span>
          </div>
        </div>
        <div className="metrics">
          <div><span>Flujo a sacarosa</span><b>{d.sucroseFlux.toFixed(0)}%</b></div>
          <div><span>Flujo a almidón</span><b>{d.starchFlux.toFixed(0)}%</b></div>
          <div><span>Actividad SPS</span><b>{d.sps.toFixed(0)}%</b></div>
          <div><span>TPT neto</span><b>{Math.abs(d.tpt).toFixed(0)}% {d.tpt >= 0 ? '→ citosol' : '→ estroma'}</b></div>
        </div>
        <div className="map-card">
          <div className="map-title"><div><span>MAPA BIOQUÍMICO INTERACTIVO</span><h1>Partición del carbono fotosintético</h1></div><div className="map-legend"><i className="low" />Bajo<i className="normal" />Medio<i className="high" />Alto<i className="critical" />Umbral</div></div>
          <MetabolicFlow balance={state} derived={d} />
          <div className="sbgn-key"><span><b>□</b> metabolito</span><span><b>○</b> proceso</span><span><b>→</b> dirigida</span><span><b>⇄</b> reversible</span><span><b>⊣</b> inhibición</span><span><b>△</b> activación</span></div>
        </div>
        <div className="interpretation"><Info /><div><b>Respuesta regulatoria</b><p>{d.sucrosePool >= 70 ? 'La sacarosa acumulada ejerce retroinhibición sobre SPS. ' : d.sps < 25 ? 'La síntesis de sacarosa está limitada por la disponibilidad de sustrato y Pi. ' : 'SPS mantiene capacidad para sostener la síntesis de sacarosa. '}{state.piCyt >= 65 ? 'El Pi citosólico alto inhibe SPS y modifica el balance entre F6P-2-quinasa y F2,6BPasa. ' : ''}{state.piStroma >= 65 ? 'El Pi estromático reduce la relación 3-PGA/Pi e inhibe AGPasa. ' : d.agpase >= 70 ? 'La relación carbono/Pi activa AGPasa y favorece el almidón. ' : 'La formación de almidón responde al balance carbono/Pi. '}El TPT mantiene el intercambio antiparalelo de triosas-P y Pi.</p></div></div>
      </section>
    </main>
  </div>
}

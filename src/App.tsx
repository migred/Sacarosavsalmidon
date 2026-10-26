import { useMemo, useState } from 'react'
import { ArrowDownUp, Beaker, BookOpenCheck, Info, Leaf, RotateCcw, SlidersHorizontal, Waves } from 'lucide-react'
import { MetabolicFlow } from './MetabolicFlow'

export type Controls = {
  carbonFixation: number
  sinkDemand: number
  phosphatePool: number
  piDistribution: number
  tptCapacity: number
}

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
  sucroseShare: number; starchShare: number; intermediateShare: number
  piCytShare: number; piStromaShare: number; trioseCytShare: number; trioseStromaShare: number
}

type Model = { balance: Balance; derived: Derived }
type Scenario = { id: string; title: string; question: string; focus: string; controls: Controls }

const INITIAL: Controls = { carbonFixation: 70, sinkDemand: 55, phosphatePool: 65, piDistribution: 50, tptCapacity: 75 }
const clamp = (v: number) => Math.max(0, Math.min(100, v))

const SCENARIOS: Scenario[] = [
  { id:'baseline', title:'Equilibrio basal', question:'¿Cómo se reparte el carbono con fijación y demanda moderadas?', focus:'Utiliza este estado como referencia para comparar los otros casos.', controls:INITIAL },
  { id:'phloem', title:'Exportación sostenida', question:'¿Qué ocurre si el floema retira sacarosa constantemente?', focus:'Observa el depósito de sacarosa, SPS y el sentido del TPT.', controls:{carbonFixation:85,sinkDemand:90,phosphatePool:65,piDistribution:60,tptCapacity:90} },
  { id:'blocked', title:'Floema interrumpido', question:'¿Qué ocurre cuando cesa bruscamente la salida de sacarosa?', focus:'Busca acumulación de sacarosa, retroinhibición de SPS y redistribución del carbono.', controls:{carbonFixation:85,sinkDemand:0,phosphatePool:65,piDistribution:45,tptCapacity:75} },
  { id:'pi-cyt', title:'Pi alto en citosol', question:'¿Cómo responde la ruta si el Pi se concentra en el citosol?', focus:'Sigue la regulación de SPS, F6P-2-quinasa, F2,6BPasa y FBPasa.', controls:{carbonFixation:70,sinkDemand:45,phosphatePool:85,piDistribution:85,tptCapacity:80} },
  { id:'pi-stroma', title:'Pi alto en estroma', question:'¿Qué sucede con el almidón si el Pi se concentra en el estroma?', focus:'Observa la relación 3-PGA/Pi, AGPasa y el flujo hacia almidón.', controls:{carbonFixation:70,sinkDemand:55,phosphatePool:85,piDistribution:15,tptCapacity:80} },
  { id:'starch', title:'Fijación alta, sumidero bajo', question:'¿Dónde se almacena el carbono cuando la fijación supera a la exportación?', focus:'Compara sacarosa acumulada, intermediarios y activación de AGPasa.', controls:{carbonFixation:95,sinkDemand:25,phosphatePool:60,piDistribution:65,tptCapacity:55} },
]

function derive(c: Controls): Model {
  // El 100 % representa el depósito de fosfato intercambiable. Una parte está libre
  // (Pi) y otra unida a triosas-P/intermediarios fosforilados.
  const phosphateScale = .35 + c.phosphatePool * .0065
  const boundP = clamp(12 + c.carbonFixation * .45 + (100 - c.sinkDemand) * .10)
  const freeP = 100 - boundP
  const piCytShare = freeP * c.piDistribution / 100
  const piStromaShare = freeP - piCytShare

  // La fijación aporta carbono; la demanda del sumidero consume las triosas citosólicas.
  // La capacidad del TPT determina cuánto se aproximan ambos compartimentos al equilibrio.
  const cytTrioseFraction = clamp(55 - c.sinkDemand * .30 + (100 - c.tptCapacity) * .10 + (c.piDistribution - 50) * .10) / 100
  const trioseCytShare = boundP * cytTrioseFraction
  const trioseStromaShare = boundP - trioseCytShare
  const asConcentration = (share: number) => clamp(share * 2 * phosphateScale)

  const piCyt = asConcentration(piCytShare)
  const piStroma = asConcentration(piStromaShare)
  const trioseCyt = asConcentration(trioseCytShare)
  const trioseStroma = asConcentration(trioseStromaShare)
  const balance: Balance = { sucroseOutput:c.sinkDemand, piCyt, trioseCyt, piStroma, trioseStroma }

  const f6p = clamp(trioseCyt * .82)
  const g6p = clamp(f6p * 1.06)
  const f26Kinase = clamp(16 + f6p * .55 + piCyt * .32)
  const f26Bisphosphatase = clamp(78 - piCyt * .48 + trioseCyt * .12)
  const f26bp = clamp(f26Kinase * .68 + (100 - f26Bisphosphatase) * .32)
  const fbpase = clamp(100 - f26bp * .72)
  const sucrosePool = clamp(18 + c.carbonFixation * .65 + trioseCyt * .35 - c.sinkDemand * .65)
  const feedback = sucrosePool > 70 ? clamp((100 - sucrosePool) * 1.7) : 100
  const sps = clamp((g6p * .62 + (100 - piCyt) * .38) * feedback / 100)
  const agpRatio = trioseStroma / Math.max(8, piStroma)
  const agpase = clamp(agpRatio * 64)
  const outward = trioseStroma * piCyt
  const inward = trioseCyt * piStroma
  const tptDrive = clamp(Math.abs(outward - inward) / 30) * Math.sign(outward - inward)
  const tpt = tptDrive * c.tptCapacity / 100

  // Reparto de un mismo presupuesto de carbono. Las tres fracciones se normalizan
  // conjuntamente y, por definición, suman el 100 % del carbono fijado.
  const sucroseWeight = Math.max(.5, c.sinkDemand * (.25 + .75 * sps / 100) * (.35 + .65 * c.tptCapacity / 100))
  const starchWeight = Math.max(.5, ((100 - c.sinkDemand) * .30 + agpase * .70) * (.40 + .60 * trioseStroma / 100) * (1 - c.sinkDemand * .0055))
  const intermediateWeight = Math.max(5, 14 + (100 - c.tptCapacity) * .16 + (100 - sps) * .08 + (100 - agpase) * .05 + sucrosePool * .10)
  const weightTotal = sucroseWeight + starchWeight + intermediateWeight
  const sucroseShare = sucroseWeight / weightTotal * 100
  const starchShare = starchWeight / weightTotal * 100
  const intermediateShare = 100 - sucroseShare - starchShare
  const throughput = c.carbonFixation / 100
  const sucroseFlux = clamp(c.carbonFixation * sps / 100)
  const starchFlux = starchShare * throughput
  const starch = clamp(12 + starchFlux * .88)

  return { balance, derived:{ f6p,g6p,f26bp,f26Kinase,f26Bisphosphatase,sucrosePool,starch,sps,fbpase,agpase,tpt,sucroseFlux,starchFlux,sucroseShare,starchShare,intermediateShare,piCytShare,piStromaShare,trioseCytShare,trioseStromaShare } }
}

function Slider({label,value,color,hint,onChange}:{label:string;value:number;color:string;hint:string;onChange:(v:number)=>void}){
  return <label className="balance-slider" style={{'--accent':color} as React.CSSProperties}>
    <span><b>{label}</b><output>{value}%</output></span>
    <input type="range" min="0" max="100" value={value} onChange={e=>onChange(Number(e.target.value))}/>
    <small>{hint}</small>
  </label>
}

export default function App(){
  const [controls,setControls]=useState<Controls>(INITIAL)
  const [scenarioId,setScenarioId]=useState('baseline')
  const {balance,derived:d}=useMemo(()=>derive(controls),[controls])
  const activeScenario=SCENARIOS.find(s=>s.id===scenarioId)
  const setControl=(field:keyof Controls,value:number)=>{setScenarioId('custom');setControls(s=>({...s,[field]:value}))}
  const selectScenario=(scenario:Scenario)=>{setScenarioId(scenario.id);setControls({...scenario.controls})}
  const reset=()=>selectScenario(SCENARIOS[0])

  return <div className="app">
    <header className="app-header">
      <div className="brand"><span><Leaf/></span><div><b>Destino del carbono</b><small>Balance de carbono y fosfato con React Flow</small></div></div>
      <div className="technology"><Beaker/>Modelo didáctico de estado estacionario</div>
    </header>
    <main className="layout">
      <aside className="controls">
        <div className="panel-heading"><SlidersHorizontal/><div><span>CONDICIONES EXTERNAS</span><h2>Modula el sistema</h2></div></div>
        <p className="intro">Las concentraciones internas ya no son controles independientes: se calculan conservando el fosfato y repartiendo el carbono fijado.</p>
        <Slider label="Fijación de carbono" value={controls.carbonFixation} color="#438357" onChange={v=>setControl('carbonFixation',v)} hint="Entrada de carbono desde el ciclo de Calvin."/>
        <Slider label="Demanda del floema" value={controls.sinkDemand} color="#c77626" onChange={v=>setControl('sinkDemand',v)} hint="Capacidad del sumidero para retirar sacarosa."/>
        <div className="pair-title"><ArrowDownUp/><span>Fosfato</span><small>depósito global conservado</small></div>
        <Slider label="Fosfato intercambiable" value={controls.phosphatePool} color="#477eb2" onChange={v=>setControl('phosphatePool',v)} hint="Tamaño relativo del depósito Pi + metabolitos fosforilados."/>
        <Slider label="Pi libre situado en citosol" value={controls.piDistribution} color="#477eb2" onChange={v=>setControl('piDistribution',v)} hint={`${100-controls.piDistribution}% del Pi libre queda en el estroma.`}/>
        <div className="pair-title"><Waves/><span>Transporte</span><small>intercambio acoplado</small></div>
        <Slider label="Capacidad del TPT" value={controls.tptCapacity} color="#7a8150" onChange={v=>setControl('tptCapacity',v)} hint="Limita el antiporte triosa-P/Pi sin alterar su estequiometría."/>
        <div className="phosphate-readout">
          <div><span>Pi citosol</span><b>{d.piCytShare.toFixed(1)}%</b></div><div><span>Pi estroma</span><b>{d.piStromaShare.toFixed(1)}%</b></div>
          <div><span>Triosas-P citosol</span><b>{d.trioseCytShare.toFixed(1)}%</b></div><div><span>Triosas-P estroma</span><b>{d.trioseStromaShare.toFixed(1)}%</b></div>
          <strong>Σ fosfato intercambiable = {(d.piCytShare+d.piStromaShare+d.trioseCytShare+d.trioseStromaShare).toFixed(0)}%</strong>
        </div>
        <button className="reset" onClick={reset}><RotateCcw/>Restablecer</button>
      </aside>

      <section className="workspace">
        <div className="scenario-panel">
          <div className="scenario-heading"><BookOpenCheck/><div><span>CASOS FISIOLÓGICOS</span><h2>Elige una situación y observa la respuesta</h2></div></div>
          <div className="scenario-list" role="list" aria-label="Casos fisiológicos predefinidos">
            {SCENARIOS.map(s=><button key={s.id} className={scenarioId===s.id?'active':''} aria-pressed={scenarioId===s.id} onClick={()=>selectScenario(s)}><b>{s.title}</b><span>{s.question}</span></button>)}
          </div>
          <div className={`scenario-prompt ${activeScenario?'':'custom'}`}><b>{activeScenario?activeScenario.question:'Exploración libre'}</b><span>{activeScenario?activeScenario.focus:'Has modificado una condición. Compara el nuevo reparto con un caso predefinido.'}</span></div>
        </div>

        <div className="carbon-budget">
          <div className="budget-heading"><div><span>PRESUPUESTO DEL CARBONO FIJADO</span><b>Los destinos suman 100%</b></div><strong>Entrada relativa: {controls.carbonFixation}%</strong></div>
          <div className="budget-bar" aria-label="Distribución del carbono fijado"><i className="to-sucrose" style={{width:`${d.sucroseShare}%`}}/><i className="to-starch" style={{width:`${d.starchShare}%`}}/><i className="retained" style={{width:`${d.intermediateShare}%`}}/></div>
          <div className="budget-legend"><span><i className="to-sucrose"/>Sacarosa exportada <b>{d.sucroseShare.toFixed(1)}%</b></span><span><i className="to-starch"/>Almidón <b>{d.starchShare.toFixed(1)}%</b></span><span><i className="retained"/>Carbono soluble <b>{d.intermediateShare.toFixed(1)}%</b></span></div>
        </div>

        <div className="metrics">
          <div><span>Actividad SPS</span><b>{d.sps.toFixed(0)}%</b></div>
          <div><span>Actividad FBPasa</span><b>{d.fbpase.toFixed(0)}%</b></div>
          <div><span>Actividad AGPasa</span><b>{d.agpase.toFixed(0)}%</b></div>
          <div><span>TPT neto</span><b>{Math.abs(d.tpt).toFixed(0)}% {d.tpt>=0?'→ citosol':'→ estroma'}</b></div>
        </div>
        <div className="map-card">
          <div className="map-title"><div><span>MAPA BIOQUÍMICO INTERACTIVO</span><h1>Partición del carbono fotosintético</h1></div><div className="map-legend"><i className="low"/>Bajo<i className="normal"/>Medio<i className="high"/>Alto<i className="critical"/>Umbral</div></div>
          <MetabolicFlow balance={balance} derived={d}/>
          <div className="sbgn-key"><span><b>□</b> metabolito</span><span><b>○</b> proceso</span><span><b>→</b> dirigida</span><span><b>⇄</b> reversible</span><span><b>⊣</b> inhibición</span><span><b>△</b> activación</span></div>
        </div>
        <div className="interpretation"><Info/><div><b>Respuesta regulatoria</b><p>{d.sucrosePool>=70?'La sacarosa acumulada ejerce retroinhibición sobre SPS. ':d.sps<25?'La síntesis de sacarosa está limitada por sustrato o por Pi. ':'SPS conserva capacidad para sostener la síntesis de sacarosa. '}{balance.piCyt>=65?'El Pi citosólico alto inhibe SPS y modifica el balance F6P-2-quinasa/F2,6BPasa. ':''}{balance.piStroma>=65?'El Pi estromático reduce la relación 3-PGA/Pi e inhibe AGPasa. ':d.agpase>=70?'La relación carbono/Pi activa AGPasa y favorece el almidón. ':'AGPasa responde al balance carbono/Pi. '}El TPT intercambia una triosa-P por un Pi, sin cambiar el fosfato total.</p></div></div>
      </section>
    </main>
  </div>
}

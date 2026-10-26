import { useMemo, useState } from 'react'
import { ArrowDownUp, Beaker, BookOpenCheck, Info, Leaf, RotateCcw, SlidersHorizontal, Waves } from 'lucide-react'
import { MetabolicFlow } from './MetabolicFlow'

export type Controls = {
  phloemLoading: number
  phosphatePool: number
  cytosolicPi: number
  cytosolicTriose: number
  phase: 'day' | 'night'
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
  tpt: number; tptExtent: number; sucroseFlux: number; starchFlux: number
  sucroseShare: number; starchShare: number; intermediateShare: number
  piCytShare: number; piStromaShare: number; trioseCytShare: number; trioseStromaShare: number
}

type Model = { balance: Balance; derived: Derived }
type Scenario = { id: string; title: string; question: string; focus: string; controls: Controls }

const DAY_CARBON_FIXATION = 80
const INITIAL: Controls = { phloemLoading: 60, phosphatePool: 65, cytosolicPi: 42, cytosolicTriose:60, phase:'day' }
const clamp = (v: number) => Math.max(0, Math.min(100, v))

function applyTptAntiport(piCyt:number,piStroma:number,trioseCyt:number,trioseStroma:number){
  // TPest + Picit <-> TPcit + Piest. Para K≈1, la extensión que elimina
  // el desequilibrio es (TPest·Picit - TPcit·Piest) / depósito total.
  const total = piCyt + piStroma + trioseCyt + trioseStroma
  const drive = trioseStroma * piCyt - trioseCyt * piStroma
  const equilibriumExtent = total > 0 ? drive / total : 0
  const requestedExtent = equilibriumExtent
  const maxForward = Math.min(trioseStroma,piCyt)
  const maxReverse = Math.min(trioseCyt,piStroma)
  const extent = Math.max(-maxReverse,Math.min(maxForward,requestedExtent))
  const limitingPool = extent >= 0 ? maxForward : maxReverse
  const relativeFlux = limitingPool > 0 ? Math.abs(extent) / limitingPool * 100 * Math.sign(extent) : 0
  return {
    piCyt:piCyt-extent,
    piStroma:piStroma+extent,
    trioseCyt:trioseCyt+extent,
    trioseStroma:trioseStroma-extent,
    extent,
    relativeFlux,
  }
}

const SCENARIOS: Scenario[] = [
  { id:'day', title:'Día · estado basal', question:'¿Cómo se reparte el carbono con luz y carga floemática moderada?', focus:'La fijación diurna permanece constante; utiliza este estado como referencia.', controls:INITIAL },
  { id:'phloem', title:'Carga floemática alta', question:'¿Qué ocurre si el floema retira sacarosa constantemente?', focus:'Observa el depósito de sacarosa, SPS y el sentido espontáneo del TPT.', controls:{phloemLoading:92,phosphatePool:65,cytosolicPi:55,cytosolicTriose:45,phase:'day'} },
  { id:'blocked', title:'Cierre de carga', question:'¿Qué ocurre cuando cesa bruscamente la carga del floema?', focus:'Busca acumulación de sacarosa, retroinhibición de SPS y desvío hacia almidón.', controls:{phloemLoading:0,phosphatePool:65,cytosolicPi:38,cytosolicTriose:72,phase:'day'} },
  { id:'night', title:'Noche', question:'¿Cómo cambia el reparto sin fijación de CO₂ y con movilización de reservas?', focus:'Compara el suministro nocturno desde almidón con el estado diurno.', controls:{phloemLoading:35,phosphatePool:58,cytosolicPi:58,cytosolicTriose:42,phase:'night'} },
  { id:'pi-cyt', title:'Pi alto en citosol', question:'¿Cómo responde la ruta cuando aumenta la cuota celular de Pi citosólico?', focus:'Comprueba que bajan Pi estromático y triosas-P y sigue la regulación enzimática.', controls:{phloemLoading:45,phosphatePool:85,cytosolicPi:90,cytosolicTriose:45,phase:'day'} },
  { id:'pi-stroma', title:'Pi bajo en citosol', question:'¿Qué sucede cuando el reparto favorece el Pi del estroma?', focus:'Observa la relación 3-PGA/Pi, AGPasa y el sentido del TPT.', controls:{phloemLoading:55,phosphatePool:85,cytosolicPi:8,cytosolicTriose:55,phase:'day'} },
  { id:'triose', title:'Acumulación de triosas-P', question:'¿Qué pasa cuando se eleva la triosa-P citosólica?', focus:'Observa cómo cambia la orientación del antiporte y cómo responde el Pi citosólico.', controls:{phloemLoading:12,phosphatePool:48,cytosolicPi:24,cytosolicTriose:92,phase:'day'} },
]

function derive(c: Controls): Model {
  // El 100 % representa el depósito de fosfato intercambiable. Una parte está libre
  // (Pi) y otra unida a triosas-P/intermediarios fosforilados.
  const phosphateScale = .35 + c.phosphatePool * .0065
  const carbonInput = c.phase === 'day' ? DAY_CARBON_FIXATION : 26
  const retention = 100 - c.phloemLoading

  // Ambos deslizadores cambian la composición celular antes del equilibrio del TPT.
  // Elevar TPcit desplaza TP hacia el estroma y Pi en sentido contrario.
  const compositionWeights = {
    piCyt: 8 + c.cytosolicPi * .92,
    piStroma: 86 - c.cytosolicPi * .58 + (c.phase === 'night' ? 12 : 0),
    trioseCyt: 18 + c.cytosolicTriose * .62 + retention * .16 - c.cytosolicPi * .10,
    trioseStroma: 102 - c.cytosolicTriose * .46 + carbonInput * .18 + retention * .18 - c.cytosolicPi * .16,
  }
  const compositionTotal = Object.values(compositionWeights).reduce((sum,value)=>sum+Math.max(2,value),0)
  const share = (value:number) => Math.max(2,value) / compositionTotal * 100
  const initialPiCytShare = share(compositionWeights.piCyt)
  const initialPiStromaShare = share(compositionWeights.piStroma)
  const initialTrioseCytShare = share(compositionWeights.trioseCyt)
  const initialTrioseStromaShare = share(compositionWeights.trioseStroma)

  // El TPT no tiene control de velocidad: alcanza el sentido dictado por los cocientes
  // TP/Pi de ambos compartimentos y conserva por separado Pi y triosa-P.
  const transported = applyTptAntiport(initialPiCytShare,initialPiStromaShare,initialTrioseCytShare,initialTrioseStromaShare)
  const {piCyt:piCytShare,piStroma:piStromaShare,trioseCyt:trioseCytShare,trioseStroma:trioseStromaShare}=transported
  const asConcentration = (share: number) => clamp(share * 2 * phosphateScale)

  const piCyt = asConcentration(piCytShare)
  const piStroma = asConcentration(piStromaShare)
  const trioseCyt = asConcentration(trioseCytShare)
  const trioseStroma = asConcentration(trioseStromaShare)
  const balance: Balance = { sucroseOutput:c.phloemLoading, piCyt, trioseCyt, piStroma, trioseStroma }

  const f6p = clamp(trioseCyt * .82)
  const g6p = clamp(f6p * 1.06)
  // Regulación del ciclo F6P/F2,6BP según el esquema de referencia:
  // F6P y Pi activan la quinasa; las triosas-P la inhiben. Pi y F6P inhiben la fosfatasa.
  const f26Kinase = clamp(16 + f6p * .65 + piCyt * .38 - trioseCyt * .25)
  const f26Bisphosphatase = clamp(78 - piCyt * .48 - f6p * .32)
  const f26bp = clamp(f26Kinase * .68 + (100 - f26Bisphosphatase) * .32)
  const fbpase = clamp(100 - f26bp * .72)
  const sucrosePool = clamp(12 + carbonInput * .72 + trioseCyt * .35 - c.phloemLoading * .68 + (c.phase==='night'?8:0))
  const feedback = sucrosePool > 70 ? clamp((100 - sucrosePool) * 1.7) : 100
  const sps = clamp((g6p * .62 + (100 - piCyt) * .38) * feedback / 100)
  const agpRatio = trioseStroma / Math.max(8, piStroma)
  const agpase = clamp(agpRatio * 64)
  const tpt = transported.relativeFlux
  const tptExtent = transported.extent

  // Reparto de un mismo presupuesto de carbono. Las tres fracciones se normalizan
  // conjuntamente y, por definición, suman el 100 % del carbono fijado.
  const sucroseWeight = Math.max(.5, c.phloemLoading * (.25 + .75 * sps / 100))
  const starchWeight = c.phase==='night' ? 1 : Math.max(.5, (retention * .30 + agpase * .70) * (.40 + .60 * trioseStroma / 100) * (1 - c.phloemLoading * .0055))
  const intermediateWeight = Math.max(5, 14 + (100 - sps) * .08 + (100 - agpase) * .05 + sucrosePool * .10 + (c.phase==='night'?16:0))
  const weightTotal = sucroseWeight + starchWeight + intermediateWeight
  const sucroseShare = sucroseWeight / weightTotal * 100
  const starchShare = starchWeight / weightTotal * 100
  const intermediateShare = 100 - sucroseShare - starchShare
  const throughput = carbonInput / 100
  const sucroseFlux = clamp(carbonInput * sps / 100)
  const starchFlux = starchShare * throughput
  const starch = clamp(12 + starchFlux * .88)

  return { balance, derived:{ f6p,g6p,f26bp,f26Kinase,f26Bisphosphatase,sucrosePool,starch,sps,fbpase,agpase,tpt,tptExtent,sucroseFlux,starchFlux,sucroseShare,starchShare,intermediateShare,piCytShare,piStromaShare,trioseCytShare,trioseStromaShare } }
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
  const [scenarioId,setScenarioId]=useState('day')
  const {balance,derived:d}=useMemo(()=>derive(controls),[controls])
  const activeScenario=SCENARIOS.find(s=>s.id===scenarioId)
  const setControl=(field:Exclude<keyof Controls,'phase'>,value:number)=>{setScenarioId('custom');setControls(s=>({...s,[field]:value}))}
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
        <p className="intro">La fijación de CO₂ se mantiene constante durante el día. Ajusta la carga floemática y el reparto celular del fosfato.</p>
        <div className={`phase-badge ${controls.phase}`}><b>{controls.phase==='day'?'Día':'Noche'}</b><span>{controls.phase==='day'?`Fijación de CO₂ fija: ${DAY_CARBON_FIXATION}%`:'Sin fijación de CO₂ · movilización de reservas'}</span></div>
        <Slider label="Carga floemática" value={controls.phloemLoading} color="#c77626" onChange={v=>setControl('phloemLoading',v)} hint="Retirada de sacarosa: al disminuir, la sacarosa se acumula."/>
        <div className="pair-title"><ArrowDownUp/><span>Fosfato</span><small>depósito global conservado</small></div>
        <Slider label="Fosfato intercambiable" value={controls.phosphatePool} color="#477eb2" onChange={v=>setControl('phosphatePool',v)} hint="Tamaño relativo del depósito Pi + metabolitos fosforilados."/>
        <Slider label="Cuota de Pi citosólico" value={controls.cytosolicPi} color="#477eb2" onChange={v=>setControl('cytosolicPi',v)} hint="Al subir, disminuyen Pi estromático y las fracciones de triosa-P; el total sigue siendo 100%."/>
        <Slider label="Triosas-P en citosol" value={controls.cytosolicTriose} color="#ad772b" onChange={v=>setControl('cytosolicTriose',v)} hint="Al subir, aumenta TP citosólica y el antiporte acoplado modifica el Pi citosólico; si domina el gradiente, Pi entra desde el estroma."/>
        <div className="pair-title"><Waves/><span>TPT automático</span><small>sin control de velocidad</small></div>
        <div className="phosphate-readout">
          <div><span>Pi citosol</span><b>{d.piCytShare.toFixed(1)}%</b></div><div><span>Pi estroma</span><b>{d.piStromaShare.toFixed(1)}%</b></div>
          <div><span>Triosas-P citosol</span><b>{d.trioseCytShare.toFixed(1)}%</b></div><div><span>Triosas-P estroma</span><b>{d.trioseStromaShare.toFixed(1)}%</b></div>
          <strong>Σ fosfato intercambiable = {(d.piCytShare+d.piStromaShare+d.trioseCytShare+d.trioseStromaShare).toFixed(0)}%</strong>
          <small className="tpt-coupling">{Math.abs(d.tptExtent)<.05?'TPT en equilibrio':d.tptExtent>0?`Orientación automática: triosa-P → citosol y Pi → estroma (${Math.abs(d.tptExtent).toFixed(1)}%)`:`Orientación automática: triosa-P → estroma y Pi → citosol (${Math.abs(d.tptExtent).toFixed(1)}%)`}</small>
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
          <div className="budget-heading"><div><span>{controls.phase==='day'?'PRESUPUESTO DEL CARBONO FIJADO':'PRESUPUESTO DEL CARBONO DISPONIBLE'}</span><b>Los destinos suman 100%</b></div><strong>{controls.phase==='day'?`Fijación diurna fija: ${DAY_CARBON_FIXATION}%`:'Aporte desde reservas: 26%'}</strong></div>
          <div className="budget-bar" aria-label="Distribución del carbono fijado"><i className="to-sucrose" style={{width:`${d.sucroseShare}%`}}/><i className="to-starch" style={{width:`${d.starchShare}%`}}/><i className="retained" style={{width:`${d.intermediateShare}%`}}/></div>
          <div className="budget-legend"><span><i className="to-sucrose"/>Sacarosa exportada <b>{d.sucroseShare.toFixed(1)}%</b></span><span><i className="to-starch"/>{controls.phase==='day'?'Almidón almacenado':'Almidón remanente'} <b>{d.starchShare.toFixed(1)}%</b></span><span><i className="retained"/>Carbono soluble <b>{d.intermediateShare.toFixed(1)}%</b></span></div>
        </div>

        <aside className="experimental-reference" aria-label="Referencia experimental">
          <div><span>REFERENCIA EXPERIMENTAL · <i>Arabidopsis</i> ILUMINADA</span><b>Flujos estimados mediante marcaje con <sup>13</sup>CO₂</b></div>
          <dl><div><dt>Síntesis de sacarosa</dt><dd>7,11 nmol C·g⁻¹ PF·s⁻¹</dd></div><div><dt>Síntesis de almidón</dt><dd>3,19 nmol C·g⁻¹ PF·s⁻¹</dd></div><div><dt>Relación sacarosa/almidón</dt><dd>2,2 : 1</dd></div><div><dt>DHAP</dt><dd>77% citosol · 23% plastidio</dd></div></dl>
          <p>El intercambio TPT fue lo bastante rápido para tratar DHAP y 3-PGA citosólicos y plastídicos como depósitos en equilibrio isotópico; el artículo no proporciona un flujo neto único del TPT transferible directamente a este simulador.</p>
          <a href="https://doi.org/10.1105/tpc.112.106989" target="_blank" rel="noreferrer">Szecowka et al., 2013 · The Plant Cell ↗</a>
        </aside>

        <div className="metrics">
          <div><span>Actividad SPS</span><b>{d.sps.toFixed(0)}%</b></div>
          <div><span>Actividad FBPasa</span><b>{d.fbpase.toFixed(0)}%</b></div>
          <div><span>Actividad AGPasa</span><b>{d.agpase.toFixed(0)}%</b></div>
          <div><span>TPT neto</span><b>{Math.abs(d.tpt).toFixed(0)}% {d.tpt>=0?'→ citosol':'→ estroma'}</b></div>
        </div>
        <div className="map-card">
          <div className="map-title"><div><span>MAPA BIOQUÍMICO INTERACTIVO</span><h1>Partición del carbono fotosintético</h1></div><div className="map-legend"><i className="low"/>Bajo<i className="normal"/>Medio<i className="high"/>Alto<i className="critical"/>Umbral</div></div>
          <MetabolicFlow balance={balance} derived={d}/>
          <div className="sbgn-key"><span><b>□</b> metabolito</span><span><b>○</b> proceso</span><span><b>→</b> dirigida</span><span><b>⇄</b> reversible</span><span><b>⊣</b> inhibición</span><span><b>△</b> activación</span><span><b>Pi repetido:</b> réplicas del mismo depósito</span><span><b>Regulación:</b> se muestra la señal dominante</span><span><b>Enzima:</b> rojo baja · ámbar media · verde alta</span><span><b>Pasa el cursor</b> para explicar su actividad</span></div>
        </div>
        <div className="interpretation"><Info/><div><b>Respuesta regulatoria</b><p>{d.sucrosePool>=70?'La sacarosa acumulada ejerce retroinhibición sobre SPS. ':d.sps<25?'La síntesis de sacarosa está limitada por sustrato o por Pi. ':'SPS conserva capacidad para sostener la síntesis de sacarosa. '}{balance.piCyt>=65?'El Pi citosólico alto inhibe SPS y modifica el balance F6P-2-quinasa/F2,6BPasa. ':''}{balance.piStroma>=65?'El Pi estromático reduce la relación 3-PGA/Pi e inhibe AGPasa. ':d.agpase>=70?'La relación carbono/Pi activa AGPasa y favorece el almidón. ':'AGPasa responde al balance carbono/Pi. '}El TPT intercambia una triosa-P por un Pi, sin cambiar el fosfato total.</p></div></div>
      </section>
    </main>
  </div>
}

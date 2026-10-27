import { useMemo, useState } from 'react'
import { Beaker, BookOpenCheck, Info, Leaf, Moon, Sun, Waves } from 'lucide-react'
import { MetabolicFlow } from './MetabolicFlow'

export type Phase = 'day' | 'night'
export type CaseParameters = { phase:Phase; phloemLoading:number; phosphatePool:number; cytosolicPiBias:number; cytosolicTrioseBias:number; photoassimilation:number; starchDegradation:number; reserveLevel:number }
export type Balance = { sucroseOutput:number; piCyt:number; trioseCyt:number; piStroma:number; trioseStroma:number }
export type Derived = {
  f6p:number; g6p:number; f26bp:number; f26Kinase:number; f26Bisphosphatase:number
  sucrosePool:number; starch:number; maltose:number; glucose:number; sps:number; fbpase:number; agpase:number
  tpt:number; tptExtent:number; sucroseFlux:number; starchSynthesisFlux:number; starchDegradationFlux:number
  sucroseShare:number; starchShare:number; intermediateShare:number
  piCytShare:number; piStromaShare:number; trioseCytShare:number; trioseStromaShare:number
  carbonInput:number; photoassimilation:number; reserveSupply:number
}
export type Model = { balance:Balance; derived:Derived }
type Scenario = { id:string; group:'Día'|'Noche'|'Estrés'; title:string; question:string; focus:string; params:CaseParameters }

const clamp=(v:number)=>Math.max(0,Math.min(100,v))

function applyTptAntiport(piCyt:number,piStroma:number,trioseCyt:number,trioseStroma:number){
  const total=piCyt+piStroma+trioseCyt+trioseStroma
  const drive=trioseStroma*piCyt-trioseCyt*piStroma
  const equilibriumExtent=total>0?drive/total:0
  const maxForward=Math.min(trioseStroma,piCyt)
  const maxReverse=Math.min(trioseCyt,piStroma)
  const extent=Math.max(-maxReverse,Math.min(maxForward,equilibriumExtent))
  const limitingPool=extent>=0?maxForward:maxReverse
  const relativeFlux=limitingPool>0?Math.abs(extent)/limitingPool*100*Math.sign(extent):0
  return {piCyt:piCyt-extent,piStroma:piStroma+extent,trioseCyt:trioseCyt+extent,trioseStroma:trioseStroma-extent,extent,relativeFlux}
}

export const SCENARIOS:Scenario[]=[
  {id:'day-normal',group:'Día',title:'Carga normal',question:'¿Cómo se reparte el carbono en una hoja iluminada?',focus:'Referencia para todas las flechas cualitativas.',params:{phase:'day',phloemLoading:60,phosphatePool:65,cytosolicPiBias:42,cytosolicTrioseBias:60,photoassimilation:80,starchDegradation:0,reserveLevel:55}},
  {id:'day-high',group:'Día',title:'Carga floemática alta',question:'¿Qué ocurre cuando el floema retira sacarosa con rapidez?',focus:'Aumenta la demanda de sacarosa y se reduce su acumulación.',params:{phase:'day',phloemLoading:92,phosphatePool:65,cytosolicPiBias:55,cytosolicTrioseBias:43,photoassimilation:80,starchDegradation:0,reserveLevel:48}},
  {id:'day-low',group:'Día',title:'Carga floemática baja',question:'¿Qué ocurre cuando disminuye la exportación de sacarosa?',focus:'La sacarosa se acumula, retroinhibe SPS y desvía carbono.',params:{phase:'day',phloemLoading:24,phosphatePool:65,cytosolicPiBias:36,cytosolicTrioseBias:76,photoassimilation:80,starchDegradation:0,reserveLevel:68}},
  {id:'day-closed',group:'Día',title:'Cierre del floema',question:'¿Qué ocurre si se interrumpe la carga floemática?',focus:'Caso extremo de acumulación y retroinhibición por sacarosa.',params:{phase:'day',phloemLoading:0,phosphatePool:63,cytosolicPiBias:30,cytosolicTrioseBias:90,photoassimilation:80,starchDegradation:0,reserveLevel:78}},
  {id:'night-early',group:'Noche',title:'Noche temprana',question:'¿Cómo se mantiene el suministro al comenzar la noche?',focus:'Cesa la fijación de CO₂ y domina la degradación de almidón.',params:{phase:'night',phloemLoading:42,phosphatePool:60,cytosolicPiBias:58,cytosolicTrioseBias:48,photoassimilation:0,starchDegradation:78,reserveLevel:78}},
  {id:'night-late',group:'Noche',title:'Noche avanzada',question:'¿Qué ocurre cuando la reserva de almidón está casi agotada?',focus:'Disminuyen maltosa, glucosa y el suministro de carbono.',params:{phase:'night',phloemLoading:24,phosphatePool:58,cytosolicPiBias:62,cytosolicTrioseBias:30,photoassimilation:0,starchDegradation:34,reserveLevel:28}},
  {id:'pi-limited',group:'Estrés',title:'Limitación de Pi',question:'¿Cómo responde la partición cuando escasea el Pi intercambiable?',focus:'Se reduce el reciclado de Pi y cambia la relación 3-PGA/Pi.',params:{phase:'day',phloemLoading:48,phosphatePool:30,cytosolicPiBias:28,cytosolicTrioseBias:76,photoassimilation:68,starchDegradation:0,reserveLevel:62}},
]

export function derive(c:CaseParameters):Model{
  const phosphateScale=.35+c.phosphatePool*.0065
  const reserveSupply=c.phase==='night'?c.starchDegradation*.72:0
  const carbonInput=c.photoassimilation+reserveSupply
  const retention=100-c.phloemLoading
  const compositionWeights={
    piCyt:8+c.cytosolicPiBias*.92+(c.phase==='night'?8:0),
    piStroma:86-c.cytosolicPiBias*.58+(c.phase==='night'?12:0),
    trioseCyt:18+c.cytosolicTrioseBias*.62+retention*.16-c.cytosolicPiBias*.10+(c.phase==='night'?reserveSupply*.18:0),
    trioseStroma:102-c.cytosolicTrioseBias*.46+c.photoassimilation*.18+retention*.18-c.cytosolicPiBias*.16-(c.phase==='night'?22:0),
  }
  const compositionTotal=Object.values(compositionWeights).reduce((sum,value)=>sum+Math.max(2,value),0)
  const share=(value:number)=>Math.max(2,value)/compositionTotal*100
  const transported=applyTptAntiport(share(compositionWeights.piCyt),share(compositionWeights.piStroma),share(compositionWeights.trioseCyt),share(compositionWeights.trioseStroma))
  const {piCyt:piCytShare,piStroma:piStromaShare,trioseCyt:trioseCytShare,trioseStroma:trioseStromaShare}=transported
  const asConcentration=(value:number)=>clamp(value*2*phosphateScale)
  const piCyt=asConcentration(piCytShare), piStroma=asConcentration(piStromaShare)
  const trioseCyt=asConcentration(trioseCytShare), trioseStroma=asConcentration(trioseStromaShare)
  const balance:Balance={sucroseOutput:c.phloemLoading,piCyt,trioseCyt,piStroma,trioseStroma}
  const f6p=clamp(trioseCyt*.82+(c.phase==='night'?reserveSupply*.16:0))
  const g6p=clamp(f6p*1.06+(c.phase==='night'?reserveSupply*.18:0))
  const f26Kinase=clamp(16+f6p*.65+piCyt*.38-trioseCyt*.25)
  const f26Bisphosphatase=clamp(78-piCyt*.48-f6p*.32)
  const f26bp=clamp(50+(f26Kinase-f26Bisphosphatase)*1.6)
  const fbpase=clamp(100-f26bp*.88)
  const sucrosePool=clamp(12+carbonInput*.72+trioseCyt*.35-c.phloemLoading*.68+(c.phase==='night'?reserveSupply*.12:0))
  const feedback=sucrosePool>70?clamp((100-sucrosePool)*1.7):100
  const sps=clamp((g6p*.62+(100-piCyt)*.38)*feedback/100)
  const agpRatio=trioseStroma/Math.max(8,piStroma)
  const agpase=clamp(agpRatio*64*(c.phase==='day'?1:.08))
  const starchDegradationFlux=c.phase==='night'?clamp(c.starchDegradation*(.55+c.reserveLevel*.0045)):0
  const maltose=clamp(starchDegradationFlux*.94), glucose=clamp(starchDegradationFlux*.72)
  const sucroseWeight=Math.max(.5,c.phloemLoading*(.25+.75*sps/100))
  const starchWeight=c.phase==='day'?Math.max(.5,(retention*.30+agpase*.70)*(.40+.60*trioseStroma/100)*(1-c.phloemLoading*.0055)):Math.max(.5,starchDegradationFlux*.22)
  const intermediateWeight=Math.max(5,14+(100-sps)*.08+(100-agpase)*.05+sucrosePool*.10+(c.phase==='night'?maltose*.12+glucose*.10:0))
  const weightTotal=sucroseWeight+starchWeight+intermediateWeight
  const sucroseShare=sucroseWeight/weightTotal*100, starchShare=starchWeight/weightTotal*100
  const intermediateShare=100-sucroseShare-starchShare
  const starchSynthesisFlux=c.phase==='day'?clamp(starchShare*carbonInput/100):clamp(agpase*.08)
  const starch=c.phase==='night'?clamp(c.reserveLevel-starchDegradationFlux*.18):clamp(12+c.reserveLevel*.38+starchSynthesisFlux*.62)
  return {balance,derived:{f6p,g6p,f26bp,f26Kinase,f26Bisphosphatase,sucrosePool,starch,maltose,glucose,sps,fbpase,agpase,tpt:transported.relativeFlux,tptExtent:transported.extent,sucroseFlux:clamp(carbonInput*sps/100),starchSynthesisFlux,starchDegradationFlux,sucroseShare,starchShare,intermediateShare,piCytShare,piStromaShare,trioseCytShare,trioseStromaShare,carbonInput,photoassimilation:c.photoassimilation,reserveSupply}}
}

const BASELINE=derive(SCENARIOS[0].params)

export default function App(){
  const [scenarioId,setScenarioId]=useState('day-normal')
  const scenario=SCENARIOS.find(item=>item.id===scenarioId)??SCENARIOS[0]
  const {balance,derived:d}=useMemo(()=>derive(scenario.params),[scenario])
  const groups=(['Día','Noche','Estrés'] as const)
  return <div className="app">
    <header className="app-header"><div className="brand"><span><Leaf/></span><div><b>Destino del carbono</b><small>Casos fisiológicos y regulación metabólica</small></div></div><div className="technology"><Beaker/>Modelo continuo · lectura cualitativa</div></header>
    <main className="layout">
      <aside className="controls case-sidebar">
        <div className="panel-heading"><BookOpenCheck/><div><span>CASOS FISIOLÓGICOS</span><h2>Elige una situación</h2></div></div>
        <p className="intro">Cada caso fija luz, carga floemática y estado de las reservas. El sistema recalcula automáticamente metabolitos, enzimas y flujos.</p>
        <div className={`phase-badge ${scenario.params.phase}`}>{scenario.params.phase==='day'?<Sun/>:<Moon/>}<div><b>{scenario.params.phase==='day'?'Día':'Noche'}</b><span>{scenario.params.phase==='day'?'Fotosíntesis activa':'Sin fijación de CO₂ · movilización de almidón'}</span></div></div>
        <div className="scenario-list" role="list" aria-label="Casos fisiológicos predefinidos">{groups.map(group=><section key={group}><h3>{group}</h3>{SCENARIOS.filter(item=>item.group===group).map(item=><button key={item.id} className={scenarioId===item.id?'active':''} aria-pressed={scenarioId===item.id} onClick={()=>setScenarioId(item.id)}><b>{item.title}</b><span>{item.question}</span></button>)}</section>)}</div>
        <div className="scenario-prompt"><b>{scenario.question}</b><span>{scenario.focus}</span></div>
        <div className="qualitative-key"><b>Concentración respecto al día basal</b><div><span>↓↓</span>muy baja</div><div><span>↓</span>baja</div><div><span className="normal-word">normal</span>sin flecha</div><div><span>↑</span>alta</div><div><span>↑↑</span>muy alta</div></div>
        <div className="pair-title"><Waves/><span>TPT automático</span><small>sin control manual</small></div>
        <p className="tpt-summary">{Math.abs(d.tptExtent)<.05?'Antiporte próximo al equilibrio.':d.tptExtent>0?'Triosa-P hacia citosol y Pi hacia estroma.':'Triosa-P hacia estroma y Pi hacia citosol.'}</p>
      </aside>
      <section className="workspace">
        <div className="case-summary"><div><span>CASO ACTIVO</span><h2>{scenario.group} · {scenario.title}</h2></div><p>{scenario.focus}</p></div>
        <div className="carbon-budget"><div className="budget-heading"><div><span>{scenario.params.phase==='day'?'PRESUPUESTO DEL CARBONO FIJADO':'CARBONO SUMINISTRADO POR LA RESERVA'}</span><b>Los destinos suman 100%</b></div><strong>{scenario.params.phase==='day'?`Fotoasimilación relativa: ${d.photoassimilation.toFixed(0)}%`:`Movilización de almidón: ${d.reserveSupply.toFixed(0)}%`}</strong></div><div className="budget-bar"><i className="to-sucrose" style={{width:`${d.sucroseShare}%`}}/><i className="to-starch" style={{width:`${d.starchShare}%`}}/><i className="retained" style={{width:`${d.intermediateShare}%`}}/></div><div className="budget-legend"><span><i className="to-sucrose"/>Sacarosa/exportación <b>{d.sucroseShare.toFixed(1)}%</b></span><span><i className="to-starch"/>{scenario.params.phase==='day'?'Almidón almacenado':'Reserva movilizada'} <b>{d.starchShare.toFixed(1)}%</b></span><span><i className="retained"/>Carbono soluble <b>{d.intermediateShare.toFixed(1)}%</b></span></div></div>
        <aside className="experimental-reference" aria-label="Referencia experimental"><div><span>REFERENCIA EXPERIMENTAL · <i>Arabidopsis</i> ILUMINADA</span><b>Flujos estimados mediante marcaje con <sup>13</sup>CO₂</b></div><dl><div><dt>Síntesis de sacarosa</dt><dd>7,11 nmol C·g⁻¹ PF·s⁻¹</dd></div><div><dt>Síntesis de almidón</dt><dd>3,19 nmol C·g⁻¹ PF·s⁻¹</dd></div><div><dt>Relación sacarosa/almidón</dt><dd>2,2 : 1</dd></div><div><dt>DHAP</dt><dd>77% citosol · 23% plastidio</dd></div></dl><p>Las cifras calibran la escala didáctica diurna; las flechas muestran cambios relativos, no concentraciones absolutas.</p><a href="https://doi.org/10.1105/tpc.112.106989" target="_blank" rel="noreferrer">Szecowka et al., 2013 · The Plant Cell ↗</a></aside>
        <div className="metrics"><div><span>Actividad SPS</span><b>{d.sps.toFixed(0)}%</b></div><div><span>Actividad FBPasa</span><b>{d.fbpase.toFixed(0)}%</b></div><div><span>Actividad AGPasa</span><b>{d.agpase.toFixed(0)}%</b></div><div><span>TPT neto</span><b>{Math.abs(d.tpt).toFixed(0)}% {d.tpt>=0?'→ citosol':'→ estroma'}</b></div></div>
        <div className="map-card"><div className="map-title"><div><span>MAPA BIOQUÍMICO INTERACTIVO</span><h1>Partición del carbono fotosintético</h1></div><div className="map-legend"><span>bloqueado</span><i className="flow-blocked"/><span>favorecido</span><i className="flow-strong"/></div></div><MetabolicFlow balance={balance} derived={d} baseline={BASELINE}/><div className="sbgn-key"><span><b>↑ / ↑↑</b> alta / muy alta</span><span><b>↓ / ↓↓</b> baja / muy baja</span><span><b>→</b> dirigida</span><span><b>⇄</b> reversible</span><span><b>⊣</b> inhibición</span><span><b>△</b> activación</span><span><b>Pi repetido:</b> mismo depósito</span><span><b>Regulación:</b> señal dominante</span><span><b>Enzima:</b> rojo baja · ámbar media · verde alta</span></div></div>
        <div className="interpretation"><Info/><div><b>Respuesta regulatoria</b><p>{scenario.params.phase==='night'?'Al cesar la fijación de CO₂, la degradación del almidón aporta maltosa y glucosa. ':''}{d.sucrosePool>=70?'La sacarosa acumulada retroinhibe SPS. ':d.sps<25?'La síntesis de sacarosa está limitada por sustrato o Pi. ':'SPS conserva capacidad para sostener la síntesis de sacarosa. '}{balance.piCyt>=65?'El Pi citosólico alto modifica el balance F6P-2-quinasa/F2,6BPasa. ':''}{balance.piStroma>=65?'El Pi estromático reduce la relación 3-PGA/Pi e inhibe AGPasa. ':d.agpase>=70?'La relación carbono/Pi activa AGPasa y favorece el almidón. ':''}El TPT intercambia una triosa-P por un Pi y conserva el fosfato total.</p></div></div>
      </section>
    </main>
  </div>
}

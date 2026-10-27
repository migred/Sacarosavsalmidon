import { memo, useMemo, useRef, useState } from 'react'
import {
  Background, BaseEdge, Controls, Handle, MarkerType, Position, ReactFlow,
  getBezierPath, getSmoothStepPath, getStraightPath, type EdgeProps, type Node, type NodeProps, type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Balance, Derived, Model } from './App'

type Props = { balance: Balance; derived: Derived; baseline: Model }
type RegulationReason = { kind:'activation'|'inhibition'|'context'; text:string }
type Trend = 'very-low'|'low'|'normal'|'high'|'very-high'
type FlowData = { label: string; value?: number; reference?: number; activity?: number; compartment?: 'cytosol' | 'chloroplast'; note?: string; tone?: string; kind?: string; active?: boolean; strength?: number; flux?: number; production?: boolean; forwardFlux?: number; reverseFlux?: number; route?: 'left'|'right'|'top'|'bottom'|'elbow'; corridor?: number; waypoints?: {x:number;y:number}[]; reasons?: RegulationReason[]; tooltipSide?:'above'|'below' }
type EnzymePopover = { x:number; y:number; side:'left'|'right'; label:string; activity:number; reasons:RegulationReason[] }

const clamp = (v:number) => Math.max(0,Math.min(100,v))
const trend=(value=0,reference=0):Trend=>{
  if(reference<=2){
    if(value<=2)return 'normal'
    return value<=45?'high':'very-high'
  }
  const ratio=value/reference
  return ratio<=.55?'very-low':ratio<=.80?'low':ratio<=1.20?'normal':ratio<=1.60?'high':'very-high'
}
const trendArrow=(state:Trend)=>state==='very-low'?'↓↓':state==='low'?'↓':state==='high'?'↑':state==='very-high'?'↑↑':''
const trendWord=(state:Trend)=>state==='very-low'?'muy baja':state==='low'?'baja':state==='high'?'alta':state==='very-high'?'muy alta':'normal'

function FourHandles() {
  return <>
    {([Position.Top, Position.Right, Position.Bottom, Position.Left] as Position[]).map(p => <span key={p}>
      <Handle type="source" position={p} id={`s-${p}`} className="bio-handle" />
      <Handle type="target" position={p} id={`t-${p}`} className="bio-handle" />
    </span>)}
  </>
}

function EnzymeHandles(){
  const sides=[Position.Top,Position.Right,Position.Bottom,Position.Left] as Position[]
  return <>
    {sides.map(position=><Handle key={`source-${position}`} type="source" position={position} id={`s-${position}`} className="bio-handle"/>)}
    {sides.flatMap(position=>[1,2,3].map(slot=>{
      const along=`${slot*25}%`
      const style=position===Position.Left||position===Position.Right?{top:along}:{left:along}
      return <Handle key={`${position}-${slot}`} type="target" position={position} id={`t-reg-${position}-${slot}`} className="reg-handle" style={style}/>
    }))}
  </>
}

const MetaboliteNode = memo(({ data }: NodeProps) => {
  const d = data as FlowData
  const state=trend(d.value,d.reference)
  return <div className={`metabolite-node ${state}`} title={`${d.label}: concentración ${trendWord(state)}`}><FourHandles /><b>{d.label}</b><strong>{trendArrow(state)||<span className="normal-word">normal</span>}</strong>{d.note && <small>{d.note}</small>}</div>
})

const PiAliasNode = memo(({data}:NodeProps)=>{
  const d=data as FlowData
  const state=trend(d.value,d.reference)
  return <div className={`pi-alias ${state}`} title={`Pi: concentración ${trendWord(state)} · réplica visual del mismo depósito`}><FourHandles/><b>Pi</b><small>{trendArrow(state)||'normal'}</small></div>
})

const ProcessNode = memo(({ data }: NodeProps) => {
  const d = data as FlowData
  return <div className="process-node" title={d.label}><FourHandles /><span /></div>
})

const EnzymeNode = memo(({ data }: NodeProps) => {
  const d = data as FlowData
  const activity=d.activity??0
  const activityClass=activity<25?'activity-low':activity<55?'activity-medium':activity<80?'activity-high':'activity-very-high'
  const summary=(d.reasons??[]).map(reason=>reason.text).join('. ')
  return <div className={`enzyme-node ${activityClass}`} aria-label={`${d.label}, actividad ${Math.round(activity)}%. ${summary}`}>
    <EnzymeHandles /><b>{d.label}</b><span>Actividad {Math.round(activity)}%</span><i><em style={{ width:`${activity}%` }} /></i>
  </div>
})

const TransportNode = memo(({ data }: NodeProps) => {
  const d = data as FlowData
  return <div className="transport-node"><FourHandles /><b>TPT</b><span>{Math.round(d.activity ?? 0)}%</span><small>{d.note}</small></div>
})

const CompartmentNode = memo(({ data }: NodeProps) => {
  const d = data as FlowData
  return <div className={`compartment-node ${d.compartment}`}><b>{d.label}</b><span>{d.note}</span></div>
})

const ReactionEdge = memo((props: EdgeProps) => {
  const d = props.data as FlowData | undefined
  const [path] = getSmoothStepPath(props)
  const flux=d?.flux??0
  const blocked=flux<6
  const width = blocked?.75:1.25+flux/22
  return <BaseEdge path={path} markerEnd={props.markerEnd} style={{ stroke:'#435b4e', strokeWidth:width, strokeDasharray:blocked?'4 5':undefined, opacity:blocked?.35:.86 }} />
})

const RegulatoryEdge = memo((props: EdgeProps) => {
  const d = props.data as FlowData | undefined
  const kind = d?.kind ?? 'activation'
  const endpointGap=kind==='catalysis'?0:8
  const endX=props.targetX+(props.targetPosition===Position.Left?-endpointGap:props.targetPosition===Position.Right?endpointGap:0)
  const endY=props.targetY+(props.targetPosition===Position.Top?-endpointGap:props.targetPosition===Position.Bottom?endpointGap:0)
  const [curve] = getBezierPath({sourceX:props.sourceX,sourceY:props.sourceY,targetX:endX,targetY:endY,sourcePosition:props.sourcePosition,targetPosition:props.targetPosition})
  const waypointPath = d?.waypoints?.length ? `M ${props.sourceX} ${props.sourceY} ${d.waypoints.map(p=>`L ${p.x} ${p.y}`).join(' ')} L ${endX} ${endY}` : undefined
  const path = waypointPath ?? (d?.route === 'left' || d?.route === 'right'
    ? `M ${props.sourceX} ${props.sourceY} L ${d.corridor} ${props.sourceY} L ${d.corridor} ${endY} L ${endX} ${endY}`
    : d?.route === 'top' || d?.route === 'bottom'
      ? `M ${props.sourceX} ${props.sourceY} L ${props.sourceX} ${d.corridor} L ${endX} ${d.corridor} L ${endX} ${endY}`
      : curve)
  const active = d?.active ?? false
  const strength=clamp(d?.strength??(active?100:0))
  const color = kind === 'inhibition' ? '#b72f2b' : kind === 'catalysis' ? '#70528f' : '#247c43'
  const width=kind==='catalysis'?1.8+strength/65:2.4+strength/24
  const opacity=active ? .78+strength/455 : .42+strength/555
  const verticalTarget = props.targetPosition === Position.Left || props.targetPosition === Position.Right
  const barHalf=9+strength*.035
  const bar = kind === 'inhibition' && (verticalTarget
    ? <line x1={endX} y1={endY-barHalf} x2={endX} y2={endY+barHalf} />
    : <line x1={endX-barHalf} y1={endY} x2={endX+barHalf} y2={endY} />)
  return <g className={`reg-edge ${kind}`} style={{ opacity }}>
    {kind!=='catalysis'&&<BaseEdge path={path} style={{stroke:'#fffdf4',strokeWidth:width+3.5,opacity:.92}}/>}
    <BaseEdge path={path} markerEnd={kind === 'activation' ? props.markerEnd : undefined} style={{ stroke:color, strokeWidth:width, strokeDasharray:kind==='catalysis'?'5 3':undefined }} />
    {bar && <g stroke={color} strokeWidth={Math.max(3,width)}>{bar}</g>}
    {kind === 'catalysis' && <circle cx={endX} cy={endY} r="4.5" fill="white" stroke={color} strokeWidth="2.5" />}
  </g>
})

const BidirectionalEdge = memo((props: EdgeProps) => {
  const d = props.data as FlowData | undefined
  const dx = props.targetX - props.sourceX
  const dy = props.targetY - props.sourceY
  const length = Math.max(1, Math.hypot(dx,dy))
  const nx = -dy / length * 5
  const ny = dx / length * 5
  const cornerX=(props.sourceX+props.targetX)/2
  const elbow=d?.route==='elbow'
  const forward = elbow
    ? `M ${props.sourceX} ${props.sourceY+5} L ${cornerX+5} ${props.sourceY+5} L ${cornerX+5} ${props.targetY+5} L ${props.targetX} ${props.targetY+5}`
    : `M ${props.sourceX+nx} ${props.sourceY+ny} L ${props.targetX+nx} ${props.targetY+ny}`
  const reverse = elbow
    ? `M ${props.targetX} ${props.targetY-5} L ${cornerX-5} ${props.targetY-5} L ${cornerX-5} ${props.sourceY-5} L ${props.sourceX} ${props.sourceY-5}`
    : `M ${props.targetX-nx} ${props.targetY-ny} L ${props.sourceX-nx} ${props.sourceY-ny}`
  const width = (flux=0) => .9 + flux / 22
  const forwardBlocked=(d?.forwardFlux??0)<6
  const reverseBlocked=(d?.reverseFlux??0)<6
  return <g className="bidirectional-edge">
    <BaseEdge path={forward} markerEnd={props.markerEnd} style={{stroke:'#435b4e',strokeWidth:forwardBlocked?.75:width(d?.forwardFlux),strokeDasharray:forwardBlocked?'4 5':undefined,opacity:forwardBlocked?.3:.88}} />
    <BaseEdge path={reverse} markerEnd={props.markerEnd} style={{stroke:'#87968d',strokeWidth:reverseBlocked?.75:width(d?.reverseFlux),strokeDasharray:reverseBlocked?'4 5':undefined,opacity:reverseBlocked?.3:.78}} />
  </g>
})

const TptEdge = memo((props: EdgeProps) => {
  const d = props.data as FlowData | undefined
  const [path] = getStraightPath(props)
  const isPi = d?.kind === 'pi'
  return <BaseEdge path={path} markerEnd={props.markerEnd} style={{
    stroke:isPi ? '#477eb2' : '#ad772b',
    strokeWidth:2.2 + (d?.flux ?? 0) / 25,
    opacity:.9,
  }} />
})

const nodeTypes = { metabolite:MetaboliteNode, piAlias:PiAliasNode, process:ProcessNode, enzyme:EnzymeNode, transport:TransportNode, compartment:CompartmentNode }
const edgeTypes = { reaction:ReactionEdge, regulatory:RegulatoryEdge, reversible:BidirectionalEdge, tpt:TptEdge }

const met = (id:string,label:string,value:number,parentId:string,x:number,y:number,note?:string,width=104) => ({ id,type:'metabolite',parentId,extent:'parent' as const,position:{x,y},data:{label,value,note},style:{width,height:58},draggable:false })
const piAlias=(id:string,value:number,parentId:string,x:number,y:number)=>({id,type:'piAlias',parentId,extent:'parent' as const,position:{x,y},data:{label:'Pi',value},style:{width:46,height:46},draggable:false,selectable:false})
const proc = (id:string,label:string,parentId:string|undefined,x:number,y:number) => ({ id,type:'process',parentId,extent:parentId?'parent' as const:undefined,position:{x,y},data:{label},style:{width:18,height:18},draggable:false })
const enz = (id:string,label:string,activity:number,parentId:string,x:number,y:number,width=92,height=38,reasons:RegulationReason[]=[],tooltipSide:'above'|'below'='above') => ({ id,type:'enzyme',parentId,extent:'parent' as const,position:{x,y},data:{label,activity,reasons,tooltipSide},style:{width,height},draggable:false })
const reaction = (id:string,source:string,target:string,flux:number,sourceHandle:string,targetHandle:string,production=false) => ({ id,type:'reaction',source,target,sourceHandle,targetHandle,data:{flux,production},markerEnd:production?{type:MarkerType.ArrowClosed,color:'#435b4e',width:9,height:9}:undefined,selectable:false })
const regulation = (id:string,source:string,target:string,kind:'activation'|'inhibition'|'catalysis',active:boolean,strength:number,sourceHandle:string,targetHandle:string,route?:FlowData['route'],corridor?:number,waypoints?:FlowData['waypoints']) => ({ id,type:'regulatory',source,target,sourceHandle,targetHandle,data:{kind,active,strength,route,corridor,waypoints},markerEnd:kind==='activation'?{type:MarkerType.ArrowClosed,color:'#247c43',width:8+strength*.018,height:8+strength*.018}:undefined,selectable:false })
const reversible = (id:string,source:string,target:string,forwardFlux:number,reverseFlux:number,sourceHandle:string,targetHandle:string,route?:'elbow') => ({ id,type:'reversible',source,target,sourceHandle,targetHandle,data:{forwardFlux,reverseFlux,route},markerEnd:{type:MarkerType.ArrowClosed,color:'#435b4e',width:8,height:8},selectable:false })
const transport = (id:string,source:string,target:string,kind:'pi'|'triose',flux:number,sourceHandle:string,targetHandle:string) => ({ id,type:'tpt',source,target,sourceHandle,targetHandle,data:{kind,flux},markerEnd:{type:MarkerType.ArrowClosed,color:kind==='pi'?'#477eb2':'#ad772b',width:10,height:10},selectable:false })

function makeElements(b:Balance,d:Derived,baseline:Model) {
  const activator=(label:string,value:number,threshold=45):RegulationReason=>value>=threshold
    ? {kind:'activation',text:`${label} elevado favorece la actividad`}
    : {kind:'context',text:`${label} bajo aporta poca activación`}
  const inhibitor=(label:string,value:number,threshold=55):RegulationReason=>value>=threshold
    ? {kind:'inhibition',text:`${label} acumulado reprime la enzima`}
    : {kind:'context',text:`${label} bajo alivia la inhibición`}
  const substrate=(label:string,value:number):RegulationReason=>({kind:'context',text:`Disponibilidad de ${label}: ${value<30?'baja':value>70?'alta':'intermedia'}`})
  const pga=Math.min(100,b.trioseStroma*1.25)
  const strongest=<T extends {strength:number},>(signals:T[])=>signals.reduce((winner,signal)=>signal.strength>winner.strength?signal:winner)
  const spsDominant=strongest([
    {id:'g6',label:'activación por G6P',strength:d.g6p*.62},
    {id:'pi',label:'inhibición por Pi citosólico',strength:b.piCyt*.38},
    {id:'sucrose',label:'retroinhibición por sacarosa',strength:Math.max(0,d.sucrosePool-70)/30*100},
  ])
  const f26kDominant=strongest([
    {id:'f6',label:'activación por F6P',strength:d.f6p*.65},
    {id:'pi',label:'activación por Pi citosólico',strength:b.piCyt*.38},
    {id:'triose',label:'inhibición por triosas-P',strength:b.trioseCyt*.25},
  ])
  const agpDominant=strongest([
    {id:'pga',label:'activación por 3-PGA',strength:pga},
    {id:'pi',label:'inhibición por Pi estromático',strength:b.piStroma},
  ])
  const winner=(label:string):RegulationReason=>({kind:'context',text:`Línea visible: ${label}; las señales menores se omiten del mapa`})
  const nodes:any[] = [
    {id:'cytosol',type:'compartment',position:{x:0,y:0},data:{label:'Citosol',note:'síntesis de sacarosa',compartment:'cytosol'},style:{width:720,height:680},draggable:false,selectable:false},
    {id:'chloroplast',type:'compartment',position:{x:840,y:0},data:{label:'Cloroplasto',note:'estroma · síntesis de almidón',compartment:'chloroplast'},style:{width:560,height:680},draggable:false,selectable:false},

    met('sucrose','Sacarosa',d.sucrosePool,'cytosol',300,25,'producto',112), met('s6p','Sacarosa-6P',d.sucroseFlux,'cytosol',300,115),
    met('udp','UDP-glucosa',d.g6p*.55,'cytosol',520,245), met('g1c','G1P',d.g6p*.62,'cytosol',540,335),
    met('g6c','G6P',d.g6p,'cytosol',380,335,'activa SPS'), met('f6c','F6P',d.f6p,'cytosol',210,335),
    met('f16c','F1,6BP',b.trioseCyt*.86,'cytosol',210,430), met('triosec','Triosas-P',b.trioseCyt,'cytosol',580,520,'citosol'),
    met('f26','F2,6BP',d.f26bp,'cytosol',25,335,'regulador'), met('pic','Pi',b.piCyt,'cytosol',600,615,'citosol · fuera'),
    piAlias('pic_sps',b.piCyt,'cytosol',590,170),piAlias('pic_f26k',b.piCyt,'cytosol',65,195),piAlias('pic_f26b',b.piCyt,'cytosol',102,474),
    proc('p_spp','Sacarosa-fosfato fosfatasa','cytosol',343,88),proc('p_sps','Sacarosa-fosfato sintasa','cytosol',343,190),proc('p_fbp','Fructosa-1,6-bisfosfatasa','cytosol',252,398),
    enz('e_spp','Sacarosa-fosfato fosfatasa',d.sucroseFlux,'cytosol',400,72,165,50,[substrate('sacarosa-6P',d.sucroseFlux)],'below'),
    enz('e_sps','Sacarosa-fosfato sintasa',d.sps,'cytosol',405,164,165,52,[activator('G6P',d.g6p,30),inhibitor('Pi citosólico',b.piCyt,55),inhibitor('sacarosa',d.sucrosePool,70),winner(spsDominant.label)],'below'),
    enz('e_udpg','UGPasa',d.g6p,'cytosol',620,298,80,38,[substrate('G1P',d.g6p*.62)]),
    enz('e_pgm_c','PGM',d.g6p,'cytosol',465,290,70,38,[substrate('G6P/G1P',d.g6p)]),
    enz('e_pgi_c','PGI',d.g6p,'cytosol',290,290,70,38,[substrate('F6P/G6P',d.f6p)]),
    enz('e_fbp','Fructosa-1,6-bisfosfatasa',d.fbpase,'cytosol',295,382,180,52,[inhibitor('F2,6BP',d.f26bp,55),substrate('F1,6BP',b.trioseCyt*.86)]),
    enz('e_ald_c','Aldolasa',b.trioseCyt,'cytosol',460,485,92,44,[substrate('triosas-P',b.trioseCyt)]),
    enz('e_f26k','Fructosa-6-fosfato 2-quinasa',d.f26Kinase,'cytosol',40,253,180,56,[activator('F6P',d.f6p,35),activator('Pi citosólico',b.piCyt,55),inhibitor('triosas-P citosólicas',b.trioseCyt,65),winner(f26kDominant.label)]),
    enz('e_f26b','Fructosa-2,6-bisfosfatasa',d.f26Bisphosphatase,'cytosol',35,402,175,52,[inhibitor('Pi citosólico',b.piCyt,55),inhibitor('F6P',d.f6p,35)]),

    met('starch','Almidón',d.starch,'chloroplast',210,25,'reserva',112),met('adpg','ADP-glucosa',d.starchSynthesisFlux,'chloroplast',210,115),
    met('maltose','Maltosa',d.maltose,'chloroplast',28,115,'degradación nocturna',112),met('glucose','Glucosa',d.glucose,'chloroplast',28,220,'degradación nocturna',112),
    met('g1s','G1P',b.trioseStroma*.58,'chloroplast',210,215),met('g6s','G6P',b.trioseStroma*.66,'chloroplast',210,305),
    met('f6s','F6P',b.trioseStroma*.76,'chloroplast',210,395),met('f16s','F1,6BP',b.trioseStroma*.86,'chloroplast',210,485),
    met('trioses','Triosas-P',b.trioseStroma,'chloroplast',25,520,'estroma'),met('pga','3-PGA',pga,'chloroplast',415,520),
    met('pis','Pi',b.piStroma,'chloroplast',10,615,'estroma · dentro'),
    piAlias('pis_agp',b.piStroma,'chloroplast',300,162),
    proc('p_starch','Almidón sintasa','chloroplast',253,90),proc('p_agp','ADP-glucosa pirofosforilasa','chloroplast',253,180),proc('p_fbp_s','Fructosa-1,6-bisfosfatasa','chloroplast',253,460),
    enz('e_starch','Almidón sintasa',d.starchSynthesisFlux,'chloroplast',370,70,150,48,[substrate('ADP-glucosa',d.starchSynthesisFlux)],'below'),
    enz('e_agp','ADP-glucosa pirofosforilasa',d.agpase,'chloroplast',365,156,170,52,[activator('3-PGA',pga,40),inhibitor('Pi estromático',b.piStroma,55),winner(agpDominant.label)],'below'),
    enz('e_pgm_s','PGM',b.trioseStroma,'chloroplast',380,270,70,38,[substrate('G1P/G6P',b.trioseStroma*.66)]),
    enz('e_pgi_s','PGI',b.trioseStroma,'chloroplast',380,360,70,38,[substrate('G6P/F6P',b.trioseStroma*.76)]),
    enz('e_fbp_s','Fructosa-1,6-bisfosfatasa',b.trioseStroma,'chloroplast',365,442,175,52,[substrate('F1,6BP',b.trioseStroma*.86)]),
    enz('e_ald_s','Aldolasa',b.trioseStroma,'chloroplast',55,468,92,44,[substrate('triosas-P',b.trioseStroma)]),

    {id:'tpt',type:'transport',position:{x:755,y:572},data:{activity:Math.abs(d.tpt),note:'orientación automática'},style:{width:82,height:48},draggable:false,selectable:false},
  ]
  const edges:any[] = [
    reaction('r_spp_1','s6p','p_spp',d.sucroseFlux,'s-top','t-bottom'),reaction('r_spp_2','p_spp','sucrose',d.sucroseFlux,'s-top','t-bottom',true),
    reaction('r_sps_f6','f6c','p_sps',d.sucroseFlux,'s-top','t-left'),reaction('r_sps_udp','udp','p_sps',d.sucroseFlux,'s-top','t-right'),reaction('r_sps_out','p_sps','s6p',d.sucroseFlux,'s-top','t-bottom',true),
    reversible('bi_udpg','g1c','udp',d.g6p*.62,d.g6p*.28,'s-top','t-bottom'),
    reversible('bi_pgm_c','g6c','g1c',d.g6p*.68,d.g6p*.32,'s-right','t-left'),
    reversible('bi_pgi_c','f6c','g6c',d.f6p*.46,d.g6p*.54,'s-right','t-left'),
    reaction('r_fbp1','f16c','p_fbp',d.fbpase,'s-top','t-bottom'),reaction('r_fbp2','p_fbp','f6c',d.fbpase,'s-top','t-bottom',true),
    reversible('bi_ald_c','triosec','f16c',b.trioseCyt*.7,b.trioseCyt*.3,'s-left','t-right','elbow'),
    reversible('bi_f26','f6c','f26',d.f26Kinase,d.f26Bisphosphatase,'s-left','t-right'),

    reaction('r_starch1','adpg','p_starch',d.starchSynthesisFlux,'s-top','t-bottom'),reaction('r_starch2','p_starch','starch',d.starchSynthesisFlux,'s-top','t-bottom',true),
    reaction('r_starch_deg','starch','maltose',d.starchDegradationFlux,'s-left','t-top',true),reaction('r_maltose_glucose','maltose','glucose',d.starchDegradationFlux*.82,'s-bottom','t-top',true),
    reaction('r_agp1','g1s','p_agp',d.agpase,'s-top','t-bottom'),reaction('r_agp2','p_agp','adpg',d.agpase,'s-top','t-bottom',true),
    reversible('bi_pgm_s','g6s','g1s',b.trioseStroma*.62,b.trioseStroma*.38,'s-top','t-bottom'),
    reversible('bi_pgi_s','f6s','g6s',b.trioseStroma*.56,b.trioseStroma*.44,'s-top','t-bottom'),
    reaction('r_fbp_s1','f16s','p_fbp_s',b.trioseStroma,'s-top','t-bottom'),reaction('r_fbp_s2','p_fbp_s','f6s',b.trioseStroma,'s-top','t-bottom',true),
    reversible('bi_ald_s','trioses','f16s',b.trioseStroma*.72,b.trioseStroma*.28,'s-right','t-left','elbow'),
    reaction('r_pga','pga','trioses',b.trioseStroma,'s-left','t-right',true),

    regulation('cat_spp','e_spp','p_spp','catalysis',true,d.sucroseFlux,'s-left','t-right'),regulation('cat_sps','e_sps','p_sps','catalysis',true,d.sps,'s-left','t-right'),
    regulation('cat_fbp','e_fbp','p_fbp','catalysis',true,d.fbpase,'s-left','t-right'),
    regulation('cat_starch','e_starch','p_starch','catalysis',true,d.starchSynthesisFlux,'s-left','t-right'),regulation('cat_agp','e_agp','p_agp','catalysis',true,d.agpase,'s-left','t-right'),
    regulation('cat_fbp_s','e_fbp_s','p_fbp_s','catalysis',true,b.trioseStroma,'s-left','t-right'),

    regulation('reg_f26_fbp','f26','e_fbp','inhibition',d.f26bp>=55,d.f26bp,'s-left','t-reg-right-2',undefined,undefined,[{x:10,y:364},{x:10,y:540},{x:570,y:540},{x:570,y:408}]),
    regulation('reg_pi_f26b','pic_f26b','e_f26b','inhibition',b.piCyt>=55,b.piCyt,'s-top','t-reg-bottom-2'),
    regulation('reg_pi_sps','pic_sps','e_sps','inhibition',spsDominant.id==='pi',spsDominant.id==='pi'?spsDominant.strength:b.piCyt*.38,'s-left','t-reg-right-2'),
    regulation('reg_pi_f26k','pic_f26k','e_f26k','activation',f26kDominant.id==='pi',f26kDominant.id==='pi'?f26kDominant.strength:b.piCyt*.38,'s-bottom','t-reg-top-1'),
    regulation('reg_pi_agp','pis_agp','e_agp','inhibition',agpDominant.id==='pi',b.piStroma,'s-right','t-reg-left-2'),
    regulation('reg_f6_f26b','f6c','e_f26b','inhibition',d.f6p>=35,d.f6p,'s-bottom','t-reg-right-2',undefined,undefined,[{x:230,y:393},{x:230,y:428}]),
  ]
  // Salida superior de G6P: el corredor libre evita la tarjeta de FBPasa.
  if(spsDominant.id==='g6') edges.push(regulation('reg_g6_sps','g6c','e_sps','activation',true,spsDominant.strength,'s-top','t-reg-bottom-3',undefined,undefined,[{x:432,y:230},{x:529,y:230}]))
  if(spsDominant.id==='sucrose') edges.push(regulation('reg_suc_sps','sucrose','e_sps','inhibition',true,spsDominant.strength,'s-right','t-reg-right-1','right',724))

  if(f26kDominant.id==='triose') edges.push(regulation('reg_tri_f26k','triosec','e_f26k','inhibition',true,f26kDominant.strength,'s-left','t-reg-left-3','left',18))
  if(f26kDominant.id==='f6') edges.push(regulation('reg_f6_f26k','f6c','e_f26k','activation',true,f26kDominant.strength,'s-top','t-reg-right-2',undefined,undefined,[{x:262,y:245},{x:230,y:245},{x:230,y:281}]))

  if(agpDominant.id==='pga') edges.push(regulation('reg_pga_agp','pga','e_agp','activation',true,agpDominant.strength,'s-right','t-reg-right-3','right',1378))
  if(d.tpt>=0){
    edges.push(
      transport('tpt_triose','trioses','triosec','triose',Math.abs(d.tpt),'s-left','t-right'),
      transport('tpt_pi','pic','pis','pi',Math.abs(d.tpt),'s-right','t-left'),
    )
  }else{
    edges.push(
      transport('tpt_triose','triosec','trioses','triose',Math.abs(d.tpt),'s-right','t-left'),
      transport('tpt_pi','pis','pic','pi',Math.abs(d.tpt),'s-left','t-right'),
    )
  }
  const b0=baseline.balance, d0=baseline.derived
  const references:Record<string,number>={
    sucrose:d0.sucrosePool,s6p:d0.sucroseFlux,udp:d0.g6p*.55,g1c:d0.g6p*.62,g6c:d0.g6p,f6c:d0.f6p,f16c:b0.trioseCyt*.86,triosec:b0.trioseCyt,f26:d0.f26bp,pic:b0.piCyt,
    pic_sps:b0.piCyt,pic_f26k:b0.piCyt,pic_f26b:b0.piCyt,starch:d0.starch,adpg:d0.starchSynthesisFlux,maltose:0,glucose:0,g1s:b0.trioseStroma*.58,g6s:b0.trioseStroma*.66,f6s:b0.trioseStroma*.76,f16s:b0.trioseStroma*.86,trioses:b0.trioseStroma,pga:Math.min(100,b0.trioseStroma*1.25),pis:b0.piStroma,pis_agp:b0.piStroma,
  }
  nodes.forEach(node=>{if(node.data&&typeof node.data.value==='number')node.data.reference=references[node.id]??node.data.value})
  return {nodes,edges}
}

export function MetabolicFlow({balance,derived,baseline}:Props){
  const {nodes,edges}=useMemo(()=>makeElements(balance,derived,baseline),[balance,derived,baseline])
  const stageRef=useRef<HTMLDivElement>(null)
  const fittedZoom=useRef<number|null>(null)
  const [isZoomed,setIsZoomed]=useState(false)
  const [popover,setPopover]=useState<EnzymePopover|null>(null)
  const showPopover=(event:React.MouseEvent,node:Node)=>{
    if(node.type!=='enzyme'||!stageRef.current)return
    const data=node.data as FlowData
    const bounds=stageRef.current.getBoundingClientRect()
    const activity=data.activity??0
    const cursorX=event.clientX-bounds.left
    const rawY=event.clientY-bounds.top+14
    const side=cursorX+278>bounds.width?'left':'right'
    const x=Math.max(8,Math.min(side==='left'?cursorX-276:cursorX+14,bounds.width-278))
    const y=Math.max(8,Math.min(rawY,bounds.height-170))
    setPopover({x,y,side,label:data.label,activity,reasons:data.reasons??[]})
  }
  const fitOnInit=(instance:ReactFlowInstance)=>{
    requestAnimationFrame(()=>{
      Promise.resolve(instance.fitView({padding:.01,minZoom:.68,maxZoom:1.3})).then(()=>{
        fittedZoom.current=instance.getViewport().zoom
        setIsZoomed(false)
      })
    })
  }
  return <div ref={stageRef} className={`flow-stage ${isZoomed?'canvas-zoomed':'canvas-fitted'}`}>
    <div className="canvas-scroll-hint">{isZoomed?'Zoom activo · desplazamiento habilitado':'Vista completa · desplazamiento bloqueado'}</div>
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView fitViewOptions={{padding:.01,minZoom:.68,maxZoom:1.3}} onInit={fitOnInit} onMoveEnd={(_,viewport)=>setIsZoomed(fittedZoom.current!==null&&viewport.zoom>fittedZoom.current+.025)} onNodeMouseEnter={showPopover} onNodeMouseMove={showPopover} onNodeMouseLeave={()=>setPopover(null)} minZoom={.6} maxZoom={2.2} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} panOnScroll={isZoomed} panOnDrag={isZoomed} preventScrolling={isZoomed} zoomOnPinch zoomOnScroll={false}>
    <Background color="#dfe6dc" gap={24} size={1}/><Controls showInteractive={false}/>
    </ReactFlow>
    {popover&&<div className={`enzyme-popover ${popover.side}`} role="tooltip" style={{left:popover.x,top:popover.y}}>
      <div><strong>{popover.label}</strong><span className={popover.activity<35?'repressed':popover.activity>=70?'active':'intermediate'}>{popover.activity<35?'Reprimida o limitada':popover.activity>=70?'Activa':'Actividad intermedia'} · {Math.round(popover.activity)}%</span></div>
      {popover.reasons.map((reason,index)=><p className={reason.kind} key={index}><b>{reason.kind==='activation'?'▲':reason.kind==='inhibition'?'⊣':'•'}</b>{reason.text}</p>)}
    </div>}
  </div>
}

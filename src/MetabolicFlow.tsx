import { memo, useMemo } from 'react'
import {
  Background, BaseEdge, Controls, Handle, MarkerType, Position, ReactFlow,
  getBezierPath, getSmoothStepPath, getStraightPath, type EdgeProps, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Balance, Derived } from './App'

type Props = { balance: Balance; derived: Derived }
type FlowData = { label: string; value?: number; activity?: number; compartment?: 'cytosol' | 'chloroplast'; note?: string; tone?: string; kind?: string; active?: boolean; flux?: number; production?: boolean; forwardFlux?: number; reverseFlux?: number; route?: 'left'|'right'|'top'|'bottom'; corridor?: number; waypoints?: {x:number;y:number}[] }

const level = (v = 0) => v < 25 ? 'low' : v < 65 ? 'normal' : v < 82 ? 'high' : 'critical'

function FourHandles() {
  return <>
    {([Position.Top, Position.Right, Position.Bottom, Position.Left] as Position[]).map(p => <span key={p}>
      <Handle type="source" position={p} id={`s-${p}`} className="bio-handle" />
      <Handle type="target" position={p} id={`t-${p}`} className="bio-handle" />
    </span>)}
  </>
}

const MetaboliteNode = memo(({ data }: NodeProps) => {
  const d = data as FlowData
  return <div className={`metabolite-node ${level(d.value)}`}><FourHandles /><b>{d.label}</b><strong>{Math.round(d.value ?? 0)}%</strong>{d.note && <small>{d.note}</small>}</div>
})

const ProcessNode = memo(({ data }: NodeProps) => {
  const d = data as FlowData
  return <div className="process-node" title={d.label}><FourHandles /><span /></div>
})

const EnzymeNode = memo(({ data }: NodeProps) => {
  const d = data as FlowData
  return <div className={`enzyme-node ${(d.activity ?? 0) < 25 ? 'limited' : ''}`}><FourHandles /><b>{d.label}</b><span>actividad {Math.round(d.activity ?? 0)}%</span><i><em style={{ width:`${d.activity ?? 0}%` }} /></i></div>
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
  const width = .9 + (d?.flux ?? 0) / 28
  return <BaseEdge path={path} markerEnd={props.markerEnd} style={{ stroke:'#435b4e', strokeWidth:width, opacity:.82 }} />
})

const RegulatoryEdge = memo((props: EdgeProps) => {
  const d = props.data as FlowData | undefined
  const [curve] = getBezierPath(props)
  const waypointPath = d?.waypoints?.length ? `M ${props.sourceX} ${props.sourceY} ${d.waypoints.map(p=>`L ${p.x} ${p.y}`).join(' ')} L ${props.targetX} ${props.targetY}` : undefined
  const path = waypointPath ?? (d?.route === 'left' || d?.route === 'right'
    ? `M ${props.sourceX} ${props.sourceY} L ${d.corridor} ${props.sourceY} L ${d.corridor} ${props.targetY} L ${props.targetX} ${props.targetY}`
    : d?.route === 'top' || d?.route === 'bottom'
      ? `M ${props.sourceX} ${props.sourceY} L ${props.sourceX} ${d.corridor} L ${props.targetX} ${d.corridor} L ${props.targetX} ${props.targetY}`
      : curve)
  const active = d?.active ?? false
  const kind = d?.kind ?? 'activation'
  const color = kind === 'inhibition' ? '#c3443a' : kind === 'catalysis' ? '#78649a' : '#3e8a58'
  const opacity = active ? 1 : .14
  const verticalTarget = props.targetPosition === Position.Left || props.targetPosition === Position.Right
  const bar = kind === 'inhibition' && (verticalTarget
    ? <line x1={props.targetX} y1={props.targetY-7} x2={props.targetX} y2={props.targetY+7} />
    : <line x1={props.targetX-7} y1={props.targetY} x2={props.targetX+7} y2={props.targetY} />)
  return <g className={`reg-edge ${kind}`} style={{ opacity }}>
    <BaseEdge path={path} markerEnd={kind === 'activation' ? props.markerEnd : undefined} style={{ stroke:color, strokeWidth:active?2.2:1.2, strokeDasharray:kind==='catalysis'?'4 3':undefined }} />
    {bar && <g stroke={color} strokeWidth="2.5">{bar}</g>}
    {kind === 'catalysis' && <circle cx={props.targetX} cy={props.targetY} r="4" fill="white" stroke={color} strokeWidth="2" />}
  </g>
})

const BidirectionalEdge = memo((props: EdgeProps) => {
  const d = props.data as FlowData | undefined
  const dx = props.targetX - props.sourceX
  const dy = props.targetY - props.sourceY
  const length = Math.max(1, Math.hypot(dx,dy))
  const nx = -dy / length * 5
  const ny = dx / length * 5
  const forward = `M ${props.sourceX+nx} ${props.sourceY+ny} L ${props.targetX+nx} ${props.targetY+ny}`
  const reverse = `M ${props.targetX-nx} ${props.targetY-ny} L ${props.sourceX-nx} ${props.sourceY-ny}`
  const width = (flux=0) => .9 + flux / 22
  return <g className="bidirectional-edge">
    <BaseEdge path={forward} markerEnd={props.markerEnd} style={{stroke:'#435b4e',strokeWidth:width(d?.forwardFlux),opacity:.88}} />
    <BaseEdge path={reverse} markerEnd={props.markerEnd} style={{stroke:'#87968d',strokeWidth:width(d?.reverseFlux),opacity:.78}} />
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

const nodeTypes = { metabolite:MetaboliteNode, process:ProcessNode, enzyme:EnzymeNode, transport:TransportNode, compartment:CompartmentNode }
const edgeTypes = { reaction:ReactionEdge, regulatory:RegulatoryEdge, reversible:BidirectionalEdge, tpt:TptEdge }

const met = (id:string,label:string,value:number,parentId:string,x:number,y:number,note?:string,width=104) => ({ id,type:'metabolite',parentId,extent:'parent' as const,position:{x,y},data:{label,value,note},style:{width,height:58},draggable:false })
const proc = (id:string,label:string,parentId:string|undefined,x:number,y:number) => ({ id,type:'process',parentId,extent:parentId?'parent' as const:undefined,position:{x,y},data:{label},style:{width:18,height:18},draggable:false })
const enz = (id:string,label:string,activity:number,parentId:string,x:number,y:number,width=92,height=38) => ({ id,type:'enzyme',parentId,extent:'parent' as const,position:{x,y},data:{label,activity},style:{width,height},draggable:false })
const reaction = (id:string,source:string,target:string,flux:number,sourceHandle:string,targetHandle:string,production=false) => ({ id,type:'reaction',source,target,sourceHandle,targetHandle,data:{flux,production},markerEnd:production?{type:MarkerType.ArrowClosed,color:'#435b4e',width:14,height:14}:undefined,selectable:false })
const regulation = (id:string,source:string,target:string,kind:'activation'|'inhibition'|'catalysis',active:boolean,sourceHandle:string,targetHandle:string,route?:FlowData['route'],corridor?:number,waypoints?:FlowData['waypoints']) => ({ id,type:'regulatory',source,target,sourceHandle,targetHandle,data:{kind,active,route,corridor,waypoints},markerEnd:kind==='activation'?{type:MarkerType.ArrowClosed,color:'#3e8a58',width:14,height:14}:undefined,selectable:false })
const reversible = (id:string,source:string,target:string,forwardFlux:number,reverseFlux:number,sourceHandle:string,targetHandle:string) => ({ id,type:'reversible',source,target,sourceHandle,targetHandle,data:{forwardFlux,reverseFlux},markerEnd:{type:MarkerType.ArrowClosed,color:'#435b4e',width:13,height:13},selectable:false })
const transport = (id:string,source:string,target:string,kind:'pi'|'triose',flux:number,sourceHandle:string,targetHandle:string) => ({ id,type:'tpt',source,target,sourceHandle,targetHandle,data:{kind,flux},markerEnd:{type:MarkerType.ArrowClosed,color:kind==='pi'?'#477eb2':'#ad772b',width:17,height:17},selectable:false })

function makeElements(b:Balance,d:Derived) {
  const nodes:any[] = [
    {id:'cytosol',type:'compartment',position:{x:0,y:0},data:{label:'Citosol',note:'síntesis de sacarosa',compartment:'cytosol'},style:{width:620,height:680},draggable:false,selectable:false},
    {id:'chloroplast',type:'compartment',position:{x:720,y:0},data:{label:'Cloroplasto',note:'estroma · síntesis de almidón',compartment:'chloroplast'},style:{width:420,height:680},draggable:false,selectable:false},

    met('sucrose','Sacarosa',d.sucrosePool,'cytosol',260,25,'producto',112), met('s6p','Sacarosa-6P',d.sucroseFlux,'cytosol',260,115),
    met('udp','UDP-glucosa',d.g6p*.55,'cytosol',430,245), met('g1c','G1P',d.g6p*.62,'cytosol',440,335),
    met('g6c','G6P',d.g6p,'cytosol',310,335,'activa SPS'), met('f6c','F6P',d.f6p,'cytosol',180,335),
    met('f16c','F1,6BP',b.trioseCyt*.86,'cytosol',180,430), met('triosec','Triosas-P',b.trioseCyt,'cytosol',475,520,'citosol'),
    met('f26','F2,6BP',d.f26bp,'cytosol',25,335,'regulador'), met('pic','Pi',b.piCyt,'cytosol',500,615,'citosol · fuera'),
    proc('p_spp','Sacarosa-fosfato fosfatasa','cytosol',303,88),proc('p_sps','Sacarosa-fosfato sintasa','cytosol',303,190),proc('p_fbp','Fructosa-1,6-bisfosfatasa','cytosol',222,398),
    enz('e_spp','Sacarosa-fosfato fosfatasa',d.sucroseFlux,'cytosol',350,72,155,50),enz('e_sps','Sacarosa-fosfato sintasa',d.sps,'cytosol',345,164,150,52),
    enz('e_udpg','UGPasa',d.g6p,'cytosol',525,298,80),enz('e_pgm_c','PGM',d.g6p,'cytosol',375,290,64),enz('e_pgi_c','PGI',d.g6p,'cytosol',245,290,64),
    enz('e_fbp','Fructosa-1,6-bisfosfatasa',d.fbpase,'cytosol',255,382,165,52),enz('e_ald_c','Aldolasa',b.trioseCyt,'cytosol',335,550,84),
    enz('e_f26k','Fructosa-6-fosfato 2-quinasa',d.f26Kinase,'cytosol',40,253,170,56),enz('e_f26b','Fructosa-2,6-bisfosfatasa',d.f26Bisphosphatase,'cytosol',35,402,165,52),

    met('starch','Almidón',d.starch,'chloroplast',150,25,'reserva',112),met('adpg','ADP-glucosa',d.starchFlux,'chloroplast',150,115),
    met('g1s','G1P',b.trioseStroma*.58,'chloroplast',150,215),met('g6s','G6P',b.trioseStroma*.66,'chloroplast',150,305),
    met('f6s','F6P',b.trioseStroma*.76,'chloroplast',150,395),met('f16s','F1,6BP',b.trioseStroma*.86,'chloroplast',150,485),
    met('trioses','Triosas-P',b.trioseStroma,'chloroplast',20,520,'estroma'),met('pga','3-PGA',Math.min(100,b.trioseStroma*1.25),'chloroplast',285,520),
    met('pis','Pi',b.piStroma,'chloroplast',5,615,'estroma · dentro'),
    proc('p_starch','Almidón sintasa','chloroplast',193,90),proc('p_agp','ADP-glucosa pirofosforilasa','chloroplast',193,180),proc('p_fbp_s','Fructosa-1,6-bisfosfatasa','chloroplast',193,460),
    enz('e_starch','Almidón sintasa',d.starchFlux,'chloroplast',265,70,135,48),enz('e_agp','ADP-glucosa pirofosforilasa',d.agpase,'chloroplast',250,156,155,52),
    enz('e_pgm_s','PGM',b.trioseStroma,'chloroplast',280,270,65),enz('e_pgi_s','PGI',b.trioseStroma,'chloroplast',280,360,65),
    enz('e_fbp_s','Fructosa-1,6-bisfosfatasa',b.trioseStroma,'chloroplast',245,442,160,52),enz('e_ald_s','Aldolasa',b.trioseStroma,'chloroplast',280,580,82),

    {id:'tpt',type:'transport',position:{x:645,y:572},data:{activity:Math.abs(d.tpt),note:'antiporte acoplado'},style:{width:82,height:48},draggable:false,selectable:false},
  ]
  const edges:any[] = [
    reaction('r_spp_1','s6p','p_spp',d.sucroseFlux,'s-top','t-bottom'),reaction('r_spp_2','p_spp','sucrose',d.sucroseFlux,'s-top','t-bottom',true),
    reaction('r_sps_f6','f6c','p_sps',d.sucroseFlux,'s-top','t-left'),reaction('r_sps_udp','udp','p_sps',d.sucroseFlux,'s-top','t-right'),reaction('r_sps_out','p_sps','s6p',d.sucroseFlux,'s-top','t-bottom',true),
    reversible('bi_udpg','g1c','udp',d.g6p*.62,d.g6p*.28,'s-top','t-bottom'),
    reversible('bi_pgm_c','g6c','g1c',d.g6p*.68,d.g6p*.32,'s-right','t-left'),
    reversible('bi_pgi_c','f6c','g6c',d.f6p*.46,d.g6p*.54,'s-right','t-left'),
    reaction('r_fbp1','f16c','p_fbp',d.fbpase,'s-top','t-bottom'),reaction('r_fbp2','p_fbp','f6c',d.fbpase,'s-top','t-bottom',true),
    reversible('bi_ald_c','triosec','f16c',b.trioseCyt*.7,b.trioseCyt*.3,'s-left','t-right'),
    reversible('bi_f26','f6c','f26',d.f26Kinase,d.f26Bisphosphatase,'s-left','t-right'),

    reaction('r_starch1','adpg','p_starch',d.starchFlux,'s-top','t-bottom'),reaction('r_starch2','p_starch','starch',d.starchFlux,'s-top','t-bottom',true),
    reaction('r_agp1','g1s','p_agp',d.agpase,'s-top','t-bottom'),reaction('r_agp2','p_agp','adpg',d.agpase,'s-top','t-bottom',true),
    reversible('bi_pgm_s','g6s','g1s',b.trioseStroma*.62,b.trioseStroma*.38,'s-top','t-bottom'),
    reversible('bi_pgi_s','f6s','g6s',b.trioseStroma*.56,b.trioseStroma*.44,'s-top','t-bottom'),
    reaction('r_fbp_s1','f16s','p_fbp_s',b.trioseStroma,'s-top','t-bottom'),reaction('r_fbp_s2','p_fbp_s','f6s',b.trioseStroma,'s-top','t-bottom',true),
    reversible('bi_ald_s','trioses','f16s',b.trioseStroma*.72,b.trioseStroma*.28,'s-right','t-left'),
    reaction('r_pga','pga','trioses',b.trioseStroma,'s-left','t-right',true),

    regulation('cat_spp','e_spp','p_spp','catalysis',true,'s-left','t-right'),regulation('cat_sps','e_sps','p_sps','catalysis',true,'s-left','t-right'),
    regulation('cat_fbp','e_fbp','p_fbp','catalysis',true,'s-left','t-right'),
    regulation('cat_starch','e_starch','p_starch','catalysis',true,'s-left','t-right'),regulation('cat_agp','e_agp','p_agp','catalysis',true,'s-left','t-right'),
    regulation('cat_fbp_s','e_fbp_s','p_fbp_s','catalysis',true,'s-left','t-right'),

    regulation('reg_f26_fbp','f26','e_fbp','inhibition',d.f26bp>=68,'s-left','t-right',undefined,undefined,[{x:10,y:364},{x:10,y:510},{x:440,y:510},{x:440,y:408}]),
    regulation('reg_pi_sps','pic','e_sps','inhibition',b.piCyt>=65,'s-right','t-right','right',610),
    regulation('reg_g6_sps','g6c','e_sps','activation',d.g6p>=30,'s-bottom','t-right',undefined,undefined,[{x:362,y:400},{x:610,y:400},{x:610,y:193}]),
    regulation('reg_suc_sps','sucrose','e_sps','inhibition',d.sucrosePool>=70,'s-right','t-right','right',610),
    regulation('reg_pi_f26k','pic','e_f26k','activation',b.piCyt>=55,'s-left','t-left','left',10),
    regulation('reg_tri_f26k','triosec','e_f26k','inhibition',b.trioseCyt>=65,'s-left','t-left','left',10),
    regulation('reg_pi_f26b','pic','e_f26b','inhibition',b.piCyt>=55,'s-left','t-left','left',10),
    regulation('reg_f6_f26k','f6c','e_f26k','activation',d.f6p>=35,'s-top','t-right',undefined,undefined,[{x:232,y:245},{x:220,y:245},{x:220,y:281}]),
    regulation('reg_f6_f26b','f6c','e_f26b','inhibition',d.f6p>=35,'s-bottom','t-right',undefined,undefined,[{x:220,y:393},{x:220,y:428}]),
    regulation('reg_pi_agp','pis','e_agp','inhibition',b.piStroma>=65,'s-right','t-right','right',1130),
    regulation('reg_pga_agp','pga','e_agp','activation',b.trioseStroma>=30,'s-right','t-right','right',1130),
  ]
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
  return {nodes,edges}
}

export function MetabolicFlow({balance,derived}:Props){
  const {nodes,edges}=useMemo(()=>makeElements(balance,derived),[balance,derived])
  return <div className="flow-stage"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView fitViewOptions={{padding:.015,minZoom:.68,maxZoom:1.15}} minZoom={.6} maxZoom={2.2} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} panOnScroll zoomOnPinch zoomOnScroll>
    <Background color="#dfe6dc" gap={24} size={1}/><Controls showInteractive={false}/>
  </ReactFlow></div>
}

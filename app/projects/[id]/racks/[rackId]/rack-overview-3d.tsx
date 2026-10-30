"use client";
import Image from 'next/image';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {RackConfig} from '@/lib/rack-config';
import {POCKET_BAYS,isPocket} from '@/lib/onerack-layout';
import {catalogProfile,artworkUrl,isBlankingPanel} from '@/lib/catalog-artwork';
import type {RackGridDevice} from './physical-rack-grid';
import {ApcPduPanel} from './apc-pdu-panel';
import {ModelPduOutlets} from './pdu-outlets';
import {readDetails} from '@/lib/equipment-details';
import {PX3_4068_ID} from '@/lib/pdu-models';
import {PocketFace} from './pocket-face';
import {RackCableBundles} from './rack-cable-bundles';
const U=17.5,W=190,D=420;
function Box({x=0,y=0,z=0,w,h,d,front,rear,top,left,right,className='',name,onSelect,rotationY=0}:{rotationY?:number;x?:number;y?:number;z?:number;w:number;h:number;d:number;front?:ReactNode;rear?:ReactNode;top?:ReactNode;left?:ReactNode;right?:ReactNode;className?:string;name?:string;onSelect?:()=>void}){
 const faces=[{key:'front',w,h,t:`translateZ(${d/2}px)`,content:front},{key:'rear',w,h,t:`rotateY(180deg) translateZ(${d/2}px)`,content:rear},{key:'left',w:d,h,t:`rotateY(-90deg) translateZ(${w/2}px)`,content:left},{key:'right',w:d,h,t:`rotateY(90deg) translateZ(${w/2}px)`,content:right},{key:'top',w,h:d,t:`rotateX(90deg) translateZ(${h/2}px)`,content:top},{key:'bottom',w,h:d,t:`rotateX(-90deg) translateZ(${h/2}px)`}];
 return <div className={`rack3-box ${className}`} style={{transform:`translate3d(${x}px,${y}px,${z}px) rotateY(${rotationY}deg)`}}>{faces.map(f=><div key={f.key} className={`rack3-face rack3-${f.key}`} style={{width:f.w,height:f.h,left:-f.w/2,top:-f.h/2,transform:f.t}} onClick={onSelect} title={name}>{f.content}</div>)}</div>;
}
function DeviceFace({device,face,pocket}:{device:RackGridDevice;face:'front'|'rear';pocket:boolean}){
 const p=catalogProfile(device.catalogDevice.sku||'',device.catalogDevice.model);
 if(p){
  if(isBlankingPanel(device.catalogDevice.sku,device.catalogDevice.model,device.catalogDevice.heightRU,pocket))return <Image src={artworkUrl(p,face)} alt="" fill unoptimized sizes="190px" loading="eager" draggable={false} style={{pointerEvents:'none'}}/>;
  if(pocket)return <div className="rack3-art-detail"><PocketFace profile={p} face={face} stretch/></div>;
  if(p.key==='smc-b3008u')return <div className="rack3-art-detail"><svg viewBox="0 0 800 640" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><image href={artworkUrl(p,face)} width="800" height="640" preserveAspectRatio="xMidYMid meet"/></svg></div>;
  const ru=device.catalogDevice.heightRU,fh=ru<=1?112:ru===2?160:ru===4?280:440;
  const crop=p.key==='smc-grandtwin'?'22 30 756 110':['asus-esc8000a','smc-641e','fs-s3900','nvidia-qm8700'].includes(p.key)?(ru<=1?(p.key==='nvidia-qm8700'&&face==='rear'?'22 25 756 70':'22 29 756 61'):p.key==='asus-esc8000a'&&face==='rear'?'22 0 756 256':'22 29 756 227'):`0 0 800 ${fh}`;
  return <div className="rack3-art-detail"><svg viewBox={crop} preserveAspectRatio="none" aria-hidden="true"><image href={artworkUrl(p,face)} width="800" height={fh}/></svg></div>;
 }
 return <span className="rack3-generic">{device.label||device.catalogDevice.model}</span>;
}
// Reuse the exact 2D panel components; inert artwork cannot edit connections in 3D.
function PduFace({device,devices,w,h}:{device:RackGridDevice;devices:RackGridDevice[];w:number;h:number}){
 const apc=/APDU10151ME/.test(device.catalogDevice.sku||device.catalogDevice.model||''),raritan=device.catalogDevice.pduModel===PX3_4068_ID;
 const assignments=readDetails(device.details).outlets,scale=w/100;
 return <div className="rack3-pdu-art" aria-hidden="true" inert><div className={`rack3-pdu-canvas ${apc?'apc-model-pdu':''}`} style={{width:100,height:1800,transform:`scale(${scale},${h/1800})`}}>
 {apc?<ApcPduPanel devices={devices} deviceId={device.id} ports={device.networkPorts} connected={device.connectedPorts} outlets={device.catalogDevice.outlets||[]} assignments={assignments} disabled/>:raritan?<><div className="rack3-pdu-model-name">Raritan<br/>{device.catalogDevice.sku||device.catalogDevice.model}</div><ModelPduOutlets devices={devices} deviceId={device.id} ports={device.networkPorts} connected={device.connectedPorts} letter={device.mounting.includes('left')?'B':'A'} assignments={assignments} disabled hidden={false} onOutlet={()=>{}}/></>:<div className="rack3-pdu-face"><strong>{device.label||device.catalogDevice.model}</strong>{(device.catalogDevice.outlets||[]).map(o=><i key={o.n} title={`P${o.n}`}/>)}</div>}
 </div></div>;
}
function RailMarks({heightRU}:{heightRU:number}){return <div className="rack3-ru">{Array.from({length:heightRU},(_,i)=><span key={i}><b>{heightRU-i}</b><i/><i/><i/></span>)}</div>;}
export function RackOverview3D({heightRU,config,devices,onEdit}:{heightRU:number;config:RackConfig;devices:RackGridDevice[];onEdit:(id:string)=>void}){
 const [yaw,setYaw]=useState(-28),[pitch,setPitch]=useState(-8),[zoom,setZoom]=useState(1),[panels,setPanels]=useState(false),[selectedId,setSelected]=useState(''),[fit,setFit]=useState(.75);
 const [cables,setCables]=useState(true);
 const overview=useRef<HTMLElement>(null);
 const [fullscreen,setFullscreen]=useState(false),[viewMessage,setViewMessage]=useState('');
 useEffect(()=>{const changed=()=>setFullscreen(document.fullscreenElement===overview.current);document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed);},[]);
 async function expandView(){try{setViewMessage('');if(document.fullscreenElement===overview.current)await document.exitFullscreen();else await overview.current?.requestFullscreen();}catch{setViewMessage('Full screen is unavailable in this browser. You can expand the browser window instead.');}}
 const viewport=useRef<HTMLDivElement>(null),drag=useRef<{x:number;y:number;yaw:number;pitch:number;pointerId:number}|null>(null),moved=useRef(false);
 const scene=useRef<HTMLDivElement>(null),orbitFrame=useRef<number|null>(null),orbit=useRef({yaw,pitch});
 function cancelOrbitFrame(){if(orbitFrame.current!==null){cancelAnimationFrame(orbitFrame.current);orbitFrame.current=null;}}
 function finishOrbit(){cancelOrbitFrame();if(drag.current){setYaw(orbit.current.yaw);setPitch(orbit.current.pitch);}drag.current=null;}
 useEffect(()=>()=>{if(orbitFrame.current!==null)cancelAnimationFrame(orbitFrame.current);},[]);
 const hasRaritan=devices.some(d=>d.catalogDevice.pduModel===PX3_4068_ID);
 const pduLane=hasRaritan?50:30;
 const H=heightRU*U+36,outerW=Math.max(config.pockets||config.pduPairs===2?W+145:W+85,W+2*((config.pduPairs||1)*pduLane+22)),selected=devices.find(d=>d.id===selectedId);
 useEffect(()=>{const el=viewport.current;if(!el)return;const observer=new ResizeObserver(()=>setFit(Math.min((el.clientHeight-100)/(H+90),(el.clientWidth-70)/(outerW+D*.65))));observer.observe(el);return()=>observer.disconnect();},[H,outerW]);
 function location(d:RackGridDevice){return isPocket(heightRU,d.startRU,config.pockets)?`Side pocket U${d.startRU}`:d.catalogDevice.heightRU===0?d.mounting.replaceAll('-',' '):`U${d.startRU}–U${d.startRU+d.catalogDevice.heightRU-1}`;}
 function camera(y:number){cancelOrbitFrame();drag.current=null;setYaw(y);setPitch(-8);setZoom(1);}
 return <section ref={overview} className="rack3-overview" onKeyDown={e=>e.stopPropagation()}>
 <header className="rack3-toolbar"><div><span className="power-eyebrow">Interactive overview · preview</span><h3>Rack in 3D</h3><p>{heightRU}U main bay{config.pockets?' + 12 side-pocket positions':''} · {devices.length} installed devices</p></div><div className="rack3-tools"><button type="button" onClick={()=>camera(0)}>Front</button><button type="button" onClick={()=>camera(180)}>Rear</button><button type="button" onClick={()=>camera(-90)}>Side</button><button type="button" onClick={()=>camera(-28)}>Reset view</button><button type="button" onClick={expandView}>{fullscreen?'Exit full screen':'Full screen'}</button><label><input type="checkbox" checked={panels} onChange={e=>setPanels(e.target.checked)}/> Side panels</label><label><input type="checkbox" checked={cables} onChange={e=>setCables(e.target.checked)}/> Cable bundles</label></div></header>
 {viewMessage&&<p role="status">{viewMessage}</p>}
 <div className="rack3-layout"><div ref={viewport} className="rack3-viewport" role="group" aria-label="Interactive 3D rack. Drag to rotate, or use arrow keys." tabIndex={0}
 onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')setYaw(y=>y-10);if(e.key==='ArrowRight')setYaw(y=>y+10);if(e.key==='ArrowUp')setPitch(p=>Math.max(-35,p-5));if(e.key==='ArrowDown')setPitch(p=>Math.min(30,p+5));}}}
 onDragStart={e=>e.preventDefault()}
 onPointerDown={e=>{if(e.button!==0||drag.current)return;moved.current=false;orbit.current={yaw,pitch};drag.current={x:e.clientX,y:e.clientY,yaw,pitch,pointerId:e.pointerId};}}
 onPointerMove={e=>{const start=drag.current;if(!start||start.pointerId!==e.pointerId)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(!moved.current&&Math.abs(dx)+Math.abs(dy)<=5)return;if(!moved.current){moved.current=true;e.currentTarget.setPointerCapture(e.pointerId);}orbit.current={yaw:start.yaw+dx*.45,pitch:Math.max(-35,Math.min(30,start.pitch-dy*.2))};if(orbitFrame.current===null)orbitFrame.current=requestAnimationFrame(()=>{orbitFrame.current=null;if(scene.current)scene.current.style.transform=`scale(${Math.max(.12,fit)*zoom}) rotateX(${orbit.current.pitch}deg) rotateY(${orbit.current.yaw}deg)`;});}}
 onPointerUp={e=>{if(drag.current?.pointerId!==e.pointerId)return;finishOrbit();if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
 onLostPointerCapture={finishOrbit} onPointerCancel={finishOrbit}>
 <div className="rack3-ground"/>
 <div ref={scene} className="rack3-scene" style={{transform:`scale(${Math.max(.12,fit)*zoom}) rotateX(${pitch}deg) rotateY(${yaw}deg)`}}>
 {[-1,1].flatMap(x=>[-1,1].map(z=><Box key={`post${x}${z}`} x={x*outerW/2} z={z*D/2} w={14} h={H} d={14} className="rack3-frame"/>))}
 {[-1,1].flatMap(y=>[-1,1].map(z=><Box key={`cross${y}${z}`} y={y*H/2} z={z*D/2} w={outerW+14} h={16} d={14} className="rack3-frame"/>))}
 {[-1,1].flatMap(y=>[-1,1].map(x=><Box key={`side${y}${x}`} y={y*H/2} x={x*outerW/2} w={14} h={16} d={D} className="rack3-frame"/>))}
 {/* Formed perimeter base with open center; side crossmembers and recessed rear mounting channels. */}
 {[-1,1].map(x=><Box key={`base-long${x}`} x={x*(outerW/2-10)} y={H/2+6} w={32} h={20} d={D+16} className="rack3-base"/>)}
 {[-1,1].map(z=><Box key={`base-end${z}`} z={z*(D/2-8)} y={H/2+6} w={outerW+16} h={20} d={32} className="rack3-base"/>)}
 {[-1,1].flatMap(x=>[-1,1].map(y=><Box key={`brace${x}${y}`} x={x*(outerW/2-3)} y={y*H/6} w={9} h={18} d={D-8} className="rack3-crossmember"/>))}
 {[-1,1].map(x=><Box key={`rear-channel${x}`} x={x*(outerW/2-20)} z={-D/2+44} w={28} h={heightRU*U} d={5} className="rack3-channel" front={<div className="rack3-slot-strip"/>} rear={<div className="rack3-slot-strip"/>}/>)}
 <Box y={-H/2-2} w={outerW-10} h={5} d={D-12} className="rack3-roof" top={<div className="rack3-roof-detail"><i/><i/><i/><i/></div>}/>

 {[-1,1].flatMap(x=>[-1,1].map(z=><Box key={`foot${x}${z}`} x={x*(outerW/2-18)} y={H/2+20} z={z*(D/2-18)} w={18} h={15} d={18} className="rack3-frame"/>))}
 {[-1,1].flatMap(x=>[-1,1].map(z=><Box key={`rail${x}${z}`} x={x*(W/2+5)} z={z*(D/2-15)} w={7} h={heightRU*U} d={5} className="rack3-rail" front={<RailMarks heightRU={heightRU}/>} rear={<RailMarks heightRU={heightRU}/>}/>))}
 {panels&&[-1,1].flatMap(x=>[-1,1].map(y=><Box key={`panel${x}${y}`} x={x*outerW/2} y={y*H/4} w={3} h={H/2-10} d={D-10} className="rack3-panel" left={<div className="rack3-panel-lock"/>} right={<div className="rack3-panel-lock"/>}/>))}
 {devices.map(device=>{
 const pocket=isPocket(heightRU,device.startRU,config.pockets),pdu=device.catalogDevice.heightRU===0;
 const blankPanel=isBlankingPanel(device.catalogDevice.sku,device.catalogDevice.model,device.catalogDevice.heightRU,pocket);
 let x=0,y=(heightRU/2-(device.startRU-1+device.catalogDevice.heightRU/2))*U,z=0,w=W,h=Math.max(5,device.catalogDevice.heightRU*U-2),depth=blankPanel?4:device.catalogDevice.category==='switch'?140:245;
 if(pocket){const bay=POCKET_BAYS.find(b=>[...b.left,...b.right].some(n=>n===device.startRU))!;const left=bay.left.some(n=>n===device.startRU);const pair=left?bay.left:bay.right;const slot=pair.findIndex(n=>n===device.startRU);const span=Math.min(device.catalogDevice.heightRU,pair.length-slot);const lane=left?pair.length-slot-span:slot;x=(left?-1:1)*(W/2+17+(lane+(span-1)/2)*19);y=(heightRU/2-(bay.from-1+(bay.to-bay.from+1)/2))*U;w=span*19-1;h=(bay.to-bay.from+1)*U-4;depth=115;}
 if(pdu){const raritan=device.catalogDevice.pduModel===PX3_4068_ID;w=raritan?44:26;depth=20;x=(device.mounting.includes('left')?-1:1)*(W/2+pduLane/2+5+(device.mounting.endsWith('-2')?pduLane:0));z=-D/2+14+w/2;h=heightRU*U*.96;y=0;}
 else z=device.mounting==='rear'?-D/2+depth/2+12:D/2-depth/2-12;
 const frontFace=device.mounting==='rear'?'rear':'front',backFace=frontFace==='front'?'rear':'front';
 const name=`${device.label||device.catalogDevice.model} · ${location(device)}`;
 const pduFace=<PduFace device={device} devices={devices} w={w} h={h}/>;
 return <Box key={device.id} rotationY={0} x={x} y={y} z={z} w={pdu?depth:w} h={h} d={pdu?w:depth} name={name} className={`rack3-equipment ${blankPanel?'rack3-blanking-panel':''} ${pdu?(device.mounting.includes('left')?'rack3-pdu-facing-right':'rack3-pdu-facing-left'):''} ${pdu&&device.catalogDevice.pduModel===PX3_4068_ID?(device.mounting.includes('left')?'rack3-raritan-B':'rack3-raritan-A'):''} ${selectedId===device.id?'rack3-selected':''}`} onSelect={()=>{if(!moved.current)setSelected(device.id);}} left={pdu?(device.mounting.includes('left')?<div className="rack3-pdu-back"/>:pduFace):undefined} right={pdu?(device.mounting.includes('left')?pduFace:<div className="rack3-pdu-back"/>):undefined} front={pdu?undefined:<DeviceFace device={device} pocket={pocket} face={frontFace}/>} rear={pdu?undefined:<DeviceFace device={device} pocket={pocket} face={backFace}/>}/>;
 })}
 {cables&&<RackCableBundles devices={devices} heightRU={heightRU} width={outerW} depth={D} pockets={config.pockets}/> }
 </div><span className="rack3-hint">Drag to orbit · Arrow keys also rotate</span>
 </div><aside className="rack3-inspector"><label className="power-budget-field">Inspect equipment<select value={selectedId} onChange={e=>setSelected(e.target.value)}><option value="">Select a device…</option>{devices.map(d=><option key={d.id} value={d.id}>{d.label||d.catalogDevice.model} · {location(d)}</option>)}</select></label>
 {selected?<><h4>{selected.label||selected.catalogDevice.model}</h4><p>{location(selected)} · {selected.mounting}</p><p>{selected.catalogDevice.vendor} {selected.catalogDevice.model}</p><p>{selected.connectedPorts?.length||0} network ports with saved connections<br/>{selected.connectedPsus?.length||0} PSUs with saved connections</p><button type="button" onClick={()=>onEdit(selected.id)}>Open equipment in 2D</button></>:<p>Select a chassis, pocket switch or PDU to inspect it.</p>}
 <label className="power-budget-field">View scale<input aria-label="3D view scale" type="range" min="0.6" max="1.5" step="0.05" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label>
 {cables&&<p className="rack3-cable-note">Blue: Cat6 · Black: DAC breakout. Illustrative routes from rear-facing switches; not a saved port-to-port wiring map.</p>}
 <details><summary>Model accuracy</summary><p>RU positions and equipment come from this rack. Frame width, depth, chassis depth, pocket depth and panel construction are illustrative. Welded frame, open base, side crossmembers, split panels and roof entries follow the supplied DC Series brochure as a visual reference; its dimensions do not confirm this rack model. Side pockets are separate from the main RU stack. Doors and fit clearances are not modeled. Use 2D for port and PSU editing.</p></details></aside></div></section>;
}

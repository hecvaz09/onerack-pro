'use client';
import {arista7010NetworkBox,arista7010PsuBoxes} from '@/lib/arista-7010tx-layout';
import {b300NetworkBox} from '@/lib/b300-network-layout';
import type {CatalogProfile} from '@/lib/catalog-artwork';
import type {NetworkPort} from '@/lib/network-ports';

type Box={x:number;y:number;w:number;h:number};
export function FaceConnections({profile,face,ports=[],connected=[],psus=[],psuDescription,href,deviceId,vertical=false}:{profile:CatalogProfile;face:'front'|'rear';ports?:NetworkPort[];connected?:string[];psus?:number[];psuDescription?:(inlet:number)=>string;href?:string;deviceId:string;vertical?:boolean}){
 const key=profile.key;
 function portBox(p:NetworkPort):Box|undefined{
  if(key==='smc-b3008u')return face==='front'?b300NetworkBox(p):undefined;
  if(key==='arista-7010tx')return face==='front'?arista7010NetworkBox(p.position,p.number):undefined;
  if(key==='asus-esc8000a'&&face==='rear'){
   if(p.position==='mgmt')return {x:564,y:221,w:25,h:20};
   if(p.position==='lan')return {x:239,y:p.number===2?205:226,w:25,h:17};
   if(p.slot===1&&p.number===1)return {x:83,y:94,w:20,h:37};
  }
  if(key==='smc-641e'&&face==='rear'){
   if(p.position==='mgmt')return {x:303,y:84,w:23,h:17};
   if(p.position==='lan')return {x:p.number===1?381:407,y:109,w:23,h:18};
   if(p.slot===4)return {x:646,y:90,w:25,h:17};
   if(p.slot===3&&p.number!==undefined&&p.number>=0&&p.number<=3)return {x:682,y:55+p.number*22,w:21,h:16};
  }
  if(profile.category!=='switch')return;
  if(p.position==='mgmt'){
   if(face==='rear'&&key.startsWith('cisco'))return {x:552,y:35,w:25,h:20};
   if(face==='front'&&key==='arista-7050cx3')return {x:722,y:35,w:24,h:22};
   if(face==='front'&&key==='nvidia-qm8700')return {x:720,y:35,w:24,h:22};
   return;
  }
  if(face!=='front'||p.position!=='switch-data'||!p.number)return;
  const n=p.number;
  const bank=(start:number,x:number,width:number,cols:number):Box=>({x:x+Math.floor((n-start)/2)*width/cols+2,y:36+((n-start)%2)*25,w:width/cols-4,h:21});
  if(key==='cisco-92348')return n<=48?{x:40+Math.floor((n-1)/2)*23.5,y:34+(n-1)%2*25,w:21,h:16}:n<=52?bank(49,612,70,2):n<=54?bank(53,694,64,1):undefined;
  if(key==='arista-7050cx3')return n<=32?bank(1,78,628,16):n<=34?bank(33,32,40,1):undefined;
  if(key==='fs-s3900')return n<=48?{x:32+Math.floor((n-1)/2)*25,y:35+(n-1)%2*25,w:22,h:16}:n<=54?{x:651+Math.floor((n-49)/2)*27,y:35+(n-49)%2*25,w:24,h:16}:undefined;
  if(key==='nvidia-qm8700')return n<=40?bank(1,32,670,20):undefined;
  const count=Number(profile.drawing.ports)||0;
  return n<=count?bank(1,40,720,Math.ceil(count/2)):undefined;
 }
 const groups=new Map<string,{box:Box;ports:NetworkPort[]}>();
 for(const p of ports){const box=portBox(p);if(!box)continue;const id=p.parentId||p.id;const group=groups.get(id);if(group)group.ports.push(p);else groups.set(id,{box,ports:[p]});}
 let power:{n:number;box:Box}[]=[];
 if(face==='rear'){
  if(profile.category==='switch')power=key==='arista-7050cx3'?[{n:1,box:{x:40,y:46,w:24,h:29}},{n:2,box:{x:633,y:46,w:24,h:29}}]:[{n:1,box:{x:42,y:44,w:22,h:30}},{n:2,box:{x:716,y:44,w:22,h:30}}];
  if(key==='arista-7010tx')power=arista7010PsuBoxes.map(({n,box})=>({n,box:{...box}}));
  if(key==='fs-s3900')power=[{n:1,box:{x:35,y:43,w:30,h:30}},{n:2,box:{x:732,y:43,w:30,h:30}}];
  if(key==='asus-esc8000a')power=[43,283,417,625].map((x,i)=>({n:i+1,box:{x:x+83,y:208,w:28,h:31}}));
  if(key==='smc-641e')power=[{n:2,box:{x:39,y:48,w:27,h:28}},{n:1,box:{x:39,y:99,w:27,h:28}}];
  if(key==='smc-510p')power=[2,1].map((n,i)=>({n,box:{x:37+i*88,y:47,w:23,h:29}}));
  if(key==='smc-821gv')power=[1,2,3,4].map((n,i)=>({n,box:{x:32+i*184,y:326,w:180,h:88}})).concat([{n:5,box:{x:32,y:128,w:180,h:92}},{n:6,box:{x:584,y:128,w:180,h:92}}]);
 }
 return <g className="face-connection-overlays">
 {[...groups].map(([id,{box,ports:group}])=>{const used=group.filter(p=>connected.includes(p.id));const p=used[0]||group[0];return <a key={id} data-connected={used.length>0} aria-label={`${p.parentEndpoint||p.name} · ${used.length?'Connected':'Available'}${group.length>1?` · ${used.length}/4 legs`:''}`} href={href?`${href}&fromDeviceId=${encodeURIComponent(deviceId)}&fromPort=${encodeURIComponent(p.id)}`:undefined} onPointerDown={e=>e.stopPropagation()}><rect className="connection-socket" x={box.x} y={box.y} width={box.w} height={box.h} rx="1"/><circle className="connection-led" cx={box.x+box.w-3} cy={box.y+3} r="2"/>{group.length>1&&group.map((leg,i)=><rect key={leg.id} className="breakout-leg-light" data-connected={connected.includes(leg.id)} x={box.x+i*box.w/4} y={box.y+box.h-3} width={box.w/4-1} height="3"/>)}</a>;})}
 {power.map(({n,box})=><a key={`psu${n}`} className="psu-hit" href="#power-connection" data-psu-device={deviceId} data-psu-inlet={n} onPointerDown={e=>e.stopPropagation()} data-connected={psus.includes(n)} aria-label={psuDescription?.(n)||`PSU ${n} · ${psus.includes(n)?"Connected":"Not connected"}`}><title>{psuDescription?.(n)||`PSU ${n} · ${psus.includes(n)?"Connected":"Not connected"}`}</title><rect className="connection-socket" x={box.x-(box.w<60?3:0)} y={box.y-(box.w<60?3:0)} width={box.w+(box.w<60?6:0)} height={box.h+(box.w<60?6:0)} rx="2"/><circle className="connection-led" cx={box.x+box.w-3} cy={box.y+3} r="2"/>{profile.category==='switch'&&<g transform={`translate(${box.x+box.w/2+(box.x<400?70:-70)} ${box.y+box.h/2})${vertical?' rotate(90)':''}`}>
  <rect x={vertical?-27:-32} y={vertical?-31:-12} width={vertical?54:64} height={vertical?62:24} rx="4" fill="#182b35" stroke={psus.includes(n)?'#5ee9b5':'#d9e6ed'} strokeWidth="1.5"/>
  {vertical?<><text x="0" y="-7" textAnchor="middle" fill="#edf3f7" fontFamily="Arial" fontSize="17" fontWeight="700">PSU</text><text x="0" y="20" textAnchor="middle" fill="#edf3f7" fontFamily="Arial" fontSize="27" fontWeight="700">{n}</text></>:<text x="0" y="5" textAnchor="middle" fill="#edf3f7" fontFamily="Arial" fontSize="15" fontWeight="700">PSU {n}</text>}
 </g>}</a>)}
 </g>;
}

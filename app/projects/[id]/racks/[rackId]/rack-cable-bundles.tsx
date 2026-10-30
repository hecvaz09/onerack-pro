import {isBlankingPanel} from '@/lib/catalog-artwork';
import type {RackGridDevice} from './physical-rack-grid';
import {POCKET_BAYS,isPocket} from '@/lib/onerack-layout';

/** Illustrative routing only. Geometry follows installed switches, not saved port assignments. */
export function RackCableBundles({devices,heightRU,width,depth,pockets}:{devices:RackGridDevice[];heightRU:number;width:number;depth:number;pockets:boolean}){
 const height=heightRU*17.5,center=width/2;
 const level=(d:RackGridDevice)=>height-(d.startRU-1+d.catalogDevice.heightRU/2)*17.5;
 const servers=devices.filter(d=>d.catalogDevice.heightRU>0&&d.catalogDevice.category!=='switch'&&!isBlankingPanel(d.catalogDevice.sku,d.catalogDevice.model,d.catalogDevice.heightRU)&&!isPocket(heightRU,d.startRU,pockets)).sort((a,b)=>b.startRU-a.startRU);
 const switches=devices.filter(d=>d.catalogDevice.category==='switch'&&d.mounting==='rear');
 if(!servers.length||!switches.length)return null;
 return <svg className="rack3-cable-bundles" aria-hidden="true" width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{position:'absolute',left:-width/2,top:-height/2,overflow:'visible',pointerEvents:'none',backfaceVisibility:'hidden',transform:`translateZ(${-depth/2+8}px) rotateY(180deg)`}}>
 {switches.map((device,index)=>{
  const bay=isPocket(heightRU,device.startRU,pockets)?POCKET_BAYS.find(b=>[...b.left,...b.right].some(n=>n===device.startRU)):undefined;
  const worldLeft=bay?.left.some(n=>n===device.startRU);
  const pair=bay?(worldLeft?bay.left:bay.right):undefined;
  const slot=pair?.findIndex(n=>n===device.startRU)??0;
  const span=pair?Math.min(device.catalogDevice.heightRU,pair.length-slot):1;
  const lane=pair?(worldLeft?pair.length-slot-span:slot):0;
  const side=bay?(worldLeft?1:-1):(index%2===0?1:-1);
  const startX=bay?center+side*(95+17+(lane+(span-1)/2)*19):center+side*45;
  const top=bay?height-(bay.to)*17.5+14:level(device);
  const below=servers.filter(d=>level(d)>top+55);
  if(!below.length)return null;
  // Decorative media grouping; the inspector explicitly distinguishes this from saved cabling.
  const dac=/production|infiniband|leaf|spine/i.test(device.label||'')||(device.networkPorts||[]).some(p=>(p.speedGbps||0)>=25);
  const color=dac?'#11161c':'#228fd5',count=4;
  const trunk=center+side*(99+(index%2)*3);
  const bottom=level(below[below.length-1]);
  return <g key={device.id} data-source-device={device.id} data-cable-type={dac?'DAC breakout':'Cat6'}>
   {Array.from({length:count},(_,i)=>{
    const destination=below[Math.round(i*(below.length-1)/(count-1))];
    const b=level(destination),a=top+i*3.5,x=startX+(bay?0:side*i*4),laneX=trunk+side*i*3;
    const end=center+side*(65-i*5),r=Math.min(20,(b-a)/4);
    const path=`M ${x} ${a} C ${x} ${a+10} ${laneX} ${a+4} ${laneX} ${a+r} V ${b-r} Q ${laneX} ${b} ${laneX-side*r} ${b} H ${end}`;
    return <g key={i}>
     <path d={path} fill="none" stroke="#03080d" strokeWidth="4.4" strokeLinecap="round"/>
     <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"/>
     <path d={path} fill="none" stroke={dac?'#64717b':'#8ad2fb'} strokeOpacity=".55" strokeWidth=".65" strokeLinecap="round"/>
     {[{x,y:a},{x:end,y:b}].map((p,j)=><rect key={j} x={p.x-2.3} y={p.y-2.5} width="4.6" height="5" rx=".8" fill={dac?'#7d878d':'#293f50'} stroke="#9badb5" strokeWidth=".4"/>)}
    </g>;
   })}
   {[.3,.65].map(f=><rect key={f} x={Math.min(trunk,trunk+side*9)-3} y={top+(bottom-top)*f} width="15" height="5" rx="1" fill="#242d32" stroke="#6d7980" strokeWidth=".6"/>)}
  </g>;
 })}
 </svg>;
}

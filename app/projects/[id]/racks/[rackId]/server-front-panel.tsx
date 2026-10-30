"use client";
import {useHardwareMaterials} from './hardware-materials';
import {HardwareLabel} from './hardware-label';
import {useId} from 'react';

// AS-8126GS-TNMR front layout, MNL-2832. Bay outlines do not imply installed drives.
export function ServerFrontPanel(){
 const materials=useHardwareMaterials(["#101820", "#14212b", "#172438", "#1b2c3c", "#24323c", "#2b3943", "#33434e", "#344753", "#475964", "#566570", "#63747e", "#83949d", "#a7b4bd", "#b9c4cc"]);
  const mesh=useId().replace(/:/g,'');
  return <div className="server-front-panel"><svg viewBox="0 0 800 640" preserveAspectRatio="none" role="img" aria-label="AS-8126GS-TNMR front chassis: ventilation grille, M.2 slots, USB, VGA, eight NVMe bays, two SATA bays and five fans">{materials.defs}
    <defs><pattern id={mesh} width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="3.5" fill={materials.fill("#101820")}/></pattern></defs>
    <rect x="2" y="2" width="796" height="636" rx="5" fill={materials.fill("#566570")} stroke="#a7b4bd" strokeWidth="3"/>
    {[12,776].map(x=><g key={x}><rect x={x} y="14" width="12" height="610" fill={materials.fill("#24323c")}/>{[28,180,450,608].map(y=><circle key={y} cx={x+6} cy={y} r="4" fill={materials.fill("#b9c4cc")}/>)}</g>)}
    <rect x="32" y="14" width="736" height="308" fill={`url(#${mesh})`} stroke="#9aa8b3" strokeWidth="3"/>
    <rect x="32" y="330" width="736" height="84" fill={materials.fill("#33434e")} stroke="#9aa8b3"/>
    {[44,68].map(x=><rect key={x} x={x} y="344" width="18" height="48" rx="2" fill={materials.fill("#101820")} stroke="#a4b4bf"/>)}
    <HardwareLabel x="64" y="409" fontSize="15" textAnchor="middle" fill="#e4ecf2">M.2</HardwareLabel>
    {[110,478].map((x,i)=><g key={x}><rect x={x} y="344" width="208" height="48" rx="3" fill={materials.fill("#63747e")} stroke="#a7b4bd"/><path d={`M${x+12} 368h184`} stroke="#293943" strokeWidth="4"/><HardwareLabel x={x+104} y="380" textAnchor="middle" fontSize="18" fill="#e4ecf2">Slot {i+9}</HardwareLabel></g>)}
    <rect x="334" y="344" width="126" height="48" rx="7" fill={materials.fill("#475964")} stroke="#94a6b1"/>
    {[706,733].map(x=><rect key={x} x={x} y="345" width="18" height="38" fill={materials.fill("#172438")} stroke="#acbdca"/>)}<HardwareLabel x="729" y="406" textAnchor="middle" fontSize="15" fill="#e4ecf2">USB</HardwareLabel>
    <rect x="32" y="420" width="32" height="75" fill={materials.fill("#2b3943")} stroke="#a7b4bd"/><circle cx="48" cy="434" r="7" fill="none" stroke="#e4ecf2"/>{[456,469,482].map(y=><circle key={y} cx="48" cy={y} r="3" fill={materials.fill("#a7b4bd")}/>)}
    {Array.from({length:10},(_,i)=>{const x=74+Math.floor(i/2)*130,y=420+(i%2)*38;return <g key={i}><rect x={x} y={y} width="124" height="34" rx="2" fill={materials.fill("#14212b")} stroke="#93a6b2"/><rect x={x+98} y={y+6} width="19" height="22" rx="2" fill={i<8?'#706447':'#645364'}/><path d={`M${x+9} ${y+11}h76m-76 11h76`} stroke="#465a67"/><HardwareLabel x={x+46} y={y+23} textAnchor="middle" fontSize="16" fill="#e4ecf2">{i<8?'NVMe':'SATA'} {i}</HardwareLabel></g>;})}
    <path d="M732 435h23l-3 30h-17z" fill={materials.fill("#1b2c3c")} stroke="#a7b4bd"/><HardwareLabel x="744" y="487" fontSize="14" textAnchor="middle" fill="#e4ecf2">VGA</HardwareLabel>
    {Array.from({length:5},(_,i)=>{const x=32+i*148;return <g key={i}><rect x={x} y="504" width="144" height="121" rx="3" fill={`url(#${mesh})`} stroke="#a7b4bd" strokeWidth="2"/><circle cx={x+72} cy="562" r="45" fill="none" stroke="#7e919d" strokeWidth="3"/><circle cx={x+72} cy="562" r="13" fill={materials.fill("#344753")}/><rect x={x+127} y="548" width="10" height="52" rx="3" fill={materials.fill("#83949d")}/></g>;})}
  </svg></div>;
}

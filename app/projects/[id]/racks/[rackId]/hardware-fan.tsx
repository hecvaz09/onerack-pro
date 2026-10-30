'use client';
import {useHardwareMaterials} from './hardware-materials';
export function HardwareFan({x,y,r}:{x:number;y:number;r:number}){
 const materials=useHardwareMaterials(['#17232b','#40515d','#81939f']);
 return <g>{materials.defs}<circle cx={x} cy={y} r={r} fill={materials.fill('#17232b')} stroke="#91a1ab"/>
 <g transform={`translate(${x} ${y}) scale(${r/32})`}>
 {[0,60,120,180,240,300].map(angle=><path key={angle} transform={`rotate(${angle})`} d="M-4 -4C-22 -5 -28 -19 -16 -26C-3 -30 5 -16 4 -7Z" fill={materials.fill('#40515d')} stroke="#091117" strokeWidth=".6"/>)}
 </g>
 {[.38,.59,.8,.96].map(scale=><circle key={scale} cx={x} cy={y} r={r*scale} fill="none" stroke="#9babb5" strokeWidth={Math.max(.6,r*.021)}/>)}
 {[0,45,90,135].map(angle=><path key={angle} d={`M${x-r} ${y}h${r*2}`} transform={`rotate(${angle} ${x} ${y})`} stroke="#7d8f9a" strokeWidth="1.1"/>)}
 <circle cx={x} cy={y} r={r*.17} fill={materials.fill('#81939f')} stroke="#1a2832" strokeWidth="1"/>
 <circle cx={x} cy={y} r={r*.07} fill="#253640"/>
 </g>;
}

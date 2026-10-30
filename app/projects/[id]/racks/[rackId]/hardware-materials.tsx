'use client';
import {useId} from 'react';
// Per-instance IDs keep repeated rack faces and 3D copies independent.
export function useHardwareMaterials(colors: string[]) {
 const prefix='material-'+useId().replace(/[^a-zA-Z0-9_-]/g,'');
 const fill=(color:string)=>`url(#${prefix}-${color.slice(1)})`;
 const shade=(color:string,amount:number)=>'#'+[1,3,5].map(i=>{const v=parseInt(color.slice(i,i+2),16);return Math.round(amount>=0?v+(255-v)*amount:v*(1+amount)).toString(16).padStart(2,'0');}).join('');
 const defs=<defs>{colors.map(color=><linearGradient key={color} id={`${prefix}-${color.slice(1)}`} x1="0" y1="0" x2=".12" y2="1">{[[0,.24],[7,.08],[38,.02],[65,0],[94,-.22],[100,-.38]].map(([offset,amount])=><stop key={offset} offset={`${offset}%`} stopColor={shade(color,amount)}/>)}</linearGradient>)}</defs>;
 return {fill,defs};
}

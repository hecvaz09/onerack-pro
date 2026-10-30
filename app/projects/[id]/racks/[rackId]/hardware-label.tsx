import type {ReactNode} from 'react';
/** Shared artwork template. Keep plates outside connector outlines and vents. */
export function HardwareLabel({x,y,fontSize=10,textAnchor='start',children}:{x:number|string;y:number|string;fontSize?:number|string;textAnchor?:'start'|'middle'|'end';fill?:string;children:ReactNode}){
 const text=Array.isArray(children)?children.join(''):String(children??'');
 const size=Number(fontSize),width=Math.max(size*.7,text.length*size*.62)+4;
 const left=Number(x)-(textAnchor==='middle'?(width-4)/2+2:textAnchor==='end'?width-2:2);
 return <g className="hardware-label" pointerEvents="none"><rect x={left} y={Number(y)-size*.86} width={width} height={size*1.15} rx="1" fill="#24343e" stroke="none"/><text x={x} y={y} fontFamily="Arial, sans-serif" fontSize={size} textAnchor={textAnchor} fill="#edf3f7">{children}</text></g>;
}

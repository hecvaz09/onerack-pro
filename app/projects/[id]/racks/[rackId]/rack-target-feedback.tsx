"use client";
import {useState,type ReactNode,type PointerEvent} from 'react';

// No timer, pointer-move tracking, or rack rerender: update only when the target changes.
export function RackTargetFeedback({children}:{children:ReactNode}){
 const [label,setLabel]=useState('');
 function identify(event:PointerEvent<HTMLDivElement>){
  const target=event.target instanceof Element?event.target:null;
  const device=target?.closest('[data-device-block]');
  const control=target?.closest('a,[role="button"],button');
  const detail=control?.getAttribute('aria-label');
  setLabel(device?`${device.getAttribute('data-target-label') || ''}${detail?` · ${detail}`:''}`:'');
 }
 return <div className="rack-target-scope" onPointerOver={identify} onPointerLeave={()=>setLabel('')}>
  {children}
  {label&&<div className="rack-target-feedback" role="status">{label}</div>}
 </div>;
}

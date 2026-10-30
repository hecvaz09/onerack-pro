"use client";
import {useEffect,useRef,useState,type ReactNode,type MouseEvent} from 'react';
import {ConnectionsPanel,type ConnectionDevice,type ConnectionRow} from './connections-panel';

type Props={children:ReactNode;rackId:string;basePath:string;devices:ConnectionDevice[];connections:ConnectionRow[]};
export function RackConnectionWindow({children,...props}:Props){
 const [target,setTarget]=useState<{device:string;port:string}|null>(null);
 function open(event:MouseEvent<HTMLDivElement>){
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target instanceof Element?event.target.closest('a'):null;
  const href=link?.getAttribute('href');if(!href)return;
  const url=new URL(href,window.location.href);
  if(url.origin!==window.location.origin||url.pathname!==props.basePath||url.searchParams.get('tab')!=='network')return;
  const device=url.searchParams.get('fromDeviceId'),port=url.searchParams.get('fromPort');
  if(!device||!port||!props.devices.some(d=>d.id===device&&d.ports.some(p=>p.id===port)))return;
  event.preventDefault();event.stopPropagation();setTarget({device,port});
 }
 return <div style={{display:'contents'}} onClickCapture={open}>{children}{target&&<ConnectionDialog key={`${target.device}:${target.port}`} {...props} target={target} onClose={()=>setTarget(null)}/>}</div>;
}
function ConnectionDialog({rackId,basePath,devices,connections,target,onClose}:Omit<Props,'children'>&{target:{device:string;port:string};onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{dialog.current?.showModal();},[]);
 return <dialog ref={dialog} className="equipment-dialog rack-connection-dialog" aria-label="Port connection" onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} onCancel={e=>{e.preventDefault();onClose();}}>
  <div className="mb-4 flex justify-end"><button type="button" aria-label="Close port connection" onClick={onClose}>Close ×</button></div>
  <ConnectionsPanel compact rackId={rackId} matrixHref={`${basePath}/connections`} devices={devices} connections={connections} initialDeviceId={target.device} initialPort={target.port}/>
 </dialog>;
}

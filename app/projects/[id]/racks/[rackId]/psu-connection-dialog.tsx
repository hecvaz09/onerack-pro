"use client";
import {useEffect,useRef} from 'react';
import {psuConnections} from '@/lib/connection-highlights';
import type {RackGridDevice} from './physical-rack-grid';

export function PsuConnectionDialog({device,inlet,devices,onClose}:{device:RackGridDevice;inlet:number;devices:RackGridDevice[];onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{dialog.current?.showModal();},[]);
 const cords=psuConnections(devices,device.id,inlet);
 const end=device.startRU+Math.max(1,device.catalogDevice.heightRU)-1;
 const ru=`U${device.startRU}${end===device.startRU?'':`–U${end}`}`;
 const powerHref=device.networkHref?.replace('tab=network','tab=power');
 return <dialog ref={dialog} className="equipment-dialog rack-connection-dialog psu-connection-dialog" aria-label="PSU power connection" onClick={e=>e.stopPropagation()} onCancel={e=>{e.preventDefault();onClose();}}>
  <div className="flex items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">Power connection</p><h2 className="text-xl font-semibold">{device.label||device.catalogDevice.model} · PSU {inlet}</h2></div><button type="button" aria-label="Close power connection" onClick={onClose}>Close ×</button></div>
  <div className="my-5 rounded-xl border border-border bg-muted/30 p-4"><p className="text-2xl font-semibold">{ru} · PSU {inlet}</p><p className="text-muted-foreground">{device.catalogDevice.model}</p><p className="text-sm text-muted-foreground">Device location · {device.mounting.replaceAll('-',' ')}</p></div>
  {cords.length===0?<p>No PDU outlet is assigned to this PSU.</p>:<div className="grid gap-3">{cords.map(({pdu,outlet,notes})=>{
   const spec=pdu.catalogDevice.outlets?.find(o=>o.n===outlet);
   return <section key={`${pdu.id}:${outlet}`} className="rounded-xl border border-border p-4"><p className="text-sm text-muted-foreground">Saved cable destination</p><h3 className="text-lg font-semibold">{pdu.label||pdu.catalogDevice.model} · Outlet {outlet}</h3><p>{ru} · PSU {inlet} → {pdu.label||pdu.catalogDevice.model} · P{outlet}</p><p className="mt-2 text-sm text-muted-foreground">PDU location: {pdu.mounting.replaceAll('-',' ')}{pdu.catalogDevice.heightRU===0?' · Vertical 0U':` · U${pdu.startRU}`}</p>{spec&&<p className="text-sm">Connector: {spec.type}</p>}{notes&&<p className="mt-2 text-sm">{notes}</p>}</section>;
  })}</div>}
  {cords.length>1&&<p className="mt-3 text-amber-400">Multiple outlets are assigned to this PSU. Review the duplicate assignments.</p>}
  <p className="mt-4 text-sm text-muted-foreground">Shows saved cabling, not live power status. Shared chassis PSUs apply to the entire chassis RU range.</p>
  {powerHref&&<a className="mt-4 inline-block underline" href={powerHref}>Open power layout →</a>}
 </dialog>;
}

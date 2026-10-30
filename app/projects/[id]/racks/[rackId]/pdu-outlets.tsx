"use client";

import {RaritanController} from './raritan-controller';
import {outletDestination} from '@/lib/connection-highlights';
import type {RackGridDevice} from './physical-rack-grid';
import type {NetworkPort} from '@/lib/network-ports';
import { PX3_4068_OUTLETS } from "@/lib/pdu-models";
import type { Outlet, OutletAssignment } from "@/lib/equipment-details";

export function ModelPduOutlets({devices,letter,disabled,hidden,assignments,onOutlet,deviceId,networkHref,ports,connected}: {
  devices:RackGridDevice[];deviceId?:string;networkHref?:string;ports?:NetworkPort[];connected?:string[];
  letter:string;disabled?:boolean;hidden:boolean;assignments:Record<string,OutletAssignment>;onOutlet:(outlet:Outlet)=>void;
}) {
  return <div className="pdu-model-layout" style={{visibility:hidden?"hidden":undefined}}>
    <RaritanController deviceId={deviceId} href={networkHref} ports={ports} connected={connected} disabled={disabled}/>
    {PX3_4068_OUTLETS.filter(o=>o.n>=4&&o.type==="C13"&&(o.n-7)%4===0).map(o=><span key={o.cb} className="pdu-breaker-label" style={{left:`${o.x}%`,top:`${o.y-4}%`}}>C{o.cb}<small>{o.phase}</small></span>)}
    {PX3_4068_OUTLETS.map(outlet=><button key={outlet.n} type="button" data-power-pdu={deviceId} data-power-outlet={outlet.n} disabled={disabled} className={`pdu-model-outlet ${outlet.type.toLowerCase()} ${outlet.n<=3?"bottom-outlet":outlet.x>50?"right-outlet":"left-outlet"}`} style={{left:`${outlet.x}%`,top:`${outlet.y}%`}} aria-label={`PDU-${letter} outlet ${outlet.n} ${outlet.type} · ${outletDestination(assignments[outlet.n],devices)}`} title={`Outlet ${outlet.n} · ${outlet.type} · CB ${outlet.cb} · ${outlet.phase} · ${outletDestination(assignments[outlet.n],devices)}`} data-assigned={!!assignments[outlet.n]?.deviceId} onClick={()=>onOutlet(outlet)}><span>{outlet.n}</span><i aria-hidden="true"><b/><b/><b/></i></button>)}
    <div className="pdu-bottom-breakers" aria-label="Dedicated breakers C1 L1, C2 L2, C3 L3"><span>C1<br/>L1</span><span>C2<br/>L2</span><span>C3<br/>L3</span></div>
  </div>;
}

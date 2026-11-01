import {isB300PowerDevice,powerInputLabel,B300_INPUT_IDENTITY} from './b300-power-inputs.ts';
import {readDetails} from './equipment-details.ts';

// PDU assignments are the source of truth for both ends of a power cord.
export function connectedPsuInlets(devices:{id?:string;details?:unknown;catalogDevice:{category:string|null;sku?:string|null;model?:string}}[],deviceId:string):number[]{
 const b300=isB300PowerDevice(devices.find(d=>d.id===deviceId)?.catalogDevice);
 return [...new Set(devices.filter(d=>d.catalogDevice.category==='pdu').flatMap(d=>Object.values(readDetails(d.details).outlets).filter(o=>o.deviceId===deviceId&&Number.isInteger(o.inlet)&&o.inlet!>0&&(!b300||o.inputIdentity===B300_INPUT_IDENTITY)).map(o=>o.inlet!)))].sort((a,b)=>a-b);
}

export function psuConnections<T extends {id:string;details?:unknown;catalogDevice:{category:string|null;model?:string;sku?:string|null}}>(devices:T[],deviceId:string,inlet:number){
 const b300=isB300PowerDevice(devices.find(d=>d.id===deviceId)?.catalogDevice);
 return devices.filter(d=>d.catalogDevice.category==='pdu').flatMap(pdu=>
  Object.entries(readDetails(pdu.details).outlets).filter(([,a])=>a.deviceId===deviceId&&a.inlet===inlet&&(!b300||a.inputIdentity===B300_INPUT_IDENTITY))
  .map(([outlet,assignment])=>({pdu,outlet:Number(outlet),notes:assignment.notes})));
}

// Resolve hover destinations from current placements so moving a chassis updates its RU.
export function outletDestination(assignment:{deviceId:string;inlet?:number;inputIdentity?:string}|undefined,devices:{id:string;label:string|null;startRU:number;catalogDevice:{model:string;sku?:string|null;heightRU:number}}[]):string{
 if(!assignment?.deviceId)return 'Available';
 const device=devices.find(d=>d.id===assignment.deviceId);
 const psu=assignment.inlet?` · ${isB300PowerDevice(device?.catalogDevice)&&assignment.inputIdentity!==B300_INPUT_IDENTITY?'Legacy PSU '+assignment.inlet+' - exact input needs review':powerInputLabel(device?.catalogDevice,assignment.inlet)}`:'';
 if(!device)return `Connected · Equipment location unavailable${psu}`;
 const end=device.startRU+Math.max(1,device.catalogDevice.heightRU)-1;
 const location=device.catalogDevice.heightRU===0?'0U':`U${device.startRU}${end===device.startRU?'':`–U${end}`}`;
 return `Connected → ${device.label||device.catalogDevice.model} · ${location}${psu}`;
}


type PowerHoverDevice={id:string;label:string|null;startRU:number;details?:unknown;catalogDevice:{model:string;sku?:string|null;heightRU:number;category:string|null;outlets?:{n:number;type:string;cb:number;phase:string}[]}};
export function psuHoverDescription(devices:PowerHoverDevice[],device:PowerHoverDevice,inlet:number):string{
 const end=device.startRU+Math.max(1,device.catalogDevice.heightRU)-1;
 const location=device.catalogDevice.heightRU===0?'0U':`U${device.startRU}${end===device.startRU?'':`–U${end}`}`;
 const prefix=`${device.label||device.catalogDevice.model} · ${location} · ${powerInputLabel(device.catalogDevice,inlet)}`;
 const cords=psuConnections(devices,device.id,inlet);
 if(!cords.length)return `${prefix} · Not connected — no PDU outlet assigned`;
 return `${prefix} · Connected → ${cords.map(({pdu,outlet})=>{
  const spec=pdu.catalogDevice.outlets?.find(o=>o.n===outlet);
  return `${pdu.label||pdu.catalogDevice.model} · P${outlet}${spec?` · ${spec.type}${spec.cb?` · B${spec.cb}`:''}${spec.phase?` · ${spec.phase}`:''}`:''}`;
 }).join(' / ')}${cords.length>1?' · Multiple assignments — review':''}`;
}

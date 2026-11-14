import {individualPowerFixture,individualEquipment} from './individual-power';
import type {Supply} from '../../lib/feed-power';

export function fourPsuPlanFixture(){
 const f=individualPowerFixture(false),server=structuredClone(f.rack.devices.find(d=>d.id==='server')!),pdu=structuredClone(f.rack.devices.find(d=>d.id==='pdu-a')!);
 server.catalogDevice.model='Synthetic four-PSU GPU server';server.catalogDevice.sku='SYNTHETIC-FOUR-PSU';server.catalogDevice.heightRU=4;server.startRU=5;server.label='GPU';
 f.inputs.budgets={server:{watts:4350,pf:.9,cords:4,minimumCords:2,connector:'C19',minVoltage:220,maxVoltage:240,estimateSource:'Synthetic planning estimate'},storage:{watts:1300,pf:.9,cords:2,minimumCords:1,connector:'C19',minVoltage:220,maxVoltage:240}};
 f.rack.devices=['a1','a2','b1','b2'].map((id,i)=>{
  const profile:Supply={id,name:id,topology:'three-phase-wye',voltage:415,limitAmps:24,feed:i<2?'A':'B',confirmed:false,
   branches:Object.fromEntries(Array.from({length:6},(_,b)=>['B'+(b+1),16])),
   outlets:Array.from({length:24},(_,n)=>({n:n+1,connectors:['C19'],branch:'B'+(Math.floor(n/4)+1),phase:(['L1','L2','L3'] as const)[Math.floor(n/4)%3],limitAmps:16}))};
  return {...structuredClone(pdu),id,label:id,mounting:i<2?'rear-right':'rear-left',details:{feed:profile.feed,outlets:id==='b1'?{1:{deviceId:'storage',inlet:2,notes:'Preserve this saved connection',locked:true}}:{}},catalogDevice:{...pdu.catalogDevice,rawData:{electricalProfile:profile,pdu:{outlets:profile.outlets.map(o=>({n:o.n,type:'C19',phase:o.phase,cb:Number(o.branch!.slice(1))}))}}}};
 });
 f.rack.devices.push({...structuredClone(server),id:'storage',startRU:1,label:'Storage'},server);
 return {...f,equipment:individualEquipment(f.rack)};
}

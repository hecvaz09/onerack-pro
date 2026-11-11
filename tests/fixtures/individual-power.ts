import {b300PowerFixture} from './b300-power';
import type {FeedEquipment} from '../../lib/feed-rack';
import type {Supply} from '../../lib/feed-power';

export function individualPowerFixture(unknownPdu=true){
 const f=b300PowerFixture(),server=f.rack.devices.find(d=>d.id==='b300')!;
 server.id='server';server.label='Same server label';server.catalogDevice.sku='SYNTHETIC-1U';server.catalogDevice.model='Synthetic server';server.catalogDevice.rawData={};
 delete f.inputs.budgets.b300;
 f.inputs.budgets.server={watts:556,pf:.87,connector:'C13',minVoltage:100,maxVoltage:240,cordLimitAmps:10,psuAcCapacity:1000};
 for(const d of f.rack.devices.filter(d=>d.catalogDevice.category==='pdu')){
  const profile:Supply={id:d.id,name:d.id,feed:d.id==='pdu-a'?'A':'B',topology:'single-phase',confirmed:true,voltage:208,limitAmps:24,
   ...(unknownPdu?{}:{branches:{B1:20}}),outlets:Array.from({length:8},(_,i)=>({n:i+1,connectors:['C13'],...(unknownPdu?{}:{branch:'B1',limitAmps:10})}))};
  d.catalogDevice.rawData={electricalProfile:profile,pdu:{outlets:profile.outlets.map(o=>({n:o.n,type:'C13',cb:1,phase:'L1'}))}};
 }
 for(let i=0;i<3;i++)f.rack.devices.push({...structuredClone(server),id:'missing-'+i,label:'Same server label',startRU:18+i});
 return {rack:f.rack,inputs:f.inputs,equipment:individualEquipment(f.rack),cord:{pduId:'pdu-a',outlet:1,deviceId:'server',inlet:1}};
}
export function individualEquipment(rack:ReturnType<typeof b300PowerFixture>['rack']):FeedEquipment[]{
 return rack.devices.map(d=>({id:d.id,name:d.label,sku:d.catalogDevice.sku,model:d.catalogDevice.model,startRU:d.startRU,mounting:d.mounting,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData,details:d.details}));
}

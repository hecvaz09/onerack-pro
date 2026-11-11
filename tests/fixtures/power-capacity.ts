import {individualPowerFixture,individualEquipment} from './individual-power';
import type {Supply} from '../../lib/feed-power';

export function powerCapacityFixture(){
 const f=individualPowerFixture(false),template=structuredClone(f.rack.devices.find(d=>d.id==='server')!);
 f.rack.devices=f.rack.devices.filter(d=>d.catalogDevice.category==='pdu');
 f.inputs.budgets={};
 for(const pdu of f.rack.devices){
  const profile=(pdu.catalogDevice.rawData as {electricalProfile:Supply}).electricalProfile;
  profile.branches={B1:16,B2:16};profile.outlets=Array.from({length:40},(_,i)=>({n:i+1,connectors:['C13'],branch:i%8<4?'B1':'B2',limitAmps:10}));
  pdu.label='Same PDU label';
  pdu.catalogDevice.rawData={electricalProfile:profile,pdu:{outlets:profile.outlets.map(o=>({n:o.n,type:'C13',cb:o.branch==='B1'?1:2,phase:'L1'}))}};
  pdu.details={...pdu.details as object,outlets:Object.fromEntries(Array.from({length:8},(_,i)=>[i+1,{deviceId:'server-'+(i+1),inlet:pdu.id==='pdu-a'?1:2,notes:'Planning draft:',locked:true}]))};
 }
 for(let i=1;i<=9;i++){
  f.rack.devices.push({...structuredClone(template),id:'server-'+i,label:'Server U'+i,startRU:i,catalogDevice:{...template.catalogDevice,heightRU:1}});
  f.inputs.budgets['server-'+i]={watts:556,pf:.9,minVoltage:100,maxVoltage:240,estimateSource:'Synthetic planning estimate'};
 }
 return {...f,equipment:individualEquipment(f.rack),cord:{pduId:'pdu-a',outlet:9,deviceId:'server-9',inlet:1}};
}

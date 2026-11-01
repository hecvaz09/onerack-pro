import {readFileSync} from 'node:fs';
import type {FeedEquipment} from '../../lib/feed-rack';
import type {FeedInputs,Supply,Cord} from '../../lib/feed-power';
export function b300PowerFixture(){
 const entry=JSON.parse(readFileSync('data/catalog/supermicro-as-8126gs-nb3rt.json','utf8'));
 const makeSupply=(id:string,feed:'A'|'B'):Supply=>({id,name:id,feed,confirmed:true,topology:'three-phase-wye',voltage:400,limitAmps:32,branches:Object.fromEntries(Array.from({length:12},(_,i)=>[String(i+1),20])),outlets:Array.from({length:12},(_,i)=>({n:i+1,connectors:['C19'],limitAmps:16,branch:String(i+1),phase:(['L1','L2','L3'] as const)[i%3]}))});
 const supplies=[makeSupply('pdu-a','A'),makeSupply('pdu-b','B')];
 const equipment:FeedEquipment[]=supplies.map(p=>({id:p.id,name:p.id+' · U1',model:'Synthetic 3-phase PDU',sku:'SYNTHETIC-PDU',mounting:p.feed==='A'?'rear-right':'rear-left',startRU:1,category:'pdu',rawData:{electricalProfile:p,pdu:{outlets:p.outlets.map(o=>({n:o.n,type:'C19',cb:Number(o.branch),phase:o.phase}))}},details:{feed:p.feed,whip:'down',nodes:{},outlets:{},future:{keep:true}}}));
 equipment.push({id:'b300',name:'Synthetic B300 · U9',sku:entry.sku,model:entry.model,mounting:'front',startRU:9,category:'chassis',rawData:{systemSpecs:entry.specs},details:{notes:'Synthetic fixture only'}});
 const inputs:FeedInputs={headroomPercent:0,budgets:{b300:{watts:12000,pf:1,connector:'C19',minVoltage:200,maxVoltage:240,cordLimitAmps:16}}};
 const rack={id:'synthetic-rack',projectId:'synthetic-project',name:'Synthetic rack',heightRU:42,configuration:{feedPower:inputs,future:{keep:true}},updatedAt:new Date('2026-10-31T00:00:00Z'),devices:equipment.map(e=>({id:e.id,catalogDeviceId:'catalog-'+e.id,startRU:e.startRU!,mounting:e.mounting!,label:e.id==='b300'?'Synthetic B300':e.id,details:e.details,catalogDevice:{id:'catalog-'+e.id,sku:e.sku!,model:e.model!,vendor:'Synthetic',heightRU:e.category==='pdu'?0:8,category:e.category,rawData:e.rawData}}))};
 return {equipment,inputs,supplies,rack};
}
export function withCables(equipment:FeedEquipment[],cords:Cord[]):FeedEquipment[]{return equipment.map(e=>({...e,details:e.category==='pdu'?{...e.details as object,outlets:Object.fromEntries(cords.filter(c=>c.pduId===e.id).map(c=>[c.outlet,{deviceId:c.deviceId,inlet:c.inlet,notes:'',locked:true,...(c.inputIdentity?{inputIdentity:c.inputIdentity}:{})}]))}:e.details}));}

import {isB300PowerDevice} from './b300-power-inputs.ts';
import {modelAcLimits} from './model-power-reference.ts';
import {catalogPowerLimits} from './catalog-power-limits.ts';
import {readPx3Settings} from './px3-power.ts';
import {pduModelId,PX3_4068_OUTLETS,PX3_4068_POWER} from './pdu-models.ts';
import {readSystemSpecs} from './system-specs.ts';
import {readDetails} from './equipment-details.ts';
import type {Supply,Load,Cord,FeedInputs} from './feed-power.ts';
export type FeedEquipment={id:string;name:string;startRU?:number;model?:string;sku?:string|null;mounting?:string;rawData:unknown;details:unknown;category:string|null};
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
export function readFeedInputs(raw:unknown,equipment?:FeedEquipment[]):FeedInputs {
  const v=obj(obj(raw).feedPower);
  if(!obj(raw).feedPower&&obj(raw).px3Power&&equipment){
   const old=readPx3Settings(raw),budgets:FeedInputs['budgets']={};
   for(const [id,b] of Object.entries(old.budgets))if(!b.passive)budgets[id]={watts:b.watts,pf:b.pf??old.pf,cords:(b.psusPerFeed??1)*2,minimumCords:b.psusPerFeed??1,connector:b.connector,cordLimitAmps:b.cordAmps??(b.connector==='C19'?16:12),psuAcCapacity:b.psuAcCapacity,...(!b.confirmed||b.testOnly?{estimateSource:'Imported unconfirmed/test power assumptions; enter verified AC watts and PSU limits.'}:{})};
   const inputs:FeedInputs={headroomPercent:old.headroomPercent??0,budgets};
   const supplies=feedRack(equipment,inputs).supplies;
   inputs.supplies=Object.fromEntries(supplies.filter(p=>pduModelId(equipment.find(e=>e.id===p.id)?.rawData)).map(p=>[p.id,{...p,voltage:old.voltage,limitAmps:old.inputLimit,confirmed:old.supplyConfirmed,outlets:p.outlets.map(o=>({...o,reserved:old.reserveDedicated&&Number(o.branch)<=3}))}]));
   return inputs;
  }
  return {...(v.cablePolicy?{cablePolicy:v.cablePolicy as FeedInputs['cablePolicy']} :{}),headroomPercent:typeof v.headroomPercent==='number'?v.headroomPercent:0,budgets:obj(v.budgets) as FeedInputs['budgets'],...(v.supplies?{supplies:obj(v.supplies) as FeedInputs['supplies']}:{})};
}
export function feedRack(equipment:FeedEquipment[],inputs:FeedInputs){
  const supplies:Supply[]=[],loads:Load[]=[],cords:Cord[]=[];
  for(const e of equipment){
    const raw=obj(e.rawData),details=obj(e.details);
    if(e.category==='pdu'){
      const profile=obj(raw.electricalProfile),preset=pduModelId(raw)?{
       topology:'three-phase-wye' as const,voltage:400,limitAmps:PX3_4068_POWER.inputAmps,confirmed:false,
       branches:Object.fromEntries(Array.from({length:15},(_,i)=>[String(i+1),PX3_4068_POWER.breakerAmps])),
       outlets:PX3_4068_OUTLETS.map(o=>({n:o.n,connectors:[o.type],branch:String(o.cb),phase:o.phase as 'L1'|'L2'|'L3',limitAmps:PX3_4068_POWER.outletAmps[o.type]}))
      }:undefined;
      const plannedFeed=(details.feed==='A'||details.feed==='B'?details.feed:e.mounting?.startsWith('rear-right')?'A':e.mounting?.startsWith('rear-left')?'B':undefined) as Supply['feed'];
      const configured=inputs.supplies?.[e.id];
      supplies.push({feed:plannedFeed,topology:profile.topology as Supply['topology'],voltage:Number(profile.voltage)||0,limitAmps:Number(profile.limitAmps)||0,outlets:Array.isArray(profile.outlets)?profile.outlets as Supply['outlets']:[],branches:profile.branches as Supply['branches'],...preset,...configured,id:e.id,name:e.name});
      for(const [n,a] of Object.entries(readDetails(e.details).outlets))if(a.deviceId)cords.push({pduId:e.id,outlet:Number(n),deviceId:a.deviceId,inlet:a.inlet||0,...(a.inputIdentity?{inputIdentity:a.inputIdentity}:{})});
    }else if(e.category!=='accessory'){
      const p:Record<string,unknown>={...modelAcLimits(e.model||'',inputs.budgets[e.id]?.connector??obj(raw.powerLoad).connector),...catalogPowerLimits(raw),...Object.fromEntries(Object.entries(obj(raw.powerLoad)).filter(([,v])=>v!==undefined)),...Object.fromEntries(Object.entries(inputs.budgets[e.id]||{}).filter(([,v])=>v!==undefined))},b=inputs.budgets[e.id];
      const b300=isB300PowerDevice(e);
      const psus=readSystemSpecs(raw).components.filter(c=>c.kind==='psu').reduce((n,c)=>n+c.quantity,0);
      loads.push({id:e.id,name:e.name,watts:b?.watts,pf:b?.pf,estimateSource:b?.estimateSource,measurement:b?.measurement,cords:b300?12:Number(p.cords)||psus||2,minimumCords:b300?1:Number(p.minimumCords)||1,...(b300?{assessment:"pdu-capacity" as const}:{}),connector:String(p.connector||''),minVoltage:Number(p.minVoltage)||undefined,maxVoltage:Number(p.maxVoltage)||undefined,cordLimitAmps:Number(p.cordLimitAmps)||undefined,psuAcCapacity:Number(p.psuAcCapacity)||undefined});
    }
  }
  return {supplies,loads,cords};
}

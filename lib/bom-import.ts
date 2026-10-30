import {catalogInputError,type CatalogInput} from './system-specs.ts';
import {mountingError} from './rack-mounting.ts';
import {px3SettingsError,type PowerBudget} from './px3-power.ts';

export type BomConfig=CatalogInput & {power?:PowerBudget;pduModel?:string};
export type BomPlacement={rack:string;sku:string;label:string;startRU:number;mounting:string};
export type TestBom={version:1;testOnly:true;project:string;customer:string;configurations:BomConfig[];placements:BomPlacement[]};
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;

// Test import only: new isolated projects, no matching or overwriting live SKUs.
export function parseTestBom(source:string):{bom:TestBom;racks:string[];counts:Record<string,number>} {
  if(source.length>500_000)throw Error('Use a BOM smaller than 500 KB.');
  let raw:unknown;try{raw=JSON.parse(source);}catch{throw Error('Choose a valid OneRack BOM JSON package.');}
  const b=obj(raw);
  if(b.version!==1||b.testOnly!==true||!text(b.project,150)||!text(b.customer,150))throw Error('This importer requires a version 1 synthetic test BOM with a project and customer.');
  if(!Array.isArray(b.configurations)||!b.configurations.length||b.configurations.length>100||!Array.isArray(b.placements)||!b.placements.length||b.placements.length>2000)throw Error('Use 1–100 configurations and 1–2,000 installed items.');
  const configurations:BomConfig[]=[],bySku=new Map<string,BomConfig>();
  for(const value of b.configurations){
    const c=obj(value);const candidate={sku:c.sku,vendor:c.vendor,model:c.model,heightRU:c.heightRU,category:c.category,specs:c.specs} as CatalogInput;
    const error=catalogInputError(candidate);if(error)throw Error(`${String(c.sku||'Configuration')}: ${error}`);
    candidate.sku=candidate.sku.trim();
    if(bySku.has(candidate.sku))throw Error(`Duplicate configuration SKU: ${candidate.sku}`);
    if(candidate.specs.status!=='draft')throw Error('Synthetic specifications must remain draft.');
    if(c.pduModel!==undefined&&(candidate.category!=='pdu'||!['PX3-4068YV-V2-K1','PX3-4068YV-V2-K2'].includes(String(c.pduModel))))throw Error('Only the existing Raritan K1/K2 electrical profiles are supported in this test.');
    let power:PowerBudget|undefined;
    if(c.power!==undefined){
      const p=obj(c.power);
      power={watts:p.watts,connector:p.connector,passive:p.passive,confirmed:false,source:'SYNTHETIC BOM TEST — review before planning',pf:p.pf,cordAmps:p.cordAmps,psusPerFeed:p.psusPerFeed,psuAcCapacity:p.psuAcCapacity,testOnly:true} as PowerBudget;
      const e=px3SettingsError({voltage:400,pf:.975,inputLimit:80,reserveDedicated:false,supplyConfirmed:false,budgets:{test:power}});
      if(e||power.watts<=0||candidate.category==='pdu')throw Error(`${candidate.sku}: ${e||'Invalid load budget.'}`);
    }
    const config={...candidate,...(power?{power}:{}),...(c.pduModel?{pduModel:String(c.pduModel)}:{})};
    configurations.push(config);bySku.set(config.sku,config);
  }
  const placements:BomPlacement[]=[],racks=new Map<string,{id:string;name:string;startRU:number;heightRU:number;mounting:string}[]>(),labels=new Set<string>(),counts:Record<string,number>=Object.create(null);
  for(const value of b.placements){
    const p=obj(value);if(!text(p.rack,100)||!text(p.label,150)||!text(p.sku,200)||!Number.isInteger(p.startRU)||Number(p.startRU)<1||typeof p.mounting!=='string')throw Error('Every installed item needs a rack, SKU, unique label and valid mounting position.');
    const config=bySku.get(String(p.sku));if(!config)throw Error(`Unknown configuration: ${String(p.sku)}`);
    const label=String(p.label).trim();if(labels.has(label))throw Error(`Duplicate system label: ${label}`);labels.add(label);
    const rack=String(p.rack).trim(),items=racks.get(rack)||[];
    const error=mountingError(48,Number(p.startRU),config.heightRU,config.category,p.mounting,items,undefined,{pockets:true,pduA:true,pduB:true});
    if(error)throw Error(`${rack} / ${label}: ${error}`);
    items.push({id:label,name:label,startRU:Number(p.startRU),heightRU:config.heightRU,mounting:p.mounting});racks.set(rack,items);
    placements.push({rack,sku:config.sku,label,startRU:Number(p.startRU),mounting:p.mounting});counts[config.sku]=(counts[config.sku]||0)+1;
  }
  if(racks.size>100)throw Error('Use up to 100 racks per test import.');
  if(configurations.some(c=>!counts[c.sku]))throw Error('Remove unused configurations from the BOM.');
  return {bom:{version:1,testOnly:true,project:String(b.project).trim(),customer:String(b.customer).trim(),configurations,placements},racks:[...racks.keys()],counts};
}

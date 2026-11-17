import type {SystemSpecs,SystemComponent} from './system-specs.ts';
import {completeManufacturerNetworkReferences} from './manufacturer-network-references.ts';
// Reviewed, exact-model facts. Never infer installed options, demand, PF, cord
// ratings or protected outlet banks from a base model or PSU output rating.
const SYS510='https://www.supermicro.com/en/products/system/WIO/1U/SYS-510P-WTR';
const B300='https://www.supermicro.com/en/products/system/gpu/8u/as-8126gs-nb3rt';
const ARISTA='https://www.arista.com/en/qsg-7010-series-1ru/7010-series-1ru-overview';
const ARISTA_CABLE='https://www.arista.com/en/qsg-7010-series-1ru/7010-series-1ru-cabling-the-switch';
const AOC100='https://store.supermicro.com/us_en/networking-100g-aoc-s100g-m2c-p.html';
const GPU420='https://www.supermicro.com/en/products/system/gpu/4u/sys-420gp-tnr';
const GPU821='https://www.supermicro.com/manuals/superserver/8U/MNL-2637.pdf';
const TNMR='https://www.supermicro.com/en/products/system/gpu/8u/as-8126gs-tnmr';
const normalized=(s:string)=>s.trim().toUpperCase().replace(/–/g,'-').replace(/\s/g,'');
export function manufacturerSpecifications(sku:string,current:SystemSpecs){
 const specs=structuredClone(current),changes:{component:string;field:string;value:string;source:string}[]=[],conflicts:string[]=[];
 const key=sku.trim().toUpperCase();
 function fill(c:SystemComponent,field:string,value:string,source:string,reviewedAt='2026-11-10'){
  const old=c.attributes[field];
  const expandsSpeeds=field==='supportedSpeedsGbps'&&old&&old.split(',').every(n=>value.split(',').map(Number).includes(Number(n)));
  if(old&&normalized(old)!==normalized(value)&&!expandsSpeeds){conflicts.push(`${c.model}: ${field} differs from the manufacturer reference; existing value preserved.`);return;}
  const review=c.fieldReviews?.[field];
  if(review&&review.value===old&&review.model===c.model&&review.manufacturer===c.manufacturer&&(!expandsSpeeds||old===value))return;
  c.attributes[field]=expandsSpeeds?value:old||value;c.fieldReviews={...c.fieldReviews,[field]:{value:c.attributes[field],model:c.model,manufacturer:c.manufacturer,source,reviewedAt}};
  changes.push({component:c.model,field,value:c.attributes[field],source});
 }
 for(const c of specs.components){
  if(c.kind==='network'&&c.model.trim().toUpperCase()==='AOC-S100G-M2C-P')for(const [field,value] of Object.entries({ports:'2',protocol:'Ethernet',connector:'QSFP28',supportedSpeedsGbps:'10,25,40,50,100'}))fill(c,field,value,field==='supportedSpeedsGbps'?'https://www.supermicro.com/manuals/other/datasheet-AOC-S100G-m2C__01-65.pdf':AOC100);
  if(key==='SYS-510P-WTR'){
   if(c.kind==='psu'&&c.model.trim().toUpperCase()==='PWS-504P-1R'&&c.manufacturer.toLowerCase()==='supermicro')fill(c,'inputVoltage','100-240 VAC',SYS510);
   if(c.kind==='network'&&Number(c.attributes.ports)===2&&/^onboard$/i.test(c.attributes.slot||'')&&/X550/i.test(c.model))for(const [field,value] of Object.entries({ports:'2',protocol:'Ethernet',connector:'RJ45',supportedSpeedsGbps:'10'}))fill(c,field,value,SYS510);
   if(c.kind==='network'&&Number(c.attributes.ports)===1&&/^(BMC|MGMT)$/i.test(c.attributes.slot||''))for(const [field,value] of Object.entries({ports:'1',protocol:'Ethernet',connector:'RJ45',supportedSpeedsGbps:'1'}))fill(c,field,value,SYS510);
  }
  if(key==='AS-8126GS-NB3RT'&&c.kind==='psu'&&c.quantity===6&&c.attributes.outputWatts==='6600'&&c.manufacturer.toLowerCase()==='supermicro')fill(c,'inputVoltage','200-240 VAC',B300);
  if(key==='AS-8126GS-NB3RT'&&c.kind==='network'&&c.quantity===8&&c.model==='Integrated ConnectX-8 SuperNIC / OSFP'&&c.attributes.ports==='1'&&c.attributes.connector==='OSFP'&&!c.attributes.speedGbps)
   fill(c,'supportedSpeedsGbps','800',B300,'2026-11-15');
  // Exact chassis/reference configuration only. Quantity and output must match;
  // retain unknown FRUs and never turn output ratings into AC-load budgets.
  if(c.kind==='psu'&&c.manufacturer.toLowerCase()==='supermicro'){
   if(key==='SYS-420GP-TNR'&&c.quantity===4&&c.attributes.outputWatts==='2000'){
    fill(c,'inputVoltage','200-240 VAC',GPU420,'2026-11-15');
    fill(c,'redundancy','2+2','https://www.supermicro.com/en/products/system/datasheet/SYS-420GP-TNR','2026-11-15');
   }
   if(key==='SYS-821GV-TNR'&&c.quantity===6&&c.attributes.outputWatts==='3000'){
    fill(c,'inputVoltage','200-240 VAC',GPU821,'2026-11-15');fill(c,'redundancy','3+3',GPU821,'2026-11-15');
   }
   if(['AS-8126GS-TNMR','AS-8126GS-TNMR-2CX8-IB-DRAFT'].includes(key)&&c.quantity===6&&c.attributes.outputWatts==='5250'){
    fill(c,'inputVoltage','200-240 VAC',TNMR,'2026-11-15');fill(c,'redundancy','3+3',TNMR,'2026-11-15');
   }
  }
  if(key==='DCS-7010TX-48-R'&&c.kind==='psu'&&c.quantity===2&&/\bAC\b/i.test(c.model)){
   fill(c,'inputVoltage','100-240 VAC',ARISTA);fill(c,'inlet','C14',ARISTA_CABLE);
  }
  if(['SYS-211GT-HNTR-CU1-TT019','SYS-211GT-HNTR-CK2-TT019'].includes(key)&&c.kind==='psu'&&c.id==='grandtwin-high-line-ac-reference'&&c.quantity===2){
   const source='https://www.supermicro.com/manuals/superserver/2U/MNL-2513.pdf';
   fill(c,'inputVoltage','200-240 VAC',source,'2026-11-16');fill(c,'redundancy','1+1',source,'2026-11-16');
  }
  if(key==='QM8700'&&c.kind==='psu'&&c.id==='ref-psu'&&c.quantity===2){
   const source='https://network.nvidia.com/sites/default/files/doc-2020/pb-qm8700.pdf';
   fill(c,'inputVoltage','100-127 / 200-240 VAC',source,'2026-11-16');fill(c,'redundancy','1+1',source,'2026-11-16');
  }
 }
 completeManufacturerNetworkReferences(key,specs,fill);
 return {specs,changes,conflicts};
}

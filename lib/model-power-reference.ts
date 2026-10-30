// Shared, reviewed manufacturer references. No customer/project-specific matching.
// Never infer AC demand by multiplying redundant PSU capacities or input amps.
type ModelPowerReference={model:string;aliases?:string[];maximumAcWatts:number|null;psuWatts:number|null;psuCount:number;minVoltage:number|null;maxVoltage:number|null;inputAmps:number|null;source:string;section:string;reviewedAt:string;notes?:string};
export const MODEL_POWER_REFERENCES:readonly ModelPowerReference[] = [
  {model:'N9K-C9336C-FX2',aliases:['Nexus 9336C-FX2','N9336C-FX2'],maximumAcWatts:719,psuWatts:null,psuCount:2,minVoltage:100,maxVoltage:240,inputAmps:null,
    source:'https://www.cisco.com/c/en/us/products/collateral/switches/nexus-9000-series-switches/datasheet-c78-742282.html',
    section:'Table 2: maximum AC input consumption and standard AC voltage',reviewedAt:'2026-10-21',
    notes:'719 W maximum whole-switch AC draw. Standard AC input 100–240 V. AC PSU options are 750 W and 1100 W output; installed part must be identified.'},
  {model:'N9K-C92348GC-X',aliases:['Nexus 92348GC-X','N92348GC-X'],maximumAcWatts:245,psuWatts:400,psuCount:2,minVoltage:100,maxVoltage:240,inputAmps:null,
    source:'https://www.cisco.com/c/en/us/products/collateral/switches/nexus-9000-series-switches/datasheet-c78-735989.html',
    section:'Table 2: maximum AC input consumption and standard AC voltage',reviewedAt:'2026-10-21',
    notes:'245 W maximum whole-switch AC draw. Standard AC input 100–240 V. The 400 W AC PSU rating is DC output, not consumption or a cord limit.'},
  {model:'SYS-211GT-HNTR',maximumAcWatts:null,psuWatts:null,psuCount:2,minVoltage:null,maxVoltage:null,inputAmps:null,
    source:'https://www.supermicro.com/en/products/system/grandtwin/2u/sys-211gt-hntr',
    section:'Power supply: shared redundant PSUs with voltage-dependent output',reviewedAt:'2026-10-21',
    notes:'Two shared redundant PSUs. Output per PSU: 1200 W at 100–127 VAC; 1800 W at 200–220 VAC; 1980 W at 220–230 VAC; 2090 W at 230–240 VAC (TUV/CB). Additional UL/cUL tiers are documented by the manufacturer. These are output capacities, not chassis AC consumption. Installed workload and applicable rating remain required.'},
  {model:'S3900-48T6S-R', maximumAcWatts:51, psuWatts:78, psuCount:2,
    minVoltage:100,maxVoltage:240,inputAmps:2,
    source:'https://resource.fs.com/mall/resource/s3900-r-series-switches-data-sheet.pdf',
    section:'Table 2: Power supply and fan specifications',reviewedAt:'2026-10-20'},
  {model:'MQM8700-HS2F',maximumAcWatts:null,psuWatts:1100,psuCount:2,
    minVoltage:200,maxVoltage:240,inputAmps:4.4,
    source:'https://networking-docs.nvidia.com/qm87xx/public-view/specifications',
    section:'Power: 100–127 V / 4.5 A and 200–240 V / 4.4 A; consumption requires NVOnline reference 1080832',reviewedAt:'2026-10-20'},
];
export function modelPowerReference(model:string){
  // Catalog display labels may include a customer suffix; require a full model token.
  const normalized=model.toUpperCase().trim();
  if(/\b(TEST|SYNTHETIC)\b/.test(normalized))return undefined;
  return MODEL_POWER_REFERENCES.find(r=>[r.model,...(r.aliases||[])].some(token=>{
    const name=token.toUpperCase(),at=normalized.indexOf(name);
    return at>=0&&!/[A-Z0-9-]/.test(normalized[at-1]||' ')&&!/[A-Z0-9-]/.test(normalized[at+name.length]||' ');
  }));
}
// Only an explicitly AC-connected installation can inherit standard AC voltage.
// Never infer PSU AC capacity, cord ampacity or PF from a model's DC output.
export function modelAcLimits(model:string,connector:unknown){
 const ref=modelPowerReference(model);
 return (connector==='C13'||connector==='C19')&&ref?.model.startsWith('N9K-')&&ref.minVoltage&&ref.maxVoltage
  ?{minVoltage:ref.minVoltage,maxVoltage:ref.maxVoltage}:{};
}

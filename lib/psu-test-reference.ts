import {readSystemSpecs} from './system-specs.ts';

// Bench results for one exact PSU, not server consumption or an AC/cord limit.
export const PWS_504P_1R_TEST = {
 model:'PWS-504P-1R', ratedDcWatts:500, minVoltage:100, maxVoltage:240,
 ratedInputAmps:'6.1–2.6', frequencyHz:'50–60', testVoltage:230, testFrequency:60,
 testedAt:'2010-08-16', reportId:'SO-179.3', typicalEfficiencyPercent:94.11,
 averageEfficiencyPercent:92.85,
 source:'https://www.supermicro.com/products/powersupply/80PLUS/80PLUS_PWS-504P-1R.pdf',
 points:[
  {loadPercent:10,inputWatts:60,outputWatts:51,currentAmps:.30,powerFactor:.87,efficiencyPercent:86.16},
  {loadPercent:20,inputWatts:112,outputWatts:103,currentAmps:.53,powerFactor:.92,efficiencyPercent:91.84},
  {loadPercent:50,inputWatts:271,outputWatts:255,currentAmps:1.22,powerFactor:.97,efficiencyPercent:94.11},
  {loadPercent:100,inputWatts:547,outputWatts:507,currentAmps:2.43,powerFactor:.98,efficiencyPercent:92.61},
 ],
} as const;

export function psuTestReference(model:string,raw:unknown){
 if(!/(^|[^A-Z0-9-])SYS-510P-WTR($|[^A-Z0-9-])/i.test(model))return undefined;
 const psus=readSystemSpecs(raw).components.filter(c=>c.kind==='psu');
 // Similar part names (including -1R2) must not inherit this report.
 if(psus.some(p=>p.model.trim()&&p.model.trim().toUpperCase()!==PWS_504P_1R_TEST.model))return undefined;
 return PWS_504P_1R_TEST;
}

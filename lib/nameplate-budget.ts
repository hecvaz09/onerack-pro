import {readSystemSpecs} from './system-specs.ts';
// DC output capacity is converted to an AC planning envelope, never measured demand.
export function nameplateBudget(raw:unknown,requiredPsus:number,efficiency=0.9,pf=0.95){
 const rows=readSystemSpecs(raw).components.filter(c=>c.kind==='psu');
 const ratings=rows.flatMap(c=>Array.from({length:c.quantity},()=>Number(c.attributes.outputWatts)));
 if(!ratings.length||ratings.some(w=>!Number.isFinite(w)||w<=0)||!Number.isInteger(requiredPsus)||requiredPsus<1||requiredPsus>ratings.length||!Number.isFinite(efficiency)||efficiency<=0||efficiency>1||!Number.isFinite(pf)||pf<=0||pf>1)return null;
 // Use the lowest ratings where mixed supplies exist; do not infer a larger N group.
 const dc=ratings.sort((a,b)=>a-b).slice(0,requiredPsus).reduce((a,b)=>a+b,0);
 return {watts:Math.ceil(dc/efficiency),pf,estimateSource:`PSU capacity estimate: ${requiredPsus} required of ${ratings.length} installed, ${dc} W DC / ${(efficiency*100).toFixed(0)}% assumed efficiency; PF ${pf} assumed. Not measured consumption.`};
}

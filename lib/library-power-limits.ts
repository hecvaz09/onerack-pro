import {catalogPowerLimits} from './catalog-power-limits.ts';
import {modelAcLimits} from './model-power-reference.ts';
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const present=(v:unknown)=>v!==undefined&&v!==null&&(typeof v!=='string'||v.trim()!=='');
// One precedence rule for the Library summary and the rack calculator.
// Explicit invalid numbers survive for validation; blank fields inherit.
export function libraryPowerLimits(model:string,raw:unknown,installation?:unknown):Record<string,unknown>{
 const catalog=catalogPowerLimits(raw),power=obj(obj(raw).powerLoad),saved=obj(installation);
 const values=(v:Record<string,unknown>)=>Object.fromEntries(Object.entries(v).filter(([,x])=>present(x)));
 return {...modelAcLimits(model,saved.connector||power.connector||catalog.connector),...catalog,...values(power),...values(saved)};
}

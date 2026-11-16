import {readSystemSpecs,systemSpecsError} from './system-specs.ts';
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
// Configuration gaps, not installation verification or a new save requirement.
export function libraryReadiness(sku:string,category:string|null,raw:unknown){
 const data=obj(raw),specs=readSystemSpecs(raw),issues:string[]=[];
 const reference=obj(data.catalogReference).basis==='model-pending'||/\bTBD\b/i.test(sku);
 if(!data.systemSpecs||systemSpecsError(data.systemSpecs))issues.push('Structured specifications need review before reuse.');
 if(reference)issues.push('Confirm the exact hardware configuration; this entry is a reference placeholder.');
 if(!['pdu','accessory'].includes(category||'')&&!specs.components.some(c=>c.kind==='psu')&&!Number(obj(data.powerLoad).cords))
  issues.push(category==='node'?'Power belongs to the parent chassis. Establish the parent and node identity before reuse.':'Add the PSU inventory or a documented input count; two inputs will not be assumed.');
 for(const c of specs.components.filter(c=>c.kind==='network')){
  const missing=[!c.attributes.ports&&'port count',(!c.attributes.connector||c.attributes.connector==='Other')&&'connector',(!c.attributes.protocol||c.attributes.protocol==='Other')&&'protocol',!c.attributes.speedGbps&&!c.attributes.supportedSpeedsGbps&&'speed capability'].filter(Boolean);
  if(missing.length)issues.push(`${c.model}: confirm ${missing.join(', ')}.${/AIOM|optional/i.test(c.attributes.slot||'')&&/pending|unspecified|unknown/i.test(c.model)?' Identify the installed adapter; an optional slot is not an installed card.':''}`);
 }
 return {label:reference?'Reference only':issues.length?'Configuration incomplete':specs.status==='verified'?'Reviewed':'Draft',issues};
}

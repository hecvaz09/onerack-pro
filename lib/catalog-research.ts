import {emptySystemSpecs,systemSpecsError,type SystemComponent,type SystemSpecs} from './system-specs.ts';
export type ResearchIdentity={vendor:string;model:string;request?:string;category?:string};
export type ResearchFinding={name:string;value:string;source:string};
export type ResearchComponent={component:SystemComponent;source:string};
export type ResearchReport={equipment?:{category:string;heightRU:number;source:string};model:string;createdAt:string;findings:ResearchFinding[];components:ResearchComponent[];unknowns:string[];sources:string[]};
const domains:Record<string,string[]>={supermicro:['supermicro.com'],cisco:['cisco.com'],arista:['arista.com'],nvidia:['nvidia.com'],raritan:['raritan.com','legrand.com'],apc:['apc.com','se.com'],servertech:['servertech.com','legrand.com'],dell:['dell.com'],hpe:['hpe.com'],lenovo:['lenovo.com']};
export function manufacturerDomains(vendor:string){return Object.entries(domains).find(([name])=>vendor.toLowerCase().replace(/[^a-z]/g,'').includes(name))?.[1]||[];}
export function officialUrl(value:unknown,allowed:string[]):value is string{try{if(typeof value!=='string'||value.length>1500)return false;const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&allowed.some(d=>u.hostname===d||u.hostname.endsWith('.'+d));}catch{return false;}}
export function researchIdentityError(i:ResearchIdentity){if(i&&i.request!==undefined&&(typeof i.request!=='string'||i.request.length>12000))return 'Keep the configuration request under 12,000 characters.';return !i||[i.vendor,i.model].some(v=>typeof v!=='string'||!v.trim()||v.length>200)?'Enter a manufacturer and exact model (up to 200 characters).':!manufacturerDomains(i.vendor).length?'This manufacturer needs an official source domain configured before research.':null;}
function canonicalSource(value:string){try{const url=new URL(value);url.searchParams.delete('utm_source');url.hash='';return url.href;}catch{return '';}}
export function parseResearch(text:string,sources:string[],identity:ResearchIdentity):ResearchReport{
  if(text.length>80000)throw new Error('Research response is too large.');
  const raw=JSON.parse(text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));
  const allowed=manufacturerDomains(identity.vendor),trusted=[...new Set(sources.filter(s=>officialUrl(s,allowed)))];
  const source=(v:unknown)=>typeof v==='string'&&officialUrl(v,allowed)&&trusted.some(url=>canonicalSource(url)===canonicalSource(v));
  if(!Array.isArray(raw.findings)||raw.findings.length>40||!Array.isArray(raw.components)||raw.components.length>20||!Array.isArray(raw.unknowns)||raw.unknowns.length>30)throw new Error('Invalid research format.');
  const findings:ResearchFinding[]=raw.findings.filter((f:ResearchFinding)=>f&&typeof f.name==='string'&&f.name.trim()&&f.name.length<=200&&typeof f.value==='string'&&f.value.length<=400&&source(f.source));
  const components:ResearchComponent[]=raw.components.filter((c:ResearchComponent)=>c&&source(c.source)&&!systemSpecsError({...emptySystemSpecs(),components:[c.component]}));
  const unknowns=raw.unknowns.filter((s:unknown)=>typeof s==='string'&&s.length<=500) as string[];
  const dropped=raw.findings.length-findings.length+raw.components.length-components.length;
  if(dropped)unknowns.push(`${dropped} suggestions omitted because their source or format could not be validated.`);
  if(!findings.length&&!components.length)throw new Error('No usable manufacturer-sourced specifications were returned.');
  const equipment=raw.equipment&&['chassis','switch','pdu','node','accessory'].includes(raw.equipment.category)&&Number.isInteger(raw.equipment.heightRU)&&raw.equipment.heightRU>=0&&raw.equipment.heightRU<=60&&(raw.equipment.heightRU>0||['pdu','node'].includes(raw.equipment.category))&&source(raw.equipment.source)?{category:String(raw.equipment.category),heightRU:Number(raw.equipment.heightRU),source:String(raw.equipment.source)}:undefined;
  return {equipment,model:identity.model,createdAt:new Date().toISOString(),findings,components,unknowns,sources:trusted};
}
// Selected research fills blanks. Existing component IDs, quantities and nonempty fields survive.
export function mergeResearch(current:SystemSpecs,report:ResearchReport,selected:string[]):SystemSpecs{
  const specs=structuredClone(current);specs.status='draft';
  for(const [i,f] of report.findings.entries())if(selected.includes(`f${i}`)&&!specs.custom.some(v=>v.name.toLowerCase()===f.name.toLowerCase()))specs.custom.push({name:f.name,value:`${f.value}\nSource: ${f.source}\nResearched: ${report.createdAt.slice(0,10)}`});
  for(const [i,{component:c,source}] of report.components.entries())if(selected.includes(`c${i}`)){
    const existing=specs.components.find(v=>v.kind===c.kind&&v.model.toLowerCase()===c.model.toLowerCase());
    if(existing){let changed=false;for(const [key,value] of Object.entries(c.attributes))if(!existing.attributes[key]&&value){existing.attributes[key]=value;changed=true;}if(changed){const citation=`AI-filled fields source: ${source} (${report.createdAt.slice(0,10)})`;if(!existing.notes.includes(citation))existing.notes+=`\n${citation}`;}}
    // Research suggestions cannot approve their own fields. Approval is a
    // separate review action tied to an exact component identity and value.
    else specs.components.push({...c,fieldReviews:undefined,id:`ai-${crypto.randomUUID()}`,notes:`${c.notes}\nSource: ${source}\nResearched: ${report.createdAt.slice(0,10)}`.slice(0,2000)});
  }
  if(!specs.sourceUrl)specs.sourceUrl=report.sources[0]||'';
  const error=systemSpecsError(specs);if(error)throw new Error(error);
  return specs;
}

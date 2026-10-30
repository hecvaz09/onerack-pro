import {mergeResearch,type ResearchReport} from './catalog-research.ts';
import {componentKindsForCategory,type SystemSpecs} from './system-specs.ts';

export function prepareEquipmentDraft(current:SystemSpecs,report:ResearchReport,category:string){
  const allowed=componentKindsForCategory(category);
  const excluded=report.components.filter(({component})=>!allowed.includes(component.kind));
  const eligible={...report,components:report.components.filter(({component})=>allowed.includes(component.kind))};
  const selected=[...eligible.findings.map((_,i)=>`f${i}`),...eligible.components.map((_,i)=>`c${i}`)];
  const specs=mergeResearch(current,eligible,selected);
  const conflicts:string[]=[];
  for(const f of eligible.findings){const old=current.custom.find(v=>v.name.toLowerCase()===f.name.toLowerCase());if(old&&old.value.split('\nSource:')[0]!==f.value)conflicts.push(`${f.name}: kept your existing value; proposed ${f.value}.`);}
  for(const {component:c} of eligible.components){const old=current.components.find(v=>v.kind===c.kind&&v.model.toLowerCase()===c.model.toLowerCase());if(!old)continue;
    if(old.quantity!==c.quantity)conflicts.push(`${c.model}: kept quantity ${old.quantity}; proposed ${c.quantity}.`);
    for(const [key,value] of Object.entries(c.attributes))if(old.attributes[key]&&value&&old.attributes[key]!==value)conflicts.push(`${c.model} — ${key}: kept ${old.attributes[key]}; proposed ${value}.`);
  }
  return {specs,conflicts,questions:[...report.unknowns,...excluded.map(({component:c})=>`${c.model} (${c.kind}) was excluded from this ${category} draft. Confirm its equipment type before adding internal components.`)],addedFacts:specs.custom.length-current.custom.length,addedComponents:specs.components.length-current.components.length};
}

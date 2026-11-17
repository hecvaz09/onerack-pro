'use client';
import type {CatalogInput} from '@/lib/system-specs';
import {libraryOnboarding,libraryModelTemplate} from '@/lib/library-onboarding';

export function LibraryOnboardingPanel({input,raw,isNew,onApply}:{input:CatalogInput;raw?:unknown;isNew:boolean;onApply:(value:CatalogInput)=>void}){
 const result=libraryOnboarding(input,raw),template=isNew&&!input.specs.components.length?libraryModelTemplate(input):null;
 function go(target:string){const el=document.getElementById(target);if(el instanceof HTMLDetailsElement)el.open=true;el?.scrollIntoView({behavior:'smooth',block:'start'});}
 return <details className="spec-section group" aria-label="Device onboarding" data-library-onboarding open={isNew}>
  <summary className="flex flex-wrap items-center justify-between gap-3"><strong><span aria-hidden="true" className="mr-2 inline-block group-open:rotate-90">▸</span>{isNew?'New device onboarding':'Device setup checklist'}</strong><span className="rounded-full border border-border px-3 py-1 text-xs">{result.completed}/{result.checks.length} ready</span></summary>
  <p className="mt-2 text-sm text-muted-foreground">{result.ready?'Model information is ready for reuse. Confirm the installed configuration when placing it in a rack.':'Complete the model once, then reuse its specifications in Power Layout and Network Layout. You can save an unfinished entry as a draft.'}</p>
  {template&&<button type="button" className="spec-add" onClick={()=>onApply(template)}>Load existing model template</button>}
  <ol className="mt-4 grid gap-2 sm:grid-cols-2">{result.checks.map(c=><li key={c.id} className="min-w-0 rounded-lg border border-border p-3"><button type="button" className="flex w-full items-start gap-2 text-left text-sm" onClick={()=>go(c.target)}><span aria-hidden="true" className={c.ready?'text-primary':'text-muted-foreground'}>{c.ready?'✓':'○'}</span><span className="min-w-0"><strong>{c.label}</strong><span className="block text-xs text-muted-foreground">{c.ready?'Ready':c.details[0]}{c.details.length>1?` (+${c.details.length-1} more)`:''}</span></span></button>{c.details.length>1&&<details className="mt-2 text-xs"><summary>View remaining items</summary><ul className="mt-2 list-disc space-y-1 pl-4">{c.details.slice(1).map(d=><li key={d}>{d}</li>)}</ul></details>}</li>)}</ol>
  <p className="mt-4 text-sm text-muted-foreground">{result.measurementPolicy}</p>
  {result.deferred.length>0&&<details className="mt-3 text-xs text-muted-foreground"><summary>Before installation</summary><ul className="mt-2 list-disc space-y-1 pl-4">{result.deferred.map(d=><li key={d}>{d}</li>)}</ul></details>}
 </details>;
}

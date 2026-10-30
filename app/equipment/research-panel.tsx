"use client";
import {useState,useTransition} from 'react';
import {researchEquipment} from './research-actions';
import {prepareEquipmentDraft} from '@/lib/equipment-assistant';
import type {ResearchReport} from '@/lib/catalog-research';
import type {SystemSpecs,CatalogInput} from '@/lib/system-specs';

type Turn={role:'user'|'assistant';text:string};
export function ResearchPanel({vendor,model,category,specs,onApply,onIdentity}:{vendor:string;model:string;category:string;specs:SystemSpecs;onApply:(s:SystemSpecs)=>void;onIdentity?:(values:Partial<CatalogInput>)=>void}){
  const [query,setQuery]=useState(model),[researchVendor,setResearchVendor]=useState(vendor);
  const [request,setRequest]=useState(''),[turns,setTurns]=useState<Turn[]>([]),[report,setReport]=useState<ResearchReport|null>(null);
  const [message,setMessage]=useState(''),[pending,start]=useTransition(),[applied,setApplied]=useState(false);
  const proposal=report?prepareEquipmentDraftSafe(specs,report,onIdentity?report.equipment?.category||category:category):null;
  function reset(){setReport(null);setTurns([]);setMessage('');setApplied(false);}
  function prepare(){
    const history=[...turns.filter(t=>t.role==='user').map(t=>t.text),request.trim()].filter(Boolean).join('\n\n');
    if(history.length>12000){setMessage('This conversation is full. Start a new request with a shorter configuration summary.');return;}
    const userText=request.trim()||`Prepare specifications for ${researchVendor} ${query}.`;
    start(async()=>{setMessage('');try{
      const result=await researchEquipment({vendor:researchVendor,model:query,category,request:history});
      if(!result.ok){setMessage(result.error);return;}
      setReport(result.report);setApplied(false);setRequest('');
      setTurns(t=>[...t,{role:'user',text:userText},{role:'assistant',text:result.cached?'I reused saved research and prepared a draft for review. No paid request was made.':'I prepared a draft from manufacturer sources. Review the summary and answer any remaining configuration questions below.'}]);
    }catch{setMessage('The assistant could not complete this request. Your equipment and current proposal are unchanged.');}});
  }
  return <section id="ai-research" className="spec-section scroll-mt-6 border-primary/30">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2>Equipment assistant</h2><span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">Describe → Prepare → Review</span></div>
    <p className="my-3 text-sm text-muted-foreground">Tell me what belongs in this configuration. I’ll fill the available specifications together and ask about missing details. Existing entries are preserved.</p>
    <div className="grid gap-3 md:grid-cols-2"><label>Manufacturer<input maxLength={200} value={researchVendor} disabled={pending} onChange={e=>{setResearchVendor(e.target.value);reset();}}/></label><label>Exact equipment model<input maxLength={200} value={query} disabled={pending} onChange={e=>{setQuery(e.target.value);reset();}} placeholder="For example AS-8126GS-TNMR"/></label></div>
    {!!turns.length&&<div role="log" aria-label="Equipment assistant conversation" className="my-4 max-h-64 space-y-3 overflow-auto rounded-lg border border-border p-4">{turns.map((turn,i)=><div key={i} className={turn.role==='user'?'ml-6 rounded-lg bg-primary/10 p-3':'mr-6 p-3'}><strong className="text-xs">{turn.role==='user'?'You':'Equipment assistant'}</strong><p className="mt-1 whitespace-pre-wrap text-sm">{turn.text}</p></div>)}</div>}
    <label className="mt-4 block">{report?'Answer a question or refine the configuration':'What should I prepare?'}<textarea rows={3} maxLength={12000} disabled={pending} value={request} onChange={e=>setRequest(e.target.value)} placeholder="Describe installed parts, paste a BOM excerpt or datasheet text, or leave blank to research the standard equipment. Include exact part numbers when you have them."/></label>
    <p className="mt-2 text-xs text-muted-foreground">The manufacturer, model, equipment type and text you enter here are sent for research. New paid requests are currently paused; saved research remains available.</p>
    <div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={pending||!researchVendor.trim()||!query.trim()||!!report&&!request.trim()} className="rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground disabled:opacity-40" onClick={prepare}>{pending?'Preparing your configuration…':report?'Update proposal':'Prepare equipment draft'}</button>{!!turns.length&&<button type="button" disabled={pending} onClick={()=>{reset();setRequest('');}} className="rounded-lg border border-border px-4 py-2 text-sm">Start a new request</button>}</div>
    {message&&<p role="status" className="mt-3 text-sm text-primary">{message}</p>}
    {proposal&&report&&<div className="mt-5 space-y-4 rounded-lg border border-border p-4"><h3 className="font-semibold">Review configuration · {report.model}</h3>
      {'error' in proposal?<p role="alert">{proposal.error}</p>:<>
      <p className="text-sm">{onIdentity&&!report.equipment&&<span className="mb-2 block text-amber-300">Equipment type and rack height were not established in this report. Confirm them in System identity before saving.</span>}{report.equipment&&<span className="block mb-2">{report.equipment.category} · {report.equipment.heightRU}U · <a href={report.equipment.source} target="_blank" rel="noreferrer" className="text-primary underline">Footprint source</a></span>}{proposal.addedFacts} new specifications · {proposal.addedComponents} new component groups. Blank fields in matching components are filled automatically.</p>
      <details><summary className="cursor-pointer text-sm text-primary">View prepared specifications and sources</summary><div className="mt-3 divide-y divide-border">{report.findings.map((f,i)=><div className="py-2 text-sm" key={i}><strong>{f.name}</strong><p>{f.value}</p><a className="text-xs text-primary underline" href={f.source} target="_blank" rel="noreferrer">Manufacturer source ↗</a></div>)}{report.components.map(({component:c,source},i)=><div className="py-2 text-sm" key={`c${i}`}><strong>{c.quantity} × {c.model}</strong><p>{Object.entries(c.attributes).map(([k,v])=>`${k}: ${v}`).join(' · ')}</p><a className="text-xs text-primary underline" href={source} target="_blank" rel="noreferrer">Manufacturer source ↗</a></div>)}</div></details>
      {!!proposal.conflicts.length&&<div><h4 className="text-sm font-semibold">Existing values kept</h4><ul className="list-disc pl-5 text-sm text-muted-foreground">{proposal.conflicts.map((v,i)=><li key={i}>{v}</li>)}</ul></div>}
      {!!proposal.questions.length&&<div className="rounded-lg bg-primary/5 p-3"><h4 className="text-sm font-semibold">Still needs your input</h4><ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">{proposal.questions.map((q,i)=><li key={i}>{q}</li>)}</ul><p className="mt-2 text-xs text-muted-foreground">Reply above when you know the answers. You can keep an incomplete draft; unknown values will stay blank.</p></div>}
      <button type="button" disabled={pending||applied} className="rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground disabled:opacity-40" onClick={()=>{onIdentity?.({vendor:researchVendor.trim(),model:query.trim(),sku:`${researchVendor.trim()}-${query.trim()}`.replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,200),...(report.equipment?{category:report.equipment.category,heightRU:report.equipment.heightRU}:{heightRU:0})});onApply(proposal.specs);setApplied(true);setMessage('Prepared configuration applied to the form. Save equipment below to keep it.');}}>{applied?'Applied to form':'Apply prepared configuration'}</button><p className="text-xs text-muted-foreground">Applies the whole proposal as a draft. Saving uses the existing equipment validation and does not mark AI specifications as verified.</p>
      </>}
    </div>}
  </section>;
}
function prepareEquipmentDraftSafe(specs:SystemSpecs,report:ResearchReport,category:string){try{return prepareEquipmentDraft(specs,report,category);}catch(error){return {error:error instanceof Error?error.message:'The draft could not be prepared.'};}}

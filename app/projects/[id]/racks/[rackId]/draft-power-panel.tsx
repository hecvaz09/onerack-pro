"use client";
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {draftPowerPlan,readDraftPowerPlan} from '@/lib/draft-power-plan';
import {feedRevision} from '@/lib/feed-balance';
import type {FeedEquipment} from '@/lib/feed-rack';
import type {FeedInputs} from '@/lib/feed-power';
import {saveDraftPowerPlan} from './feed-power-actions';
export function DraftPowerPanel({rackId,equipment,inputs,initial,saved}:{rackId:string;equipment:FeedEquipment[];inputs:FeedInputs;initial:FeedInputs;saved?:unknown}){
 const router=useRouter(),[preview,setPreview]=useState<ReturnType<typeof draftPowerPlan>|null>(null),[message,setMessage]=useState(''),[pending,start]=useTransition();
 const stored=readDraftPowerPlan(saved),plan=preview?.plan||stored,revision=feedRevision(equipment,inputs),dirty=JSON.stringify(inputs)!==JSON.stringify(initial),stale=!!plan&&plan.revision!==revision;
 return <details className="power-extra" open={stored?true:undefined}><summary>Calculated wiring plan{stored?' · saved draft':''}</summary>
 <p className="my-3 text-sm text-amber-300">Uses the same load-based allocator as the rear elevation. Saves the proposed schedule without changing confirmed connections. Pending PSU documentation stays separate.</p>
 <div className="power-plan-actions"><button type="button" disabled={pending||dirty} onClick={()=>{setPreview(draftPowerPlan(equipment,inputs));setMessage('');}}>Calculate wiring plan</button><button type="button" disabled={pending||dirty||!preview?.plan||stale} onClick={()=>start(async()=>{try{const r=await saveDraftPowerPlan(rackId,feedRevision(equipment,initial));setMessage(r.error||'Draft saved. Installed wiring unchanged.');if(!r.error)router.refresh();}catch{setMessage('Could not save the draft. Try again.');}})}>Save plan snapshot</button></div>
 {!!saved&&!stored&&<p className="my-2 text-sm">The previous draft used an older allocation method. Calculate a new load-based plan; confirmed wiring is unchanged.</p>}
 {dirty&&<p className="my-2 text-sm">Save power inputs first. PSU voltage and capacity documentation may remain pending; load, cord and PDU limits are required.</p>}
 {preview?.error&&<p role="alert" className="my-2 text-amber-300">{preview.error}</p>}
 {stale&&<p role="alert" className="my-2 text-amber-300">This draft is out of date. Generate it again using the current rack and inputs.</p>}
 {plan&&<><p className="my-3 font-semibold">{preview?.plan?'Draft preview':'Saved draft'} · {plan.assignments.length} cords · not installed</p><details><summary>Unverified checks and conflicts · {plan.issues.length}</summary><ul className="list-disc pl-5 text-sm">{plan.issues.map(i=><li className="my-2" key={i}>{i}</li>)}</ul></details><details className="my-3"><summary>Draft cable schedule</summary>{plan.assignments.map(c=><p className="my-2 text-sm" key={`${c.pduId}:${c.outlet}`}>{equipment.find(e=>e.id===c.pduId)?.name||c.pduId} · P{c.outlet} → {equipment.find(e=>e.id===c.deviceId)?.name||c.deviceId} · PSU {c.inlet}</p>)}</details></>}
 <p role="status">{message}</p></details>;
}

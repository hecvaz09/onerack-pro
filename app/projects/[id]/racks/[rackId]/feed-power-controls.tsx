"use client";
import {useState,useTransition} from 'react';
import {balanceFeeds,feedRevision} from '@/lib/feed-balance';
import type {FeedEquipment} from '@/lib/feed-rack';
import type {FeedInputs} from '@/lib/feed-power';
import {readOutlets} from '@/lib/equipment-details';
import {readSystemSpecs} from '@/lib/system-specs';
import {applyFeedBalance} from './feed-power-actions';
import {saveOutlet,undoRedoRack} from './actions';
export function FeedPowerControls({rackId,equipment,inputs,initial}:{rackId:string;equipment:FeedEquipment[];inputs:FeedInputs;initial:FeedInputs}){
 const [plan,setPlan]=useState<ReturnType<typeof balanceFeeds>|null>(null),[message,setMessage]=useState(''),[pending,start]=useTransition();
 const [manual,setManual]=useState({pduId:equipment.find(e=>e.category==='pdu')?.id||'',outlet:0,deviceId:'',inlet:1});
 const dirty=JSON.stringify(inputs)!==JSON.stringify(initial),outlets=readOutlets(equipment.find(e=>e.id===manual.pduId)?.rawData);
 const target=equipment.find(e=>e.id===manual.deviceId),psus=readSystemSpecs(target?.rawData).components.filter(c=>c.kind==='psu').reduce((n,c)=>n+c.quantity,0);
 function run(action:()=>Promise<{error?:string;ok?:boolean}>,success:string){start(async()=>{try{const result=await action();setMessage(result.error||success);if(!result.error)setPlan(null);}catch{setMessage('Could not save. Reload to check the current rack.');}});}
 return <section className="power-workflow-step"><header><span className="power-step-number">2</span><div><h3>Plan the cables</h3><p>Generate a proposal, review it, then save. Existing manual assignments stay fixed.</p></div></header>
 <div className="power-plan-actions"><button disabled={pending||dirty} onClick={()=>{setPlan(balanceFeeds(equipment,inputs));setMessage('');}}>Calculate cables</button><button disabled={pending||dirty||!plan||!!plan.error||!plan.analysis.ready} onClick={()=>run(()=>applyFeedBalance(rackId,feedRevision(equipment,initial)),'Cable proposal saved.')}>Save proposed cables</button><button disabled={pending} onClick={()=>run(()=>undoRedoRack(rackId,-1),'Undid last rack change.')}>Undo</button><button disabled={pending} onClick={()=>run(()=>undoRedoRack(rackId,1),'Redid last rack change.')}>Redo</button></div>
 {dirty&&<p className="text-sm">Save power inputs before calculating cables.</p>}{plan?.error&&<p className="text-amber-300">{plan.error}</p>}{plan&&!plan.error&&<div><h4>Proposal ready to review · {plan.assignments.length} cords</h4><details className="my-3"><summary>Proposed phase and breaker loads · normal and failover</summary>{plan.analysis.scenarios.map(s=><div key={s.lost||'normal'} className="my-3"><strong>{s.lost?`Feed ${s.lost} lost`:'Normal operation'}</strong>{s.totals.map(p=><div key={p.id} className="my-2 text-sm"><p>{p.name} · {p.phases.map((a,i)=>`L${i+1}: ${a.toFixed(2)} A`).join(' · ')} / {p.limitAmps} A per line</p><p className="text-xs text-muted-foreground">{Object.entries(p.branches).map(([b,a])=>`Branch ${b}: ${a.toFixed(2)} A`).join(' · ')}</p></div>)}</div>)}</details><details><summary>View proposed cable schedule</summary>{plan.assignments.map(c=><p key={`${c.pduId}:${c.outlet}`}>{equipment.find(e=>e.id===c.pduId)?.name} · P{c.outlet} → {equipment.find(e=>e.id===c.deviceId)?.name} · PSU {c.inlet}</p>)}</details></div>}
 <details><summary>Choose an outlet manually</summary><div className="power-fields mt-3">
 <label>PDU<select value={manual.pduId} onChange={e=>setManual({...manual,pduId:e.target.value,outlet:0})}>{equipment.filter(e=>e.category==='pdu').map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</select></label>
 <label>Outlet<select value={manual.outlet} onChange={e=>setManual({...manual,outlet:Number(e.target.value)})}><option value={0}>Choose outlet…</option>{outlets.map(o=><option key={o.n} value={o.n}>{o.n} · {o.type}</option>)}</select></label>
 <label>Equipment<select value={manual.deviceId} onChange={e=>setManual({...manual,deviceId:e.target.value,inlet:1})}><option value="">Clear assignment</option>{equipment.filter(e=>e.category!=='pdu'&&e.category!=='accessory').map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</select></label>
 <label>PSU<select value={manual.inlet} onChange={e=>setManual({...manual,inlet:Number(e.target.value)})}>{Array.from({length:Math.min(6,psus||6)},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
 <button disabled={pending||!manual.pduId||!manual.outlet} onClick={()=>run(()=>saveOutlet(rackId,manual.pduId,manual.outlet,manual.deviceId,'',manual.inlet),'Manual cable saved.')}>Save manual cable</button></div></details><p role="status">{message}</p></section>;
}

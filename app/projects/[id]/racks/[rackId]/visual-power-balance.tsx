"use client";
import {useState} from 'react';
import {supplyCapacityVA} from '@/lib/feed-power';
import type {visualPowerBalance} from '@/lib/visual-power';
export function VisualPowerBalance({review,proposed}:{review:ReturnType<typeof visualPowerBalance>;proposed:boolean}){
 const [scenario,setScenario]=useState(0);
 const current=review.current.scenarios[scenario],projected=review.projected.scenarios[scenario];
 const color=review.status==='blocked'?'#ff9292':review.status==='caution'?'#f4ce73':'#5ee9b5';
 return <aside className="visual-balance" aria-label="Power balance sheet">
 <h3 className="text-xl font-semibold">Power balance sheet</h3>
 <p style={{color}} role="status">{review.status==='blocked'?'⚠ Not approved':review.status==='caution'?'⚠ Incomplete cabling':'👍 Calculation checks passed'}</p>
 <p className="text-sm">{proposed?'Saved → proposed connection':'Saved connections'} · saved power inputs</p>
 <div className="flex flex-wrap gap-2 my-3">{['Normal','Feed A lost','Feed B lost'].map((label,i)=><button type="button" key={label} aria-pressed={scenario===i} onClick={()=>setScenario(i)} style={{border:'1px solid',borderRadius:6,padding:'5px 8px',background:scenario===i?'#315b53':'transparent'}}>{label}</button>)}</div>
 {projected.totals.map(p=>{const before=current.totals.find(t=>t.id===p.id)!,supply=review.supplies.find(s=>s.id===p.id)!,capacity=supplyCapacityVA(supply),valid=Number.isFinite(capacity)&&capacity>0;return <section key={p.id} className="rounded-lg border border-border p-3 my-3">
 <strong>{p.name} · Feed {p.feed||'?'}</strong>
 {!p.online?<p>Offline in this scenario</p>:<>
 <p>Load: {before.watts.toFixed(0)} W{proposed&&<> → <strong>{p.watts.toFixed(0)} W</strong> ({p.watts-before.watts>=0?'+':''}{(p.watts-before.watts).toFixed(0)} W)</>}</p>
 <p className="text-sm">Apparent capacity: {valid?(capacity/1000).toFixed(2)+' kVA':'Not configured'}</p>
 <p className="text-sm">Remaining: {valid?((capacity-p.va)/1000).toFixed(2)+' kVA':'Unknown'} · input limit only</p>
 <p className="text-sm">Highest line utilization: {p.limitAmps>0?(p.amps/p.limitAmps*100).toFixed(1)+'%':'Unknown'}</p>
 {p.phases.map((amps,i)=><div key={i} className="text-sm mt-2"><div>{p.phases.length>1?`L${i+1}`:'Line'}: {amps.toFixed(2)} / {p.limitAmps||'?'} A · {p.limitAmps>0?(p.limitAmps-amps).toFixed(2)+' A left':'limit missing'}</div><progress style={{width:'100%',accentColor:amps>p.limitAmps?'#ff9292':'#5ee9b5'}} max={p.limitAmps||1} value={amps}/></div>)}
 {p.phases.length>1&&<p className="text-sm">Phase spread: {p.spread.toFixed(2)} A</p>}
 <details><summary>Breaker loads</summary>{Object.entries(p.branches).map(([b,a])=><p key={b}>Branch {b}: {a.toFixed(2)} / {supply.branches?.[b]||'?'} A</p>)}</details>
 </>}
 </section>;})}
 {review.errors.length>0&&<div style={{color:'#ff9292'}}><strong>Resolve before saving</strong><ul>{review.errors.slice(0,3).map(e=><li key={e}>{e}</li>)}</ul>{review.errors.length>3&&<details><summary>{review.errors.length-3} more checks</summary>{review.errors.slice(3).map(e=><p key={e}>{e}</p>)}</details>}</div>}
 {review.cautions.length>0&&<details style={{color:'#f4ce73'}}><summary>Cabling incomplete: redundancy is not approved</summary>{review.cautions.map(c=><p key={c}>{c}</p>)}</details>}
 <p className="text-sm mt-3">Calculated, not measured. Missing inputs make totals incomplete. Capacity is shown in kVA and amps because a fixed watt capacity is not configured. Phase, breaker, cord and failover checks can limit capacity further. No new imbalance or warning threshold is assumed.</p>
 </aside>;
}

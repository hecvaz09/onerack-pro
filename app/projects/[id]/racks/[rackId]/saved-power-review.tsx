 'use client';
import {analyzeFeeds,type FeedInputs} from '@/lib/feed-power';
import {feedRack,type FeedEquipment} from '@/lib/feed-rack';
import {powerReviewResult} from '@/lib/power-review-result';
import {powerReviewSummary} from '@/lib/power-review-summary';

export function SavedPowerReview({equipment,saved,dirty}:{equipment:FeedEquipment[];saved:FeedInputs;dirty:boolean}){
 const {supplies,loads,cords}=feedRack(equipment,saved);
 const analysis=analyzeFeeds(supplies,loads,cords,saved.headroomPercent);
 const result=powerReviewResult(analysis);
 const attention=[...new Set([...analysis.issues,...analysis.scenarios.flatMap(s=>s.errors)])];
 const review=powerReviewSummary(attention,equipment);

 function goTo(id:string){const node=document.getElementById(id);node?.focus({preventScroll:true});node?.scrollIntoView({block:'start'});}
 return <section id="power-review" tabIndex={-1} aria-label="Saved power review" className="rounded-xl border border-border p-5 space-y-4">
   <header><h3 className="text-xl font-semibold">Review</h3><h4 className="mt-3 font-semibold">{result.title}</h4><p className="mt-2 text-sm text-muted-foreground">{result.description}</p></header>
   {analysis.scopeNotes?.map(note=><p role="note" key={note} className="text-sm text-muted-foreground">{note}</p>)}
   {dirty&&<p role="status" className="text-sm text-amber-300">Unsaved edits are excluded. <button type="button" className="underline" onClick={()=>goTo('power-save-inputs')}>Review and save power inputs</button> to update this result.</p>}
   {result.failures.length>0&&<ul className="list-disc space-y-2 pl-5 text-sm">{powerReviewSummary(result.failures,equipment).actions.slice(0,3).map(g=><li key={g.message}>{g.message}{g.devices.length>1&&` (${g.devices.length} systems)`}</li>)}{powerReviewSummary(result.failures,equipment).actions.length>3&&<li>Additional findings are listed in calculation details.</li>}</ul>}
   {result.actions.length>0&&<ul className="space-y-4">{result.actions.map(action=><li key={action.label}><p className="text-sm">{action.description}</p><button type="button" className="mt-1 text-sm font-semibold underline" onClick={()=>goTo(action.target)}>{action.label}</button></li>)}</ul>}
   <details><summary className="text-sm">View calculation details</summary>
    <p className="my-3 text-xs text-muted-foreground">Calculated from saved wiring and inputs, including {saved.headroomPercent}% planning headroom. These are calculated results, not live readings.</p>
    {result.docs.length>0&&<div className="my-3 text-sm"><h4 className="font-semibold">Missing PSU specifications</h4><ul className="mt-2 list-disc space-y-2 pl-5">{powerReviewSummary(result.docs,equipment).actions.map(g=><li key={g.message}>{g.message}{g.devices.length>1&&<details><summary>{g.devices.length} affected systems</summary>{g.devices.join(', ')}</details>}</li>)}</ul></div>}
    <details className="power-extra"><summary>Inspect phase currents and breaker loads</summary>
    <div className="feed-scenarios">{analysis.scenarios.map(s=><div key={s.lost||'normal'} className="rounded-xl border border-border p-4"><h4 className="font-semibold">{s.lost?`Feed ${s.lost} lost`:'Normal operation'}</h4><p className="mb-3 text-xs text-muted-foreground">Calculated load includes entered watts only; missing budgets are not zero-load devices.</p>{s.totals.map(p=><div key={p.id} className="mb-4"><div className="flex justify-between gap-2 text-sm"><strong>{p.name}</strong><span>{p.online?`${(p.watts/1000).toFixed(2)} kW`:'Offline'}</span></div>{p.phases.map((amps,i)=><div key={i} className="my-1"><div className="flex justify-between text-xs"><span>{p.phases.length>1?`L${i+1}`:'Line'}</span><span>{amps.toFixed(2)} / {p.limitAmps} A</span></div><progress className="feed-load-meter" max={p.limitAmps||1} value={amps}/></div>)}{p.phases.length>1&&<p className="text-xs text-muted-foreground">Phase spread {p.spread.toFixed(2)} A{ supplies.find(v=>v.id===p.id)?.topology==='three-phase-wye'?` · Fundamental neutral ${p.neutralAmps.toFixed(2)} A`:''}</p>}<details className="mt-2"><summary className="text-xs">Breaker loads</summary>{Object.entries(p.branches).map(([branch,amps])=><p className="text-xs" key={branch}>Branch {branch}: {amps.toFixed(2)} / {supplies.find(v=>v.id===p.id)?.branches?.[branch]??'?'} A</p>)}</details></div>)}{s.errors.map(e=><p className="mt-2 text-sm text-red-400" key={e}>{e}</p>)}</div>)}</div>
    </details>

    <details className="power-extra"><summary>Technical details and assumptions</summary><p className="mt-3 text-sm text-muted-foreground">{review.assumptions.join(" ")}</p><details className="my-3"><summary>Full diagnostic list ({attention.length})</summary><ul className="list-disc pl-5 text-sm">{attention.map(issue=><li key={issue}>{issue}</li>)}</ul></details><p className="mt-3 text-sm text-muted-foreground">Equal sharing across surviving cords is assumed. Three-phase calculations use an ABC sinusoidal model with lagging power factor; neutral current excludes harmonics. PDU ratings do not establish shared upstream capacity. PSU output ratings are not system AC consumption.</p><p className="text-sm text-muted-foreground">Ratings come from each installed PDU’s electrical profile. Missing ratings and unsupported supply topologies remain flagged for review. Automatic proposals require complete verified ratings. Missing limits are listed above and block saving a proposal.</p></details>
   </details>
 </section>;
}

 'use client';
import type {FeedInputs} from '@/lib/feed-power';
import type {FeedEquipment} from '@/lib/feed-rack';
import {rackPowerAssessment} from '@/lib/rack-power-assessment';
import {powerReviewResult} from '@/lib/power-review-result';
import {powerReviewSummary} from '@/lib/power-review-summary';
import {PowerBalanceSheet} from './power-balance-sheet';

export function SavedPowerReview({equipment,saved,dirty,showBalance=true}:{equipment:FeedEquipment[];saved:FeedInputs;dirty:boolean;showBalance?:boolean}){
 const {supplies,design:analysis}=rackPowerAssessment(equipment,saved);
 const result=powerReviewResult(analysis);
 const attention=[...new Set([...analysis.issues,...analysis.scenarios.flatMap(s=>s.errors)])];
 const review=powerReviewSummary(attention,equipment);
 const failures=powerReviewSummary(result.failures,equipment).actions;
 const documents=powerReviewSummary(result.docs,equipment).actions;

 function goTo(id:string){
  const target=document.getElementById(id);
  if(!target)return;
  for(let node:HTMLElement|null=target;node;node=node.parentElement){
   if(node instanceof HTMLDetailsElement)node.open=true;
  }
  const focus=target instanceof HTMLDetailsElement?target.querySelector('summary'):target;
  focus?.focus({preventScroll:true});
  target.scrollIntoView({block:'start',behavior:'auto'});
 }
 return <section id="power-review" tabIndex={-1} aria-label="Saved power review" className="min-w-0 space-y-4">
   <header><h3 className="text-lg font-semibold">Saved plan checks</h3><p className="mt-2 font-medium">{analysis.ready?`Design checks passed${analysis.scopeNotes?.length?' (PDU capacity)':''}`:result.title}</p><p className="mt-1 text-sm text-muted-foreground">{result.description}</p></header>
   {dirty&&<p role="status" className="text-sm text-amber-800 dark:text-amber-300">Unsaved edits are excluded. <button type="button" className="underline" onClick={()=>goTo('power-save-inputs')}>Review and save power inputs</button> to update this result.</p>}
   {showBalance&&<PowerBalanceSheet analysis={analysis} supplies={supplies} headroomPercent={saved.headroomPercent} basis="saved"/>}
   {failures.length>0&&<div className="space-y-2"><h4 className="text-sm font-semibold">Conflicts to resolve</h4><ul className="list-disc space-y-2 pl-5 text-sm">{failures.slice(0,3).map(g=><li key={g.message}>{g.message}{g.devices.length>1&&` (${g.devices.length} systems)`}</li>)}{failures.length>3&&<li>All {failures.length} grouped findings are available in the diagnostics below.</li>}</ul></div>}
   {result.actions.length>0&&<nav aria-label="Power review actions" className="flex flex-wrap gap-x-5 gap-y-3">{result.actions.map(action=><button type="button" key={action.label} title={action.description} className="text-left text-sm font-semibold underline underline-offset-4" onClick={()=>goTo(action.target)}>{action.label}</button>)}</nav>}
   {!showBalance&&analysis.verificationNotes.length>0&&<details><summary className="cursor-pointer text-sm font-medium">Pending site and equipment verification ({analysis.verificationNotes.length})</summary><p className="mt-2 text-sm text-muted-foreground">Design results use the saved planning values. Site verification and physical installation remain separate.</p><ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{analysis.verificationNotes.map(note=><li key={note}>{note}</li>)}</ul></details>}
   {!showBalance&&analysis.scopeNotes?.map(note=><p role="note" key={note} className="text-sm text-muted-foreground">{note}</p>)}
   <details className="border-t border-border pt-3"><summary className="cursor-pointer text-sm font-medium">Specifications, assumptions and diagnostics</summary>
    <p className="my-3 text-xs text-muted-foreground">Calculated from saved wiring and inputs, including {saved.headroomPercent}% planning headroom.</p>
    {documents.length>0&&<div className="my-3 text-sm"><h4 className="font-semibold">Missing PSU specifications</h4><p className="mt-1 text-muted-foreground">Recorded consumption remains unchanged.</p><ul className="mt-2 list-disc space-y-2 pl-5">{documents.map(g=><li key={g.message}>{g.message}{g.devices.length>1&&<details><summary>{g.devices.length} affected systems</summary>{g.devices.join(', ')}</details>}</li>)}</ul></div>}
    {review.assumptions.length>0&&<p className="mt-3 text-sm text-muted-foreground">{review.assumptions.join(' ')}</p>}
    <p className="mt-3 text-sm text-muted-foreground">Equal sharing across surviving cords is assumed. Three-phase calculations use an ABC sinusoidal model with lagging power factor; neutral current excludes harmonics. PDU ratings do not establish shared upstream capacity. PSU output ratings are not system AC consumption.</p>
    <p className="mt-2 text-sm text-muted-foreground">Ratings come from each installed PDU’s electrical profile. Missing ratings and unsupported supply topologies remain flagged for review. Automatic proposals require complete documented planning ratings.</p>
    {attention.length>0&&<details className="mt-3"><summary className="cursor-pointer text-sm">Full diagnostic list ({attention.length})</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{attention.map(issue=><li key={issue}>{issue}</li>)}</ul></details>}
   </details>
 </section>;
}

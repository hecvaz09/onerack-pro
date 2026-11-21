import type {analyzeFeeds,Supply} from '@/lib/feed-power';
import {designPowerAnalysis} from '@/lib/outlet-planning-checks';
import {powerReviewResult} from '@/lib/power-review-result';

type Analysis=ReturnType<typeof analyzeFeeds>&{verificationNotes?:string[]};
type CheckStatus='Passed'|'Failed'|'Incomplete';
const statusClass:Record<CheckStatus,string>={
  Passed:'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  Failed:'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  Incomplete:'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300',
};
const number=(value:number)=>Number.isFinite(value)?value.toFixed(2):'Unknown';
const limit=(value:number|undefined)=>value!==undefined&&Number.isFinite(value)&&value>0?`${value} A`:'limit missing';
const scenarioName=(lost:'A'|'B'|null)=>lost?`Feed ${lost} lost`:'Normal operation';

export function PowerBalanceSheet({analysis,supplies,headroomPercent,basis}:{analysis:Analysis;supplies:Supply[];headroomPercent:number;basis:'saved'|'proposed'}){
  const design=designPowerAnalysis(analysis);
  const verificationNotes=[...new Set([...(analysis.verificationNotes||[]),...design.verificationNotes])];
  // Reuse the review's distinction between known conflicts and missing inputs.
  // Scenario figures come directly from the shared analyzer, including headroom.
  const wiringConflicts=powerReviewResult({...design,scenarios:[]}).failures;
  const incomplete=design.issues.filter(issue=>!wiringConflicts.includes(issue));
  const incompleteMappings=incomplete.some(issue=>/not all .*power cords are connected|document the number of power inputs|Install PDUs/.test(issue));
  const partial=incomplete.length>0||wiringConflicts.length>0;
  const states=design.scenarios.map(scenario=>{
    const failures=powerReviewResult({...design,scenarios:[scenario]}).failures;
    const failed=failures.length>0||(!incompleteMappings&&scenario.errors.length>0);
    const status:CheckStatus=failed?'Failed':incomplete.length||scenario.errors.length||scenario.unavailable.length||!scenario.totals.length?'Incomplete':'Passed';
    return {scenario,status};
  });

  return <section aria-label="Power balance sheet" data-power-balance={basis} className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h3 className="text-lg font-semibold">Power balance sheet</h3><p className="mt-1 text-sm text-muted-foreground">{basis==='saved'?'Saved inputs and connections':'Saved inputs and proposed connections'}. Includes {Number.isFinite(headroomPercent)?headroomPercent:'unknown'}% planning headroom.</p></div>
      <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold">{basis==='saved'?'Saved plan':'Proposed plan · Not saved'}</span>
    </header>
    <p className="text-xs text-muted-foreground">{design.scopeNotes?.length?'PDU capacity scenarios':'Calculated design scenarios'} · Current is compared with the entered usable line limit. These are calculated loads, not live readings.</p>
    {partial&&<p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">{incomplete.length>0?'Incomplete inputs or connections.':'Saved wiring conflicts.'} Loads shown cover only the equipment and assignments the model can calculate; they do not establish a complete rack total.</p>}
    <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-3">
      {states.map(({scenario:s,status})=><article key={s.lost||'normal'} aria-label={scenarioName(s.lost)} data-balance-scenario={s.lost||'normal'} data-balance-status={status.toLowerCase()} className="min-w-0 space-y-3 rounded-lg border border-border p-3 sm:p-4">
        <header className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">{scenarioName(s.lost)}</h4><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass[status]}`}>{status}</span></header>
        {!s.totals.length&&<p className="text-sm text-muted-foreground">No PDU loads available. Add PDUs and powered equipment to calculate this plan.</p>}
        <ul className="space-y-3" aria-label={`${scenarioName(s.lost)} PDU loads`}>{s.totals.map(p=>{
          const known=s.outletLoads.some(load=>load.pduId===p.id);
          const showLoad=!partial||known;
          return <li key={p.id} data-pdu-id={p.id} className={`min-w-0 rounded-md border border-border/70 p-3 ${p.online?'':'bg-muted/40 text-muted-foreground'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2"><p className="min-w-0 break-words text-sm font-semibold">{p.name}</p><span className="text-xs">Feed {p.feed}{!p.online&&' · Offline'}</span></div>
            {p.online?<dl className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">{partial?'Known load':'Calculated load'}</dt><dd className="mt-1 text-base font-semibold tabular-nums">{showLoad?`${number(p.watts/1000)} kW`:'Load unavailable'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{p.phases.length>1?'Highest line / limit':'Line current / limit'}</dt><dd className="mt-1 text-base font-semibold tabular-nums">{showLoad?number(p.amps):'—'} / {limit(p.limitAmps)}</dd></div>
            </dl>:<p className="mt-2 text-sm">Offline for this feed-loss scenario.</p>}
          </li>;
        })}</ul>
        {s.unavailable.length>0&&<p className="text-sm text-amber-800 dark:text-amber-300">Single-PSU equipment offline: {s.unavailable.join(', ')}. These devices do not have independent A/B redundancy.</p>}
        {s.errors.length>0&&<div className="space-y-2 text-sm"><ul className="list-disc space-y-1 pl-4">{s.errors.slice(0,2).map(error=><li key={error}>{error}</li>)}</ul>{s.errors.length>2&&<details><summary className="cursor-pointer">All {s.errors.length} scenario findings</summary><ul className="mt-2 list-disc space-y-1 pl-4">{s.errors.map(error=><li key={error}>{error}</li>)}</ul></details>}</div>}
      </article>)}
    </div>
    {verificationNotes.length>0&&<details className="rounded-lg border border-amber-500/30 p-3"><summary className="cursor-pointer text-sm font-medium">Pending site and equipment verification ({verificationNotes.length})</summary><p className="mt-2 text-sm text-muted-foreground">Design results use the entered planning values. These checks still need confirmation before installation.</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{verificationNotes.map(note=><li key={note}>{note}</li>)}</ul></details>}
    {design.scopeNotes?.map(note=><p role="note" key={note} className="text-sm text-muted-foreground">{note}</p>)}
    {supplies.length>0&&<details className="border-t border-border pt-3"><summary className="cursor-pointer text-sm font-medium">Phase and bank detail</summary><div className="mt-3 grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-3">{design.scenarios.map(s=><div key={s.lost||'normal'} className="min-w-0 space-y-3"><h4 className="text-sm font-semibold">{scenarioName(s.lost)}</h4>{s.totals.filter(p=>p.online).map(p=>{
      const supply=supplies.find(item=>item.id===p.id);
      const known=!partial||s.outletLoads.some(load=>load.pduId===p.id);
      return <div key={p.id} className="min-w-0 space-y-1 text-xs"><h5 className="break-words font-semibold">{p.name}</h5>{!known?<p>Load unavailable until inputs and assignments are complete.</p>:<>
        {p.phases.map((amps,i)=><p key={i}>{p.phases.length>1?`L${i+1}`:'Line'}: {number(amps)} / {limit(p.limitAmps)}</p>)}
        {p.phases.length>1&&<p>Phase spread: {number(p.spread)} A</p>}
        {supply?.topology==='three-phase-wye'&&<p>Fundamental neutral: {number(p.neutralAmps)} A{supply.neutralLimitAmps?` / ${limit(supply.neutralLimitAmps)}`:''}</p>}
        {Object.entries(p.branches).map(([branch,amps])=><p key={branch}>Bank {branch}: {number(amps)} / {limit(supply?.branches?.[branch])}</p>)}
      </>}</div>;
    })}</div>)}</div></details>}
  </section>;
}

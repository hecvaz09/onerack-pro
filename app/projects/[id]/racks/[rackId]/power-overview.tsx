'use client';
import {Button} from '@/components/ui/button';
import {powerOverview} from '@/lib/power-overview';
import type {FeedInputs} from '@/lib/feed-power';
import type {FeedEquipment} from '@/lib/feed-rack';
import {sectionLabelClassName} from './styles';

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

export function PowerOverview({equipment,saved,dirty}:{equipment:FeedEquipment[];saved:FeedInputs;dirty:boolean}){
  const overview=powerOverview(equipment,saved);
  const recorded=overview.measured+overview.estimated+overview.entered;
  const checks=overview.documentation.length+overview.findings.length;
  const action=overview.priority||(dirty
    ?{target:'save-inputs',label:'Review and save inputs',text:'Save your edits before connecting equipment or reviewing updated results.'}
    :overview.next);

  return <section aria-label="Rack power overview" className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className={sectionLabelClassName}>Rack power</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">Your rack power plan</h2>
        <p className="mt-2 text-sm text-muted-foreground">{overview.systems} powered systems · {overview.pdus} PDUs</p>
      </div>
      <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">Saved values</span>
    </header>

    <div className="flex flex-col items-start gap-4 rounded-lg bg-muted/40 p-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className={sectionLabelClassName}>What to do next</p>
        <p className="mt-1 text-sm">{action.text}</p>
        <p className="mt-2 text-xs text-muted-foreground">Recommendations depend on the saved inputs and configured limits.</p>
      </div>
      <Button type="button" size="lg" className="h-auto min-h-10 w-full whitespace-normal px-4 py-2 sm:w-auto" onClick={()=>goTo('power-'+action.target)}>{action.label}</Button>
    </div>

    {dirty&&<p role="status" className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
      <strong className="font-semibold">Unsaved edits are not included in these totals.</strong>{' '}
      The overview still shows your saved rack.
    </p>}

    <div className="grid gap-5 sm:grid-cols-2">
      <div className="min-w-0 space-y-2">
        <h3 className="text-sm font-medium">Recorded equipment demand</h3>
        {recorded>0
          ?<p className="text-3xl font-semibold tabular-nums tracking-tight">{(overview.watts/1000).toFixed(2)} <span className="text-base font-normal text-muted-foreground">kW</span></p>
          :<p className="text-3xl font-semibold" aria-label="No demand recorded">—</p>}
        <p className="text-xs text-muted-foreground">Before planning headroom · not live metering</p>
        <p className="text-sm text-muted-foreground">{overview.measured} recorded {overview.measured===1?'measurement':'measurements'} · {overview.estimated} estimated · {overview.entered} entered</p>
        {!overview.systems
          ?<p className="text-sm text-muted-foreground">No powered systems yet. No demand recorded.</p>
          :overview.missingWatts>0&&<p className="text-sm">{recorded>0?'Partial total · ':''}{overview.missingWatts} {overview.missingWatts===1?'system still needs':'systems still need'} watts.{recorded===0&&' No demand recorded.'}</p>}
      </div>
      <div className="min-w-0 space-y-2">
        <h3 className="text-sm font-medium">Saved PSU assignments</h3>
        {overview.expected>0?<><p className="text-3xl font-semibold tabular-nums tracking-tight">{overview.connected} <span className="text-base font-normal text-muted-foreground">/ {overview.expected}</span></p>
          <progress aria-label="Saved PSU assignments" aria-valuetext={overview.connected+' of '+overview.expected+' saved'} className="feed-load-meter w-full" value={overview.connected} max={overview.expected}/>
        </>:<p className="text-sm text-muted-foreground">No expected PSU assignments yet.</p>}
        <p className="text-xs text-muted-foreground">Saved mappings do not confirm physical installation, testing or electrical capacity.</p>
      </div>
    </div>



    {overview.missingAssignments.length>0&&<section aria-label="Power assignments to complete" className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold">{overview.missingAssignments.length} {overview.missingAssignments.length===1?'device needs':'devices need'} power assignments</h3>
      <p className="text-sm text-muted-foreground">Complete the saved PSU-to-outlet mappings. Devices with no assignments cannot yet be assessed for backup power.</p>
      <a href="#power-connections" className="text-sm font-medium text-primary underline underline-offset-4" onClick={e=>{e.preventDefault();goTo('power-connections');}}>Open connection editor</a>
      <details>
        <summary className="cursor-pointer text-sm">Affected equipment · {overview.missingAssignments.length}</summary>
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">{overview.missingAssignments.map(device=><li key={device.id} data-assignment-device={device.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <span className="min-w-0"><strong className="font-medium">{Number.isInteger(device.startRU)?`U${device.startRU}`:'Position not recorded'}</strong><span className="ml-2">{device.name.replace(/ · U\d+$/,'')}</span></span>
          <span className="text-xs text-muted-foreground">{device.assigned}/{device.expected} PSUs assigned</span>
        </li>)}</ul>
      </details>
    </section>}

    {(checks>0||overview.assumptions.length>0)&&<details className="border-t border-border pt-4">
      <summary className="cursor-pointer text-sm font-medium">Checks and assumptions{checks>0&&<span className="ml-2 font-normal text-muted-foreground">· {checks} grouped checks</span>}</summary>
      <div className="mt-4 space-y-4 text-sm">
        {overview.documentation.length>0&&<section aria-label="PSU documentation">
          <h3 className="font-medium">PSU documentation</h3>
          <p className="mt-1 text-xs text-muted-foreground">Missing specifications remain separate from recorded consumption.</p>
          <ul className="mt-2 list-disc space-y-2 pl-5">{overview.documentation.map(g=><li key={g.message}>{g.message}{g.devices.length>1&&<span> ({g.devices.length} systems)</span>}</li>)}</ul>
        </section>}
        {overview.findings.length>0&&<section aria-label="Saved plan checks">
          <h3 className="font-medium">Saved plan checks</h3>
          <ul className="mt-2 list-disc space-y-2 pl-5">{overview.findings.map(g=><li key={g.message}>{g.message}{g.devices.length>1&&<details className="mt-1"><summary className="cursor-pointer text-xs text-muted-foreground">{g.devices.length} affected devices</summary><p className="mt-1 break-words text-xs text-muted-foreground">{g.devices.join(', ')}</p></details>}</li>)}</ul>
        </section>}
        {overview.assumptions.length>0&&<section aria-label="Estimate assumptions"><h3 className="font-medium">Estimate assumptions</h3><p className="mt-2 text-muted-foreground">{overview.assumptions.join(' ')}</p></section>}
      </div>
    </details>}
  </section>;
}

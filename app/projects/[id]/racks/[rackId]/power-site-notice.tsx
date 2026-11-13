import type {Supply} from '@/lib/feed-power';

export function PowerSiteNotice({supplies}:{supplies:Supply[]}){
 const pending=supplies.filter(p=>p.confirmed!==true);
 if(!pending.length)return null;
 return <aside aria-label="Site verification pending" className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
  <h3 className="font-semibold">Site verification pending</h3>
  <p className="text-sm text-muted-foreground">Design calculations use Library specifications and saved planning settings. You can calculate and save connections while facility information is unknown. Confirm the actual supply before installation.</p>
  <details className="text-sm"><summary>Planned supplies · {pending.length} PDUs</summary><ul className="mt-2 space-y-1">{pending.map(p=><li key={p.id}>{p.name} · Feed {p.feed||'unassigned'} · {p.voltage||'Unknown'} V{p.topology&&p.topology!=='single-phase'?' line-to-line':''} · {p.topology==='three-phase-wye'?'three-phase wye':p.topology==='three-phase-delta'?'three-phase delta':p.topology==='single-phase'?'single-phase':'topology unknown'} · {p.limitAmps||'Unknown'} A usable per line</li>)}</ul><p className="mt-2 text-muted-foreground">Facility circuits, upstream capacity, and A/B independence remain unconfirmed. Planned values are requirements for this design.</p></details>
 </aside>;
}

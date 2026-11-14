import type {PowerAssignmentDecision} from '@/lib/feed-balance';
import type {FeedEquipment} from '@/lib/feed-rack';
import {powerInputLabel} from '@/lib/b300-power-inputs';

export function PowerAssignmentNotes({equipment,deviations,limitations}:{equipment:FeedEquipment[];deviations:PowerAssignmentDecision[];limitations:string[]}){
 return <>
  {limitations.length>0&&<aside aria-label="A/B redundancy limitations" className="rounded-xl border border-amber-400/40 p-4 text-sm space-y-2"><h4 className="font-semibold">A/B redundancy incomplete</h4><p>These connections can be planned, but the rack cannot pass all redundancy checks with this hardware.</p><ul className="space-y-1">{limitations.map(note=><li key={note}>{note}</li>)}</ul></aside>}
  {deviations.length>0&&<details className="rounded-xl border border-border p-4 text-sm" aria-label="Outlet sequence explanations"><summary>Why outlet numbers differ from sequence · {deviations.length}</summary><ul className="mt-3 space-y-3">{deviations.map(d=><li key={`${d.deviceId}:${d.inlet}`}><strong>{equipment.find(e=>e.id===d.deviceId)?.name} · {powerInputLabel(equipment.find(e=>e.id===d.deviceId),d.inlet)} → {equipment.find(e=>e.id===d.pduId)?.name} / P{d.outlet}</strong><p className="mt-1 text-muted-foreground">{d.reason}</p></li>)}</ul></details>}
 </>;
}

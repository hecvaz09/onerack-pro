"use client";
import {useState,type ReactNode} from 'react';
import Link from 'next/link';
import {rackSpaceStatus,type StatusDevice} from '@/lib/rack-status';
import {feedRack,readFeedInputs,type FeedEquipment} from '@/lib/feed-rack';
import {analyzeFeeds} from '@/lib/feed-power';
import {designPowerAnalysis} from '@/lib/outlet-planning-checks';

export function RackStatusPane({children,devices,equipment,configuration,heightRU,pockets,basePath,networkCables}:{children:ReactNode;devices:StatusDevice[];equipment:FeedEquipment[];configuration:unknown;heightRU:number;pockets:boolean;basePath:string;networkCables:number}){
 const [open,setOpen]=useState(true);
 const space=rackSpaceStatus(heightRU,pockets,devices);
 const inputs=readFeedInputs(configuration,equipment),{supplies,loads,cords}=feedRack(equipment,inputs);
 const analysis=designPowerAnalysis(analyzeFeeds(supplies,loads,cords,inputs.headroomPercent));
 const known=loads.filter(d=>Number.isFinite(d.watts)&&Number(d.watts)>0),watts=known.reduce((n,d)=>n+Number(d.watts),0);
 const issues=[...new Set([...analysis.issues,...analysis.scenarios.flatMap(s=>s.errors)])];
 return <div className={`rack-status-layout ${open?'status-open':'status-closed'}`}>
  <div className="rack-status-main">{children}</div>
  <aside className="rack-status-pane" aria-label="Current rack status">
   <button className="rack-status-toggle" type="button" aria-expanded={open} aria-controls="rack-status-content" onClick={()=>setOpen(v=>!v)}><span>{open?'Current status':'Status'}</span><span aria-hidden="true">{open?'→':'←'}</span></button>
   {open&&<div id="rack-status-content">
    <p className="status-caption">Saved build · updates after changes save</p>
    <section className="status-section"><div className="status-section-title"><h3>Rack space</h3><span>{Math.round(space.used/heightRU*100)}% occupied</span></div><progress aria-label="Occupied rack units" max={heightRU} value={space.used}/><div className="status-metrics"><div><strong>{space.free}<small> U</small></strong><span>Available</span></div><div><strong>{space.longest}<small> U</small></strong><span>Largest open span</span></div></div><p className="status-caption">{space.used} of {heightRU}U reserved through the rack{pockets?` · ${space.pockets}/12 pocket positions used`:''}</p></section>
    <section className="status-section"><div className="status-metrics"><div><strong>{devices.length}</strong><span>Installed devices</span></div><div><strong>{space.nodes}</strong><span>Server nodes</span></div><div><strong>{networkCables}</strong><span>Network cable records</span></div><div><strong>{cords.length}</strong><span>Power cords</span></div></div><Link href={`${basePath}/connections`} className="status-action">Review cable matrix ↗</Link></section>
    <section className="status-section"><div className="status-section-title"><h3>Power design</h3><span className={`status-badge ${analysis.ready?'status-ok':'status-review'}`}>{analysis.ready?'Plan checked':'Needs review'}</span></div><div className="status-power-total">{known.length?(watts/1000).toFixed(2):'—'} <small>kW entered</small></div><p className="status-caption">{known.length}/{loads.length} system budgets · {supplies.length} PDUs · {inputs.headroomPercent}% extra headroom</p><p className="status-caption">Calculated from saved demand and planned limits. Site verification is separate. Missing budgets are not zero.</p>{analysis.scopeNotes?.length&&<p className="status-caption">B300: PDU capacity planning only. Internal server redundancy is not evaluated. Incomplete B300 mappings are excluded from capacity totals.</p>}<div className="status-scenarios">{analysis.scenarios.map(s=><div key={s.lost||'normal'}><span>{s.lost?`Feed ${s.lost} lost`:'Normal operation'}</span><strong className={s.errors.length?'status-error':analysis.issues.length?'status-review':'status-ok'}>{s.errors.length?`${s.errors.length} ${s.errors.length===1?"flag":"flags"}`:analysis.issues.length?'Incomplete':'Pass'}</strong></div>)}</div><Link className="status-action" href={`${basePath}?tab=power`}>Open power planner ↗</Link></section>
    {issues.length>0&&<section className="status-section"><details><summary>Needs attention <span className="status-count">{issues.length}</span></summary><ul className="status-issues">{issues.slice(0,5).map(issue=><li key={issue}>{issue}</li>)}</ul>{issues.length>5&&<Link className="status-action" href={`${basePath}?tab=power`}>Review all {issues.length} items ↗</Link>}</details></section>}
    <section className="status-section"><details open><summary>Installed equipment <span className="status-count">{space.groups.length} models</span></summary><div className="status-inventory">{space.groups.length?space.groups.map(g=><details key={g.name}><summary><b>{g.count}×</b><span>{g.name}</span></summary><p>{g.positions.join(' · ')}</p></details>):<p className="status-caption">Add equipment to begin this build.</p>}</div></details></section>
   </div>}
  </aside>
 </div>;
}

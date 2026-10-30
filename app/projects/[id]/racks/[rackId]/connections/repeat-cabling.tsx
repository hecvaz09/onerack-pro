'use client';
import {useMemo,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {planCablingPattern,type PatternDevice,type PatternConnection,type PatternOptions} from '@/lib/cabling-pattern';
import {applyCablingPattern} from './pattern-actions';

export function RepeatCabling({rackId,devices,connections,revision}:{rackId:string;devices:PatternDevice[];connections:PatternConnection[];revision:string}){
 const router=useRouter();const [pending,start]=useTransition();
 const chassis=devices.filter(d=>d.category==='chassis');
 const [sourceId,setSource]=useState(''),[targets,setTargets]=useState<string[]>([]),[order,setOrder]=useState<PatternOptions['order']>('descending'),[direction,setDirection]=useState<-1|1>(-1),[labelTemplate,setLabel]=useState(''),[reviewed,setReviewed]=useState(false),[preview,setPreview]=useState(false),[message,setMessage]=useState('');
 const source=devices.find(d=>d.id===sourceId),matching=chassis.filter(d=>d.id!==sourceId&&d.catalogId===source?.catalogId);
 const options={sourceId,targetIds:targets,order,direction,labelTemplate};
 const plan=useMemo(()=>planCablingPattern(devices,connections,{sourceId,targetIds:targets,order,direction,labelTemplate}),[devices,connections,sourceId,targets,order,direction,labelTemplate]);
 const adds=plan.rows.filter(r=>r.state==='add'),kept=plan.rows.filter(r=>r.state==='keep'),conflicts=plan.rows.filter(r=>r.state==='conflict'),warnings=[...new Set(adds.flatMap(r=>r.warnings))];
 function changed(){setPreview(false);setReviewed(false);setMessage('');}
 function save(){start(async()=>{try{const result=await applyCablingPattern(rackId,options,revision,reviewed);setMessage(result.ok?`Added ${result.count} connections. Use Undo in the rack map to restore the previous cabling.`:result.error);if(result.ok){setPreview(false);setTargets([]);router.refresh();}}catch{setMessage('Could not save. Reload to check the latest cabling before retrying.');}});}
 return <details className="repeat-cabling"><summary><span>Repeat chassis cabling</span><small>Use a completed chassis as your wiring template</small></summary>
 <p className="repeat-intro">Connect the first chassis once, then fill the pattern across matching chassis. Each switch advances by the template’s physical port span; breakout legs stay with their parent. Network cables only.</p>
 <fieldset disabled={pending}>
 <div className="repeat-fields">
 <label>Template chassis<select value={sourceId} onChange={e=>{setSource(e.target.value);setTargets([]);changed();}}><option value="">Choose a wired chassis…</option>{chassis.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
 <label>Chassis order<select value={order} onChange={e=>{setOrder(e.target.value as PatternOptions['order']);changed();}}><option value="descending">Top to bottom · highest RU first</option><option value="ascending">Bottom to top · lowest RU first</option></select></label>
 <label>Switch port direction<select value={direction} onChange={e=>{setDirection(Number(e.target.value) as -1|1);changed();}}><option value={-1}>Count down · P24 → P23</option><option value={1}>Count up · P1 → P2</option></select></label>
 </div>
 <label className="repeat-label">Cable label formula <span>Optional · leave blank for automatic endpoint labels that follow RU moves</span><input value={labelTemplate} maxLength={400} placeholder="{switch} | {device}" onChange={e=>{setLabel(e.target.value);changed();}}/></label>
 <p className="repeat-hint">{'{switch} = switch RU + port · {device} = chassis RU + node/port · {n} = chassis sequence (template is 1). Custom formulas save fixed labels.'}</p>
 {source&&<div className="repeat-targets"><div><strong>Apply to matching chassis</strong><button type="button" onClick={()=>{setTargets(targets.length===matching.length?[]:matching.map(d=>d.id));changed();}}>{targets.length===matching.length?'Clear selection':'Select all'}</button></div>{matching.length?<div className="repeat-checks">{[...matching].sort((a,b)=>(order==='descending'?-1:1)*(a.startRU-b.startRU)).map(d=><label key={d.id}><input type="checkbox" checked={targets.includes(d.id)} onChange={e=>{setTargets(old=>e.target.checked?[...old,d.id]:old.filter(id=>id!==d.id));changed();}}/>{d.name}</label>)}</div>:<p>No other chassis of this model are installed in this rack.</p>}</div>}
 <button className="repeat-button" type="button" disabled={!targets.length||!sourceId} onClick={()=>{setPreview(true);setReviewed(false);}}>Preview connections</button>
 {preview&&<div className="repeat-preview">
 <h3>{adds.length} new connections · {kept.length} existing kept · {conflicts.length} conflicts</h3>
 {plan.errors.map(e=><p className="repeat-error" key={e} role="alert">{e}</p>)}{plan.notes.map(n=><p className="repeat-hint" key={n}>{n}</p>)}
 <div className="overflow-x-auto"><table><thead><tr><th>Chassis / node port</th><th>Switch / port</th><th>Generated label</th><th>Result</th></tr></thead><tbody>{plan.rows.map((row,i)=><tr key={i} data-conflict={row.state==='conflict'}><td>{row.targetName}<small>{row.sourcePort}</small></td><td>{row.switchName}<small>{row.switchPort}</small></td><td className="font-mono">{row.state==='keep'?'Unchanged':row.label||'—'}</td><td>{row.state==='add'?'Add connection':row.message}</td></tr>)}</tbody></table></div>
 {!!warnings.length&&<div className="repeat-warnings"><p>Compatibility notes: {warnings.join(' ')}</p><label><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>I reviewed these compatibility notes.</label></div>}
 <button type="button" className="repeat-button" disabled={!adds.length||!!conflicts.length||!!plan.errors.length||(!!warnings.length&&!reviewed)} onClick={save}>{pending?'Applying…':`Apply ${adds.length} connections`}</button>
 </div>}
 </fieldset><p role="status" aria-live="polite" className="repeat-message">{pending?'Saving the complete pattern…':message}</p>
 </details>;
}

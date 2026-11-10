'use client';
import {simplePowerPlan} from '@/lib/simple-power-plan';
import {psuConnectionStatuses} from '@/lib/psu-connection-status';
import {powerInputLabel,powerAssignmentLabel,isB300PowerDevice,B300_POWER_SCOPE,B300_INPUT_IDENTITY} from '@/lib/b300-power-inputs';
import {applyPowerSave,powerFeedProgress} from '@/lib/power-feed-progress';
import {ArrowRight,Check,ClipboardList,PlugZap,Trash2,X} from 'lucide-react';
import {consumptionSummary} from '@/lib/power-consumption';
import {readFeedInputs} from '@/lib/feed-rack';
import {useEffect,useMemo,useRef,useState,useTransition,type CSSProperties} from 'react';
import {useRouter} from 'next/navigation';
import {RackGrid,type RackGridDevice} from './physical-rack-grid';
import type {RackConfig} from '@/lib/rack-config';
import {readDetails,type Outlet} from '@/lib/equipment-details';
import {psuConnections} from '@/lib/connection-highlights';
import {connectVisualPower,disconnectVisualPower,saveVisualPowerPlan} from './visual-power-actions';
import {powerReviewSummary} from '@/lib/power-review-summary';
import {powerWiringGuide} from '@/lib/power-wiring-guide';
import {visualPowerBalance,canSaveVisualPowerDraft,connectionPowerChecks} from '@/lib/visual-power';
import type {FeedEquipment} from '@/lib/feed-rack';
import type {Cord} from '@/lib/feed-power';

type Endpoint={pduId:string;outlet:number;deviceId?:string;inlet?:number;inputIdentity?:typeof B300_INPUT_IDENTITY};
export function VisualPowerMap({rackId,config,heightRU,devices:serverDevices,equipment:serverEquipment,configuration}:{equipment:FeedEquipment[];configuration:unknown;rackId:string;config:RackConfig;heightRU:number;devices:RackGridDevice[]}) {
 const [acknowledged,setAcknowledged]=useState<{source:FeedEquipment[];equipment:FeedEquipment[]}|null>(null);
 const equipment=acknowledged?.source===serverEquipment?acknowledged.equipment:serverEquipment;
 const devices=useMemo(()=>serverDevices.map(d=>({...d,details:equipment.find(e=>e.id===d.id)?.details??d.details})),[serverDevices,equipment]);
 const powerStatuses=useMemo(()=>psuConnectionStatuses(equipment,configuration),[equipment,configuration]);
 const simplePlan=useMemo(()=>simplePowerPlan(equipment,configuration),[equipment,configuration]);
 const [previewRevision,setPreviewRevision]=useState<string|null>(null);
 const reviewing=previewRevision===simplePlan.revision&&!simplePlan.error;
 const router=useRouter(),root=useRef<HTMLDivElement>(null),busy=useRef(false);
 const [selected,setSelected]=useState<Endpoint|null>(null),[hover,setHover]=useState<Endpoint|null>(null);
 const [message,setMessage]=useState('Click a PSU to see the calculator’s recommended PDU outlet.'),[pending,start]=useTransition();
 const [saveError,setSaveError]=useState('');
 const [candidate,setCandidate]=useState<Cord|undefined>();
 const [target,setTarget]=useState<{deviceId:string;inlet:number}|undefined>();
 const selectedBudget=target?readFeedInputs(configuration,equipment).budgets[target.deviceId]:undefined;
 const rackPlan=useMemo(()=>powerWiringGuide(equipment,configuration),[equipment,configuration]);
 const guide=useMemo(()=>powerWiringGuide(equipment,configuration,target,candidate),[equipment,configuration,target,candidate]);
 const sides=useMemo(()=>powerFeedProgress(equipment,configuration,rackPlan.assignments||[]),[equipment,configuration,rackPlan.assignments]);
 const pendingConnections=sides.flatMap(side=>side.pending.map(c=>({...c,feed:side.feed})));
 const complete=!rackPlan.error&&Number(rackPlan.total)>0&&pendingConnections.length===0;
 const changedSuggestions=candidate&&guide.assignments&&rackPlan.assignments?guide.assignments.filter(c=>c.deviceId!==candidate.deviceId||c.inlet!==candidate.inlet).filter(c=>rackPlan.assignments!.some(previous=>previous.deviceId===c.deviceId&&previous.inlet===c.inlet&&(previous.pduId!==c.pduId||previous.outlet!==c.outlet))).length:0;
 const [clearing,setClearing]=useState(false);
 const review=visualPowerBalance(equipment,configuration,candidate);
 const savedChecks=selected?.deviceId&&!candidate?connectionPowerChecks(review,equipment,selected.pduId,selected.deviceId):[];
 const savedBudget=selected?.deviceId?readFeedInputs(configuration,equipment).budgets[selected.deviceId]:undefined;
 const grouped=powerReviewSummary([...new Set([...(guide?.issues||[]),...review.errors])].map(i=>i.replace(/^(Normal|Feed [AB] lost): /,'')),equipment);
 const draftAllowed=!!candidate&&!!guide?.recommendation&&!!guide.provisional&&canSaveVisualPowerDraft(review);
 const blocked=!!guide?.error||(!!candidate&&review.status==='blocked');
 const feedback=draftAllowed?'#f4ce73':blocked?'#ff9292':candidate&&review.status==='caution'?'#f4ce73':'#5ee9b5';
 const selectionMessage=draftAllowed?'Recommended planning connection. Load distribution calculated; PSU documentation is tracked separately.':target?(guide?.error?'Outlet recommendation unavailable. Open the checks below to see what needs attention.':candidate?(blocked?'Selected connection needs attention. See the reason below.':'Selected connection checked. Confirm to save it.'):'Recommended outlet highlighted. Click it to review and confirm, or choose another outlet.'):selected?.deviceId?(savedChecks.length?'Connection saved. Open pending checks for this device and PDU.':'Connection saved. No outstanding checks for this device and PDU.'):message;
 const [line,setLine]=useState<{x1:number;y1:number;x2:number;y2:number}|null>(null);
 const inputLabel=(id:string|undefined,inlet:number)=>powerInputLabel(equipment.find(e=>e.id===id),inlet);
 const savedLabel=(endpoint:Endpoint)=>powerAssignmentLabel(equipment.find(e=>e.id===endpoint.deviceId),readDetails(equipment.find(e=>e.id===endpoint.pduId)?.details).outlets[endpoint.outlet]||{});
 const capacityOnly=equipment.some(isB300PowerDevice);
 const name=(id?:string)=>{const d=devices.find(d=>d.id===id);return d?`${d.label||d.catalogDevice.model} · U${d.startRU}`:'Equipment';};
 const resolve=(pduId:string,outlet:number):Endpoint=>{const a=readDetails(devices.find(d=>d.id===pduId)?.details).outlets[outlet];return {pduId,outlet,deviceId:a?.deviceId,inlet:a?.inlet,inputIdentity:a?.inputIdentity};};
 // Hover paints the rack only. It must never resize the controls above its hit targets.
 const controlEndpoint=candidate||(target?guide.recommendation:selected);
 const shown=hover||controlEndpoint||rackPlan.recommendation;

 useEffect(()=>{
  const host=root.current;if(!host)return;
  function paint(){
   if(!host)return;
   host.querySelectorAll('[data-power-proposed]').forEach(el=>el.removeAttribute('data-power-proposed'));
   host.querySelectorAll('[data-power-highlight]').forEach(el=>el.removeAttribute('data-power-highlight'));
   const outlets=Array.from(host.querySelectorAll<HTMLElement>('[data-power-pdu]'));
   const psus=Array.from(host.querySelectorAll<HTMLElement>('[data-psu-device]'));
   if(reviewing)for(const c of simplePlan.remaining){
    outlets.find(el=>el.dataset.powerPdu===c.pduId&&Number(el.dataset.powerOutlet)===c.outlet)?.setAttribute('data-power-proposed','true');
    psus.find(el=>el.dataset.psuDevice===c.deviceId&&Number(el.dataset.psuInlet)===c.inlet)?.setAttribute('data-power-proposed','true');
   }
   const a=outlets.find(el=>el.dataset.powerPdu===shown?.pduId&&Number(el.dataset.powerOutlet)===shown?.outlet);
   const b=psus.find(el=>el.dataset.psuDevice===shown?.deviceId&&Number(el.dataset.psuInlet)===shown?.inlet&&(!isB300PowerDevice(equipment.find(d=>d.id===shown?.deviceId))||shown?.inputIdentity===B300_INPUT_IDENTITY));
   a?.setAttribute('data-power-highlight','true');b?.setAttribute('data-power-highlight','true');
   if(a&&b){const origin=host.getBoundingClientRect(),ra=a.getBoundingClientRect(),rb=(b.querySelector(".connection-socket")||b).getBoundingClientRect();setLine({x1:ra.left+ra.width/2-origin.left,y1:ra.top+ra.height/2-origin.top,x2:rb.left+rb.width/2-origin.left,y2:rb.top+rb.height/2-origin.top});}else setLine(null);
  }
  paint();const observer=new ResizeObserver(paint);observer.observe(host);host.addEventListener('scroll',paint,true);window.addEventListener('resize',paint);
  return()=>{observer.disconnect();host.removeEventListener('scroll',paint,true);window.removeEventListener('resize',paint);};
 },[shown,devices,equipment,reviewing,simplePlan]);
 function inspect(target:EventTarget|null){
  if(!(target instanceof Element))return;
  const o=target.closest<HTMLElement>('[data-power-pdu]');
  if(o){setHover(resolve(o.dataset.powerPdu!,Number(o.dataset.powerOutlet)));return;}
  const p=target.closest<HTMLElement>('[data-psu-device]');
  if(p){const cord=psuConnections(devices,p.dataset.psuDevice!,Number(p.dataset.psuInlet))[0];setHover(cord?resolve(cord.pdu.id,cord.outlet):null);return;}
  setHover(null);
 }
 function chooseOutlet(pduId:string,outlet:Outlet){
  if(busy.current)return;setSaveError('');setHover(null);setClearing(false);
  const next=resolve(pduId,outlet.n);setSelected(next);
  setCandidate(target&&!next.deviceId?{...target,pduId,outlet:outlet.n,...(isB300PowerDevice(equipment.find(e=>e.id===target.deviceId))?{inputIdentity:B300_INPUT_IDENTITY}:{})}:undefined);
  setMessage('Choose a PSU, review the projected balance, then confirm.');
 }
 function choosePsu(deviceId:string,inlet:number){
  if(busy.current)return;setSaveError('');setHover(null);setClearing(false);
  const cords=psuConnections(devices,deviceId,inlet);
  if(cords.length){setTarget(undefined);setCandidate(undefined);setSelected(resolve(cords[0].pdu.id,cords[0].outlet));setMessage(readDetails(cords[0].pdu.details).outlets[cords[0].outlet]?.notes.includes('Planning draft:')?'Saved draft connection. Electrical verification remains pending.':'Saved connection. Clear it to choose a different outlet.');return;}
  const proposed=reviewing?simplePlan.remaining.find(c=>c.deviceId===deviceId&&c.inlet===inlet):undefined;
  if(proposed){reviewConnection(proposed);return;}
  setTarget({deviceId,inlet});setCandidate(selected&&!selected.deviceId?{pduId:selected.pduId,outlet:selected.outlet,deviceId,inlet,...(isB300PowerDevice(equipment.find(e=>e.id===deviceId))?{inputIdentity:B300_INPUT_IDENTITY}:{})}:undefined);setSelected(null);
  setMessage('Calculator recommendation highlighted. Click that outlet to review and confirm, or click another outlet to check an alternative.');
 }
 function reviewConnection(c:Cord){
  if(busy.current)return;
  setTarget({deviceId:c.deviceId,inlet:c.inlet});setCandidate(c);setSelected(null);setHover(null);setSaveError('');setClearing(false);
 }
 function confirm(){
  if(!candidate||busy.current||(blocked&&!draftAllowed))return;
  setSaveError('');
  const endpoint=candidate;busy.current=true;
  start(async()=>{try{const result=await connectVisualPower(rackId,endpoint.pduId,endpoint.outlet,endpoint.deviceId,endpoint.inlet,draftAllowed);if(result.error){setSaveError(result.error);router.refresh();return;}setAcknowledged({source:serverEquipment,equipment:applyPowerSave(equipment,result)});setCandidate(undefined);setTarget(undefined);setSelected(endpoint);setMessage(draftAllowed?'Draft connection saved. Electrical verification remains pending.':'Connection saved. Balance sheet updated.');router.refresh();}catch{setSaveError('Could not save. Refresh and try again.');}finally{busy.current=false;}});
 }
 function clear(){
  if(!selected?.deviceId||busy.current)return;busy.current=true;
  start(async()=>{try{const result=await disconnectVisualPower(rackId,selected.pduId,selected.outlet,selected.deviceId!,selected.inlet||0);setMessage(result.error||'Connection cleared. Choose an outlet and PSU to reconnect.');if(result.ok){setAcknowledged({source:serverEquipment,equipment:applyPowerSave(equipment,result)});setSelected(null);setCandidate(undefined);setTarget(undefined);}setClearing(false);router.refresh();}catch{setMessage('Could not clear. Refresh and try again.');}finally{busy.current=false;}});
 }
 function calculateLayout(){
  if(busy.current)return;
  setPreviewRevision(simplePlan.revision);setSaveError('');setSelected(null);setTarget(undefined);setCandidate(undefined);setHover(null);
 }
 function saveLayout(){
  if(busy.current||!reviewing||!simplePlan.remaining.length)return;
  busy.current=true;setSaveError('');
  start(async()=>{try{
   const result=await saveVisualPowerPlan(rackId,simplePlan.revision,simplePlan.planning);
   if(result.error){setSaveError(result.error);router.refresh();return;}
   if(result.ok){const updated=(result.updates||[]).reduce((rows,update)=>applyPowerSave(rows,{ok:true,...update}),equipment);setAcknowledged({source:serverEquipment,equipment:updated});setPreviewRevision(null);setSelected(null);setCandidate(undefined);setTarget(undefined);setHover(null);setMessage(result.planning?'Planning layout saved. Electrical verification is still pending.':'Connections saved.');router.refresh();}
  }catch{setSaveError('The save could not be confirmed. Refresh before trying again.');}finally{busy.current=false;}});
 }
 function openAdvanced(){const advanced=document.getElementById('power-advanced');if(advanced instanceof HTMLDetailsElement)advanced.open=true;advanced?.scrollIntoView({block:'start'});}
 return <div className="visual-power-map" style={{"--power-feedback":feedback} as CSSProperties} onKeyDown={e=>{if(e.key==='Escape'&&!pending){setSelected(null);setHover(null);setTarget(undefined);setCandidate(undefined);setClearing(false);}}}>
  <section className="simple-power-actions" aria-label="Automatic rack connections">
   <div><p className="text-sm text-muted-foreground">Calculate → Review → Save</p><h3 className="font-semibold">{reviewing?'Review your connections':'Plan your connections'}</h3><p className="text-sm" role="status" aria-live="polite">{previewRevision&&simplePlan.error?'Some settings need attention before a plan can be calculated.':previewRevision&&!reviewing?'The rack changed. Calculate a fresh plan.':reviewing?`${simplePlan.remaining.length} new connections proposed. Click a PSU to inspect its outlet.`:message==='Click a PSU to see the calculator’s recommended PDU outlet.'?'Use your saved Library data and rack settings. Existing cables stay fixed.':message}</p></div>
   <div className="power-connection-actions"><button type="button" className={`power-connection-button${reviewing?'':' is-primary'}`} disabled={pending} onClick={calculateLayout}>Calculate connections</button>{reviewing&&simplePlan.remaining.length>0&&<button type="button" className="power-connection-button is-primary" disabled={pending} onClick={saveLayout}>{pending?'Saving…':simplePlan.planning?'Save planning layout':'Save connections'}</button>}{previewRevision&&simplePlan.error&&<button type="button" className="power-connection-button" onClick={openAdvanced}>Review needed settings</button>}</div>
   {reviewing&&simplePlan.remaining.length>0&&<p className="text-xs text-muted-foreground">Dashed outlines are proposed connections. PSU lights update only after saving.</p>}
   {reviewing&&simplePlan.planning&&<p className="text-sm text-amber-300">Planning mode · estimates or PSU documentation need verification. Saving records the wiring, not electrical approval.</p>}
   {reviewing&&!simplePlan.remaining.length&&<p className="text-sm">All proposed connections are already saved.</p>}
   {previewRevision&&simplePlan.error&&<details><summary>What needs attention?</summary><p className="text-sm">{simplePlan.error}</p><ul className="text-sm">{grouped.actions.map((g,i)=><li key={i}>{g.message}</li>)}</ul></details>}
  </section>
  <details className="power-extra"><summary>Connection progress &amp; individual connection tools</summary>
  {capacityOnly&&<p role="note" className="text-sm text-muted-foreground">{B300_POWER_SCOPE}</p>}
  <section className="visual-power-toolbar" style={{position:"relative",top:0}} aria-label="Calculated rack wiring plan">
   <div className="power-connection-heading"><span className="power-connection-icon"><PlugZap size={20} aria-hidden="true"/></span><h3>Connection progress</h3><span className="power-connection-state">{rackPlan.error?'Needs attention':`${rackPlan.confirmed||0} / ${rackPlan.total||0} confirmed`}</span></div>
   <p className="power-connection-measurement">{rackPlan.error?rackPlan.error:'Recommendations use saved consumption and electrical settings. Saved cables stay fixed; a recommendation is not a saved connection.'}</p>
   {!rackPlan.error&&<div className="power-feed-sections">{sides.map(side=><section key={side.feed} className={`power-feed-section feed-${side.feed.toLowerCase()}`} aria-label={`${side.feed}-Side Power`}>
    <div className="power-connection-heading"><span className="power-feed-letter">{side.feed}</span><h4>{side.feed}-Side Power</h4><span className="power-connection-state" aria-live="polite">{side.connected} of {side.total} connected</span></div>
    <progress aria-label={`${side.feed}-Side connection progress`} value={side.connected} max={side.total||1}/>
    <p className="power-feed-complete">{side.pending.length?`${side.pending.length} ${side.pending.length===1?'connection':'connections'} remaining`:side.total?'All connections on this side are saved':'No assignments on this feed'}</p>
   </section>)}</div>}
   {!rackPlan.error&&pendingConnections.length>0&&<div>
    <button className="power-connection-button is-primary" type="button" disabled={pending} onClick={()=>reviewConnection(pendingConnections[0])}><ArrowRight size={17} aria-hidden="true"/>Review next connection</button>
    <details open className="mt-3"><summary>{capacityOnly?'Pending power inputs':'Pending PSUs'} · {pendingConnections.length}</summary><div className="power-feed-pending">{pendingConnections.map(c=><button key={`${c.deviceId}:${c.inlet}`} className="power-connection-button power-feed-row" type="button" disabled={pending} onClick={()=>reviewConnection(c)}><span><strong>{name(c.deviceId)}</strong><small>{inputLabel(c.deviceId,c.inlet)} · Feed {c.feed}</small></span><ArrowRight size={16} aria-hidden="true"/><span><strong>Recommended outlet {c.outlet}</strong><small>{name(c.pduId)}</small></span></button>)}</div></details>
   </div>}
   {complete&&<div><p className="power-feed-complete"><Check size={17} aria-hidden="true"/>All planned connections are saved. Review balance and remaining checks.</p><button type="button" className="power-connection-button is-primary mt-3" onClick={()=>{const target=document.getElementById('power-review');if(target){target.focus({preventScroll:true});target.scrollIntoView({block:'start'});}else{setMessage('Review the phase and breaker results in the power planner above.');}}}>Review power balance</button></div>}


  </section>
  </details>
  {(selected||target||saveError)&&<section className="visual-power-toolbar" aria-label="Power connection controls">
   <div className="power-connection-heading"><span className="power-connection-icon"><PlugZap size={20} aria-hidden="true"/></span><h3>{selected?.deviceId&&!candidate?'Saved connection':candidate?'Review connection':'Connect power'}</h3><span className="power-connection-state">{pending?'Saving…':selected?.deviceId&&!candidate?'Saved':draftAllowed?'Planning':candidate&&blocked?'Needs attention':target?'Selected':'Ready'}</span></div>
   {controlEndpoint&&<div className="power-connection-route"><div><span className="power-connection-caption">PDU · Outlet {controlEndpoint.outlet}</span><strong>{name(controlEndpoint.pduId)}</strong></div><ArrowRight className="power-route-arrow" size={20} aria-hidden="true"/><div><span className="power-connection-caption">{controlEndpoint.deviceId?`Equipment · ${!candidate&&!target?savedLabel(controlEndpoint):inputLabel(controlEndpoint.deviceId,controlEndpoint.inlet||0)}`:'Destination'}</span><strong>{controlEndpoint.deviceId?name(controlEndpoint.deviceId):'Select a PSU in the rack'}</strong></div></div>}
   {target&&<p className="power-connection-measurement">{consumptionSummary(selectedBudget||{})}</p>}
   <div className="power-connection-footer"><p role="status" aria-live="polite">{pending?'Saving connection…':saveError||selectionMessage}</p><div className="power-connection-actions">
    {candidate&&<button className="power-connection-button is-primary" type="button" disabled={pending||(blocked&&!draftAllowed)} onClick={confirm}><Check size={17} aria-hidden="true"/>{draftAllowed?'Save planning connection':blocked?'Resolve checks to save':'Save connection'}</button>}
    {selected?.deviceId&&!candidate&&!clearing&&<button className="power-connection-button is-danger" type="button" disabled={pending} onClick={()=>setClearing(true)}><Trash2 size={16} aria-hidden="true"/>Clear connection</button>}
    {(selected||target)&&!clearing&&<button className="power-connection-button" type="button" disabled={pending} onClick={()=>{setSelected(null);setHover(null);setTarget(undefined);setCandidate(undefined);setClearing(false);setSaveError('');}}><X size={16} aria-hidden="true"/>{selected?.deviceId&&!candidate?'Done':'Cancel'}</button>}
    {clearing&&<><span className="power-clear-question">Remove this connection?</span><button className="power-connection-button is-danger" type="button" disabled={pending} onClick={clear}><Trash2 size={16} aria-hidden="true"/>Yes, clear connection</button><button className="power-connection-button" type="button" disabled={pending} onClick={()=>setClearing(false)}>Keep connection</button></>}
   </div></div>
   {selected?.deviceId&&!candidate&&<div className="power-saved-checks">
    <p className="power-connection-measurement">{consumptionSummary(savedBudget||{})}</p>
    {savedChecks.length>0&&<details key={`${selected.pduId}:${selected.outlet}:${selected.deviceId}`}>
     <summary className="power-connection-button"><ClipboardList size={17} aria-hidden="true"/>View pending checks <span className="power-connection-state">{savedChecks.length}</span></summary>
     <div className="power-check-content"><h4>Pending checks · {name(selected.deviceId)} / {savedLabel(selected)}</h4>
      <p>These checks concern the selected equipment and its PDU. Missing PSU specifications do not change the recorded consumption or remove the saved connection.</p>
      <ul>{savedChecks.map(check=><li key={check}>{check}</li>)}</ul>
      <p>Review PSU voltage, capacity and cord ratings in this device’s Power settings; review PDU limits in PDU power configuration. Other rack checks remain in the Power Calculator.</p>
     </div>
    </details>}
   </div>}
  </section>}
  {target&&<details key={`${target.deviceId}:${target.inlet}:${!!blocked}`} open={blocked||undefined} className="rounded-xl border border-border p-4 my-3" style={{background:"var(--background,#17252b)"}} aria-live="polite">
   <summary className="font-semibold">{blocked?'Connection checks to resolve':'Why this outlet? · alternatives and technical details'}</summary><p className="my-2 text-sm">To check an alternative, select another free outlet in the rear elevation. Review the result before saving.</p>{candidate&&!guide.error&&<p>{changedSuggestions?`This alternative changes ${changedSuggestions} other proposed assignments. Confirmed cables stay fixed.`:'This choice keeps the other proposed assignments unchanged.'}</p>}
   {guide?.recommendation?<><p><strong>{name(target.deviceId)} / {inputLabel(target.deviceId,target.inlet)} → {name(guide.recommendation.pduId)} / Outlet {guide.recommendation.outlet}</strong></p><p>{guide.reason}</p>{guide.contributions?.map(c=><p key={c.lost||'normal'}>{c.lost?`Feed ${c.lost} lost`:'Completed plan · normal'}: this cord {c.watts.toFixed(0)} W · PDU total {c.pduWatts.toFixed(0)} W</p>)}<p>These are calculated contributions in the completed wiring plan. Existing cables stay fixed.</p>{guide.provisional&&<details><summary>PSU documentation pending · separate from consumption</summary>{powerReviewSummary(guide.pendingChecks||[],equipment).actions.map((g,i)=><p key={i}>{g.message}{g.devices.length>1?` (${g.devices.length} systems)`:''}</p>)}</details>}</>:<><p className="text-amber-300">Recommendations paused: {grouped.actions.length} grouped checks need attention.</p><details><summary>See required inputs and affected equipment</summary>{grouped.actions.map((g,i)=><p key={i}>{g.message}{g.devices.length>1?` (${g.devices.length} systems)`:''}</p>)}{grouped.assumptions.map(a=><p key={a}>{a}</p>)}{!grouped.actions.length&&<p>{guide?.error}</p>}</details></>}
   {candidate&&guide?.recommendation&&!draftAllowed&&review.errors.length>0&&<div className="my-3 text-amber-300"><p>The completed plan passes, but the current partial layout has checks to resolve before this step can be saved:</p><details open><summary>Why this connection is blocked</summary>{grouped.actions.map((g,i)=><p key={i}>{g.message}{g.devices.length>1?` (${g.devices.length} systems)`:''}</p>)}{grouped.assumptions.map(a=><p key={a}>{a}</p>)}</details></div>}
   {candidate&&<><p style={{color:feedback}}>{draftAllowed?'PSU compatibility pending; consumption value is unchanged':blocked?'Cannot save this step; see checks above':review.status==='caution'?'Wiring in progress; missing connections are expected':'👍 Checks passed'} · Current step PDU load: {review.current.scenarios[0].totals.find(p=>p.id===candidate.pduId)?.watts.toFixed(0)} W → {review.projected.scenarios[0].totals.find(p=>p.id===candidate.pduId)?.watts.toFixed(0)} W</p></>}
  </details>}
  <p className="psu-status-legend" role="note"><span data-state="off">○ Not connected</span><span data-state="connected">● Saved and checked</span><span data-state="pending">◐ Verification pending</span><span data-state="issue">! Needs attention</span><small>Saved connection status — not live electrical power.</small></p>
  <div ref={root} style={{position:'relative',overflowX:'auto',maxWidth:'100%'}} onPointerOver={e=>inspect(e.target)} onPointerLeave={()=>setHover(null)} onFocusCapture={e=>inspect(e.target)} onBlurCapture={()=>setHover(null)}>
   <RackGrid powerStatuses={powerStatuses} config={config} rear disabled heightRU={heightRU} devices={devices} onOutlet={chooseOutlet} onPsu={choosePsu}/>
   {line&&<svg aria-hidden="true" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:30,overflow:'hidden'}}><line {...line} stroke="#101e24" strokeWidth="7"/><line {...line} stroke={feedback} strokeWidth="3"/><circle cx={line.x1} cy={line.y1} r="5" fill={feedback}/><circle cx={line.x2} cy={line.y2} r="5" fill={feedback}/></svg>}
  </div>
  <style>{`.simple-power-actions{display:grid;gap:12px;margin-bottom:16px}.visual-power-map [data-power-proposed="true"] .connection-socket{stroke:var(--primary);stroke-width:3;stroke-dasharray:5 3}.visual-power-map [data-power-proposed="true"]{outline:2px dashed var(--primary);outline-offset:2px}.power-saved-checks{display:grid;gap:12px}.power-saved-checks summary{width:fit-content;list-style:none}.power-saved-checks summary::-webkit-details-marker{display:none}.power-saved-checks details[open] summary{border-color:var(--primary)}.power-check-content{margin-top:12px;padding:16px;border:1px solid var(--border);border-radius:12px;max-height:280px;overflow:auto;font-size:13px;line-height:1.6}.power-check-content h4{font-weight:650}.power-check-content p{margin:8px 0;color:var(--muted-foreground)}.power-check-content ul{padding-left:20px;list-style:disc}.power-check-content li{margin:6px 0}.power-feed-sections{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.power-feed-section{min-width:0;padding:16px;border:1px solid var(--border);border-radius:14px;background:color-mix(in srgb,var(--background) 20%,transparent);display:flex;flex-direction:column;gap:14px}.power-feed-section h4{font-size:15px;font-weight:650}.power-feed-letter{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:color-mix(in srgb,var(--primary) 14%,transparent);color:var(--primary);font-weight:700}.power-feed-section progress{width:100%;accent-color:var(--primary)}.power-feed-pending{display:grid;gap:8px;margin-top:12px;max-height:360px;overflow:auto;padding:3px}.power-feed-row{display:grid!important;grid-template-columns:minmax(0,1fr) 16px minmax(0,1fr);text-align:left;width:100%;gap:10px!important}.power-feed-row span{display:grid;gap:4px;min-width:0}.power-feed-row strong{overflow-wrap:anywhere;font-size:12px}.power-feed-row small{font-size:11px;line-height:1.4;color:var(--muted-foreground);overflow-wrap:anywhere}.power-feed-complete{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted-foreground)}@media(max-width:800px){.power-feed-sections{grid-template-columns:1fr}}
.visual-power-layout{display:grid;grid-template-columns:minmax(280px,360px) minmax(0,1fr);gap:18px;align-items:start}.visual-balance{position:sticky;top:150px;max-height:calc(100vh - 170px);overflow:auto;padding:14px;border:1px solid #5b7773;border-radius:10px;background:var(--background,#17252b)}@media(max-width:1000px){.visual-power-layout{display:flex;flex-direction:column}.visual-balance{position:sticky;top:120px;z-index:31;max-height:30vh;width:100%}}.visual-power-toolbar{position:sticky;top:12px;z-index:35;margin:12px 0;padding:20px;border:1px solid var(--border);border-radius:18px;background:var(--card);color:var(--card-foreground);backdrop-filter:blur(24px);box-shadow:0 8px 28px rgb(0 0 0 / .12),inset 0 1px 0 rgb(255 255 255 / .07);display:grid;gap:16px}.power-connection-heading{display:flex;align-items:center;gap:10px}.power-connection-heading h3{font-size:16px;font-weight:650;margin:0}.power-connection-icon{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;color:var(--primary);background:color-mix(in srgb,var(--primary) 12%,transparent);border:1px solid color-mix(in srgb,var(--primary) 25%,transparent)}.power-connection-state{margin-left:auto;font-size:12px;font-weight:600;padding:4px 10px;border:1px solid var(--border);border-radius:999px;background:var(--muted)}.power-connection-route{display:grid;grid-template-columns:minmax(0,1fr) 20px minmax(0,1fr);align-items:center;gap:18px;padding:14px 16px;border:1px solid var(--border);border-radius:12px;background:color-mix(in srgb,var(--background) 30%,transparent)}.power-connection-route>div{min-width:0;display:grid;gap:5px}.power-connection-caption{font-size:12px;color:var(--muted-foreground);font-weight:550}.power-connection-route strong{font-size:14px;line-height:1.5;overflow-wrap:anywhere}.power-route-arrow{color:var(--primary)}.power-connection-measurement{font-size:13px;color:var(--muted-foreground);margin:0}.power-connection-footer{display:flex;align-items:center;justify-content:space-between;gap:16px}.power-connection-footer>p{font-size:13px;line-height:1.5;color:var(--muted-foreground);margin:0;max-width:65ch}.power-connection-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;flex-shrink:0}.power-connection-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:10px 16px;border:1px solid var(--border);border-radius:10px;background:var(--card);color:var(--foreground);font-size:13px;font-weight:650;cursor:pointer;transition:background .15s,border-color .15s}.power-connection-button.is-primary{background:var(--primary);color:var(--primary-foreground);border-color:var(--primary);box-shadow:0 2px 8px rgb(0 0 0 / .12)}.power-connection-button.is-danger{color:var(--foreground);border-color:color-mix(in srgb,var(--destructive) 55%,var(--border));background:color-mix(in srgb,var(--destructive) 10%,var(--card))}.power-connection-button.is-danger svg{color:var(--destructive)}.power-connection-button:hover:not(:disabled){filter:brightness(1.12);border-color:var(--primary)}.power-connection-button:focus-visible{outline:3px solid var(--ring);outline-offset:3px}.power-connection-button:disabled{opacity:.5;cursor:not-allowed}.power-clear-question{font-size:13px}.power-connection-button:active:not(:disabled){transform:translateY(1px)}@media(max-width:1000px){.power-connection-footer{align-items:flex-start;flex-direction:column}.power-connection-actions{justify-content:flex-start;flex-shrink:1}}@media(max-width:600px){.visual-power-toolbar{position:relative;top:auto;padding:14px}.power-connection-route{grid-template-columns:minmax(0,1fr);gap:10px}.power-route-arrow{transform:rotate(90deg)}.power-connection-actions{width:100%}.power-connection-button{flex:1 1 auto}.power-connection-state{font-size:11px}}@media(prefers-reduced-motion:reduce){.power-connection-button{transition:none}.power-connection-button:active:not(:disabled){transform:none}}.visual-power-map [data-power-highlight="true"]{outline:3px solid var(--power-feedback)!important;outline-offset:2px}.visual-power-map [data-power-highlight="true"] .connection-socket{stroke:var(--power-feedback)!important;stroke-width:4!important;fill:color-mix(in srgb,var(--power-feedback) 20%,transparent)!important}.visual-power-map [data-power-pdu]:focus-visible,.visual-power-map .psu-hit:focus-visible{outline:3px solid #f4ce73;outline-offset:3px}`}</style>
 </div>;
}

'use client';
import {powerSetupAudit} from '@/lib/power-setup-audit';
import {libraryPowerFactors} from '@/lib/library-power-factor';
import {PowerViewStateContext} from '@/lib/power-view-state';
import {powerSettingsProblem,type PowerSettingsProblem} from '@/lib/power-settings-problem';
import {missingPowerEstimates,nextPowerQuestion} from '@/lib/simple-power-plan';
import {powerAssignmentLabel} from '@/lib/b300-power-inputs';
import {ClearLayoutControls} from './clear-layout-controls';
import {PowerOverview} from './power-overview';
import {EquipmentPowerInputs} from './equipment-power-inputs';
import {SavedPowerReview} from './saved-power-review';
import {DraftPowerPanel} from './draft-power-panel';
import {FeedElectricalSetup} from './feed-electrical-setup';
import {FeedPowerControls} from './feed-power-controls';
import {useState,useTransition,useRef,type ReactNode,type SetStateAction} from 'react';
import {type FeedInputs} from '@/lib/feed-power';
import type {BulkApplyFeedback} from '@/lib/equipment-power-editing';
import {feedRack,type FeedEquipment} from '@/lib/feed-rack';
import {saveFeedInputs} from './feed-power-actions';
import {cardClassName,inputClassName} from './styles';
import {useRouter} from 'next/navigation';
import {createPowerEditor,receivePowerSnapshot,editPowerEditor,powerEditorMessage,powerEditorDirty,capturePowerSave,finishPowerSave,POWER_INPUT_CONFLICT,type PowerSaveResult} from '@/lib/power-input-state';
export function FeedPowerPlanner({rackId,equipment,initial,saveRevision,latestHref,savedDraft,children}:{rackId:string;equipment:FeedEquipment[];initial:FeedInputs;saveRevision:string;latestHref?:string;savedDraft?:unknown;children?:ReactNode}){
  const [editor,setEditor]=useState(()=>createPowerEditor(initial,saveRevision)),[pending,start]=useTransition();
  const [bulkFeedback,setBulkFeedback]=useState<BulkApplyFeedback|null>(null),saveBusy=useRef(false),router=useRouter();
  if(editor.seenRevision!==saveRevision)setEditor(current=>receivePowerSnapshot(current,initial,saveRevision));
  const inputs=editor.draft,saved=editor.saved,dirty=powerEditorDirty(editor),message=editor.message,viewCurrent=editor.revision===saveRevision&&!editor.conflict;
  function setInputs(change:SetStateAction<FeedInputs>){setBulkFeedback(null);setEditor(current=>editPowerEditor(current,change));}
  function setMessage(value:string){setEditor(current=>powerEditorMessage(current,value));}
  function save(next?:FeedInputs){
    if(saveBusy.current||editor.conflict)return;
    setBulkFeedback(null);const editing=next?editPowerEditor(editor,next):editor;const request=capturePowerSave(editing);
    const problem=powerSettingsProblem(request.inputs,equipment);
    if(problem){setEditor(finishPowerSave(editing,request,{error:problem.message}));revealProblem(problem);return;}
    if(next)setEditor(editing);saveBusy.current=true;
    start(async()=>{
      try{
        let result:PowerSaveResult<FeedInputs>;
        try{result=await saveFeedInputs(rackId,request.inputs,request.revision);}catch{result={error:'The save could not be confirmed. Your draft is kept. You can correct settings or retry.'};}
        setEditor(current=>finishPowerSave(current,request,result));
        if('ok' in result&&result.ok)router.refresh();
        else if(!('conflict' in result&&result.conflict))revealProblem(powerSettingsProblem(request.inputs,equipment)||{message:'error' in result?result.error:'Review your settings.',target:'power-equipment'});
      }finally{saveBusy.current=false;}
    });
  }
  const {supplies,loads,cords}=feedRack(equipment,inputs);
  const advanced=useRef<HTMLDetailsElement>(null);
  const problem=powerSettingsProblem(inputs,equipment);
  const setupChecks=powerSetupAudit(equipment,inputs);
  const setupGroups=[...new Set(setupChecks.map(c=>c.message))].map(message=>({message,checks:setupChecks.filter(c=>c.message===message)}));
  const libraryFactors=libraryPowerFactors(equipment,inputs);
  const estimates=missingPowerEstimates(equipment,inputs),question=nextPowerQuestion(equipment,saved);
  function revealProblem(issue:Omit<PowerSettingsProblem,'field'>&{field?:string}){
    if(advanced.current)advanced.current.open=true;
    requestAnimationFrame(()=>{
      const section=document.getElementById(issue.target);
      const article=issue.deviceId?Array.from(section?.querySelectorAll<HTMLElement>('[data-equipment-power]')||[]).find(el=>el.dataset.equipmentPower===issue.deviceId):null;
      const field=issue.field?article?.querySelector<HTMLElement>(`[data-power-field="${issue.field}"]`):null;
      const target=field||article||section;
      for(let node:HTMLElement|null=target||null;node;node=node.parentElement)if(node instanceof HTMLDetailsElement)node.open=true;
      target?.scrollIntoView({block:'center'});target?.focus({preventScroll:true});
    });
  }
  function openSettings(id:string){revealProblem({message:'',target:id==='power-feeds'?'power-feeds':'power-equipment'});}
  function discardEdits(){setBulkFeedback(null);setEditor(current=>powerEditorMessage(editPowerEditor(current,current.saved),'Unsaved changes discarded. Saved wiring is unchanged.'));}
  return <section className={`${cardClassName} space-y-6`}>
    {editor.conflict&&<div role="alert" className="rounded-lg border border-border p-3 text-sm"><p>{POWER_INPUT_CONFLICT}</p><p>The saved overview and wiring on this page may be out of date.</p><a className="text-primary underline" href={latestHref||''} target="_blank" rel="noreferrer">Open latest rack in a new tab</a></div>}
    <header><h2 className="text-xl font-semibold">Connect your rack</h2><p className="mt-2 text-sm text-muted-foreground">Calculate connections, review them on your rack, then save the layout.</p></header>
    {setupChecks.length>0&&<details open={setupChecks.some(c=>c.blocking)||undefined} className="rounded-xl border border-border p-4" aria-label="Power setup checklist"><summary className="font-semibold">Power setup: {setupChecks.filter(c=>c.blocking).length} required settings; {setupChecks.filter(c=>!c.blocking).length} pending verification checks</summary><p className="my-2 text-sm">Available Library values are inherited. Review all missing settings here before calculating. Pending documentation can remain in a planning layout; required settings must be completed.</p><ul className="space-y-2">{setupGroups.map(g=><li key={g.message} className="text-sm"><p>{g.message}</p><details><summary>{g.checks.length} affected device(s)</summary>{g.checks.map((c,i)=><p key={`${c.deviceId}:${i}`}><strong>{c.name}</strong> <button type="button" className="text-primary underline" onClick={()=>revealProblem(c)}>Review setting</button></p>)}</details></li>)}</ul></details>}
    {libraryFactors.changes.length>0&&<section className="rounded-xl border border-border p-4 space-y-3" aria-label="Library power factors"><h3 className="font-semibold">Power factor available from your Library</h3><p className="text-sm">Use PF {libraryFactors.changes[0].pf} for {libraryFactors.changes.length} matching server(s) with missing power factor. This is the lowest reported PSU test value at 230 V, used as a planning assumption. Your entered watts and measurements stay unchanged.</p><details><summary>Source and affected servers</summary>{libraryFactors.changes.map(c=><p className="text-sm mt-2" key={c.id}>{c.name}: {c.source}</p>)}</details><button type="button" disabled={pending||!viewCurrent} className="power-connection-button is-primary" onClick={()=>save(libraryFactors.inputs)}>Use Library power factors and save</button></section>}
    {question&&!dirty&&<section className="rounded-xl border border-border p-4 space-y-3" aria-label="Next setup step"><h3 className="font-semibold">{question.title}</h3><p className="text-sm text-muted-foreground">{question.message}</p>
      {question.target==='power-equipment'&&estimates.changes.length>0&&<><button type="button" disabled={pending||!viewCurrent} className="power-connection-button is-primary" onClick={()=>save(estimates.inputs)}>Use and save Library estimates</button><details><summary className="text-sm">Review {estimates.changes.length} estimated system{estimates.changes.length===1?'':'s'}</summary><p className="text-sm text-muted-foreground">Planning values only; existing consumption values and measurements stay unchanged. No electrical limits are assumed.</p>{estimates.changes.map(e=><p key={e.id} className="text-sm">{e.name}: {e.watts} W estimated</p>)}</details></>}
      <button type="button" className="power-connection-button" onClick={()=>openSettings(question.target)}>Review {question.target==='power-feeds'?'power feeds':'equipment settings'}</button>
    </section>}
    {message&&<p role={editor.status==='error'?'alert':'status'} className="text-sm">{message}</p>}
    <section id="power-connections" tabIndex={-1} aria-label="Connections" className="space-y-4">
      {(dirty||!viewCurrent)&&<div role="status" className="space-y-2"><p>{problem?problem.message:'Save your settings before calculating connections. Zoom and saved-connection inspection remain available.'}</p><button type="button" disabled={pending||editor.conflict} className="power-connection-button is-primary" onClick={()=>save()}>Save settings</button>{problem&&<button id="power-review-needed" type="button" className="power-connection-button" onClick={()=>revealProblem(problem)}>Complete required setting</button>}{dirty&&<button type="button" disabled={pending} className="power-connection-button" onClick={discardEdits}>Discard unsaved changes</button>}</div>}
      <PowerViewStateContext.Provider value={dirty||!viewCurrent}>{children}</PowerViewStateContext.Provider>
    </section>
    <details ref={advanced} id="power-advanced" className="power-extra"><summary>Advanced settings &amp; electrical checks</summary><div className="mt-5 space-y-6">
    <PowerOverview equipment={equipment} saved={saved} dirty={dirty}/>

    <section id="power-equipment" tabIndex={-1} className="space-y-4"><header><h3 className="text-xl font-semibold">Equipment power</h3><p className="mt-2 text-sm text-muted-foreground">Record AC demand for each complete installed device. Entries are individual; applying demand to matching devices is an explicit choice.</p></header>
    <EquipmentPowerInputs invalidField={editor.status==='error'?problem||undefined:undefined} equipment={equipment} loads={loads} inputs={inputs} initial={saved} setInputs={setInputs} setMessage={setMessage} bulkFeedback={bulkFeedback} setBulkFeedback={setBulkFeedback}/>
    <details className="power-extra"><summary>Planning allowance · {inputs.headroomPercent}% extra headroom</summary><label className="block text-sm">Extra headroom (%)<input type="number" min="0" max="100" className={`${inputClassName} ml-3 w-24`} value={inputs.headroomPercent} onChange={e=>{setInputs({...inputs,headroomPercent:Number(e.target.value)});setMessage('Unsaved inputs');}}/></label></details>
    </section>
    <div id="power-feeds" tabIndex={-1}><FeedElectricalSetup supplies={supplies} initialSupplies={feedRack(equipment,saved).supplies} equipment={equipment} onChange={(id,value)=>{setInputs(s=>({...s,supplies:{...s.supplies,[id]:value}}));setMessage('Unsaved electrical setup');}}/></div>
    <div className="space-y-2"><p className="text-sm text-muted-foreground">Save equipment consumption and power feed settings before connecting equipment. Existing cables stay unchanged.</p>
    <button id="power-save-inputs" type="button" disabled={pending||editor.conflict} className="rounded-lg border border-border px-4 py-2" onClick={()=>save()}>{pending?'Saving…':'Save power inputs'}</button>{message&&<p role={editor.status==='error'||editor.conflict?'alert':'status'}>{message}</p>}</div>
      <details className="power-extra"><summary>Manual tools, drafts, and Undo/Redo</summary><p className="my-3 text-sm text-muted-foreground">A plan snapshot saves only a proposal. Save proposed cables applies wiring. Individual connections are saved using the rear elevation above. Undo/Redo operates on rack history, including other rack changes.</p>
    <details className="power-extra"><summary>Cable assignment rules · {inputs.cablePolicy==='low-ru-c13-switch-top'?'Low RU first · C13 only':'Electrical balance'}</summary><label className="mt-3 block text-sm">Assignment policy<select className={`${inputClassName} mt-2 w-full`} value={inputs.cablePolicy||'balanced'} onChange={e=>{setInputs(s=>({...s,cablePolicy:e.target.value as FeedInputs['cablePolicy']}));setMessage('Unsaved cable policy. Save power inputs before generating a proposal.');}}><option value="balanced">Balance electrical load</option><option value="low-ru-c13-switch-top">Lowest RU first · C13 only · dedicated switch outlets</option></select></label>{inputs.cablePolicy==='low-ru-c13-switch-top'&&<p className="mt-3 text-sm">C19 receptacles are excluded. Network switches use only P7, P11, P15, P19, P23 and P27. Servers use remaining compatible outlets in ascending order, starting with the lowest RU. P1 is C19 on the PX3 model, so it is skipped. Electrical limits and fixed cables remain enforced. Matching A/B outlet numbers are preferred when available. Saving this policy does not rewire the rack.</p>}</details>
        <ClearLayoutControls rackId={rackId} kind="power"/>
        <DraftPowerPanel rackId={rackId} equipment={equipment} inputs={inputs} initial={saved} saved={savedDraft}/>
        <FeedPowerControls rackId={rackId} equipment={equipment} inputs={inputs} initial={saved}/>
        <details className="mt-3"><summary>Saved cable schedule · {cords.length} cords</summary>{cords.map(c=><p key={`${c.pduId}:${c.outlet}`} className="mt-2 text-sm">{supplies.find(p=>p.id===c.pduId)?.name} · P{c.outlet} → {loads.find(d=>d.id===c.deviceId)?.name} · {powerAssignmentLabel(equipment.find(e=>e.id===c.deviceId),c)}</p>)}</details>
      </details>
    <SavedPowerReview equipment={equipment} saved={saved} dirty={dirty}/>
    </div></details>
  </section>;
}

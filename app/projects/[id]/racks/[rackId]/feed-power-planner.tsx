'use client';
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
  function save(){
    if(saveBusy.current||editor.conflict)return;
    saveBusy.current=true;setBulkFeedback(null);const request=capturePowerSave(editor);
    start(async()=>{
      let result:PowerSaveResult<FeedInputs>;
      try{result=await saveFeedInputs(rackId,request.inputs,request.revision);}catch{result={error:'The save could not be confirmed. Your draft is kept. Open the latest rack before trying again.'};}
      setEditor(current=>finishPowerSave(current,request,result));saveBusy.current=false;
      if('ok' in result&&result.ok)router.refresh();
    });
  }
  const {supplies,loads,cords}=feedRack(equipment,inputs);
  return <section className={`${cardClassName} space-y-6`}>
    {editor.conflict&&<div role="alert" className="rounded-lg border border-border p-3 text-sm"><p>{POWER_INPUT_CONFLICT}</p><p>The saved overview and wiring on this page may be out of date.</p><a className="text-primary underline" href={latestHref||''} target="_blank" rel="noreferrer">Open latest rack in a new tab</a></div>}
    <PowerOverview equipment={equipment} saved={saved} dirty={dirty}/>

    <section id="power-equipment" tabIndex={-1} className="space-y-4"><header><h3 className="text-xl font-semibold">Equipment power</h3><p className="mt-2 text-sm text-muted-foreground">Record AC demand for each complete installed device. Entries are individual; applying demand to matching devices is an explicit choice.</p></header>
    <EquipmentPowerInputs equipment={equipment} loads={loads} inputs={inputs} initial={saved} setInputs={setInputs} setMessage={setMessage} bulkFeedback={bulkFeedback} setBulkFeedback={setBulkFeedback}/>
    <details className="power-extra"><summary>Planning allowance · {inputs.headroomPercent}% extra headroom</summary><label className="block text-sm">Extra headroom (%)<input type="number" min="0" max="100" className={`${inputClassName} ml-3 w-24`} value={inputs.headroomPercent} onChange={e=>{setInputs({...inputs,headroomPercent:Number(e.target.value)});setMessage('Unsaved inputs');}}/></label></details>
    </section>
    <div id="power-feeds" tabIndex={-1}><FeedElectricalSetup supplies={supplies} initialSupplies={feedRack(equipment,saved).supplies} equipment={equipment} onChange={(id,value)=>{setInputs(s=>({...s,supplies:{...s.supplies,[id]:value}}));setMessage('Unsaved electrical setup');}}/></div>
    <div className="space-y-2"><p className="text-sm text-muted-foreground">Save equipment consumption and power feed settings before connecting equipment. Existing cables stay unchanged.</p>
    <button id="power-save-inputs" type="button" disabled={pending||editor.conflict} className="rounded-lg border border-border px-4 py-2" onClick={save}>{pending?'Saving…':'Save power inputs'}</button>{message&&<p role={editor.status==='error'||editor.conflict?'alert':'status'}>{message}</p>}</div>
    <section id="power-connections" tabIndex={-1} aria-label="Connections" className="space-y-4">
      <header><h3 className="text-xl font-semibold">Connections</h3><p className="mt-2 text-sm text-muted-foreground">Select a pending PSU, review its recommended outlet, then confirm the connection.</p></header>
      {(dirty||!viewCurrent)&&<p role="status" className="text-sm text-amber-300">Save edits and refresh this rack view before connecting equipment. The rear elevation uses server-saved values.</p>}
      <div inert={dirty||!viewCurrent}>{children}</div>
      <details className="power-extra"><summary>Additional connection tools · drafts, bulk proposals, manual entry and Undo/Redo</summary><p className="my-3 text-sm text-muted-foreground">A plan snapshot saves only a proposal. Save proposed cables applies wiring. Individual connections are saved using the rear elevation above. Undo/Redo operates on rack history, including other rack changes.</p>
    <details className="power-extra"><summary>Cable assignment rules · {inputs.cablePolicy==='low-ru-c13-switch-top'?'Low RU first · C13 only':'Electrical balance'}</summary><label className="mt-3 block text-sm">Assignment policy<select className={`${inputClassName} mt-2 w-full`} value={inputs.cablePolicy||'balanced'} onChange={e=>{setInputs(s=>({...s,cablePolicy:e.target.value as FeedInputs['cablePolicy']}));setMessage('Unsaved cable policy. Save power inputs before generating a proposal.');}}><option value="balanced">Balance electrical load</option><option value="low-ru-c13-switch-top">Lowest RU first · C13 only · dedicated switch outlets</option></select></label>{inputs.cablePolicy==='low-ru-c13-switch-top'&&<p className="mt-3 text-sm">C19 receptacles are excluded. Network switches use only P7, P11, P15, P19, P23 and P27. Servers use remaining compatible outlets in ascending order, starting with the lowest RU. P1 is C19 on the PX3 model, so it is skipped. Electrical limits and fixed cables remain enforced. Matching A/B outlet numbers are preferred when available. Saving this policy does not rewire the rack.</p>}</details>
        <DraftPowerPanel rackId={rackId} equipment={equipment} inputs={inputs} initial={saved} saved={savedDraft}/>
        <FeedPowerControls rackId={rackId} equipment={equipment} inputs={inputs} initial={saved}/>
        <details className="mt-3"><summary>Saved cable schedule · {cords.length} cords</summary>{cords.map(c=><p key={`${c.pduId}:${c.outlet}`} className="mt-2 text-sm">{supplies.find(p=>p.id===c.pduId)?.name} · P{c.outlet} → {loads.find(d=>d.id===c.deviceId)?.name} · PSU {c.inlet}</p>)}</details>
      </details>
    </section>
    <SavedPowerReview equipment={equipment} saved={saved} dirty={dirty}/>
  </section>;
}

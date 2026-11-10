'use client';
import {isB300PowerDevice} from '@/lib/b300-power-inputs';
import type {Dispatch,SetStateAction,FormEvent} from 'react';
import {isMeasuredPower} from '@/lib/power-consumption';
import {buttonVariants} from '@/components/ui/button';
import {applyEquipmentDemand,equipmentDemandSource,hasEquipmentDemand,matchingDemandDevices,type BulkApplyFeedback} from '@/lib/equipment-power-editing';
import type {FeedInputs,Load} from '@/lib/feed-power';
import type {FeedEquipment} from '@/lib/feed-rack';
import {EquipmentRecordSummary} from '@/app/equipment/equipment-record-summary';
import {PowerEstimatePicker} from './power-estimate-picker';
import {inputClassName} from './styles';

type Budget=FeedInputs['budgets'][string];
type Props={invalidField?:{deviceId?:string;field?:'watts'|'pf'};equipment:FeedEquipment[];loads:Load[];inputs:FeedInputs;initial:FeedInputs;setInputs:Dispatch<SetStateAction<FeedInputs>>;setMessage:(message:string)=>void;bulkFeedback?:BulkApplyFeedback|null;setBulkFeedback?:(feedback:BulkApplyFeedback|null)=>void};
const shortName=(device:FeedEquipment)=>device.name.replace(/ · U\d+$/,'')||device.model||'Installed device';
function closeBulk(form:HTMLFormElement){form.reset();const details=form.closest('details');if(details)details.open=false;}

export function EquipmentPowerInputs({invalidField,equipment,loads,inputs,initial,setInputs,setMessage,bulkFeedback=null,setBulkFeedback=()=>{}}:Props){
  const powered=equipment.filter(device=>device.category!=='pdu'&&device.category!=='accessory');
  if(!powered.length)return <p className="text-sm text-muted-foreground">No powered equipment is installed. Add equipment in the rack elevation to enter its consumption here.</p>;
  return <div className="space-y-4">{powered.map(device=>{
    const budget=inputs.budgets[device.id],load=loads.find(item=>item.id===device.id),source=equipmentDemandSource(budget);
    const dirty=JSON.stringify(budget)!==JSON.stringify(initial.budgets[device.id]);
    const missingFactor=!Number.isFinite(budget?.pf)||budget.pf<=0||budget.pf>1;
    const matches=matchingDemandDevices(equipment,device);
    const feedback=bulkFeedback?.sourceId===device.id&&bulkFeedback.fingerprint===JSON.stringify(inputs)?bulkFeedback:null;
    const resultId='bulk-demand-result-'+device.id;
    function update(change:Partial<Budget>,message:string){
      setBulkFeedback(null);
      setInputs(previous=>({...previous,budgets:{...previous.budgets,[device.id]:{
        ...previous.budgets[device.id],watts:previous.budgets[device.id]?.watts??0,pf:previous.budgets[device.id]?.pf??0,...change,
      }}}));setMessage(message);
    }
    function apply(event:FormEvent<HTMLFormElement>){
      event.preventDefault();
      const form=event.currentTarget,selected=Array.from(form.querySelectorAll<HTMLInputElement>('input[name="target"]:checked')).map(input=>input.value);
      const result=applyEquipmentDemand(inputs,equipment,device.id,selected);
      if(result.error){setBulkFeedback({sourceId:device.id,fingerprint:JSON.stringify(inputs),error:result.error,changes:[]});setMessage('');return;}
      if(result.inputs!==inputs)setInputs(result.inputs);
      form.querySelectorAll<HTMLInputElement>('input[name="target"]').forEach(input=>{input.checked=false;});
      setBulkFeedback({sourceId:device.id,fingerprint:JSON.stringify(result.inputs),changes:result.changes});
      setMessage('');
    }
    return <article key={device.id} data-equipment-power={device.id} aria-label={`${shortName(device)} power inputs`} className="min-w-0 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1 basis-60">
          <h4 className="font-semibold break-words">{shortName(device)}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{Number.isInteger(device.startRU)?`U${device.startRU}`:'Position not recorded'} · this installed device only</p>
          {device.model&&device.model!==shortName(device)&&<p className="mt-1 text-xs text-muted-foreground">{device.model}</p>}
          {!hasEquipmentDemand(budget)&&<p className="mt-2 text-sm">Demand missing or invalid. Blank or 0 W remains incomplete in the calculator.</p>}
          {missingFactor&&<p className="mt-2 text-sm">Power factor required · open power factor and estimation below.</p>}
          {dirty&&<p className="mt-2 text-sm">Unsaved edits for this device.</p>}
        </div>
        <label className="text-sm">Whole-system AC demand (W)<input data-power-field="watts" aria-invalid={invalidField?.deviceId===device.id&&invalidField.field==='watts'||undefined} type="number" min="0" max="1000000" step="any" className={`${inputClassName} mt-1 block w-44 max-w-full aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30`} value={budget?.watts||''} placeholder="Not recorded" onChange={event=>update({watts:Number(event.target.value),estimateSource:undefined,measurement:undefined},'Unsaved demand for this device. Editing watts clears its previous source. Review and save power inputs.')}/></label>
        <label className="text-sm">Demand source<select data-power-field="source" className={`${inputClassName} mt-1 block w-48 max-w-full appearance-auto`} value={isMeasuredPower(budget||{})?'measured':budget?.estimateSource?'estimated':'entered'} onChange={event=>{
          if(event.target.value==='measured'&&hasEquipmentDemand(budget))update({measurement:{watts:budget.watts,source:'User-recorded measurement'},estimateSource:undefined},'Recorded as your measurement of this device, not live monitoring. Review and save power inputs.');
          else if(event.target.value==='entered')update({measurement:undefined,estimateSource:undefined},'Source changed to manually entered for this device. Review and save power inputs.');
        }}><option value="entered">Manually entered</option>{budget?.estimateSource&&<option value="estimated" disabled>Planning estimate</option>}<option value="measured" disabled={!hasEquipmentDemand(budget)}>Recorded measurement</option></select></label>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">For the complete device, not each PSU’s rating. Extra planning headroom is added separately.</p>
      <p className="mt-2 text-sm">{source.label}{source.label==='Recorded measurement'?' · user recorded, not live monitoring':source.label==='Planning estimate'?' · not a measurement':''}</p>
      <details className="mt-2 text-sm"><summary className="cursor-pointer">Demand source and assumptions</summary><p className="mt-2 break-words text-muted-foreground">{source.description}</p></details>

      {matches.length>0&&<details data-bulk-for={device.id} className="mt-4 border-t border-border pt-3" onToggle={event=>{setBulkFeedback(null);if(event.currentTarget.open)event.currentTarget.querySelector('form')?.reset();}}>
        <summary className="cursor-pointer text-sm">Apply demand to matching devices…</summary>
        <p className="mt-3 text-sm text-muted-foreground">Same model and Library configuration only. Missing demand is selected by default. Select an existing value explicitly to replace it. Copied demand becomes a planning estimate, never a measurement of another device. Power factor, PSU settings and cables stay unchanged.</p>
        <form className="mt-3 space-y-3" onSubmit={apply} onChange={()=>setBulkFeedback(null)}>
          <div className="flex flex-wrap gap-3 text-sm"><button data-bulk-action="all" type="button" className="text-primary underline" onClick={event=>{setBulkFeedback(null);event.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="target"]').forEach(input=>{input.checked=true;});}}>Select all {matches.length} (includes existing demand)</button><button data-bulk-action="missing" type="button" className="text-primary underline" onClick={event=>{setBulkFeedback(null);event.currentTarget.form?.reset();}}>Missing demand only</button><button data-bulk-action="clear" type="button" className="text-primary underline" onClick={event=>{setBulkFeedback(null);event.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="target"]').forEach(input=>{input.checked=false;});}}>Clear selection</button></div>
          <p className="text-xs text-muted-foreground">Selecting all also selects any listed recorded measurements for replacement. Nothing changes until you apply the selection.</p>
          <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Select installed devices to update</legend>{matches.map(target=>{
            const targetBudget=inputs.budgets[target.id],existing=hasEquipmentDemand(targetBudget);
            return <label className="flex items-start gap-2 text-sm" key={target.id}><input type="checkbox" name="target" value={target.id} defaultChecked={!existing} className="mt-1"/><span>{Number.isInteger(target.startRU)?`U${target.startRU} · `:''}{shortName(target)}<span className="block text-xs text-muted-foreground">{existing?`Replace ${targetBudget.watts.toLocaleString()} W · ${equipmentDemandSource(targetBudget).label}`:'Demand missing'}</span></span></label>;
          })}</fieldset>
          <div className="flex flex-wrap gap-3"><button type="submit" aria-describedby={feedback?resultId:undefined} disabled={!hasEquipmentDemand(budget)} className={buttonVariants({size:'lg',className:'h-auto min-h-10 whitespace-normal px-4 py-2'})}>Apply {hasEquipmentDemand(budget)?`${budget.watts.toLocaleString()} W `:''}to selected devices</button><button data-bulk-action="cancel" type="button" className="rounded-lg border border-border px-3 py-2 text-sm" onClick={event=>{setBulkFeedback(null);const form=event.currentTarget.form;if(form)closeBulk(form);}}>Cancel</button></div>
          {feedback&&<div id={resultId} role={feedback.error?'alert':'status'} aria-live="polite" aria-atomic="true" className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            {feedback.error?<p>{feedback.error}</p>:<>
              <p className="font-medium">{feedback.changes.some(change=>change.kind==='demand')?'Demand updated in the unsaved draft.':feedback.changes.some(change=>change.kind==='source')?'Wattage unchanged; planning source updated in the unsaved draft.':'No changes needed.'}</p>
              <ul className="max-h-64 space-y-2 overflow-y-auto">{feedback.changes.map(change=><li key={change.id} data-bulk-result-device={change.id}>
                <strong className="font-medium">{Number.isInteger(change.startRU)?`U${change.startRU} · `:''}{change.name.replace(/ · U\d+$/,'')}</strong>{' — '}
                {change.kind==='demand'?`${change.before===undefined?'Not recorded':`${change.before.toLocaleString()} W`} → ${change.after.toLocaleString()} W`:change.kind==='source'?`Already ${change.after.toLocaleString()} W; planning source updated.`:`Already ${change.after.toLocaleString()} W with the same planning source; unchanged.`}
              </li>)}</ul>
              <p>{feedback.changes.some(change=>change.kind!=='unchanged')?'Unsaved. Review and save power inputs to keep these edits.':'This Apply made no changes. Any earlier unsaved edits still need saving.'} Cable assignments are unchanged.</p>
              <p className="text-xs text-muted-foreground">Selection cleared after Apply. Select devices again to apply another value.</p>
            </>}
          </div>}
        </form>
      </details>}

      <details className="mt-4 border-t border-border pt-3"><summary className="cursor-pointer text-sm">Power factor and estimation{missingFactor?' · power factor required':''}</summary>
        <p className="mt-3 text-sm text-muted-foreground">Power factor converts watts into electrical load. It must be above 0 and at most 1; it is not inferred from a watt reading.</p>
        <label className="mt-3 block text-sm">Power factor<input data-power-field="pf" aria-invalid={invalidField?.deviceId===device.id&&invalidField.field==='pf'||undefined} type="number" min="0.01" max="1" step="any" className={`${inputClassName} mt-1 block w-40 max-w-full aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30`} value={budget?.pf||''} placeholder="Required" onChange={event=>update({pf:Number(event.target.value)},'Unsaved power factor for this device. Review and save power inputs.')}/></label>
        <PowerEstimatePicker model={device.model||''} raw={device.rawData} requiredPsus={load?.minimumCords||1} count={1} onApply={estimate=>update({...estimate,measurement:undefined},'Unsaved planning estimate for this device. Review and save power inputs.')}/>
      </details>
      <details className="mt-3 border-t border-border pt-3"><summary className="cursor-pointer text-sm">Advanced · PSU limits and Library references</summary>
        <p className="mt-3 text-sm text-muted-foreground">Unedited limits inherit current Library/model assumptions. Supported options are not a confirmed inventory of this device. Overrides apply to this installation only. PSU capacity is separate from selected demand.</p>
        {isB300PowerDevice(device)&&<p className="mt-3 text-sm">Six PSU modules · two AC inputs each · 12 input assignments. Enter the cord connector, input voltage range and usable cord current below. Internal PSU redundancy and module output capacity are outside this PDU check.</p>}
        <div className="power-fields mt-3">{(['cords','minimumCords','connector','minVoltage','maxVoltage','cordLimitAmps','psuAcCapacity'] as const).filter(field=>!isB300PowerDevice(device)||!['cords','minimumCords','psuAcCapacity'].includes(field)).map(field=>{
          const labels={cords:'PSU cords used for planning',minimumCords:'Minimum PSUs needed after feed loss',connector:'Cord connector (C13 / C19)',minVoltage:'Minimum PSU voltage (V)',maxVoltage:'Maximum PSU voltage (V)',cordLimitAmps:'Usable cord current (A)',psuAcCapacity:'Supported AC load per PSU (W)'};
          return <label key={field}>{labels[field]}<input data-power-field={field} type={field==='connector'?'text':'number'} value={budget?.[field]??load?.[field]??''} onChange={event=>update({[field]:field==='connector'?event.target.value:event.target.value?Number(event.target.value):undefined},'Unsaved PSU limit for this device. Review and save power inputs.')}/></label>;
        })}</div>
        <EquipmentRecordSummary sku={device.sku||undefined} model={device.model||''} raw={device.rawData} installation={budget} powerInputContext/>
      </details>
    </article>;
  })}<a href="#power-save-inputs" className="inline-block text-sm font-medium text-primary underline underline-offset-4" onClick={event=>{
    event.preventDefault();const target=document.getElementById('power-save-inputs');if(!target)return;target.focus({preventScroll:true});target.scrollIntoView({block:'center',behavior:'auto'});
  }}>Review and save power inputs</a><p className="text-xs text-muted-foreground">Edits stay unsaved until you use Save power inputs. That action also saves feed settings; cable assignments stay unchanged.</p></div>;
}

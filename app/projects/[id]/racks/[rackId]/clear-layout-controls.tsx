'use client';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {clearRackLayout} from './clear-layout-actions';
import {undoRedoRack} from './actions';
export function ClearLayoutControls({rackId,kind}:{rackId:string;kind:'power'|'network'}){
 const router=useRouter(),[confirm,setConfirm]=useState(false),[message,setMessage]=useState(''),[canUndo,setCanUndo]=useState(false),[pending,start]=useTransition();
 function run(undo=false){start(async()=>{try{
  const result=undo?await undoRedoRack(rackId,-1):await clearRackLayout(rackId,kind);
  if('error' in result&&result.error){setMessage(result.error);return;}
  setCanUndo(!undo);setConfirm(false);setMessage(undo?'Last rack change restored.':`${kind==='power'?'Power':'Network'} layout cleared. Equipment and settings kept.`);router.refresh();
 }catch{setMessage('Could not complete the change. Reload to check the saved rack.');}});}
 return <section className="mb-4 rounded-xl border border-border p-4" aria-label={`Clear ${kind} layout`}>
  <div className="flex flex-wrap items-center gap-4"><button type="button" className="rounded-lg border border-border px-3 py-2 text-sm" disabled={pending} onClick={()=>{setConfirm(true);setMessage('');}}>Clear {kind} layout</button>{canUndo&&<button type="button" disabled={pending} className="text-sm underline" onClick={()=>run(true)}>Undo last rack change</button>}<span role="status" className="text-sm">{message}</span></div>
  {confirm&&<div className="mt-3" role="group" aria-label="Confirm clear layout"><p className="mb-3 text-sm">Clear all saved {kind==='power'?'power-cord assignments and the saved power draft':'network cables, including external network links'} in this rack? Equipment, {kind==='power'?'network cables':'power cords'}, ratings and planning settings stay. Undo can restore the change. Unsaved proposals will be discarded.</p><div className="flex gap-4"><button type="button" disabled={pending} className="rounded-lg border border-red-400 px-3 py-2 text-sm" onClick={()=>run()}>Confirm clear {kind} layout</button><button type="button" disabled={pending} onClick={()=>setConfirm(false)}>Cancel</button></div></div>}
 </section>;
}

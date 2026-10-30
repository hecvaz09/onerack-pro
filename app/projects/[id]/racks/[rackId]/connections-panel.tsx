"use client";
import {cableLength} from '@/lib/cable-length';
import {EXTERNAL_STAGES,readExternal,externalName,externalStatus,type ExternalEndpoint} from '@/lib/external-connections';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {BREAKOUT_CABLE} from '@/lib/network-breakout';
import {useState,useTransition} from 'react';
import {saveNetworkConnection,type NetworkInput} from './network-actions';
import {deleteConnection} from './actions';
import {networkEndpoint,cableEndpointLabel,NETWORK_CABLE_TYPES,portUsed,portCompatibility,type NetworkPort,type PortConnection} from '@/lib/network-ports';

export type ConnectionDevice={id:string;name:string;catalogId:string;startRU:number;category:string|null;ports:NetworkPort[]};
export type ConnectionRow=PortConnection&{fromName:string;toName:string;cableType:string|null;label:string|null;lengthValue?:number|null;lengthUnit?:string|null};
const blank:NetworkInput={fromDeviceId:'',toDeviceId:'',fromPort:'',toPort:'',cableType:'',label:'',lengthValue:null,lengthUnit:null,reviewed:false};
const field='h-11 w-full rounded-lg border border-input bg-background px-3 text-sm';
export function ConnectionsPanel({rackId,matrixHref,devices,connections,initialDeviceId,initialPort,compact=false}:{compact?:boolean;initialDeviceId?:string;initialPort?:string;rackId:string;matrixHref:string;devices:ConnectionDevice[];connections:ConnectionRow[]}){
  const router=useRouter();
  const existing=initialDeviceId&&initialPort?connections.find(c=>(c.fromDeviceId===initialDeviceId&&c.fromPort===initialPort)||(c.toDeviceId===initialDeviceId&&c.toPort===initialPort)):undefined;
  const initial=existing?{...blank,lengthValue:existing.lengthValue??null,lengthUnit:existing.lengthUnit??null,fromDeviceId:existing.fromDeviceId,toDeviceId:existing.toDeviceId||'',external:readExternal(existing.external),fromPort:existing.fromPort||'',toPort:existing.toPort||'',cableType:existing.cableType||'',label:existing.label||''}:{...blank,fromDeviceId:initialDeviceId||'',fromPort:initialPort||''};
  if(!existing&&devices.find(d=>d.id===initialDeviceId)?.ports.find(p=>p.id===initialPort)?.lane)initial.cableType=BREAKOUT_CABLE;
  const [form,setForm]=useState<NetworkInput>(initial),[editing,setEditing]=useState<string|null>(existing?.id||null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[pending,start]=useTransition();
  function change(patch:Partial<NetworkInput>){setForm(v=>{const next={...v,...patch,reviewed:false};if(['fromDeviceId','toDeviceId','fromPort','toPort'].some(k=>k in patch)){const a=devices.find(d=>d.id===next.fromDeviceId)?.ports.find(p=>p.id===next.fromPort),b=devices.find(d=>d.id===next.toDeviceId)?.ports.find(p=>p.id===next.toPort);if(a?.lane||b?.lane)next.cableType=BREAKOUT_CABLE;else if(next.cableType===BREAKOUT_CABLE)next.cableType='';}return next;});setError('');setNotice('');}
  const from=devices.find(d=>d.id===form.fromDeviceId),to=devices.find(d=>d.id===form.toDeviceId);
  const a=from?.ports.find(p=>p.id===form.fromPort),b=to?.ports.find(p=>p.id===form.toPort);
  const automaticLabel=form.external&&a&&from?`${networkEndpoint(from.startRU,from.category,a)||a.name} | ${externalName(form.external)}`:a&&b&&from&&to?cableEndpointLabel({...from,port:a},{...to,port:b}):'';
  const check=!form.external&&a&&b?portCompatibility(a,b,form.cableType):null;
  function edit(c:ConnectionRow){setEditing(c.id);setForm({lengthValue:c.lengthValue??null,lengthUnit:c.lengthUnit??null,fromDeviceId:c.fromDeviceId,toDeviceId:c.toDeviceId||'',external:readExternal(c.external),fromPort:c.fromPort||'',toPort:c.toPort||'',cableType:c.cableType||'',label:c.label||'',reviewed:false});setError('');setNotice('');document.getElementById('network-cable-editor')?.scrollIntoView({behavior:'smooth',block:'start'});}
  function remove(connectionId:string){
    setError('');setNotice('');
    start(async()=>{
      try{
        const result=await deleteConnection(connectionId,rackId);
        if(!result.ok){setError(result.error);return;}
        if(editing===connectionId){setEditing(null);setForm(blank);}
        router.refresh();
        setNotice('Connection deleted. Both ports are available again. Use Undo in the rack map to restore it.');
      }catch{setError('Could not remove cable. Try again.');}
    });
  }
  function save(){
    if(pending)return;
    setNotice('');
    if(!a||(!form.external&&!b)||!form.cableType){setError('Select the rack port and cable type, and a destination port for an internal cable.');return;}
    if(form.external&&!form.label.trim()){setError('Enter the shipping cable label.');return;}
    if((form.external||check?.warnings.length)&&!form.reviewed){setError('Check the review / reserve checkbox before saving.');return;}
    if(check?.error){setError(check.error);return;}
    setError('');start(async()=>{try{const result=await saveNetworkConnection(rackId,editing,{...form,lengthUnit:form.lengthValue==null?null:form.lengthUnit});if(!result.ok)setError(result.error);else{setEditing(null);setForm({...blank});setNotice(`Saved: ${form.label.trim()||automaticLabel} · ${from?.name||'Equipment'} / ${a?.name||'Port'}${form.external?' · Rack port reserved for external cable':''}.`);router.refresh();}}catch{setError('Could not reach the server. Your selections are still here.');}});
  }
  function savedLabel(c:ConnectionRow){
    if(c.label)return c.label;
    if(c.external){const d=devices.find(d=>d.id===c.fromDeviceId),p=d?.ports.find(p=>p.id===c.fromPort);return `${d&&p?networkEndpoint(d.startRU,d.category,p)||p.name:'Unmapped port'} | ${externalName(c.external)}`;}
    const from=devices.find(d=>d.id===c.fromDeviceId),to=devices.find(d=>d.id===c.toDeviceId);
    const a=from?.ports.find(p=>p.id===c.fromPort),b=to?.ports.find(p=>p.id===c.toPort);
    return from&&to&&a&&b?cableEndpointLabel({...from,port:a},{...to,port:b}):'';
  }
  const devicePortName=(id:string|null,port?:string|null)=>!port?'Unmapped port':devices.find(d=>d.id===id)?.ports.find(p=>p.id===port)?.name||'Port missing from configuration';
  function side(label:string,device:ConnectionDevice|undefined,idKey:'fromDeviceId'|'toDeviceId',portKey:'fromPort'|'toPort'){
    return <fieldset className="space-y-3 rounded-xl border border-border p-4"><legend className="px-2 font-semibold">{label}</legend>
      <label className="block text-sm">{label} device<select aria-label={label+' device'} className={field+' mt-2'} value={form[idKey]} onChange={e=>change({[idKey]:e.target.value,[portKey]:''})} required><option value="">Choose equipment…</option>{devices.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <label className="block text-sm">{label} port<select aria-label={label+' port'} className={field+' mt-2'} value={form[portKey]} onChange={e=>change({[portKey]:e.target.value})} required disabled={!device?.ports.length}><option value="">Choose an available port…</option>{device?.ports.map(p=>{const used=portUsed(connections,device.id,p.id,editing??undefined);return <option key={p.id} value={p.id} disabled={used}>{p.name} · {used?'Connected':editing&&((form.fromDeviceId===device.id&&form.fromPort===p.id)||(form.toDeviceId===device.id&&form.toPort===p.id))?'Selected for this cable':'Available'} · {p.protocol||'Unknown protocol'}{p.speedGbps?` · ${p.speedGbps} Gb/s`:''}</option>;})}</select></label>
      {device&&!device.ports.length&&<p className="text-sm text-amber-300">No ports defined. <Link className="underline" href={`/equipment/${device.catalogId}`}>Add network interfaces and ports per card</Link> in the equipment configuration.</p>}
    </fieldset>;
  }
  return <section className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Network cables</h2><p className="mt-1 text-sm text-muted-foreground">Connect two rack ports, or reserve a rack port for a customer-site destination. Saved cabling is not live link status.</p></div><Link href={matrixHref} className="text-sm text-primary underline">Connection matrix →</Link></header>
    <form id="network-cable-editor" className="scroll-mt-6 space-y-4" noValidate onSubmit={e=>{e.preventDefault();save();}}>
      <h3 className="font-semibold">{editing?'Edit / map existing cable':'Add cable'}</h3>
      <fieldset disabled={pending} className="space-y-4">
        <label className="block text-sm">Connection destination<select aria-label="Connection destination" className={field+' mt-2'} value={form.external?'external':'rack'} onChange={e=>change({toDeviceId:'',toPort:'',external:e.target.value==='external'?{site:'',equipment:'',port:'',notes:'',status:'awaiting_site'}:null})}><option value="rack">Equipment in this rack</option><option value="external">External / customer site</option></select></label>
        <div className="grid gap-4 lg:grid-cols-2">{side('From',from,'fromDeviceId','fromPort')}{form.external?<fieldset className="space-y-3 rounded-xl border border-border p-4"><legend className="px-2 font-semibold">Customer-site destination</legend><p className="text-sm text-muted-foreground">These details can stay blank until installation. Enter the shipping label below to identify the cable.</p>{(['site','equipment','port','notes'] as const).map(key=><label key={key} className="block text-sm">{{site:'Site / location (optional)',equipment:'Destination equipment / patch panel (optional)',port:'Far-end port (optional)',notes:'Installation notes (optional)'}[key]}<input className={field+' mt-2'} maxLength={500} value={form.external![key]} placeholder={key==='notes'?'Instructions for the site installer':'To be assigned on site'} onChange={e=>change({external:{...form.external!,[key]:e.target.value}})}/></label>)}<label className="block text-sm">Installation status<select className={field+' mt-2'} value={form.external.status} onChange={e=>change({external:{...form.external!,status:e.target.value as ExternalEndpoint['status']}})}>{Object.entries(EXTERNAL_STAGES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></fieldset>:side('To',to,'toDeviceId','toPort')}</div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Cable type<select aria-label="Cable type" className={field+' mt-2'} value={form.cableType} onChange={e=>change({cableType:e.target.value})} required><option value="">Choose cable type…</option>{NETWORK_CABLE_TYPES.map(t=><option key={t}>{t}</option>)}</select></label><label className="text-sm">{form.external?'Shipping cable label':'Cable label (optional override)'}<input required={!!form.external} placeholder={form.external?'e.g. U01-Hd/St--LAN1 | EXT-Uplink':automaticLabel||'Choose slots in equipment specifications'} className={field+' mt-2'} value={form.label} maxLength={500} onChange={e=>change({label:e.target.value})}/></label></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Cable length (optional)<input aria-label="Cable length" type="number" min="0.001" max="100000" step="any" className={field+' mt-2'} value={form.lengthValue??''} placeholder="e.g. 15" onChange={e=>change({lengthValue:e.target.value===''?null:Number(e.target.value),lengthUnit:e.target.value===''?null:form.lengthUnit||'ft'})}/></label><label className="text-sm">Length unit<select aria-label="Length unit" className={field+' mt-2'} value={form.lengthUnit||'ft'} onChange={e=>change({lengthUnit:e.target.value})}><option value="ft">Feet (ft)</option><option value="m">Meters (m)</option></select></label></div>
        {check?.error&&<p role="alert" className="text-red-300">{check.error}</p>}
        {!!check?.warnings.length&&<div className="rounded-lg border border-amber-400/40 p-4 text-sm"><p className="font-semibold text-amber-300">Review before cabling</p><ul className="my-2 list-disc pl-5">{check.warnings.map(w=><li key={w}>{w}</li>)}</ul><label className="flex items-center gap-2"><input type="checkbox" checked={form.reviewed} onChange={e=>setForm(v=>({...v,reviewed:e.target.checked}))}/>I reviewed these limitations; save this as a planning connection.</label></div>}
        {form.external&&<label className="flex items-start gap-2 rounded-lg border border-border p-4 text-sm"><input type="checkbox" checked={form.reviewed} onChange={e=>setForm(v=>({...v,reviewed:e.target.checked}))}/>Reserve this rack port. Far-end connector, speed, and compatibility must be verified on site.</label>}
        <p className="text-xs text-muted-foreground">Checks use entered port specifications. Transceiver, lane/breakout and cable-length compatibility still require review.</p>
        <div className="flex flex-wrap gap-3"><button type="button" onClick={save} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-40" disabled={!a||(!form.external&&!b)||!form.cableType||!!check?.error||(!!check?.warnings.length&&!form.reviewed)||(!!form.external&&(!form.label.trim()||!form.reviewed))}>{pending?'Saving…':editing?'Save cable changes':'Add cable'}</button>{editing&&<button type="button" className="rounded-lg border border-red-400/40 px-4 py-2 text-red-300 disabled:opacity-40" onClick={()=>remove(editing)}>Delete connection</button>}{editing&&<button type="button" className="rounded-lg border border-border px-4 py-2" onClick={()=>{setEditing(null);setForm(blank);setError('');}}>Cancel edit</button>}</div>
      </fieldset>
      {pending&&<p role="status">Saving cable to the rack…</p>}
      {error&&<p role="alert" className="rounded-lg border border-red-400/40 p-3 text-red-300">{error}</p>}
      {notice&&<p role="status" className="rounded-lg border border-primary/40 p-3 text-primary">{notice}</p>}
    </form>
    {automaticLabel&&<p className="text-sm text-primary">Automatic label: <strong>{automaticLabel}</strong></p>}
    {!compact&&<><details className="saved-cables-disclosure"><summary className="mb-3 cursor-pointer rounded-lg py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">Saved cables · {connections.length}</summary>{!connections.length?<p className="text-sm text-muted-foreground">No connections yet.</p>:<ul className="divide-y divide-border rounded-xl border border-border">{connections.map(c=><li key={c.id} className="flex flex-wrap items-center justify-between gap-4 p-4"><div className="min-w-0"><p className="font-medium">{c.fromName} → {c.toName}</p><p className="mt-1 text-sm">{devicePortName(c.fromDeviceId,c.fromPort)} → {c.external?externalName(c.external):devicePortName(c.toDeviceId,c.toPort)}</p><p className="mt-1 text-xs text-muted-foreground">{[c.cableType,savedLabel(c),c.lengthValue!=null?cableLength(c):''].filter(Boolean).join(' · ')}</p>{!!c.external&&<p className="mt-1 text-sm text-amber-300">{externalStatus(c.external)}</p>}{(!c.external&&(!c.fromPort||!c.toPort))&&<p className="mt-1 text-sm text-amber-300">Unmapped legacy cable — select ports to track availability.</p>}</div><div className="flex gap-3"><button type="button" disabled={pending} className="rounded-lg border border-border px-3 py-2" onClick={()=>edit(c)}>{c.external?'Edit external cable':c.fromPort&&c.toPort?'Edit ports':'Map ports'}</button><button type="button" disabled={pending} className="rounded-lg border border-border px-3 py-2" onClick={()=>remove(c.id)}>Remove</button></div></li>)}</ul>}</details>
    <div><h3 className="mb-3 text-lg font-semibold">Port availability</h3><p className="mb-4 text-sm text-muted-foreground">Tinted ports are connected. Unmapped legacy cables do not reserve a port.</p><div className="grid gap-4 xl:grid-cols-2">{devices.map(d=><article key={d.id} className="rounded-xl border border-border p-4"><div className="mb-3 flex flex-wrap justify-between gap-2"><h4 className="font-semibold">{d.name}</h4><span className="text-sm text-muted-foreground">{d.ports.filter(p=>!portUsed(connections,d.id,p.id)).length} / {d.ports.length} available</span></div>{!d.ports.length?<Link href={`/equipment/${d.catalogId}`} className="text-sm text-primary underline">Define network ports →</Link>:<ul className="max-h-96 space-y-2 overflow-y-auto pr-1">{d.ports.map(p=>{const c=connections.find(c=>(c.fromDeviceId===d.id&&c.fromPort===p.id)||(c.toDeviceId===d.id&&c.toPort===p.id));const peer=c&&(c.external?`${externalName(c.external)} · ${externalStatus(c.external)}`:c.fromDeviceId===d.id?`${c.toName} / ${c.external?externalName(c.external):devicePortName(c.toDeviceId,c.toPort)}`:`${c.fromName} / ${devicePortName(c.fromDeviceId,c.fromPort)}`);return <li key={p.id} className={`rounded-lg border p-3 text-sm ${c?'border-primary/50 bg-primary/10':'border-border'}`}><div className="flex justify-between gap-3"><span className="font-medium">{p.name}</span><strong className={c?'text-primary':'text-muted-foreground'}>{c?.external?externalStatus(c.external):c?'Connected':'Available'}</strong></div><p className="mt-1 text-xs text-muted-foreground">{p.protocol||'Unknown protocol'} · {p.connector||'Unknown connector'} · {p.speedGbps?`${p.speedGbps} Gb/s`:'Unknown speed'} · {p.reviewed?'Reviewed specs':'Draft specs'}</p>{peer&&<p className="mt-2 break-words">→ {peer}</p>}</li>;})}</ul>}</article>)}</div></div>
    </>}
  </section>;
}

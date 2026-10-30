"use client";
import {supplyIssues} from '@/lib/feed-power';
import type {FeedInputs,Supply,Phase,Topology} from '@/lib/feed-power';
import type {FeedEquipment} from '@/lib/feed-rack';
import {inputClassName} from './styles';
import {readOutlets} from '@/lib/equipment-details';
export function FeedElectricalSetup({supplies,initialSupplies,equipment,onChange}:{supplies:Supply[];initialSupplies:Supply[];equipment:FeedEquipment[];onChange:(id:string,value:NonNullable<FeedInputs['supplies']>[string])=>void}){
 return <section aria-label="Power feeds" className="space-y-4"><header><h3 className="text-xl font-semibold">Power feeds</h3><p className="mt-2 text-sm text-muted-foreground">Review each PDU’s feed assignment. Expand electrical settings only when you need to check or change them.</p></header>
 <p className="text-sm">{supplies.length} PDUs installed · {supplies.filter(p=>p.feed==='A').length} on feed A · {supplies.filter(p=>p.feed==='B').length} on feed B</p>
 {!supplies.length&&<p className="text-sm text-muted-foreground">No PDUs are installed. Add PDUs in the rack elevation before configuring feeds.</p>}
 {supplies.length>0&&(!supplies.some(p=>p.feed==='A')||!supplies.some(p=>p.feed==='B'))&&<p className="text-sm text-amber-300">Assign PDUs to both independent feeds A and B for redundancy checks.</p>}
 {supplies.map(p=>{
  const physical=readOutlets(equipment.find(e=>e.id===p.id)?.rawData);
  const profile:Supply & {branches:Record<string,number>}={...p,topology:p.topology||'single-phase' as Topology,confirmed:p.confirmed===true,outlets:p.outlets.length?p.outlets:physical.map(o=>({n:o.n,connectors:o.type.split('/'),branch:o.cb?String(o.cb):'',phase:undefined,limitAmps:0})),branches:p.branches||{}};
  function edit(change:Partial<Supply>){onChange(p.id,{...profile,...change,confirmed:false});}
  const phases=profile.topology==='three-phase-delta'?['L1-L2','L2-L3','L3-L1']:['L1','L2','L3','L1-L2','L2-L3','L3-L1'];
  const dirty=JSON.stringify(p)!==JSON.stringify(initialSupplies.find(v=>v.id===p.id));
  const checks=supplyIssues({...p,confirmed:true});
  const model=equipment.find(e=>e.id===p.id)?.model||p.name;
  return <article className="min-w-0 rounded-xl border border-border p-4" key={p.id} aria-label={`${p.name} feed setup`}>
   <div className="flex flex-wrap items-start gap-4"><div className="min-w-0 flex-1 basis-60"><h4 className="font-semibold break-words">{model}</h4>{model!==p.name&&<p className="mt-1 text-sm text-muted-foreground">{p.name}</p>}<p className={`mt-2 text-sm ${checks.length||!p.confirmed?'text-amber-300':'text-emerald-300'}`}>{checks.length?'Setup incomplete':p.confirmed?'Settings verified':'Verification needed'}</p>{dirty&&<p className="mt-1 text-xs text-amber-300">Unsaved changes</p>}</div>
   <label className="text-sm">Power feed<select aria-label="Power feed" className={`${inputClassName} mt-1 block w-40 max-w-full`} value={profile.feed||''} onChange={e=>edit({feed:e.target.value as 'A'|'B'})}><option value="">Choose feed…</option><option value="A">Feed A</option><option value="B">Feed B</option></select></label></div>
   <details className="mt-4 border-t border-border pt-3"><summary className="text-sm">Electrical settings and verification{checks.length?` · ${checks.length} checks to review`:''}</summary>
   <p className="my-3 text-sm text-muted-foreground">Use the exact PDU and upstream circuit’s usable continuous limits. Three-phase voltage is line-to-line. Confirm the actual installation before marking settings verified.</p>
   {checks.length>0&&<ul className="my-3 list-disc space-y-1 pl-5 text-sm text-amber-300">{checks.map(check=><li key={check}>{check}</li>)}</ul>}
   <div className="power-fields mt-3">
   <label>Supply topology<select value={profile.topology} onChange={e=>edit({topology:e.target.value as Topology})}><option value="single-phase">Single-phase</option><option value="three-phase-wye">Three-phase Wye</option><option value="three-phase-delta">Three-phase Delta</option></select></label>
   <label>{profile.topology==='single-phase'?'Supply voltage (V)':'Line-to-line voltage (V)'}<input type="number" min="1" max="1000" value={profile.voltage||''} onChange={e=>edit({voltage:Number(e.target.value)})}/></label>
   <label>Usable current per line (A)<input type="number" min="1" max="1000" value={profile.limitAmps||''} onChange={e=>edit({limitAmps:Number(e.target.value)})}/></label>
   {profile.topology==='three-phase-wye'&&<label>Neutral limit (A, optional)<input type="number" min="1" max="1000" value={profile.neutralLimitAmps||''} onChange={e=>edit({neutralLimitAmps:e.target.value?Number(e.target.value):undefined})}/></label>}
  </div><details className="mt-4"><summary>Outlet phases and breaker limits · {profile.outlets.length} outlets</summary><div className="overflow-x-auto"><table className="power-table"><thead><tr><th>Outlet</th><th>Connectors</th><th>Phase / line pair</th><th>Outlet A</th><th>Branch</th><th>Branch A</th><th>Reserved</th></tr></thead><tbody>{profile.outlets.slice().sort((a,b)=>a.n-b.n).map(o=>{
   function outlet(change:Partial<typeof o>){edit({outlets:profile.outlets.map(v=>v.n===o.n?{...v,...change}:v)});}
   return <tr key={o.n}><td>P{o.n}</td><td>{o.connectors.join(' / ')}</td><td><select aria-label={`${p.name} P${o.n} phase`} disabled={profile.topology==='single-phase'} value={o.phase||''} onChange={e=>outlet({phase:e.target.value as Phase})}><option value="">{profile.topology==='single-phase'?'Single-phase':'Choose…'}</option>{phases.map(v=><option key={v}>{v}</option>)}</select></td><td><input aria-label={`${p.name} P${o.n} outlet amps`} className="w-20" type="number" min="0" value={o.limitAmps||''} onChange={e=>outlet({limitAmps:Number(e.target.value)})}/></td><td><input aria-label={`${p.name} P${o.n} branch`} className="w-20" value={o.branch||''} onChange={e=>outlet({branch:e.target.value})}/></td><td><input aria-label={`${p.name} branch ${o.branch||'?'} amps`} className="w-20" type="number" min="0" value={profile.branches[o.branch||'']||''} disabled={!o.branch} onChange={e=>edit({branches:{...profile.branches,[o.branch!]:Number(e.target.value)}})}/></td><td><input type="checkbox" aria-label={`${p.name} P${o.n} reserved`} checked={!!o.reserved} onChange={e=>outlet({reserved:e.target.checked})}/></td></tr>;
  })}</tbody></table></div></details><label className="mt-4 block text-sm"><input type="checkbox" checked={profile.confirmed} onChange={e=>onChange(p.id,{...profile,confirmed:e.target.checked})}/> I verified the voltage, feed, phase mapping and usable PDU/branch/outlet limits.</label></details></article>;
 })}
 {supplies.length>0&&<p className="text-sm text-muted-foreground">Changes remain unsaved until you use <button type="button" className="underline" onClick={()=>{const target=document.getElementById('power-save-inputs');target?.focus({preventScroll:true});target?.scrollIntoView({block:'center'});}}>Save power inputs</button>. Editing a setting requires verifying that PDU again. Saved cables are unchanged.</p>}
 </section>;
}

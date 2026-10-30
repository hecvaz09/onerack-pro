"use client";
import {useState,useTransition} from 'react';
import {SMC_CX8_IB_PROFILE as profile} from '@/lib/network-profiles';
import {saveNetworkProfile} from './network-profile-actions';

export function NetworkProfilePanel({rackId,devices,profiles}:{rackId:string;devices:{id:string;name:string}[];profiles:Record<string,string>}){
  const [pending,start]=useTransition(),[message,setMessage]=useState('');
  if(!devices.length)return null;
  function save(id:string,enabled:boolean){start(async()=>{const result=await saveNetworkProfile(rackId,id,enabled);setMessage(result.ok?(enabled?'Proposed network profile saved.':'Network profile removed.'):result.error||'Could not save.');});}
  return <section className="power-planner mb-5">
    <p className="text-xs uppercase tracking-widest text-muted-foreground">Proposed server configuration</p>
    <h2 className="mt-2 text-xl font-semibold">Supermicro {profile.model}</h2>
    <p className="my-3 text-sm text-muted-foreground">Two ConnectX-8 adapters using InfiniBand per server. Choose which installed chassis use this planning profile.</p>
    <div className="grid gap-3 md:grid-cols-2">
      <article className="rounded-lg border border-border p-4"><h3 className="mb-3 font-semibold">Built-in Ethernet ports</h3>{profile.onboard.map(port=><p className="my-2 text-sm" key={port.id}>{port.name} · {port.speed} · {port.connector}</p>)}</article>
      <article className="rounded-lg border border-border p-4"><h3 className="mb-3 font-semibold">InfiniBand adapters</h3>{profile.adapters.map(adapter=><p className="my-2 text-sm" key={adapter.id}>{adapter.name} · {adapter.protocol}</p>)}<p className="mt-3 text-xs text-amber-200">Adapter SKU, physical port count, link speed and server compatibility still need confirmation. No port assignments are generated from this profile yet.</p></article>
    </div>
    <div className="mt-4 divide-y divide-border">{devices.map(d=><div key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{d.name}</p><p className="text-xs text-muted-foreground">{profiles[d.id]?'2 × ConnectX-8 · InfiniBand · proposed':'No network profile assigned'}</p></div><button className="rounded-lg border border-border px-3 py-2 text-sm" disabled={pending} onClick={()=>save(d.id,!profiles[d.id])}>{profiles[d.id]?'Remove profile':'Use this profile'}</button></div>)}</div>
    {message&&<p role="status" className="mt-3 text-sm">{message}</p>}
    <a className="mt-3 inline-block text-xs text-primary underline" href={profile.source} target="_blank" rel="noreferrer">Supermicro onboard port specifications</a>
  </section>;
}

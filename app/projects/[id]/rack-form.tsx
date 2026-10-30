"use client";
import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/button";
import { RACK_PROFILES } from "@/lib/rack-config";
import { createRack } from "./actions";
const inputClassName = "h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring";
export function RackForm({projectId}:{projectId:string}) {
  const [profile,setProfile]=useState("rnr-60-pockets");
  const [error,setError]=useState("");
  const [pending,startTransition]=useTransition();
  const formRef=useRef<HTMLFormElement>(null);
  return <form ref={formRef} className="mb-6 space-y-2" onSubmit={event=>{
    event.preventDefault();const data=new FormData(event.currentTarget);
    startTransition(async()=>{setError("");const result=await createRack(projectId,data);if(result.ok){formRef.current?.reset();setProfile("rnr-60-pockets");}else setError(result.error);});
  }}><fieldset disabled={pending} className="flex flex-wrap gap-2">
    <input type="text" name="name" required maxLength={200} placeholder="Rack name" aria-label="Rack name" className={inputClassName+" flex-1"}/>
    <select name="profile" aria-label="Rack profile" value={profile} onChange={e=>setProfile(e.target.value)} className={inputClassName}>{RACK_PROFILES.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
    {profile==="custom"&&<input name="heightRU" type="number" min={1} max={60} step={1} required defaultValue={48} aria-label="Custom height (RU)" className={inputClassName+" w-24"}/>}
    <input type="hidden" name="pduA" value="on"/><input type="hidden" name="pduB" value="on"/>
    <Button type="submit">{pending?"Adding…":"Add rack"}</Button>
  </fieldset>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}</form>;
}

"use client";

import { useState, useTransition } from "react";
import { RACK_PROFILES, type RackConfig } from "@/lib/rack-config";
import { saveRackSettings } from "./actions";

export function RackSettings({ rackId, name, heightRU, config }: { rackId: string; name: string; heightRU: number; config: RackConfig }) {
  const [profile, setProfile] = useState(config.profile);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const input = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  return <details className="rack-settings rounded-xl border border-border bg-card p-4">
    <summary className="cursor-pointer text-sm font-medium">Rack settings · {RACK_PROFILES.find(p => p.id === config.profile)?.name}</summary>
    <form className="mt-4 grid gap-4 sm:grid-cols-3" onSubmit={event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      setMessage("");
      startTransition(async () => {
        try {
          const result = await saveRackSettings(rackId, form);
          setMessage(result.ok ? "Rack settings saved." : result.error);
        } catch { setMessage("Could not save rack settings. Please try again."); }
      });
    }}>
      <fieldset disabled={pending} className="contents">
        <label className="text-sm">Rack name<input name="name" required maxLength={200} defaultValue={name} className={input}/></label>
        <label className="text-sm">Profile<select name="profile" value={profile} onChange={e => setProfile(e.target.value)} className={input}>{RACK_PROFILES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        {profile === "custom" ? <label className="text-sm">Main bay height (RU)<input type="number" name="heightRU" min={1} max={60} step={1} required defaultValue={heightRU} className={input}/></label> : <p className="self-center text-sm text-muted-foreground">{RACK_PROFILES.find(p => p.id === profile)?.heightRU}U main bay{profile === "rnr-60-pockets" ? " + twelve side pockets" : ""}</p>}
        <label className="text-sm">Location<input name="location" maxLength={200} defaultValue={config.location} className={input}/></label>
        <label className="text-sm">Asset tag<input name="assetTag" maxLength={100} defaultValue={config.assetTag} className={input}/></label>
        <label className="text-sm">PDU layout<select name="pduPairs" defaultValue={config.pduPairs||1} className={input}><option value="1">Two PDUs · A / B</option><option value="2">Four PDUs · A1 / A2 / B1 / B2</option></select></label><div className="flex items-center gap-4 text-sm"><label><input type="checkbox" name="pduA" defaultChecked={config.pduA}/> PDU-A rail</label><label><input type="checkbox" name="pduB" defaultChecked={config.pduB}/> PDU-B rail</label></div>
        <input type="hidden" name="defaultSwitchPortFace" value={config.defaultSwitchPortFace}/><input type="hidden" name="defaultChassisId" value={config.defaultChassisId}/>
        <div className="flex items-center gap-4 sm:col-span-3"><button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" type="submit">{pending ? "Saving…" : "Save settings"}</button><p role="status" className="text-sm">{message}</p></div>
      </fieldset>
    </form>
  </details>;
}

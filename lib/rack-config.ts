import { mountingError } from "./rack-mounting.ts";

export const RACK_PROFILES = [
  { id:"rnr-60-pockets", name:"OneRack U60 · 48U + 12 side pockets", heightRU:48, pockets:true },
  { id:"apc-netshelter-42", name:"APC NetShelter SX 42U", heightRU:42, pockets:false },
  { id:"eaton-48", name:"Eaton RE-Series 48U", heightRU:48, pockets:false },
  { id:"vertiv-48", name:"Vertiv VR3357 48U", heightRU:48, pockets:false },
  { id:"generic-42", name:"Generic 42U", heightRU:42, pockets:false },
  { id:"generic-48", name:"Generic 48U", heightRU:48, pockets:false },
  { id:"custom", name:"Custom rack", heightRU:48, pockets:false },
] as const;
export type RackConfig = {profile:string;pockets:boolean;pduA:boolean;pduB:boolean;pduPairs?:1|2;location:string;assetTag:string;defaultSwitchPortFace:"front"|"rear";defaultChassisId:string};
export function readRackConfig(raw:unknown):RackConfig {
  const v=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
  return {pduPairs:v.pduPairs===2?2:1,profile:typeof v.profile==="string"&&RACK_PROFILES.some(p=>p.id===v.profile)?v.profile:"custom",pockets:v.pockets===true,pduA:v.pduA!==false,pduB:v.pduB!==false,location:typeof v.location==="string"?v.location:"",assetTag:typeof v.assetTag==="string"?v.assetTag:"",defaultSwitchPortFace:v.defaultSwitchPortFace==="rear"?"rear":"front",defaultChassisId:typeof v.defaultChassisId==="string"?v.defaultChassisId:""};
}
export function rackConfigError(heightRU:number,config:RackConfig):string|null {
  if(!Number.isInteger(heightRU)||heightRU<1||heightRU>60)return "Rack height must be a whole number from 1 to 60.";
  if(config.pockets&&heightRU!==48)return "The twelve side pockets require a 48U main bay.";
  if(config.location.length>200||config.assetTag.length>100)return "Location or asset tag is too long.";
  return null;
}

export function rackSettingsFromForm(form: FormData) {
  const profile = RACK_PROFILES.find(p => p.id === form.get("profile"));
  if (!profile) return { error: "Choose a rack profile." } as const;
  const heightRU = profile.id === "custom" ? Number(form.get("heightRU")) : profile.heightRU;
  const configuration = readRackConfig({ profile: profile.id, pockets: profile.pockets,
    pduPairs: Number(form.get("pduPairs")), pduA: form.get("pduA") === "on", pduB: form.get("pduB") === "on",
    location: String(form.get("location") ?? "").trim(), assetTag: String(form.get("assetTag") ?? "").trim(),
    defaultSwitchPortFace: form.get("defaultSwitchPortFace"), defaultChassisId: String(form.get("defaultChassisId") ?? "") });
  const name = String(form.get("name") ?? "").trim();
  const error = !name || name.length > 200 ? "Enter a rack name of 1–200 characters." : rackConfigError(heightRU, configuration);
  return error ? { error } : { name, heightRU, configuration };
}

export function rackChangeError(heightRU: number, configuration: RackConfig, devices: {
  id: string; startRU: number; heightRU: number; mounting: string; name: string; category: string | null;
}[], previous?: RackConfig): string | null {
  if (previous && previous.pockets !== configuration.pockets && devices.some(d => d.heightRU > 0 && d.startRU + d.heightRU - 1 > 48)) {
    return "Move or remove equipment above U48 or in side pockets before changing between a pocket rack and a standard rack.";
  }
  for (const device of devices) {
    const error = mountingError(heightRU, device.startRU, device.heightRU, device.category, device.mounting, devices, device.id, configuration);
    if (error) return `${device.name}: ${error} Move or remove this equipment before changing the profile.`;
  }
  return null;
}

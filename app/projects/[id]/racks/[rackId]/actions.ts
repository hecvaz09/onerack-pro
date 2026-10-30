"use server";
import {requireActiveRack} from "@/lib/rack-trash";

import {requireActiveProjectForRack} from "@/lib/project-lifecycle";
import { revalidatePath } from "next/cache";
import { rackMutation } from "@/lib/rack-mutation";
import { parseRackUnit } from "@/lib/rack-validation";

import {planRackFill} from "@/lib/rack-fill";
import { mountingError } from "@/lib/rack-mounting";
import { detailsObject, readDetails, readOutlets, readNodeNames, type NodeDetails } from "@/lib/equipment-details";
import { readRackConfig, rackSettingsFromForm, rackChangeError } from "@/lib/rack-config";
import { prisma } from "@/lib/prisma";
import { replayRackChange } from "@/lib/rack-history";

export type PlaceDeviceValues = { catalogDeviceId: string; startRU: string; label: string; mounting: string };
export type PlaceDeviceState = { error: string; values: PlaceDeviceValues } | { success: true } | null;
export type MoveDeviceResult = { ok: true } | { ok: false; error: string };
export type ConnectionResult = MoveDeviceResult;

export async function saveRackSettings(rackId: string, form: FormData): Promise<MoveDeviceResult> {
  const settings = rackSettingsFromForm(form);
  if ("error" in settings) return { ok: false, error: settings.error! };
  try {
    const result = await rackMutation(rackId, async tx => {
      const rack = await tx.rack.findUnique({ where: { id: rackId }, include: { devices: { include: { catalogDevice: true } } } });
      if (!rack) return { error: "Rack not found." };
      const error = rackChangeError(settings.heightRU, settings.configuration, rack.devices.map(d => ({ id:d.id, startRU:d.startRU, mounting:d.mounting, heightRU:d.catalogDevice.heightRU, category:d.catalogDevice.category, name:d.label || d.catalogDevice.model })), readRackConfig(rack.configuration));
      if (error) return { error };
      if (settings.configuration.defaultChassisId && !await tx.catalogDevice.findFirst({ where:{id:settings.configuration.defaultChassisId,category:"chassis"} })) return { error: "Choose a chassis from the catalog." };
      await tx.rack.update({ where: { id: rackId }, data: {...settings,configuration:{...(rack.configuration as Record<string,never>),...settings.configuration}} });
      return { projectId: rack.projectId };
    });
    if ("error" in result) return { ok: false, error: result.error! };
    revalidatePath(`/projects/${result.projectId}`);
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}`);
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}/connections`);
    return { ok: true };
  } catch { return { ok: false, error: "Could not save rack settings. Your equipment has not been changed." }; }
}

export async function saveNode(rackId:string,deviceId:string,nodeName:string,node:NodeDetails):Promise<MoveDeviceResult>{
  if(!node||!["active","offline","decommissioned"].includes(node.status)||[node.hostname,node.ip,node.serial,node.notes].some(v=>typeof v!=="string"||v.length>2000))return {ok:false,error:"Invalid node details."};
  try{
    const result=await rackMutation(rackId,async tx=>{
      const device=await tx.deviceInstance.findFirst({where:{id:deviceId,rackId},include:{rack:true,catalogDevice:true}});
      if(!device||!readNodeNames(device.catalogDevice.rawData).includes(nodeName))return {error:"Node not found in installed equipment."};
      const details=detailsObject(device.details),nodes=detailsObject(details.nodes);
      nodes[nodeName]={...detailsObject(nodes[nodeName]),...node};
      await tx.deviceInstance.update({where:{id:deviceId},data:{details:JSON.parse(JSON.stringify({...details,nodes}))}});
      return {projectId:device.rack.projectId};
    });
    if("error" in result)return {ok:false,error:result.error!};
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}`);return {ok:true};
  }catch{return {ok:false,error:"Could not save node details."};}
}

export async function fillRack(rackId:string,catalogDeviceId:string,mounting="front"):Promise<{ok:true;count:number}|{ok:false;error:string}> {
  try {
    const result=await rackMutation(rackId,async tx=>{
      const rack=await tx.rack.findUnique({where:{id:rackId},include:{devices:{include:{catalogDevice:true}}}});
      const catalog=await tx.catalogDevice.findUnique({where:{id:catalogDeviceId}});
      if(!rack||!catalog||!Number.isInteger(catalog.heightRU)||catalog.heightRU<1||!["front","rear"].includes(mounting))return {error:"Choose rack-mounted equipment to fill this rack."};
      const occupied=rack.devices.map(d=>({id:d.id,startRU:d.startRU,heightRU:d.catalogDevice.heightRU,mounting:d.mounting,name:d.label||d.catalogDevice.model}));
      const placements=planRackFill(rack.heightRU,catalog.heightRU,catalog.category,mounting,occupied,readRackConfig(rack.configuration)).map(startRU=>({rackId,catalogDeviceId,startRU,mounting}));
      if(!placements.length)return {error:"No empty span is large enough for this equipment."};
      // Keep existing instance IDs and cables intact when filling free spans.
      await tx.deviceInstance.createMany({data:placements});
      return {projectId:rack.projectId,count:placements.length};
    });
    if("error" in result)return {ok:false,error:result.error!};
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}`);
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}/connections`);
    return {ok:true,count:result.count};
  }catch{return {ok:false,error:"Could not fill the rack. Please try again."};}
}

export async function undoRedoRack(rackId:string,direction:-1|1):Promise<MoveDeviceResult> {
  if(direction!==-1&&direction!==1)return {ok:false,error:"Invalid history direction."};
  try {
    const result=await prisma.$transaction(async tx=>{
      await requireActiveProjectForRack(tx,rackId);
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${rackId}, 0))::text`;
      await requireActiveRack(tx,rackId);
      const rack=await tx.rack.findUnique({where:{id:rackId},select:{projectId:true}});
      if(!rack)return {error:"Rack not found."};
      const error=await replayRackChange(tx,rackId,direction);
      return error?{error}:{projectId:rack.projectId};
    },{timeout:30000});
    if("error" in result)return {ok:false,error:result.error!};
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}`);
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}/connections`);
    return {ok:true};
  } catch {return {ok:false,error:"Could not restore the saved rack change. Please try again."};}
}

export async function renameDevice(rackId:string,deviceId:string,label:string):Promise<MoveDeviceResult> {
  if(label.length>200)return {ok:false,error:"Keep the label under 200 characters."};
  try {
    const result=await rackMutation(rackId,async tx=>{
      const device=await tx.deviceInstance.findFirst({where:{id:deviceId,rackId},include:{rack:true}});
      if(!device)return {error:"Device not found in this rack."};
      await tx.deviceInstance.update({where:{id:deviceId},data:{label:label.trim()||null}});
      return {projectId:device.rack.projectId};
    });
    if("error" in result)return {ok:false,error:result.error!};
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}`);
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}/connections`);
    return {ok:true};
  }catch{return {ok:false,error:"Could not save this label."};}
}

export async function removeDevice(rackId: string, deviceId: string): Promise<MoveDeviceResult> {
  try {
    const result = await rackMutation(rackId, async tx => {
      const device = await tx.deviceInstance.findFirst({
        where: { id: deviceId, rackId },
        select: { rack: { select: { projectId: true } } },
      });
      if (!device) return { error: "Device not found in this rack. Reload to see the latest changes." };
      const pdus = await tx.deviceInstance.findMany({ where: { rackId, catalogDevice: { category: "pdu" } }, select: { id: true, details: true } });
      for (const pdu of pdus) {
        const details = detailsObject(pdu.details), outlets = detailsObject(details.outlets);
        let changed = false;
        for (const [number, assignment] of Object.entries(readDetails(pdu.details).outlets)) {
          if (assignment.deviceId === deviceId) {
            outlets[number] = { ...detailsObject(outlets[number]), deviceId: "" };
            changed = true;
          }
        }
        if (changed) await tx.deviceInstance.update({ where: { id: pdu.id }, data: { details: JSON.parse(JSON.stringify({ ...details, outlets })) } });
      }
      // Foreign keys cascade its incoming and outgoing cables in this transaction.
      // The catalog entry and other placed devices are retained.
      await tx.deviceInstance.delete({ where: { id: deviceId } });
      return { projectId: device.rack.projectId };
    });
    if ("error" in result) return { ok: false, error: result.error! };
    const path = `/projects/${result.projectId}/racks/${rackId}`;
    revalidatePath(path);
    revalidatePath(`${path}/connections`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't remove the device. Please try again." };
  }
}

export async function saveOutlet(rackId: string, pduId: string, outlet: number, deviceId: string, notes: string, inlet=0): Promise<MoveDeviceResult> {
  if(!Number.isInteger(inlet)||inlet<0||inlet>6)return {ok:false,error:"Choose a PSU number from 1 to 6."};
  if (!Number.isInteger(outlet) || notes.length > 2000) return { ok:false,error:"Invalid outlet or notes longer than 2,000 characters." };
  try {
    const result = await rackMutation(rackId, async tx => {
      const pdu = await tx.deviceInstance.findFirst({where:{id:pduId,rackId,catalogDevice:{category:"pdu"}},include:{catalogDevice:true,rack:true}});
      if (!pdu || !readOutlets(pdu.catalogDevice.rawData).some(o=>o.n===outlet)) return {error:"This outlet is not in the installed PDU."};
      if (deviceId && !await tx.deviceInstance.findFirst({where:{id:deviceId,rackId,catalogDevice:{category:{not:"pdu"}}}})) return {error:"Choose installed equipment in this rack."};
      const details=readDetails(pdu.details);
      if (!deviceId && !notes.trim()) delete details.outlets[String(outlet)];
      else details.outlets[String(outlet)]={deviceId,notes:notes.trim(),inlet,locked:true};
      await tx.deviceInstance.update({where:{id:pduId},data:{details:JSON.parse(JSON.stringify({...pdu.details as object,...details}))}});
      return {projectId:pdu.rack.projectId};
    });
    if ("error" in result) return {ok:false,error:result.error!};
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}`);
    return {ok:true};
  } catch { return {ok:false,error:"Could not save this outlet. Please try again."}; }
}

export async function placeDevice(rackId: string, _previous: PlaceDeviceState, formData: FormData): Promise<PlaceDeviceState> {
  const values = {
    catalogDeviceId: String(formData.get("catalogDeviceId") ?? "").trim(),
    startRU: String(formData.get("startRU") ?? "").trim(),
    label: String(formData.get("label") ?? "").trim(),
    mounting: String(formData.get("mounting") ?? "front"),
  };
  if (!values.catalogDeviceId) return { error: "Choose a device to place.", values };
  const startRU = parseRackUnit(values.startRU);
  if (startRU === null) return { error: "Enter a positive whole-number starting RU.", values };
  try {
    const result = await rackMutation(rackId, async tx => {
      const rack = await tx.rack.findUnique({ where: { id: rackId }, include: { devices: { include: { catalogDevice: true } } } });
      const catalog = await tx.catalogDevice.findUnique({ where: { id: values.catalogDeviceId } });
      if (!rack) return { error: "Rack not found." };
      if (!catalog) return { error: "Device not found in the catalog." };
      const error = mountingError(rack.heightRU, startRU, catalog.heightRU, catalog.category, values.mounting, rack.devices.map(d => ({ id: d.id, startRU: d.startRU, heightRU: d.catalogDevice.heightRU, mounting: d.mounting, name: d.label || d.catalogDevice.model })),undefined,readRackConfig(rack.configuration));
      if (error) return { error };
      await tx.deviceInstance.create({ data: { rackId, catalogDeviceId: catalog.id, startRU, mounting: values.mounting, label: values.label || null } });
      return { projectId: rack.projectId };
    });
    if ("error" in result) return { error: result.error!, values };
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}`);
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}/connections`);
    return { success: true };
  } catch (error) {
    console.error("placeDevice failed", error);
    return { error: "Couldn't save the placement. Please try again.", values };
  }
}

export async function moveDevice(rackId: string, deviceId: string, toStartRU: number, mounting?: string): Promise<MoveDeviceResult> {
  try {
    const result = await rackMutation(rackId, async tx => {
      const rack = await tx.rack.findUnique({ where: { id: rackId }, include: { devices: { include: { catalogDevice: true } } } });
      if (!rack) return { error: "Rack not found." };
      const device = rack.devices.find(d => d.id === deviceId);
      if (!device) return { error: "Device not found in this rack." };
      const error = mountingError(rack.heightRU, toStartRU, device.catalogDevice.heightRU, device.catalogDevice.category, mounting ?? device.mounting, rack.devices.map(d => ({ id: d.id, startRU: d.startRU, heightRU: d.catalogDevice.heightRU, mounting: d.mounting, name: d.label || d.catalogDevice.model })), deviceId,readRackConfig(rack.configuration));
      if (error) return { error };
      await tx.deviceInstance.update({ where: { id: deviceId }, data: { startRU: toStartRU, ...(mounting ? { mounting } : {}) } });
      return { projectId: rack.projectId };
    });
    if ("error" in result) return { ok: false, error: result.error! };
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}`);
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}/connections`);
    return { ok: true };
  } catch (error) {
    console.error("moveDevice failed", error);
    return { ok: false, error: "Couldn't move the device. Please try again." };
  }
}

export async function deleteConnection(connectionId: string, rackId: string): Promise<ConnectionResult> {
  try {
    const result = await rackMutation(rackId, async tx => {
      const connection = await tx.connection.findFirst({ where: { id: connectionId, fromDevice: { rackId }, OR: [{toDevice: {rackId}}, {toDeviceId:null}] }, select: { fromDevice: { select: { rack: { select: { projectId: true } } } } } });
      if (!connection) return { error: "Connection not found in this rack." };
      await tx.connection.delete({ where: { id: connectionId } });
      return { projectId: connection.fromDevice.rack.projectId };
    });
    if ("error" in result) return { ok: false, error: result.error! };
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}`);
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}/connections`);
    return { ok: true };
  } catch (error) {
    console.error("deleteConnection failed", error);
    return { ok: false, error: "Couldn't remove the connection. Please try again." };
  }
}

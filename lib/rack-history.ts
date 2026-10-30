import {readExternal} from './external-connections.ts';
import type { Prisma } from "@/generated/prisma/client";
import {networkPorts,portUsed,portCompatibility} from './network-ports.ts';
type Snapshot = {
    rack: { name: string; heightRU: number; configuration: Prisma.JsonValue } | null;
    devices: {
        id: string;
        catalogDeviceId: string;
        startRU: number;
        mounting: string;
        label: string | null;
        details: Prisma.JsonValue;
    }[];
    connections: {
        id: string;
        fromDeviceId: string;
        toDeviceId: string|null;
        external?: Prisma.JsonValue;
        lengthValue?:number|null;
        lengthUnit?:string|null;
        cableType: string | null;
        label: string | null;
        fromPort?: string | null;
        toPort?: string | null;
    }[];
};
export async function rackSnapshot(tx: Prisma.TransactionClient, rackId: string): Promise<Snapshot> {
    const rack = await tx.rack.findUnique({ where: { id: rackId }, select: { name: true, heightRU: true, configuration: true } });
    const devices = await tx.deviceInstance.findMany({ where: { rackId }, orderBy: { id: "asc" }, select: { id: true, catalogDeviceId: true, startRU: true, mounting: true, label: true, details: true } });
    const connections = await tx.connection.findMany({ where: { fromDevice: { rackId }, OR: [{toDevice: {rackId}}, {toDeviceId:null}] }, orderBy: { id: "asc" }, select: { id: true, fromDeviceId: true, toDeviceId: true, cableType: true, label: true, fromPort:true, toPort:true,external:true,lengthValue:true,lengthUnit:true } });
    return { rack, devices, connections };
}
// JSONB may reorder object keys; compare canonical objects, not insertion order.
function canonical(value: unknown): string {
    if (Array.isArray(value))
        return `[${value.map(canonical).join(",")}]`;
    if (value && typeof value === "object")
        return `{${Object.entries(value).filter(([k,v])=>!(['fromPort','toPort','external','lengthValue','lengthUnit'].includes(k)&&v==null)).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
    return JSON.stringify(value);
}
export async function recordRackChange(tx: Prisma.TransactionClient, rackId: string, before: Snapshot) {
    const after = await rackSnapshot(tx, rackId);
    if (canonical(before) === canonical(after))
        return;
    const history = await tx.rackHistory.findUnique({ where: { rackId } });
    const previous = history?.snapshots as unknown as Snapshot[] | undefined;
    const continuous = previous && canonical(previous[history!.cursor]) === canonical(before);
    const snapshots = [...(continuous ? previous.slice(0, history!.cursor + 1) : [before]), after].slice(-31);
    await tx.rackHistory.upsert({ where: { rackId }, create: { rackId, snapshots: snapshots as unknown as Prisma.InputJsonValue, cursor: snapshots.length - 1 }, update: { snapshots: snapshots as unknown as Prisma.InputJsonValue, cursor: snapshots.length - 1 } });
}
export async function replayRackChange(tx: Prisma.TransactionClient, rackId: string, direction: -1 | 1) {
    const history = await tx.rackHistory.findUnique({ where: { rackId } });
    const snapshots = history?.snapshots as unknown as Snapshot[] | undefined;
    const cursor = (history?.cursor ?? 0) + direction;
    if (!history || !snapshots || cursor < 0 || cursor >= snapshots.length)
        return "No saved change to undo or redo.";
    if (canonical(await rackSnapshot(tx, rackId)) !== canonical(snapshots[history.cursor]))
        return "The rack changed outside this history. Reload before making another change.";
    const target = snapshots[cursor];
    if (!target.rack) return "This older history does not include rack settings. Make a new change to start compatible history.";
    const mapped=target.connections.filter(c=>c.fromPort||c.toPort);
    if(mapped.length){
        const ids=[...new Set(target.devices.map(d=>d.catalogDeviceId))].sort();
        for(const id of ids)await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`catalog:${id}`}, 0))::text`;
        const catalog=await tx.catalogDevice.findMany({where:{id:{in:ids}}});
        const ports=(deviceId:string)=>networkPorts(catalog.find(c=>c.id===target.devices.find(d=>d.id===deviceId)?.catalogDeviceId)?.rawData);
        for(const c of mapped){
            if(!c.toDeviceId){if(!readExternal(c.external)||!ports(c.fromDeviceId).some(p=>p.id===c.fromPort)||portUsed(mapped,c.fromDeviceId,c.fromPort!,c.id))return 'Cannot restore the external cable: its rack port changed or is occupied.';continue;}
            const from=ports(c.fromDeviceId).find(p=>p.id===c.fromPort),to=ports(c.toDeviceId).find(p=>p.id===c.toPort);
            if(!from||!to||portCompatibility(from,to,c.cableType||'').error||portUsed(mapped,c.fromDeviceId,c.fromPort!,c.id)||portUsed(mapped,c.toDeviceId,c.toPort!,c.id))return 'Cannot restore these cables because the equipment ports changed. Restore the equipment configuration first.';
        }
    }
    await tx.rack.update({ where: { id: rackId }, data: { ...target.rack, configuration: (target.rack.configuration ?? {}) as Prisma.InputJsonValue } });
    await tx.connection.deleteMany({ where: { fromDevice: { rackId }, OR: [{toDevice: {rackId}}, {toDeviceId:null}] } });
    await tx.deviceInstance.deleteMany({ where: { rackId, id: { notIn: target.devices.map(d => d.id) } } });
    for (const device of target.devices) {
        const data = { ...device, details: (device.details ?? {}) as Prisma.InputJsonValue };
        await tx.deviceInstance.upsert({ where: { id: device.id }, create: { ...data, rackId }, update: data });
    }
    if (target.connections.length)
        await tx.connection.createMany({ data: target.connections.map(({external,...c})=>({...c,...(external?{external:external as Prisma.InputJsonValue}:{})})) });
    await tx.rackHistory.update({ where: { rackId }, data: { cursor } });
    return null;
}

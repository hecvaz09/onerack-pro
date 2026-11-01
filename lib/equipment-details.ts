import { pduModelId, PX3_4068_OUTLETS } from "./pdu-models.ts";

export type Outlet = {
    n: number;
    type: string;
    cb: number;
    phase: string;
};
export type OutletAssignment = {
    deviceId: string;
    notes: string;
    inlet?: number;
    locked?: boolean;
    inputIdentity?: "b300-module-input-v1";
};
export type NodeDetails = {
    hostname: string;
    ip: string;
    serial: string;
    notes: string;
    status: "active" | "offline" | "decommissioned";
};
export type EquipmentDetails = {
    outlets: Record<string, OutletAssignment>;
    nodes: Record<string, NodeDetails>;
};
function record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
// For targeted writes: clone the raw object without projecting away unknown fields.
// Readers may normalize through readDetails; mutations must preserve unrelated data.
export function detailsObject(value: unknown): Record<string, unknown> {
    return { ...record(value) };
}
// Replacing a binding owns these fields, while notes and future metadata remain explicit.
export function withOutletAssignment(value: unknown, assignment: OutletAssignment): Record<string, unknown> {
    const entry = detailsObject(value);
    delete entry.inlet;
    delete entry.locked;
    delete entry.inputIdentity;
    return { ...entry, ...assignment };
}
export function readDetails(value: unknown): EquipmentDetails {
    const outlets: EquipmentDetails["outlets"] = {};
    for (const [key, entry] of Object.entries(record(record(value).outlets))) {
        const item = record(entry);
        if (/^\d+$/.test(key) && typeof item.deviceId === "string" && typeof item.notes === "string")
            outlets[key] = { deviceId: item.deviceId, notes: item.notes, ...(typeof item.inlet === "number" ? {inlet:item.inlet} : {}), ...(typeof item.locked === "boolean" ? {locked:item.locked} : {}), ...(item.inputIdentity === "b300-module-input-v1" ? {inputIdentity:item.inputIdentity} : {}) };
    }
    const nodes: EquipmentDetails["nodes"] = {};
    for (const [key, nodeValue] of Object.entries(record(record(value).nodes))) {
        const node = record(nodeValue);
        nodes[key] = { hostname: String(node.hostname || ""), ip: String(node.ip || ""), serial: String(node.serial || ""), notes: String(node.notes || ""), status: node.status === "offline" || node.status === "decommissioned" ? node.status : "active" };
    }
    return { outlets, nodes };
}
export function readNodeNames(raw: unknown): string[] {
    const rows = record(record(raw).nodeGrid).labels;
    return Array.isArray(rows) ? rows.flat().filter((v): v is string => typeof v === "string" && v.length > 0) : [];
}
export function readOutlets(raw: unknown): Outlet[] {
    if (pduModelId(raw)) return PX3_4068_OUTLETS.map(({n,type,cb,phase}) => ({n,type,cb,phase})).sort((a,b) => a.n-b.n);
    const items = record(record(raw).pdu).outlets;
    if (!Array.isArray(items))
        return [];
    return items.flatMap(value => {
        const v = record(value);
        return typeof v.n === "number" && Number.isInteger(v.n) && typeof v.type === "string" && typeof v.cb === "number" && typeof v.phase === "string" ? [{ n: v.n, type: v.type, cb: v.cb, phase: v.phase }] : [];
    });
}

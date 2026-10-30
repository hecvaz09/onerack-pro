"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { readDetails, type NodeDetails } from "@/lib/equipment-details";
import type { RackGridDevice } from "./physical-rack-grid";
import {NodeConnections} from './node-connections';
import { saveNode } from "./actions";
const empty: NodeDetails = { hostname: "", ip: "", serial: "", notes: "", status: "active" };
export function NodeEditor({ rackId, device, nodeName, onClose }: {
    rackId: string;
    device: RackGridDevice;
    nodeName: string;
    onClose: () => void;
}) {
    const [node, setNode] = useState(readDetails(device.details).nodes[nodeName] || empty);
    const [error, setError] = useState("");
    const [pending, start] = useTransition();
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => { dialog.current?.showModal(); }, []);
    function save(clear = false) { start(async () => { try {
        const result = await saveNode(rackId, device.id, nodeName, clear ? empty : node);
        if (result.ok)
            onClose();
        else
            setError(result.error);
    }
    catch {
        setError("Could not save node.");
    } }); }
    return <dialog ref={dialog} className="equipment-dialog" aria-labelledby="node-title" onCancel={e => { e.preventDefault(); if (!pending)
        onClose(); }}><form onSubmit={e => { e.preventDefault(); save(); }}><div className="flex justify-between"><h2 id="node-title" className="font-semibold">{nodeName} · U{device.startRU}</h2><button type="button" aria-label="Close node editor" disabled={pending} onClick={onClose}>×</button></div><p className="my-3 text-sm text-muted-foreground">{device.label || device.catalogDevice.model}</p><NodeConnections device={device} nodeName={nodeName}/>{([['hostname', 'Hostname'], ['ip', 'IP address'], ['serial', 'Serial / asset tag'], ['notes', 'Notes']] as const).map(([field, label]) => <label key={field} className="my-3 block text-sm">{label}<input maxLength={2000} value={node[field]} onChange={e => setNode({ ...node, [field]: e.target.value })} className="mt-1 w-full rounded border border-border bg-background p-2"/></label>)}<label className="block text-sm">Status<select value={node.status} onChange={e => setNode({ ...node, status: e.target.value as NodeDetails['status'] })} className="mt-1 w-full rounded border border-border bg-background p-2"><option value="active">Active</option><option value="offline">Offline</option><option value="decommissioned">Decommissioned</option></select></label>{error && <p role="alert">{error}</p>}<div className="mt-5 flex justify-between"><button type="button" disabled={pending} onClick={() => save(true)}>Clear node data</button><button disabled={pending} className="rounded bg-primary px-3 py-2 text-primary-foreground">{pending ? "Saving…" : "Save node"}</button></div></form></dialog>;
}

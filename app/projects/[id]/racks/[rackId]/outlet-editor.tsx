"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { readDetails, type Outlet } from "@/lib/equipment-details";
import type { RackGridDevice } from "./physical-rack-grid";
import { saveOutlet } from "./actions";
export function OutletEditor({ rackId, pdu, outlet, devices, onClose }: {
    rackId: string;
    pdu: RackGridDevice;
    outlet: Outlet;
    devices: RackGridDevice[];
    onClose: () => void;
}) {
    const existing = readDetails(pdu.details).outlets[outlet.n];
    const [deviceId, setDeviceId] = useState(existing?.deviceId || "");
    const [notes, setNotes] = useState(existing?.notes || "");
    const [inlet,setInlet]=useState(existing?.inlet||0);
    const [error, setError] = useState("");
    const [pending, start] = useTransition();
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => { dialog.current?.showModal(); }, []);
    function save(clear = false) { start(async () => { try {
        const result = await saveOutlet(rackId, pdu.id, outlet.n, clear ? "" : deviceId, clear ? "" : notes,clear?0:inlet);
        if (result.ok)
            onClose();
        else
            setError(result.error);
    }
    catch {
        setError("Could not save this outlet. Please try again.");
    } }); }
    return <dialog ref={dialog} className="equipment-dialog" onCancel={event => { event.preventDefault(); if (!pending)
        onClose(); }} aria-labelledby="outlet-title"><form onSubmit={e => { e.preventDefault(); save(); }}>
    <div className="flex justify-between gap-4"><h2 id="outlet-title" className="font-semibold">{pdu.label || `PDU-${pdu.mounting.startsWith("rear-left") ? "B" : "A"}`} · Outlet {outlet.n}</h2><button type="button" aria-label="Close outlet editor" disabled={pending} onClick={onClose}>×</button></div>
    <p className="my-3 text-sm text-muted-foreground">{pdu.label || pdu.catalogDevice.model}<br />{outlet.type} · {outlet.cb?`Circuit breaker ${outlet.cb}`:"Circuit breaker unverified"} · {outlet.phase}</p>
    <label className="block text-sm">Assigned equipment<select value={deviceId} onChange={e => setDeviceId(e.target.value)} className="mt-2 w-full rounded-md border border-border bg-background p-2"><option value="">Unassigned</option>{devices.filter(d => d.id !== pdu.id && !d.pending && d.catalogDevice.category !== "pdu").map(d => <option key={d.id} value={d.id}>{d.label || d.catalogDevice.model} · U{d.startRU}</option>)}</select></label>
    <label className="mt-4 block text-sm">Notes<textarea maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="mt-2 w-full rounded-md border border-border bg-background p-2"/></label>
    <label className="mt-4 block text-sm">Device power supply<select className="mt-2 w-full rounded-md border border-border bg-background p-2" value={inlet} onChange={e=>setInlet(Number(e.target.value))}><option value={0}>Not identified</option>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>PSU {n}</option>)}</select></label>
    <p className="mt-2 text-xs text-muted-foreground">Manual assignments stay locked during automatic balancing.</p>
    {error && <p role="alert" className="my-2 text-sm text-red-400">{error}</p>}
    <div className="mt-5 flex justify-between gap-3"><button type="button" disabled={pending} onClick={() => save(true)} className="rounded-md border border-border px-3 py-2 text-sm">Clear assignment</button><button disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">{pending ? "Saving…" : "Save outlet"}</button></div>
  </form></dialog>;
}

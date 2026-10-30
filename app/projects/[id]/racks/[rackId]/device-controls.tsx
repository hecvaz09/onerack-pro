"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { RackGridDevice } from "./physical-rack-grid";
import { moveDevice, renameDevice } from "./actions";
export function DeviceControls({ device, rackId }: {
    device: RackGridDevice;
    rackId: string;
}) {
    const [label, setLabel] = useState(device.label || "");
    const [ru, setRu] = useState(String(device.startRU));
    const [error, setError] = useState("");
    const [pending, start] = useTransition();
    return <div className="my-3 space-y-3 text-xs">{device.catalogDevice.id&&<Link className="block text-primary underline" href={`/equipment/${device.catalogDevice.id}`}>Edit system specifications →</Link>}<form onSubmit={e => { e.preventDefault(); start(async () => { try {
        const result = await renameDevice(rackId, device.id, label);
        setError(result.ok ? "Label saved." : result.error);
    }
    catch {
        setError("Could not save label.");
    } }); }}><label>Equipment label<input value={label} maxLength={200} onChange={e => setLabel(e.target.value)} className="my-2 w-full rounded border border-border bg-background p-2"/></label><button disabled={pending} className="rounded border border-border px-2 py-1">Save label</button></form>{device.catalogDevice.heightRU > 0 && <form onSubmit={e => { e.preventDefault(); start(async () => { try {
        const result = await moveDevice(rackId, device.id, Number(ru), device.mounting);
        setError(result.ok ? "Position saved." : result.error);
    }
    catch {
        setError("Could not move device.");
    } }); }}><label>Move to RU / pocket<input type="number" min={1} max={60} value={ru} onChange={e => setRu(e.target.value)} className="my-2 w-full rounded border border-border bg-background p-2"/></label><button disabled={pending} className="rounded border border-border px-2 py-1">Move equipment</button></form>}{error && <p role="status">{error}</p>}</div>;
}

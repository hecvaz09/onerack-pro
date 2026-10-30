"use client";
import {RackOverview3D} from "./rack-overview-3d";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import type { RackConfig } from "@/lib/rack-config";
import { createPortal } from "react-dom";
import {RackTargetFeedback} from "./rack-target-feedback";
import {EquipmentDrawerScope,EquipmentDrawerToggle,EquipmentDrawer,type EquipmentDrawerHandle} from "./equipment-drawer";
import { DeviceControls } from "./device-controls";
import { NodeEditor } from "./node-editor";
import { OutletEditor } from "./outlet-editor";
import type { Outlet } from "@/lib/equipment-details";
import { isPocket } from "@/lib/onerack-layout";
import { mountingError } from "@/lib/rack-mounting";
import { dropStartRU, grabbedRowOffset } from "@/lib/rack-drag";
import { moveDevice, placeDevice, undoRedoRack, fillRack, removeDevice } from "./actions";
import { CatalogChipBody, CatalogPalette, type CatalogItem } from "./catalog-palette";
import { RackGrid, type RackGridDevice } from "./physical-rack-grid";
import { colorForCategory } from "./device-colors";
import { RemoveDeviceButton } from "./remove-device-button";
// Read live viewport geometry so scrolling cannot leave stale row targets.
const rackCollision: CollisionDetection = ({ pointerCoordinates, droppableContainers }) => {
    if (!pointerCoordinates)
        return [];
    const { x, y } = pointerCoordinates;
    const hit = document.elementFromPoint(x, y);
    const assembly = hit?.closest(".elevation-assembly");
    if (!assembly)
        return [];
    const rail = hit?.closest("[data-mounting]");
    let id = hit?.closest("[data-drop-id]")?.getAttribute("data-drop-id") || rail?.getAttribute("data-mounting");
    if (!id) {
        const grid = assembly.querySelector(".elevation-grid");
        const first = grid?.querySelector("[data-rack-ru]");
        if (!grid || !first)
            return [];
        const bounds = grid.getBoundingClientRect();
        const column = first.getBoundingClientRect();
        const count = Number(first.getAttribute("data-rack-ru"));
        if (x < column.left || x >= column.right || y < bounds.top || y >= bounds.bottom)
            return [];
        const ru = count - Math.floor((y - bounds.top) / (bounds.height / count));
        id = (assembly.classList.contains("rear-assembly") ? "rear" : "front") + "-ru-" + ru;
    }
    return droppableContainers.some(container => container.id === id) ? [{ id }] : [];
};
type DragItem = {
    id: string;
    kind: "placed" | "catalog";
    heightRU: number;
    name: string;
    category: string | null;
    width: number;
    height: number;
    grabOffset: number;
    catalogItem?: CatalogItem;
};
export function RackWorkspace({ rackId, heightRU, config, devices, catalog, history, connectionCounts = {} }: {
    config:RackConfig;
    rackId: string;
    heightRU: number;
    devices: RackGridDevice[];
    catalog: CatalogItem[];
    history: {
        undo: boolean;
        redo: boolean;
    };
    connectionCounts?: Record<string, number>;
}) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
    const [optimisticDevices, applyChange] = useOptimistic(devices, (current, change: {
        kind: "remove";
        deviceId: string;
    } | {
        kind: "move";
        deviceId: string;
        startRU: number;
        mounting: string;
    } | {
        kind: "add";
        device: RackGridDevice;
    }) => {
        if (change.kind === "remove")
            return current.filter(d => d.id !== change.deviceId);
        if (change.kind === "move")
            return current.map(device => device.id === change.deviceId ? { ...device, startRU: change.startRU, mounting: change.mounting } : device);
        const d = change.device;
        // Revalidation can supply the saved placement before the transition finishes.
        return current.some(existing => existing.startRU === d.startRU && existing.mounting === d.mounting && existing.catalogDevice.model === d.catalogDevice.model) ? current : [...current, d];
    });
    const [context, setContext] = useState<{
        id?: string;
        ru: number;
        mounting: string;
        x: number;
        y: number;
    } | null>(null);
    const drawer = useRef<EquipmentDrawerHandle>(null);
    const pending = useRef(new Set<string>());
    const [pendingIds, setPendingIds] = useState<string[]>([]);
    const [message, setMessage] = useState<string | null>(null);
    const [isSaving, startSaving] = useTransition();
    const [active, setActive] = useState<DragItem | null>(null);
    const [nodeEdit, setNodeEdit] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [outletEdit, setOutletEdit] = useState<{
        id: string;
        outlet: Outlet;
    } | null>(null);
    const [focused, setFocused] = useState(false);
    const [detail, setDetail] = useState(true);
    const [threeD,setThreeD]=useState(false);
    const [zoom, setZoom] = useState(100);
    const [picked, setPicked] = useState<CatalogItem | null>(null);
    const [isRemoving, setIsRemoving] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const selected = optimisticDevices.find(device => device.id === selectedId);
    const [overMount, setOverMount] = useState("front");
    const [overRU, setOverRU] = useState<number | null>(null);
    const saving = useRef(false);
    // Ported from OneRack's 56px edge zone and 2–16px/frame scrolling.
    useEffect(() => {
        if (!active)
            return;
        let y: number | null = null;
        let frame = 0;
        let previous = 0;
        let stopped = false;
        const track = (event: PointerEvent) => { y = event.clientY; };
        const stop = () => { stopped = true; cancelAnimationFrame(frame); };
        const tick = (time: number) => {
            if (stopped)
                return;
            const elapsed = previous ? Math.min(32, time - previous) / (1000 / 60) : 1;
            previous = time;
            if (y !== null && y >= 0 && y <= window.innerHeight) {
                const edge = 56;
                const distance = y < edge ? y : window.innerHeight - y;
                if (distance < edge) {
                    const speed = 2 + 14 * (1 - distance / edge);
                    const scroller = document.querySelector(".canvas-focused");
                    if (scroller)
                        scroller.scrollBy(0, speed * elapsed * (y < edge ? -1 : 1));
                    else
                        window.scrollBy(0, speed * elapsed * (y < edge ? -1 : 1));
                }
            }
            frame = requestAnimationFrame(tick);
        };
        window.addEventListener("pointermove", track);
        window.addEventListener("pointerup", stop);
        window.addEventListener("pointercancel", stop);
        window.addEventListener("blur", stop);
        frame = requestAnimationFrame(tick);
        return () => { stop(); window.removeEventListener("pointermove", track); window.removeEventListener("pointerup", stop); window.removeEventListener("pointercancel", stop); window.removeEventListener("blur", stop); };
    }, [active]);
    function target(ru: number, item: DragItem, mounting = overMount) {
        const startRU = isPocket(heightRU, ru, config.pockets) ? ru : dropStartRU(ru, item.grabOffset);
        const error = mountingError(heightRU, startRU, item.heightRU, item.category, mounting, optimisticDevices.map(d => ({
            id: d.id, startRU: d.startRU, heightRU: d.catalogDevice.heightRU, mounting: d.mounting, name: d.label || d.catalogDevice.model,
        })), item.kind === "placed" ? item.id : undefined,config);
        return { startRU, heightRU: item.heightRU, error };
    }
    function handleDragStart(event: DragStartEvent) {
        const data = event.active.data.current;
        const placed = optimisticDevices.find(d => d.id === data?.deviceId);
        const item = catalog.find(d => d.id === data?.catalogDeviceId);
        const pointer = event.activatorEvent;
        // dnd-kit populates active.rect after onDragStart; measure the source now.
        const source = pointer.target instanceof Element ? pointer.target.closest("[data-device-block], [data-catalog-chip]") : null;
        const rect = source?.getBoundingClientRect() ?? event.active.rect.current.initial;
        if (!data || !rect || (!placed && !item) || saving.current || pending.current.has(String(data?.deviceId)))
            return;
        const grabOffset = placed && !isPocket(heightRU, placed.startRU, config.pockets) && pointer instanceof PointerEvent
            ? grabbedRowOffset(placed.catalogDevice.heightRU, pointer.clientY, rect.top, rect.height) : 0;
        setMessage(null);
        setOverRU(null);
        setActive({ id: placed?.id || String(event.active.id), kind: placed ? "placed" : "catalog",
            heightRU: data.heightRU, name: placed?.label || placed?.catalogDevice.model || item!.model,
            category: placed ? placed.catalogDevice.category : item!.category,
            width: rect.width, height: rect.height, grabOffset, catalogItem: item });
    }
    function handleDragEnd(event: DragEndEvent) {
        setActive(null);
        setOverRU(null);
        if (!active || !event.over || saving.current)
            return;
        if (active.kind === "catalog" && active.category === "chassis" && "shiftKey" in event.activatorEvent && event.activatorEvent.shiftKey && !isPocket(heightRU, Number(event.over.data.current?.ru),config.pockets)) {
            startSaving(async () => { try {
                const result = await fillRack(rackId, active.catalogItem!.id);
                setMessage(result.ok ? "Empty rack spans filled." : result.error);
            }
            catch {
                setMessage("Could not fill the rack.");
            } });
            return;
        }
        const destination = target(Number(event.over.data.current?.ru), active, event.over.data.current?.mounting);
        if (destination.error) {
            setMessage(destination.error);
            return;
        }
        if (active.kind === "placed" && devices.find(d => d.id === active.id)?.startRU === destination.startRU && devices.find(d => d.id === active.id)?.mounting === event.over.data.current?.mounting)
            return;
        const mounting = String(event.over.data.current?.mounting ?? "front");
        const pendingId = active.kind === "placed" ? active.id : `pending:${crypto.randomUUID()}`;
        pending.current.add(pendingId);
        setPendingIds([...pending.current]);
        startSaving(async () => {
            try {
                if (active.kind === "placed") {
                    applyChange({ kind: "move", deviceId: active.id, startRU: destination.startRU, mounting });
                    const result = await moveDevice(rackId, active.id, destination.startRU, mounting);
                    setMessage(result.ok ? `Saved at RU ${destination.startRU}.` : result.error);
                }
                else {
                    applyChange({ kind: "add", device: { id: pendingId, pending: true, startRU: destination.startRU, mounting, label: null, catalogDevice: active.catalogItem! } });
                    const form = new FormData();
                    form.set("catalogDeviceId", active.catalogItem!.id);
                    form.set("startRU", String(destination.startRU));
                    form.set("mounting", mounting);
                    const result = await placeDevice(rackId, null, form);
                    setMessage(result && "error" in result ? result.error : active.heightRU === 0 ? `Installed on ${mounting.replace("-", " ")} rail.` : `Placed on ${mounting} at RU ${destination.startRU}.`);
                }
            }
            catch {
                setMessage("Could not save this change. Please try again.");
            }
            finally {
                pending.current.delete(pendingId);
                setPendingIds([...pending.current]);
            }
        });
    }
    const displayedDevices = optimisticDevices.map(d => ({ ...d, pending: d.pending || pendingIds.includes(d.id) }));
    const selectDevice = (id: string) => { setSelectedId(id); drawer.current?.show(); };
    const requestRemoval = (id: string) => {
        if (saving.current || isSaving || active || !optimisticDevices.some(device => device.id === id)) return;
        saving.current = true;
        setIsRemoving(true);
        setContext(null);
        setMessage(null);
        startSaving(async () => {
            applyChange({ kind: "remove", deviceId: id });
            try {
                const result = await removeDevice(rackId, id);
                if (result.ok) {
                    setSelectedId(current => current === id ? null : current);
                    setMessage("Device and attached cables removed. Use Undo to restore them.");
                } else setMessage(result.error);
            } catch {
                setMessage("Couldn't remove the device. Please try again.");
            } finally {
                saving.current = false;
                setIsRemoving(false);
            }
        });
    };
    function clickPlace(ru: number, mounting: string, choice = picked) {
        if (!choice) {
            setMessage("Select equipment in the library, then click an empty position.");
            drawer.current?.show();
            return;
        }
        const error = mountingError(heightRU, ru, choice.heightRU, choice.category, mounting, optimisticDevices.map(d => ({ id: d.id, startRU: d.startRU, heightRU: d.catalogDevice.heightRU, mounting: d.mounting, name: d.label || d.catalogDevice.model })),undefined,config);
        if (error) {
            setMessage(error);
            return;
        }
        const item = choice;
        const pendingId = "pending:" + crypto.randomUUID();
        startSaving(async () => {
            applyChange({ kind: "add", device: { id: pendingId, pending: true, startRU: ru, mounting, label: null, catalogDevice: item } });
            const form = new FormData();
            form.set("catalogDeviceId", item.id);
            form.set("startRU", String(ru));
            form.set("mounting", mounting);
            try {
                const result = await placeDevice(rackId, null, form);
                setMessage(result && "error" in result ? result.error : "Placement saved.");
            }
            catch {
                setMessage("Could not save placement. Please try again.");
            }
        });
    }
    function historyAction(direction: -1 | 1) {
        if (isSaving || isRemoving || active)
            return;
        startSaving(async () => { try {
            const result = await undoRedoRack(rackId, direction);
            setMessage(result.ok ? (direction === -1 ? "Change undone." : "Change redone.") : result.error);
            setSelectedId(null);
        }
        catch {
            setMessage("Could not restore this change.");
        } });
    }
    const preview = active && overRU !== null ? target(overRU, active) : null;
    const contextDevice = devices.find(d=>d.id===context?.id);
    const fillChoice = picked || catalog.find(c=>c.id===contextDevice?.catalogDevice.id) || catalog.find(c=>c.id===config.defaultChassisId) || null;
    function fillSelectedRack() {
        if (!fillChoice || saving.current || isSaving || isRemoving) return;
        const mounting=context?.mounting === "rear" ? "rear" : "front";
        setContext(null);
        saving.current=true;
        startSaving(async()=>{
            try { const result=await fillRack(rackId,fillChoice.id,mounting); setMessage(result.ok ? `Added ${result.count} x ${fillChoice.model}. Existing equipment kept. Use Undo to reverse this fill.` : result.error); }
            catch {setMessage("Could not fill rack. Please try again.");}
            finally {saving.current=false;}
        });
    }
    const canvas = (<EquipmentDrawerScope ref={drawer}><RackTargetFeedback><div className={focused ? "canvas-focused" : undefined} onClick={() => setContext(null)} onKeyDown={event => {
            if (event.target instanceof HTMLElement && event.target.closest("input,textarea,select,[contenteditable=true]"))
                return;
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
                event.preventDefault();
                historyAction(event.shiftKey ? 1 : -1);
            }
            else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
                event.preventDefault();
                historyAction(1);
            }
            else if (event.key === "Escape") {
                setPicked(null);
                setSelectedId(null);
                setContext(null);
                setFocused(false);
            }
            else if ((event.key === "Delete" || event.key === "Backspace") && selectedId && !isSaving && !isRemoving) {
                event.preventDefault();
                requestRemoval(selectedId);
            }
        }}>
      <div className="mb-3 flex items-center justify-between gap-4"><div className="flex items-center gap-3"><EquipmentDrawerToggle disabled={!!active||threeD}/><h2 className="text-sm font-semibold">Rack Map</h2><button type="button" className="text-xs text-muted-foreground" onClick={() => setFocused(v => !v)}>{focused ? "Exit focus" : "Focus canvas"}</button></div><div className="canvas-zoom" style={threeD?{display:"none"}:undefined}><button type="button" disabled={!history.undo || isSaving || isRemoving || !!active} onClick={() => historyAction(-1)}>Undo</button><button type="button" disabled={!history.redo || isSaving || isRemoving || !!active} onClick={() => historyAction(1)}>Redo</button><button type="button" aria-label="Zoom out" onClick={() => setZoom(z => Math.max(40, z - 10))}>−</button><output>{zoom}%</output><button type="button" aria-label="Zoom in" onClick={() => setZoom(z => Math.min(200, z + 10))}>+</button><button type="button" onClick={() => { setZoom(100); setDetail(true); }}>Reset</button></div><div className="flex gap-2"><button type="button" aria-pressed={!detail&&!threeD} onClick={() => { setThreeD(false); setDetail(false); setZoom(40); }} className="rounded-md border border-border px-3 py-1 text-xs">Overview</button><button type="button" aria-pressed={detail&&!threeD} onClick={() => { setThreeD(false); setDetail(true); setZoom(100); }} className="rounded-md border border-border px-3 py-1 text-xs">Working size</button><button type="button" disabled={!!active} aria-pressed={threeD} onClick={()=>setThreeD(true)} className="rounded-md border border-border px-3 py-1 text-xs">3D overview</button></div></div>
    {threeD?<RackOverview3D heightRU={heightRU} config={config} devices={displayedDevices} onEdit={id=>{setThreeD(false);selectDevice(id);}}/>:<DndContext id="rack-workspace" sensors={sensors} collisionDetection={rackCollision} autoScroll={false} onDragStart={handleDragStart} onDragOver={event => { setOverRU(event.over ? Number(event.over.data.current?.ru) : null); setOverMount(String(event.over?.data.current?.mounting ?? "front")); }} onDragEnd={handleDragEnd} onDragCancel={() => { setActive(null); setOverRU(null); }}>
      <p role="status" aria-live="polite" className="mb-3 min-h-5 text-xs text-muted-foreground">
        {isSaving ? "Saving…" : preview ? (preview.error || (preview.heightRU === 0 ? `Release to install on ${overMount.replace("-", " ")}` : `Release to place at RU ${preview.startRU}–${preview.startRU + preview.heightRU - 1}`))
            : message || "Drag a chassis to move it. Drag empty rack space to scroll. Click a label for equipment controls or a port for its connection."}
      </p>
      <div className={`rack-workbench ${detail ? "rack-detail" : "rack-fit"}`}><EquipmentDrawer><CatalogPalette catalog={catalog} disabled={isRemoving} selectedId={picked?.id} onPick={item => { setPicked(item); setSelectedId(null); setMessage(`Selected ${item.model}. Click an empty rack position or drag to place.`); }}/>
        <div className="selected-equipment" aria-live="polite">
          {selected ? <><div className="flex items-start justify-between gap-2"><h3 className="text-sm font-medium">{selected.label || selected.catalogDevice.model}</h3><button type="button" aria-label="Close equipment controls" disabled={isRemoving} onClick={() => setSelectedId(null)} className="text-muted-foreground">×</button></div><p className="mt-2 text-xs text-muted-foreground">{selected.catalogDevice.heightRU === 0 ? selected.mounting.replace("-", " ") : `RU ${selected.startRU}–${selected.startRU + selected.catalogDevice.heightRU - 1} · ${selected.mounting}`}</p><p className="my-3 text-xs text-muted-foreground">{connectionCounts[selected.id] || 0} connected cables</p><DeviceControls key={`${selected.id}:${selected.startRU}:${selected.label}`} device={selected} rackId={rackId}/><RemoveDeviceButton name={selected.label || selected.catalogDevice.model} disabled={isSaving || isRemoving} onRemove={() => requestRemoval(selected.id)}/></> : <p className="text-xs text-muted-foreground">Drag equipment from the catalog to add it. Select a device on either rack face or a PDU rail to view its details and remove it.</p>}
        </div></EquipmentDrawer><section className="rack-face"><RackGrid config={config} heightRU={heightRU} zoom={zoom} onPlace={clickPlace} onContext={(id, x, y) => { const d = displayedDevices.find(v => v.id === id)!; setContext({ id, ru: d.startRU, mounting: d.mounting, x, y }); }} onSlotContext={(ru, mounting, x, y) => setContext({ ru, mounting, x, y })} onOutlet={(id, outlet) => setOutletEdit({ id, outlet })} onNode={(id, name) => setNodeEdit({ id, name })} devices={displayedDevices} draggingId={active?.kind === "placed" ? active.id : null} preview={overMount === "front" ? preview : null} disabled={isRemoving} onSelect={selectDevice} onRemove={isSaving ? undefined : requestRemoval} selectedId={selectedId}/></section><section className="rack-face"><RackGrid config={config} rear heightRU={heightRU} zoom={zoom} onPlace={clickPlace} onContext={(id, x, y) => { const d = displayedDevices.find(v => v.id === id)!; setContext({ id, ru: d.startRU, mounting: d.mounting, x, y }); }} onSlotContext={(ru, mounting, x, y) => setContext({ ru, mounting, x, y })} onOutlet={(id, outlet) => setOutletEdit({ id, outlet })} onNode={(id, name) => setNodeEdit({ id, name })} devices={displayedDevices} draggingId={active?.kind === "placed" ? active.id : null} preview={overMount === "rear" ? preview : null} disabled={isRemoving} onSelect={selectDevice} onRemove={isSaving ? undefined : requestRemoval} selectedId={selectedId}/></section></div>
      {active && createPortal(<DragOverlay dropAnimation={null} style={{ pointerEvents: "none", willChange: "transform", backfaceVisibility: "hidden" }}>
        {active && (active.catalogItem ? <CatalogChipBody item={active.catalogItem}/> :
                <div className="flex items-center justify-center rounded-sm border border-primary px-2 text-center text-xs text-white shadow-xl" style={{ width: active.width, height: active.height, backgroundColor: colorForCategory(active.category), opacity: 0.9 }}>
            {active.name}
          </div>)}
      </DragOverlay>, document.body)}
    {context && createPortal(<div role="menu" aria-label="Rack position actions" className="rack-context" style={{ left: Math.max(8, Math.min(context.x, window.innerWidth - 240)), top: Math.max(8, Math.min(context.y, window.innerHeight - 390)) }}>
      <p>U{context.ru} · {context.mounting}</p>
      {context.id ? <><button role="menuitem" onClick={() => selectDevice(context.id!)}>Edit equipment…</button><button role="menuitem" onClick={() => requestRemoval(context.id!)}>Remove equipment</button></> : <><button role="menuitem" onClick={() => clickPlace(context.ru, context.mounting)}>Place selected equipment</button><button role="menuitem" onClick={() => clickPlace(context.ru, context.mounting, catalog.find(c => c.model === "1U Blank Panel") || null)}>Add blank cover</button><button role="menuitem" onClick={() => clickPlace(context.ru, context.mounting, catalog.find(c => c.model === "Cable Manager 1U") || null)}>Add cable manager</button></>}
      <div className="border-t border-border pt-2 mt-2" onClick={e=>e.stopPropagation()}>
        <label className="block text-xs px-2" htmlFor="fill-rack-equipment">Equipment to repeat</label>
        <select id="fill-rack-equipment" className="w-full my-2 text-sm" value={fillChoice?.id || ""} disabled={isSaving || isRemoving} onChange={e=>setPicked(catalog.find(c=>c.id===e.target.value)||null)}>
          <option value="" disabled>Choose equipment...</option>
          {catalog.filter(c=>c.heightRU>0).map(c=><option key={c.id} value={c.id}>{c.model} · {c.heightRU}U</option>)}
        </select>
        <button role="menuitem" disabled={isSaving || isRemoving || !fillChoice || fillChoice.heightRU<1} onClick={fillSelectedRack}>Fill rack with selected equipment</button>
        <p className="text-xs px-2">Fills free space from bottom to top. Keeps installed equipment.</p>
      </div>
    </div>, document.body)}
    </DndContext>}
    {nodeEdit && displayedDevices.find(d => d.id === nodeEdit.id) && <NodeEditor rackId={rackId} device={displayedDevices.find(d => d.id === nodeEdit.id)!} nodeName={nodeEdit.name} onClose={() => setNodeEdit(null)}/>}
    {outletEdit && displayedDevices.find(d => d.id === outletEdit.id) && <OutletEditor key={`${outletEdit.id}:${outletEdit.outlet.n}`} rackId={rackId} pdu={displayedDevices.find(d => d.id === outletEdit.id)!} outlet={outletEdit.outlet} devices={displayedDevices} onClose={() => setOutletEdit(null)}/>}
    </div></RackTargetFeedback></EquipmentDrawerScope>);
    return focused ? createPortal(canvas, document.body) : canvas;
}

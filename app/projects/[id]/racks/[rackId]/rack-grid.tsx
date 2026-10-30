"use client";

import { useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { colorForCategory } from "./device-colors";

export type RackGridDevice = {
  id: string;
  pending?: boolean;
  startRU: number;
  mounting: string;
  label: string | null;
  catalogDevice: {
    model: string;
    vendor: string;
    heightRU: number;
    category: string | null;
  };
};

// Presentational: the DndContext lives in RackWorkspace, which owns the drag handling.
export function RackGrid({ heightRU, devices, preview, disabled = false, rear = false, onSelect, selectedId, onRemove, draggingId }: {
  heightRU: number; devices: RackGridDevice[]; disabled?: boolean;
  rear?: boolean;
  draggingId?: string | null;
  onSelect?: (id: string) => void;
  onRemove?: (id: string) => void;
  selectedId?: string | null;
  preview?: { startRU: number; heightRU: number; error: string | null } | null;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // 0U devices (PDUs, twin nodes) have no RU span to draw.
  const face = rear ? "rear" : "front";
  const placed = devices.filter((device) => device.catalogDevice.heightRU >= 1);

  const occupied = new Set<number>();
  for (const device of placed) {
    for (let ru = device.startRU; ru < device.startRU + device.catalogDevice.heightRU; ru++) {
      occupied.add(ru);
    }
  }

  // Grid rows run top to bottom, RUs run bottom to top: the top row is the highest RU.
  const rowFor = (ru: number) => heightRU - ru + 1;
  const ruSlots = Array.from({ length: heightRU }, (_, i) => heightRU - i);

  return (
    <div onPointerMove={event => { if (draggingId) return; const item = (event.target as Element).closest("[data-device-id]"); setHoveredId(item?.getAttribute("data-device-id") ?? null); }} onPointerLeave={() => setHoveredId(null)} className={`elevation-assembly ${rear ? "rear-assembly" : "front-assembly"}`}>
    {rear && <Rail side="rear-left" devices={devices} onSelect={disabled ? undefined : onSelect} selectedId={selectedId} onRemove={disabled ? undefined : onRemove} />}
    <div data-rack-scroll="" aria-label={rear ? "Rear rack map" : "Front rack map"} className={`rack-frame ${rear ? "rear-frame" : "front-frame"}`}>
      <div
        className="elevation-grid grid gap-x-2"
        style={{
          gridTemplateColumns: "2rem 1fr",
          gridTemplateRows: `repeat(${heightRU}, minmax(0, 1fr))`,
          minHeight: `${heightRU * 7}px`,
          height: `var(--rack-fit-height, ${heightRU * 34}px)`,
        }}
      >
        {ruSlots.map((ru) => (
          <span
            key={`label-${ru}`}
            className="flex items-center justify-end text-[10px] leading-none font-medium text-muted-foreground tabular-nums"
            style={{ gridColumn: 1, gridRow: rowFor(ru) }}
          >
            {ru}
          </span>
        ))}

        {ruSlots.map((ru) => (
          <RuSlot key={`slot-${ru}`} mounting={face} ru={ru} row={rowFor(ru)} isEmpty={!occupied.has(ru)} />
        ))}

        {placed.map((device) => {
          const topRU = device.startRU + device.catalogDevice.heightRU - 1;
          return device.mounting !== face ? <div key={device.id} data-device-id={device.id} className="rear-device" hidden={draggingId === device.id} data-selected={selectedId === device.id} role={onSelect ? "button" : undefined} tabIndex={onSelect && !disabled ? 0 : undefined} onClick={() => { if (!disabled) onSelect?.(device.id); }} onKeyDown={event => { if (!disabled && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelect?.(device.id); } }} title={`${device.label || device.catalogDevice.model} · Opposite-face footprint · RU ${device.startRU}–${topRU}`} style={{ gridColumn: 2, gridRow: `${rowFor(topRU)} / span ${device.catalogDevice.heightRU}` }}><span>{device.label || device.catalogDevice.model}</span>{device.catalogDevice.heightRU >= 4 && <small>RU {device.startRU}–{topRU}</small>}</div> : <DeviceBlock key={device.id} device={device} row={rowFor(topRU)} disabled={disabled || !!device.pending} onSelect={onSelect} selectedId={selectedId} />;
        })}
        {onRemove && placed.filter(device => device.id !== draggingId).map(device => <div key={`remove-${device.id}`} className="device-remove-layer" data-device-id={device.id} data-hovered={hoveredId === device.id} style={{gridColumn:2,gridRow:`${rowFor(device.startRU + device.catalogDevice.heightRU - 1)} / span ${device.catalogDevice.heightRU}`}}><button type="button" className="device-remove-dot" disabled={disabled || device.pending} aria-label={`Remove ${device.label || device.catalogDevice.model} at RU ${device.startRU} from rack`} title="Remove from rack (both views)" onPointerDown={event=>event.stopPropagation()} onClick={()=>onRemove(device.id)}>×</button></div>)}
        {preview && preview.startRU >= 1 && preview.startRU + preview.heightRU - 1 <= heightRU && (
          <div data-placement-preview className={`pointer-events-none z-30 flex items-center justify-center rounded-sm border-2 text-center text-[10px] font-semibold shadow-lg  ${preview.error ? "border-red-400 bg-red-950 text-red-100" : "border-primary bg-primary/10 text-primary"}`}
            style={{ gridColumn: 2, gridRow: `${rowFor(preview.startRU + preview.heightRU - 1)} / span ${preview.heightRU}` }}>
            {preview.error ? "Blocked · " : "Place · "}RU {preview.startRU}–{preview.startRU + preview.heightRU - 1}
          </div>
        )}
      </div>
    </div>
    {rear && <Rail side="rear-right" devices={devices} onSelect={disabled ? undefined : onSelect} selectedId={selectedId} onRemove={disabled ? undefined : onRemove} />}
    </div>
  );
}

function Rail({ side, devices, onSelect, selectedId, onRemove }: { side: string; devices: RackGridDevice[]; onSelect?: (id: string) => void; selectedId?: string | null; onRemove?: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: side, data: { ru: 1, mounting: side } });
  const pdu = devices.find(d => d.mounting === side && d.catalogDevice.heightRU === 0);
  return <div ref={setNodeRef} data-mounting={side} data-selected={pdu?.id === selectedId} role={pdu && onSelect ? "button" : undefined} tabIndex={pdu && onSelect ? 0 : undefined} onClick={() => { if (pdu) onSelect?.(pdu.id); }} onKeyDown={event => { if (pdu && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelect?.(pdu.id); } }} className={`pdu-rail ${pdu ? "rail-installed" : ""} ${isOver ? "rail-over" : ""}`} title={pdu ? pdu.label || pdu.catalogDevice.model : side.replace("-", " ") + " · Drop vertical PDU"}><>{pdu && onRemove && <button type="button" className="device-remove-dot" disabled={pdu.pending} aria-label={`Remove ${pdu.label || pdu.catalogDevice.model} from ${side}`} onPointerDown={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();onRemove(pdu.id);}}>×</button>}<span>{pdu ? pdu.label || pdu.catalogDevice.model : side === "rear-left" ? "LEFT · 0U PDU" : "RIGHT · 0U PDU"}</span></></div>;
}

function RuSlot({ ru, row, isEmpty, mounting }: { ru: number; row: number; isEmpty: boolean; mounting: string }) {
  const { setNodeRef } = useDroppable({ id: `${mounting}-ru-${ru}`, data: { ru, mounting } });

  return (
    <div
      ref={setNodeRef}
      data-rack-ru={ru}
      className={[
        isEmpty && "border-b border-dashed border-border bg-background/60",
        // Raised above device blocks so the highlight shows on occupied RUs too.
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ gridColumn: 2, gridRow: row }}
    />
  );
}

function DeviceBlock({ device, row, disabled, onSelect, selectedId }: { device: RackGridDevice; row: number; disabled: boolean; onSelect?: (id: string) => void; selectedId?: string | null }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: device.id,
    disabled,
    data: { kind: "placed", mounting: device.mounting, startRU: device.startRU, heightRU: device.catalogDevice.heightRU },
  });

  const topRU = device.startRU + device.catalogDevice.heightRU - 1;
  const name = device.label || device.catalogDevice.model;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-device-id={device.id}
      data-device-block
      data-selected={selectedId === device.id}
      onClick={() => { if (!disabled && !isDragging) onSelect?.(device.id); }}
      onKeyDown={event => { if (!disabled && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelect?.(device.id); } }}
      title={`${name} — ${device.catalogDevice.vendor} ${device.catalogDevice.model} (RU ${device.startRU}–${topRU})`}
      className={[
        "rack-device m-px flex cursor-grab touch-none flex-col items-center justify-center overflow-hidden rounded-sm border border-white/10 px-2 text-center text-xs leading-tight font-medium text-zinc-100",
        "transition-opacity duration-150 motion-reduce:transition-none",
        isDragging && "invisible",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        gridColumn: 2,
        gridRow: `${row} / span ${device.catalogDevice.heightRU}`,
        backgroundColor: colorForCategory(device.catalogDevice.category),
      }}
    >
      <span className="w-full truncate">{name}</span>
      {/* 1U blocks only have room for the name. */}
      {device.catalogDevice.heightRU >= 2 && (
        <span className="w-full truncate text-[10px] font-normal text-zinc-100/70 tabular-nums">
          RU {device.startRU}–{topRU}
        </span>
      )}
    </div>
  );
}

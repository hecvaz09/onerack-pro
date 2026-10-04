"use client";

import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { startTransition, useOptimistic, useState } from "react";
import { moveDevice } from "./actions";

type RackGridDevice = {
  id: string;
  startRU: number;
  label: string | null;
  catalogDevice: {
    model: string;
    vendor: string;
    heightRU: number;
    category: string | null;
  };
};

const CATEGORY_COLORS: Record<string, string> = {
  chassis: "#00d4f5",
  switch: "#f59e0b",
  accessory: "#8888cc",
};
const FALLBACK_COLOR = "#d4d4d8";

const ROW_HEIGHT = "1.75rem"; // h-7

export function RackGrid({
  rackId,
  heightRU,
  devices,
}: {
  rackId: string;
  heightRU: number;
  devices: RackGridDevice[];
}) {
  // A small activation distance keeps a click from starting a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Moves show instantly; if the server rejects one, React drops it when the transition ends.
  const [optimisticDevices, applyMove] = useOptimistic(
    devices,
    (current, move: { deviceId: string; startRU: number }) =>
      current.map((device) =>
        device.id === move.deviceId ? { ...device, startRU: move.startRU } : device,
      ),
  );
  const [moveError, setMoveError] = useState<string | null>(null);

  // 0U devices (PDUs, twin nodes) have no RU span to draw.
  const placed = optimisticDevices.filter((device) => device.catalogDevice.heightRU >= 1);

  const occupied = new Set<number>();
  for (const device of placed) {
    for (let ru = device.startRU; ru < device.startRU + device.catalogDevice.heightRU; ru++) {
      occupied.add(ru);
    }
  }

  // Grid rows run top to bottom, RUs run bottom to top: the top row is the highest RU.
  const rowFor = (ru: number) => heightRU - ru + 1;
  const ruSlots = Array.from({ length: heightRU }, (_, i) => heightRU - i);

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over) return;
    const deviceId = String(event.active.id);
    const fromStartRU = event.active.data.current?.startRU;
    const toRU = Number(String(event.over.id).replace("ru-", ""));
    if (toRU === fromStartRU) return;

    startTransition(async () => {
      applyMove({ deviceId, startRU: toRU });
      const result = await moveDevice(rackId, deviceId, toRU);
      setMoveError(result.ok ? null : result.error);
    });
  }

  return (
    <DndContext
      id="rack-grid"
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragEnd={handleDragEnd}
    >
      {moveError && (
        <p role="alert" className="mb-2 text-sm text-destructive">
          {moveError}
        </p>
      )}

      <div className="w-full max-w-sm rounded-lg border-2 border-border bg-muted/40 p-2">
        <div
          className="grid gap-x-2"
          style={{
            gridTemplateColumns: "2rem 1fr",
            gridTemplateRows: `repeat(${heightRU}, ${ROW_HEIGHT})`,
          }}
        >
          {ruSlots.map((ru) => (
            <span
              key={`label-${ru}`}
              className="flex items-center justify-end text-xs text-muted-foreground tabular-nums"
              style={{ gridColumn: 1, gridRow: rowFor(ru) }}
            >
              {ru}
            </span>
          ))}

          {ruSlots.map((ru) => (
            <RuSlot key={`slot-${ru}`} ru={ru} row={rowFor(ru)} isEmpty={!occupied.has(ru)} />
          ))}

          {placed.map((device) => {
            const topRU = device.startRU + device.catalogDevice.heightRU - 1;
            return <DeviceBlock key={device.id} device={device} row={rowFor(topRU)} />;
          })}
        </div>
      </div>
    </DndContext>
  );
}

function RuSlot({ ru, row, isEmpty }: { ru: number; row: number; isEmpty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `ru-${ru}` });

  return (
    <div
      ref={setNodeRef}
      className={[
        isEmpty && "border-b border-dashed border-border bg-background/60",
        // Raised above device blocks so the highlight shows on occupied RUs too.
        isOver && "pointer-events-none z-10 bg-primary/15 ring-2 ring-primary ring-inset",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ gridColumn: 2, gridRow: row }}
    />
  );
}

function DeviceBlock({ device, row }: { device: RackGridDevice; row: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: device.id,
    data: { startRU: device.startRU },
  });

  const topRU = device.startRU + device.catalogDevice.heightRU - 1;
  const name = device.label || device.catalogDevice.model;
  const color = CATEGORY_COLORS[device.catalogDevice.category ?? ""] ?? FALLBACK_COLOR;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={`${name} — ${device.catalogDevice.vendor} ${device.catalogDevice.model} (RU ${device.startRU}–${topRU})`}
      className={[
        "m-px flex cursor-grab touch-none items-center justify-center overflow-hidden rounded-sm border border-black/20 px-2 text-xs font-medium text-neutral-900",
        isDragging && "relative z-20 cursor-grabbing opacity-70 shadow-lg",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        gridColumn: 2,
        gridRow: `${row} / span ${device.catalogDevice.heightRU}`,
        backgroundColor: color,
        transform: CSS.Translate.toString(transform),
      }}
    >
      <span className="truncate">{name}</span>
    </div>
  );
}

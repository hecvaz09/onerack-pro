"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { colorForCategory } from "./device-colors";

export type RackGridDevice = {
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

const ROW_HEIGHT = "1.375rem"; // 22px: a 48U rack fits with less scrolling

// Presentational: the DndContext lives in RackWorkspace, which owns the drag handling.
export function RackGrid({ heightRU, devices }: { heightRU: number; devices: RackGridDevice[] }) {
  // 0U devices (PDUs, twin nodes) have no RU span to draw.
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
            className="flex items-center justify-end text-[11px] leading-none font-medium text-muted-foreground tabular-nums"
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
    data: { kind: "placed", startRU: device.startRU, heightRU: device.catalogDevice.heightRU },
  });

  const topRU = device.startRU + device.catalogDevice.heightRU - 1;
  const name = device.label || device.catalogDevice.model;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-device-block
      title={`${name} — ${device.catalogDevice.vendor} ${device.catalogDevice.model} (RU ${device.startRU}–${topRU})`}
      className={[
        "m-px flex cursor-grab touch-none flex-col items-center justify-center overflow-hidden rounded-sm border border-black/20 px-2 text-center text-xs leading-tight font-medium text-neutral-900",
        isDragging && "relative z-20 cursor-grabbing opacity-70 shadow-lg",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        gridColumn: 2,
        gridRow: `${row} / span ${device.catalogDevice.heightRU}`,
        backgroundColor: colorForCategory(device.catalogDevice.category),
        transform: CSS.Translate.toString(transform),
      }}
    >
      <span className="w-full truncate">{name}</span>
      {/* 1U blocks only have room for the name. */}
      {device.catalogDevice.heightRU >= 2 && (
        <span className="w-full truncate text-[10px] font-normal text-neutral-900/70 tabular-nums">
          RU {device.startRU}–{topRU}
        </span>
      )}
    </div>
  );
}

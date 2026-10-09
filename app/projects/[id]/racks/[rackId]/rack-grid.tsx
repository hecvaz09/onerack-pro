"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { borderForCategory, colorForCategory } from "./device-colors";

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
export type RackGridPreview = {
  startRU: number;
  heightRU: number;
  category: string | null;
  valid: boolean;
};

export type RackFace = "front" | "rear";

export function RackGrid({
  heightRU,
  devices,
  onRemove,
  preview,
  face = "front",
}: {
  heightRU: number;
  devices: RackGridDevice[];
  onRemove: (deviceId: string) => void;
  preview: RackGridPreview | null;
  face?: RackFace;
}) {
  // Placeholder rear view: mirror the layout by moving the RU labels to the other side.
  // Swapping columns (rather than a CSS flip) keeps text readable and leaves the drag
  // math, which is vertical only, untouched.
  const isRear = face === "rear";
  const labelColumn = isRear ? 2 : 1;
  const deviceColumn = isRear ? 1 : 2;

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
    <div className="w-full max-w-sm rounded-lg border border-border bg-muted/50 p-2">
      <div
        className="grid gap-x-2"
        style={{
          gridTemplateColumns: isRear ? "1fr 2rem" : "2rem 1fr",
          gridTemplateRows: `repeat(${heightRU}, ${ROW_HEIGHT})`,
        }}
      >
        {ruSlots.map((ru) => (
          <span
            key={`label-${ru}`}
            className={`flex items-center text-[11px] leading-none font-medium text-muted-foreground tabular-nums ${
              isRear ? "justify-start" : "justify-end"
            }`}
            style={{ gridColumn: labelColumn, gridRow: rowFor(ru) }}
          >
            {ru}
          </span>
        ))}

        {ruSlots.map((ru) => (
          <RuSlot
            key={`slot-${ru}`}
            ru={ru}
            row={rowFor(ru)}
            column={deviceColumn}
            isEmpty={!occupied.has(ru)}
          />
        ))}

        {placed.map((device) => {
          const topRU = device.startRU + device.catalogDevice.heightRU - 1;
          return (
            <DeviceBlock
              key={device.id}
              device={device}
              row={rowFor(topRU)}
              column={deviceColumn}
              onRemove={() => onRemove(device.id)}
            />
          );
        })}

        {preview && (
          <FootprintPreview
            preview={preview}
            rackHeightRU={heightRU}
            rowFor={rowFor}
            column={deviceColumn}
          />
        )}
      </div>
    </div>
  );
}

// Each RU is a drop target; the footprint preview, not the slot, shows where a drop lands.
function RuSlot({
  ru,
  row,
  column,
  isEmpty,
}: {
  ru: number;
  row: number;
  column: number;
  isEmpty: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: `ru-${ru}` });

  return (
    <div
      ref={setNodeRef}
      className={isEmpty ? "border-b border-dashed border-border bg-background/60" : undefined}
      style={{ gridColumn: column, gridRow: row }}
    />
  );
}

// The RUs the dragged device would occupy: in its own category colors if it fits, red if
// it doesn't.
function FootprintPreview({
  preview,
  rackHeightRU,
  rowFor,
  column,
}: {
  preview: RackGridPreview;
  rackHeightRU: number;
  rowFor: (ru: number) => number;
  column: number;
}) {
  // A device too tall for the spot would run past the top of the rack; draw only the part
  // inside the rack so the grid never grows extra rows (it's red either way).
  const topRU = Math.min(preview.startRU + preview.heightRU - 1, rackHeightRU);
  const span = topRU - preview.startRU + 1;
  if (span < 1) return null;

  // The category fills are deep tints that barely show as a thin dashed line on the dark
  // card, so a valid footprint is outlined in the category's lighter hairline color and
  // filled with its tint at 50%.
  const borderColor = preview.valid ? borderForCategory(preview.category) : "#f87171";
  const fillColor = preview.valid ? colorForCategory(preview.category) : "#f87171";
  const fillPercent = preview.valid ? 50 : 15;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none z-[5] m-px rounded-sm border-2 border-dashed"
      style={{
        gridColumn: column,
        gridRow: `${rowFor(topRU)} / span ${span}`,
        borderColor,
        backgroundColor: `color-mix(in srgb, ${fillColor} ${fillPercent}%, transparent)`,
      }}
    />
  );
}

function DeviceBlock({
  device,
  row,
  column,
  onRemove,
}: {
  device: RackGridDevice;
  row: number;
  column: number;
  onRemove: () => void;
}) {
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
        "group relative m-px flex cursor-grab touch-none flex-col items-center justify-center overflow-hidden rounded-sm border px-2 text-center text-xs leading-tight font-medium text-zinc-100",
        isDragging && "relative z-20 cursor-grabbing opacity-70 shadow-lg",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        gridColumn: column,
        gridRow: `${row} / span ${device.catalogDevice.heightRU}`,
        backgroundColor: colorForCategory(device.catalogDevice.category),
        borderColor: borderForCategory(device.catalogDevice.category),
        transform: CSS.Translate.toString(transform),
      }}
    >
      <span className="w-full truncate">{name}</span>
      {/* 1U blocks only have room for the name. */}
      {device.catalogDevice.heightRU >= 2 && (
        <span className="w-full truncate text-[10px] font-normal text-zinc-100/70 tabular-nums">
          RU {device.startRU}–{topRU}
        </span>
      )}

      {!isDragging && (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          title={`Remove ${name}`}
          // The block's drag listeners are React handlers on the parent, so stopping the
          // pointerdown here keeps dnd-kit from ever seeing it: a click on ✕ deletes
          // instead of grabbing the block. Keydown is stopped for the same reason.
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="absolute top-0.5 right-0.5 flex size-3.5 cursor-pointer items-center justify-center rounded-sm text-[10px] leading-none text-zinc-100/80 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/30 hover:text-white focus-visible:opacity-100"
        >
          ✕
        </button>
      )}
    </div>
  );
}

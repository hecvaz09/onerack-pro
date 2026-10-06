"use client";

import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { startTransition, useOptimistic, useRef, useState, useTransition } from "react";
import { moveDevice, placeDevice, removeDevice } from "./actions";
import { CatalogPalette, type CatalogItem } from "./catalog-palette";
import { RackGrid, type RackGridDevice } from "./rack-grid";

// Where the dragged device would land if dropped now: the hovered slot, adjusted by the
// grab offset for moves. movingId is the device being moved (null for catalog drags).
type DropPreview = { startRU: number; heightRU: number; movingId: string | null };

export function RackWorkspace({
  rackId,
  heightRU,
  devices,
  catalog,
}: {
  rackId: string;
  heightRU: number;
  devices: RackGridDevice[];
  catalog: CatalogItem[];
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
  // One message line for both moves and placements; cleared by the next success.
  const [actionError, setActionError] = useState<string | null>(null);
  // New devices wait for the server, so show that a placement is in flight.
  const [isPlacing, startPlacing] = useTransition();
  // How many RUs above its bottom RU a placed device was grabbed, so it lands under the pointer.
  const grabOffsetRef = useRef(0);
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);

  // Mirrors the server's fit and overlap rules, only to color the preview; the server
  // still validates the actual move or placement.
  const previewValid = (() => {
    if (!dropPreview) return false;
    const { startRU, heightRU: height, movingId } = dropPreview;
    const endRU = startRU + height - 1;
    if (startRU < 1 || endRU > heightRU) return false;
    return !optimisticDevices.some((device) => {
      if (device.id === movingId || device.catalogDevice.heightRU < 1) return false;
      const deviceEnd = device.startRU + device.catalogDevice.heightRU - 1;
      return startRU <= deviceEnd && device.startRU <= endRU;
    });
  })();

  function handleDragOver(event: DragOverEvent) {
    const data = event.active.data.current;
    if (!event.over || !data) {
      setDropPreview(null);
      return;
    }
    const toRU = Number(String(event.over.id).replace("ru-", ""));
    // Same landing rule as handleDragEnd, so the preview shows exactly where it will drop.
    setDropPreview(
      data.kind === "placed"
        ? {
            startRU: Math.max(1, toRU - grabOffsetRef.current),
            heightRU: data.heightRU,
            movingId: String(event.active.id),
          }
        : { startRU: toRU, heightRU: data.heightRU, movingId: null },
    );
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    grabOffsetRef.current = data?.kind === "placed" ? measureGrabOffset(event, data.heightRU) : 0;
  }

  function handleDragEnd(event: DragEndEvent) {
    setDropPreview(null);
    if (!event.over) return;

    const data = event.active.data.current;
    const toRU = Number(String(event.over.id).replace("ru-", ""));

    if (data?.kind === "placed") {
      const deviceId = String(event.active.id);
      // A drop too low to fit the grabbed offset means "put it at the bottom".
      const toStartRU = Math.max(1, toRU - grabOffsetRef.current);
      if (toStartRU === data.startRU) return;

      startTransition(async () => {
        applyMove({ deviceId, startRU: toStartRU });
        const result = await moveDevice(rackId, deviceId, toStartRU);
        setActionError(result.ok ? null : result.error);
      });
    } else if (data?.kind === "catalog") {
      const formData = new FormData();
      formData.set("catalogDeviceId", data.catalogDeviceId);
      formData.set("startRU", String(toRU));

      startPlacing(async () => {
        const result = await placeDevice(rackId, null, formData);
        setActionError(result && "error" in result ? result.error : null);
      });
    }
  }

  function handleRemove(deviceId: string) {
    startTransition(async () => {
      const result = await removeDevice(deviceId, rackId);
      setActionError(result.ok ? null : result.error);
    });
  }

  return (
    <DndContext
      id="rack-workspace"
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDropPreview(null)}
    >
      {actionError && (
        <p role="alert" className="mb-2 text-sm text-destructive">
          {actionError}
        </p>
      )}
      {isPlacing && <p className="mb-2 text-sm text-muted-foreground">Placing device…</p>}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <CatalogPalette catalog={catalog} />
        <RackGrid
          heightRU={heightRU}
          devices={optimisticDevices}
          onRemove={handleRemove}
          preview={dropPreview && { ...dropPreview, valid: previewValid }}
        />
      </div>
    </DndContext>
  );
}

// Reads where on the block the pointer went down. Measured at drag start, before the
// block moves; falls back to 0 (pointer = bottom RU) if the geometry isn't available.
function measureGrabOffset(event: DragStartEvent, heightRU: number) {
  const pointer = event.activatorEvent;
  if (!(pointer instanceof PointerEvent) || !(pointer.target instanceof Element)) return 0;

  const block = pointer.target.closest("[data-device-block]");
  const rect = block?.getBoundingClientRect();
  if (!rect || rect.height === 0 || heightRU < 1) return 0;

  // Screen y grows downward but RUs grow upward: row 0 from the top is the highest RU.
  const rowHeight = rect.height / heightRU;
  const rowFromTop = Math.min(
    heightRU - 1,
    Math.max(0, Math.floor((pointer.clientY - rect.top) / rowHeight)),
  );
  return heightRU - 1 - rowFromTop;
}

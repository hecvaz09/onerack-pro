"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { startTransition, useOptimistic, useState, useTransition } from "react";
import { moveDevice, placeDevice } from "./actions";
import { CatalogChipBody, CatalogPalette, type CatalogItem } from "./catalog-palette";
import { RackGrid, type RackGridDevice } from "./rack-grid";

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
  const [activeCatalogItem, setActiveCatalogItem] = useState<CatalogItem | null>(null);

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    setActiveCatalogItem(
      data?.kind === "catalog"
        ? (catalog.find((item) => item.id === data.catalogDeviceId) ?? null)
        : null,
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCatalogItem(null);
    if (!event.over) return;

    const data = event.active.data.current;
    const toRU = Number(String(event.over.id).replace("ru-", ""));

    if (data?.kind === "placed") {
      const deviceId = String(event.active.id);
      if (toRU === data.startRU) return;

      startTransition(async () => {
        applyMove({ deviceId, startRU: toRU });
        const result = await moveDevice(rackId, deviceId, toRU);
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

  return (
    <DndContext
      id="rack-workspace"
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveCatalogItem(null)}
    >
      {actionError && (
        <p role="alert" className="mb-2 text-sm text-destructive">
          {actionError}
        </p>
      )}
      {isPlacing && <p className="mb-2 text-sm text-muted-foreground">Placing device…</p>}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <CatalogPalette catalog={catalog} />
        <RackGrid heightRU={heightRU} devices={optimisticDevices} />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCatalogItem && (
          <div className="w-56 shadow-lg">
            <CatalogChipBody item={activeCatalogItem} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

"use client";

import { useDraggable } from "@dnd-kit/core";
import { borderForCategory, colorForCategory } from "./device-colors";

export type CatalogItem = {
  id: string;
  vendor: string;
  model: string;
  heightRU: number;
  category: string | null;
};

export function CatalogPalette({ catalog }: { catalog: CatalogItem[] }) {
  return (
    <div className="flex w-full shrink-0 flex-col sm:w-56">
      <h3 className="mb-2 text-xs font-medium text-muted-foreground">Catalog</h3>
      {catalog.length === 0 ? (
        <p className="text-sm text-muted-foreground">No placeable devices in the catalog.</p>
      ) : (
        <ul className="flex max-h-96 flex-col gap-1.5 overflow-y-auto pr-1">
          {catalog.map((item) => (
            <li key={item.id}>
              <CatalogChip item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CatalogChip({ item }: { item: CatalogItem }) {
  // The chip stays put; RackWorkspace's DragOverlay draws the copy that follows the
  // pointer, so it isn't clipped by this list's scroll container.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `catalog-${item.id}`,
    data: { kind: "catalog", catalogDeviceId: item.id, heightRU: item.heightRU },
  });

  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? "opacity-40" : undefined}>
      <CatalogChipBody item={item} />
    </div>
  );
}

export function CatalogChipBody({ item }: { item: CatalogItem }) {
  return (
    <div
      title={`${item.vendor} — ${item.model} (${item.heightRU}U)`}
      className="cursor-grab touch-none truncate rounded-md border px-2.5 py-1.5 text-xs font-medium text-zinc-100 shadow-xs transition-shadow hover:shadow-sm"
      style={{
        backgroundColor: colorForCategory(item.category),
        borderColor: borderForCategory(item.category),
      }}
    >
      {item.vendor} — {item.model} ({item.heightRU}U)
    </div>
  );
}

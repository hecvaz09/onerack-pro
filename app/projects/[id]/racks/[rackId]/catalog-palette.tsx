"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Search, GripVertical, Server } from "lucide-react";

export type CatalogItem = { id: string; vendor: string; model: string; heightRU: number; category: string | null };

export function CatalogPalette({ catalog, disabled = false, onPick, selectedId }: { catalog: CatalogItem[]; disabled?: boolean; onPick?: (item:CatalogItem)=>void; selectedId?:string }) {
  const [query, setQuery] = useState("");
  const items = catalog.filter(item => `${item.vendor} ${item.model} ${item.heightRU}U`.toLowerCase().includes(query.toLowerCase()));
  return <div className="equipment-library">
    <div className="library-title"><h3>Equipment library</h3><span>{catalog.length}</span></div>
    <label className="catalog-search"><Search size={14}/><input aria-label="Search equipment" placeholder="Search equipment…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <p className="library-instruction">Drag equipment into the rack</p>
    <ul className="catalog-list">{items.map(item=><li key={item.id}><CatalogChip item={item} disabled={disabled} onPick={onPick} selected={selectedId===item.id}/></li>)}</ul>
    {items.length === 0 && <p className="library-instruction">No matching equipment.</p>}
  </div>;
}

function CatalogChip({ item, disabled, onPick, selected }: { item: CatalogItem; disabled: boolean; onPick?: (item:CatalogItem)=>void; selected?:boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `catalog-${item.id}`, disabled, data: { kind: "catalog", catalogDeviceId: item.id, heightRU: item.heightRU } });
  return <div onClick={()=>!disabled && onPick?.(item)} onKeyDown={e=>{if(!disabled && (e.key==="Enter" || e.key===" ")){e.preventDefault();onPick?.(item);}}} data-selected={selected} data-catalog-chip ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? "opacity-40" : undefined}><CatalogChipBody item={item}/></div>;
}

export function CatalogChipBody({ item }: { item: CatalogItem }) {
  return <div title={`${item.vendor} — ${item.model} (${item.heightRU}U)`} className="catalog-item">
    <span className="catalog-icon"><Server size={16} strokeWidth={1.5}/></span>
    <div className="catalog-item-copy"><span className="catalog-vendor">{item.vendor}</span><span className="catalog-model">{item.model}</span><span className="catalog-unit">{item.heightRU}U</span></div>
    <GripVertical size={13} className="catalog-grip"/>
  </div>;
}

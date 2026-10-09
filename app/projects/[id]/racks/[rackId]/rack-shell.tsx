"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemePicker } from "@/app/theme-picker";
import { type CatalogItem } from "./catalog-palette";
import { ConnectionsPanel, type ConnectionDevice, type ConnectionRow } from "./connections-panel";
import { PlaceDeviceForm } from "./place-device-form";
import { type RackFace, type RackGridDevice } from "./rack-grid";
import { RackWorkspace } from "./rack-workspace";
import { RemoveDeviceButton } from "./remove-device-button";
import { cardClassName, listRowClassName, sectionLabelClassName } from "./styles";

export type PlacedDeviceRow = {
  id: string;
  name: string;
  vendorModel: string;
  startRU: number;
  endRU: number;
};

type Tab = "elevation" | "connections";

const frostedBarClassName = "rounded-xl border border-border/60 bg-card backdrop-blur-md";

export function RackShell({
  projectId,
  projectName,
  rackId,
  rackName,
  heightRU,
  deviceCount,
  occupiedRU,
  devices,
  catalog,
  placedRows,
  connectionDevices,
  connections,
  matrixHref,
}: {
  projectId: string;
  projectName: string;
  rackId: string;
  rackName: string;
  heightRU: number;
  deviceCount: number;
  occupiedRU: number;
  devices: RackGridDevice[];
  catalog: CatalogItem[];
  placedRows: PlacedDeviceRow[];
  connectionDevices: ConnectionDevice[];
  connections: ConnectionRow[];
  matrixHref: string;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("elevation");
  const [face, setFace] = useState<RackFace>("front");
  const [showPlaceForm, setShowPlaceForm] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      {/* Window chrome */}
      <div className={`${frostedBarClassName} grid grid-cols-[1fr_auto_1fr] items-center px-4 py-2.5`}>
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
        </span>
        <span className="truncate text-xs font-medium text-muted-foreground">
          {projectName} · Rack planner
        </span>
        <button
          type="button"
          aria-expanded={showThemePicker}
          onClick={() => setShowThemePicker((open) => !open)}
          className="justify-self-end rounded-md px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Theme
        </button>
      </div>
      {showThemePicker && (
        <div className={`${frostedBarClassName} mt-2 px-4 py-2.5`}>
          <ThemePicker />
        </div>
      )}

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/projects" className="transition-colors hover:text-foreground">
          Projects
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={`/projects/${projectId}`} className="transition-colors hover:text-foreground">
          {projectName}
        </Link>
        <span aria-hidden="true">/</span>
        <span>Racks</span>
      </nav>

      {/* Header */}
      <header className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-baseline gap-3 text-3xl font-semibold tracking-tight">
            {rackName}
            <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-sm font-medium text-muted-foreground">
              {heightRU}U
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {deviceCount} {deviceCount === 1 ? "device" : "devices"} · {occupiedRU} of {heightRU}U
            occupied
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          className="px-4"
          aria-expanded={showPlaceForm}
          onClick={() => setShowPlaceForm((open) => !open)}
        >
          {showPlaceForm ? "Close" : "Place device"}
        </Button>
      </header>

      {showPlaceForm && (
        <section className={`${cardClassName} mt-6`}>
          <h2 className={`${sectionLabelClassName} mb-4`}>Place a device</h2>
          <PlaceDeviceForm rackId={rackId} rackHeightRU={heightRU} catalog={catalog} />
        </section>
      )}

      {/* Tabs */}
      <div role="tablist" aria-label="Rack views" className="mt-8 flex gap-6 border-b border-border">
        <TabButton active={activeTab === "elevation"} onClick={() => setActiveTab("elevation")}>
          Elevation
        </TabButton>
        <TabButton active={activeTab === "connections"} onClick={() => setActiveTab("connections")}>
          Connections
        </TabButton>
      </div>

      <div className="mt-6 space-y-8">
        {activeTab === "elevation" ? (
          <>
            <section className={cardClassName}>
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className={sectionLabelClassName}>{face === "front" ? "Front" : "Rear"} view</h2>
                <div className="flex rounded-full border border-border bg-muted/40 p-0.5">
                  {(["front", "rear"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={face === value}
                      onClick={() => setFace(value)}
                      className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                        face === value
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <RackWorkspace
                rackId={rackId}
                heightRU={heightRU}
                devices={devices}
                catalog={catalog}
                face={face}
              />
            </section>

            <section className={cardClassName}>
              <h2 className={`${sectionLabelClassName} mb-4`}>Placed devices</h2>
              {placedRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No devices placed yet.</p>
              ) : (
                <ul className="-mx-3 space-y-0.5">
                  {placedRows.map((row) => (
                    <li key={row.id} className={listRowClassName}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{row.name}</p>
                        <p className="truncate text-sm text-muted-foreground">{row.vendorModel}</p>
                      </div>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground">
                          RU {row.startRU}–{row.endRU}
                        </span>
                        <RemoveDeviceButton deviceId={row.id} rackId={rackId} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : (
          <ConnectionsPanel
            rackId={rackId}
            matrixHref={matrixHref}
            devices={connectionDevices}
            connections={connections}
          />
        )}
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { ThemePicker } from "@/app/theme-picker";
import { ConnectionsPanel } from "./connections-panel";
import { PlaceDeviceForm } from "./place-device-form";
import { RackWorkspace } from "./rack-workspace";
import { RemoveDeviceButton } from "./remove-device-button";
import { cardClassName, listRowClassName, sectionLabelClassName } from "./styles";

export default async function RackPage({ params }: PageProps<"/projects/[id]/racks/[rackId]">) {
  const { id, rackId } = await params;

  // Render per request so placements reflect the database, not build time.
  await connection();

  const [rack, catalog, connections] = await Promise.all([
    prisma.rack.findFirst({
      where: { id: rackId, projectId: id },
      include: {
        project: true,
        devices: { include: { catalogDevice: true }, orderBy: { startRU: "asc" } },
      },
    }),
    prisma.catalogDevice.findMany({
      where: { heightRU: { gte: 1 } },
      orderBy: [{ vendor: "asc" }, { model: "asc" }],
      select: { id: true, vendor: true, model: true, heightRU: true, category: true },
    }),
    // Connections are only created between devices in the same rack.
    prisma.connection.findMany({
      where: { fromDevice: { rackId, rack: { projectId: id } } },
      include: {
        fromDevice: { include: { catalogDevice: true } },
        toDevice: { include: { catalogDevice: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!rack) notFound();

  // Model + RU tells identical devices apart, e.g. "Nexus 9336C-FX2 @ RU 47".
  const deviceName = (device: { label: string | null; startRU: number; catalogDevice: { model: string } }) =>
    `${device.label || device.catalogDevice.model} @ RU ${device.startRU}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      {/* Temporary home for the theme picker until the app shell exists. */}
      <div className="mb-10 rounded-xl border border-border/60 bg-card px-4 py-2 backdrop-blur-md">
        <ThemePicker />
      </div>

      <header className="mb-10">
        <Link
          href={`/projects/${id}`}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to project
        </Link>
        <p className="mt-6 text-sm text-muted-foreground">{rack.project.name}</p>
        <h1 className="mt-1 flex flex-wrap items-baseline gap-3 text-3xl font-semibold tracking-tight">
          {rack.name}
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-sm font-medium text-muted-foreground">
            {rack.heightRU}U
          </span>
        </h1>
      </header>

      <div className="space-y-8">
        <section className={cardClassName}>
          <h2 className={`${sectionLabelClassName} mb-4`}>Place a device</h2>
          <PlaceDeviceForm rackId={rackId} rackHeightRU={rack.heightRU} catalog={catalog} />
        </section>

        <section className={cardClassName}>
          <h2 className={`${sectionLabelClassName} mb-4`}>Elevation</h2>
          <RackWorkspace
            rackId={rackId}
            heightRU={rack.heightRU}
            catalog={catalog}
            // Only what the grid draws: keeps rawData and timestamps out of the client payload.
            devices={rack.devices.map(({ id, startRU, label, catalogDevice }) => ({
              id,
              startRU,
              label,
              catalogDevice: {
                model: catalogDevice.model,
                vendor: catalogDevice.vendor,
                heightRU: catalogDevice.heightRU,
                category: catalogDevice.category,
              },
            }))}
          />
        </section>

        <section className={cardClassName}>
          <h2 className={`${sectionLabelClassName} mb-4`}>Placed devices</h2>
          {rack.devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No devices placed yet.</p>
          ) : (
            <ul className="-mx-3 space-y-0.5">
              {rack.devices.map((device) => {
                const endRU = device.startRU + device.catalogDevice.heightRU - 1;
                return (
                  <li key={device.id} className={listRowClassName}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {device.label || device.catalogDevice.model}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {device.catalogDevice.vendor} / {device.catalogDevice.model}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground">
                        RU {device.startRU}–{endRU}
                      </span>
                      <RemoveDeviceButton deviceId={device.id} rackId={rackId} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <ConnectionsPanel
          rackId={rackId}
          matrixHref={`/projects/${id}/racks/${rackId}/connections`}
          devices={rack.devices.map((device) => ({ id: device.id, name: deviceName(device) }))}
          connections={connections.map((connection) => ({
            id: connection.id,
            fromName: deviceName(connection.fromDevice),
            toName: deviceName(connection.toDevice),
            cableType: connection.cableType,
            label: connection.label,
          }))}
        />
      </div>
    </main>
  );
}

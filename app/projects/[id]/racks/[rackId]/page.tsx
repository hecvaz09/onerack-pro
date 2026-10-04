import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { ConnectionsPanel } from "./connections-panel";
import { PlaceDeviceForm } from "./place-device-form";
import { RackWorkspace } from "./rack-workspace";

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
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href={`/projects/${id}`} className="text-sm text-muted-foreground hover:underline">
        ← Back to project
      </Link>

      <p className="mt-4 text-sm text-muted-foreground">{rack.project.name}</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        {rack.name} ({rack.heightRU}U)
      </h1>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Place a device</h2>

      <PlaceDeviceForm rackId={rackId} rackHeightRU={rack.heightRU} catalog={catalog} />

      <h2 className="mt-8 mb-3 text-lg font-semibold">Elevation</h2>

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

      <h2 className="mt-8 mb-3 text-lg font-semibold">Placed devices</h2>

      {rack.devices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No devices placed yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rack.devices.map((device) => {
            const endRU = device.startRU + device.catalogDevice.heightRU - 1;
            return (
              <li key={device.id} className="flex items-baseline justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {device.label || device.catalogDevice.model}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {device.catalogDevice.vendor} / {device.catalogDevice.model}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                  RU {device.startRU}–{endRU}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <ConnectionsPanel
        rackId={rackId}
        devices={rack.devices.map((device) => ({ id: device.id, name: deviceName(device) }))}
        connections={connections.map((connection) => ({
          id: connection.id,
          fromName: deviceName(connection.fromDevice),
          toName: deviceName(connection.toDevice),
          cableType: connection.cableType,
          label: connection.label,
        }))}
      />
    </main>
  );
}

import { notFound } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { RackShell } from "./rack-shell";

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

  const occupiedRU = rack.devices.reduce((total, device) => total + device.catalogDevice.heightRU, 0);

  return (
    <RackShell
      projectId={id}
      projectName={rack.project.name}
      rackId={rackId}
      rackName={rack.name}
      heightRU={rack.heightRU}
      deviceCount={rack.devices.length}
      occupiedRU={occupiedRU}
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
      placedRows={rack.devices.map((device) => ({
        id: device.id,
        name: device.label || device.catalogDevice.model,
        vendorModel: `${device.catalogDevice.vendor} / ${device.catalogDevice.model}`,
        startRU: device.startRU,
        endRU: device.startRU + device.catalogDevice.heightRU - 1,
      }))}
      connectionDevices={rack.devices.map((device) => ({ id: device.id, name: deviceName(device) }))}
      connections={connections.map((connection) => ({
        id: connection.id,
        fromName: deviceName(connection.fromDevice),
        toName: deviceName(connection.toDevice),
        cableType: connection.cableType,
        label: connection.label,
      }))}
      matrixHref={`/projects/${id}/racks/${rackId}/connections`}
    />
  );
}

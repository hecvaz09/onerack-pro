import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { CABLE_META, FALLBACK_CABLE, cableMeta } from "../cable-types";

// Unordered: A–B and B–A are the same cable.
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export default async function ConnectionMatrixPage({
  params,
}: PageProps<"/projects/[id]/racks/[rackId]/connections">) {
  const { id, rackId } = await params;

  // Render per request so the matrix reflects the database, not build time.
  await connection();

  const [rack, connections] = await Promise.all([
    prisma.rack.findFirst({
      where: { id: rackId, projectId: id },
      include: {
        devices: { include: { catalogDevice: true }, orderBy: { startRU: "asc" } },
      },
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

  const devices = rack.devices.map((device) => ({
    id: device.id,
    startRU: device.startRU,
    // Model + RU tells identical devices apart, e.g. "Nexus 9336C-FX2 @ RU 47".
    name: `${device.label || device.catalogDevice.model} @ RU ${device.startRU}`,
  }));

  const cableByPair = new Map<string, string | null>();
  for (const { fromDeviceId, toDeviceId, cableType } of connections) {
    const key = pairKey(fromDeviceId, toDeviceId);
    if (!cableByPair.has(key)) cableByPair.set(key, cableType);
  }

  const rackPath = `/projects/${id}/racks/${rackId}`;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <Link href={rackPath} className="text-sm text-muted-foreground hover:underline">
        ← Back to rack
      </Link>

      <h1 className="mt-4 mb-6 text-2xl font-semibold tracking-tight">
        {rack.name} — Connection Matrix
      </h1>

      {devices.length < 2 ? (
        <p className="text-sm text-muted-foreground">Place at least two devices to see the matrix.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-card backdrop-blur-md" />
                  {devices.map((device) => (
                    <th
                      key={device.id}
                      scope="col"
                      title={device.name}
                      className="h-9 min-w-12 border-b border-l border-border px-1 font-medium whitespace-nowrap text-muted-foreground tabular-nums"
                    >
                      RU {device.startRU}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devices.map((rowDevice) => (
                  <tr key={rowDevice.id}>
                    <th
                      scope="row"
                      title={rowDevice.name}
                      className="sticky left-0 z-10 max-w-56 truncate border-t border-border bg-card px-3 text-left font-medium backdrop-blur-md"
                    >
                      {rowDevice.name}
                    </th>
                    {devices.map((colDevice) => (
                      <MatrixCell
                        key={colDevice.id}
                        isDiagonal={rowDevice.id === colDevice.id}
                        hasCable={cableByPair.has(pairKey(rowDevice.id, colDevice.id))}
                        cableType={cableByPair.get(pairKey(rowDevice.id, colDevice.id)) ?? null}
                        title={`${rowDevice.name} ↔ ${colDevice.name}`}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {[...Object.entries(CABLE_META), ["Other / unspecified", FALLBACK_CABLE] as const].map(
              ([name, meta]) => (
                <li key={name} className="flex items-center gap-2">
                  <span
                    className="inline-flex h-6 min-w-10 items-center justify-center rounded-sm px-1.5 text-xs font-semibold text-neutral-900"
                    style={{ backgroundColor: meta.color }}
                  >
                    {meta.abbr}
                  </span>
                  <span className="text-muted-foreground">{name}</span>
                </li>
              ),
            )}
          </ul>
        </>
      )}
    </main>
  );
}

function MatrixCell({
  isDiagonal,
  hasCable,
  cableType,
  title,
}: {
  isDiagonal: boolean;
  hasCable: boolean;
  cableType: string | null;
  title: string;
}) {
  const base = "h-9 min-w-12 border-t border-l border-border text-center";

  if (isDiagonal) {
    return <td className={`${base} bg-muted text-muted-foreground`}>—</td>;
  }
  if (!hasCable) {
    return <td className={base} />;
  }

  const meta = cableMeta(cableType);
  return (
    // Solid swatch with dark text, like the rack grid's device blocks, so it reads in both themes.
    <td
      title={`${title}${cableType ? ` · ${cableType}` : ""}`}
      className={`${base} font-semibold text-neutral-900`}
      style={{ backgroundColor: meta.color }}
    >
      {meta.abbr}
    </td>
  );
}

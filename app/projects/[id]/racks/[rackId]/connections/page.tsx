import {ClearLayoutControls} from '../clear-layout-controls';
import {externalName} from '@/lib/external-connections';
import {createHash} from 'node:crypto';
import {patternState} from '@/lib/cabling-pattern';
import {RepeatCabling} from './repeat-cabling';
import {networkPorts} from '@/lib/network-ports';
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import {buildCableMatrix} from "@/lib/cable-matrix";
import {CableMatrix} from "./cable-matrix";
import {RackConnectionWindow} from "../rack-connection-window";
import { RackNavigation } from "../rack-navigation";



export default async function ConnectionMatrixPage({
  params,
}: PageProps<"/projects/[id]/racks/[rackId]/connections">) {
  const { id, rackId } = await params;

  // Render per request so the matrix reflects the database, not build time.
  await connection();

  const [rack, connections] = await Promise.all([
    prisma.rack.findFirst({
      where: { id: rackId, projectId: id, trashedAt:null, project: {trashedAt:null} },
      include: {
        devices: { include: { catalogDevice: true }, orderBy: { startRU: "asc" } },
      },
    }),
    // Rack-origin cables include customer-site destinations.
    prisma.connection.findMany({
      where: { fromDevice: { rackId, rack: { projectId: id, trashedAt:null, project: {trashedAt:null} } } },
      include: {
        fromDevice: { include: { catalogDevice: true } },
        toDevice: { include: { catalogDevice: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!rack) notFound();


  const rackPath = `/projects/${id}/racks/${rackId}`;
  const devices=rack.devices.map(d=>({id:d.id,name:`${d.label||d.catalogDevice.model} · U${d.startRU}`,startRU:d.startRU,category:d.catalogDevice.category,catalogId:d.catalogDevice.id,ports:networkPorts(d.catalogDevice.rawData)}));
  const network=connections.filter(c=>c.cableType!=="Power");
  const matrix=buildCableMatrix(devices,network,rackPath);
  const patternConnections=network.map(c=>({id:c.id,fromDeviceId:c.fromDeviceId,toDeviceId:c.toDeviceId,fromPort:c.fromPort,toPort:c.toPort,cableType:c.cableType,external:c.external,label:c.label,lengthValue:c.lengthValue,lengthUnit:c.lengthUnit}));
  const revision=createHash('sha256').update(patternState(devices,patternConnections)).digest('hex');
  return <main className="workspace-page">
    <Link href={rackPath} className="text-sm text-primary">← Back to rack</Link>
    <h1 className="mt-4 text-2xl font-semibold">{rack.name} — Cable Matrix</h1>
    <p className="my-3 text-sm text-muted-foreground">Shared wiring schedule for switch ports, external destinations and unmapped cables. Search, length, status and editing use the same table throughout.</p>
    <RackNavigation basePath={rackPath} active="network"/><ClearLayoutControls rackId={rackId} kind="network"/>
    <div className="my-4 flex flex-wrap gap-5 text-sm"><span>{network.length} saved network connections</span><span>{matrix.sections.length} switches</span><Link className="text-primary underline" href={`${rackPath}?tab=power`}>Power cable schedule →</Link></div>
    <RepeatCabling rackId={rackId} devices={devices} connections={patternConnections} revision={revision}/>
    <RackConnectionWindow rackId={rackId} basePath={rackPath} devices={devices} connections={network.map(c=>({id:c.id,fromDeviceId:c.fromDeviceId,toDeviceId:c.toDeviceId,fromPort:c.fromPort,toPort:c.toPort,cableType:c.cableType,external:c.external,label:c.label,lengthValue:c.lengthValue,lengthUnit:c.lengthUnit,fromName:devices.find(d=>d.id===c.fromDeviceId)?.name||'',toName:c.external?externalName(c.external):devices.find(d=>d.id===c.toDeviceId)?.name||''}))}>
      <CableMatrix sections={matrix.allSections}/>
    </RackConnectionWindow>
    <p className="my-5 text-xs text-muted-foreground">A switch-to-switch cable appears under both switches. Breakout legs are separate 25G rows, labeled P1-1 through P1-4. Length shows the entered cable size in feet or meters; a dash means unspecified.</p>
  </main>;
}

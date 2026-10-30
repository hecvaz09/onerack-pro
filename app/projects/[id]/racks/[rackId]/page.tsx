import {powerInputsRevision} from '@/lib/power-input-revision';
import {ClearLayoutControls} from './clear-layout-controls';
import {RackAssistantPanel} from './rack-assistant-panel';
import {externalName} from '@/lib/external-connections';
import {RackStatusPane} from "./rack-status-pane";
import {rackPowerPlanner} from "@/lib/rack-capabilities";
import {FeedPowerPlanner} from "./feed-power-planner";
import {readFeedInputs} from "@/lib/feed-rack";
import {networkPorts} from '@/lib/network-ports';
import {SystemSpecSummary} from "./system-spec-summary";
import {NetworkProfilePanel} from "./network-profile-panel";
import {readNetworkProfiles} from "@/lib/network-profiles";
import { pduModelId } from "@/lib/pdu-models";
import {readRackConfig} from "@/lib/rack-config";
import { readOutlets, readNodeNames } from "@/lib/equipment-details";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppearanceMenu } from "@/app/appearance-menu";
import { cardClassName } from "./styles";
import {RackConnectionWindow} from "./rack-connection-window";
import { ConnectionsPanel } from "./connections-panel";
import { RackWorkspace } from "./rack-workspace";
import { RackNavigation } from "./rack-navigation";
import { VisualPowerMap } from "./visual-power-map";
import { RackSettings } from "./rack-settings";
import {PowerPlanner} from "./power-planner";
import {readPx3Settings} from "@/lib/px3-power";


export default async function RackPage({ params, searchParams }: PageProps<"/projects/[id]/racks/[rackId]">) {
  const { id, rackId } = await params;

  // Render per request so placements reflect the database, not build time.
  await connection();

  const [rack, catalog, connections] = await Promise.all([
    prisma.rack.findFirst({
      where: { id: rackId, projectId: id, trashedAt:null, project: {trashedAt:null} },
      include: {
        project: true,
        history: true,
        devices: { include: { catalogDevice: true }, orderBy: { startRU: "asc" } },
      },
    }),
    prisma.catalogDevice.findMany({
      where: { OR: [{ heightRU: { gte: 1 } }, { category: "pdu", heightRU: 0 }] },
      orderBy: [{ vendor: "asc" }, { model: "asc" }],
      select: { id: true, sku: true, vendor: true, model: true, heightRU: true, category: true, rawData: true },
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
  const config=readRackConfig(rack.configuration);
  const source=(rack.configuration as Record<string,unknown>|null)?.buildSource as {notes?:string[]}|undefined;

  // Model + RU tells identical devices apart, e.g. "Nexus 9336C-FX2 @ RU 47".
  const deviceName = (device: { label: string | null; startRU: number; mounting: string; catalogDevice: { model: string; heightRU: number } }) => `${device.label || device.catalogDevice.model} @ ${device.catalogDevice.heightRU === 0 ? device.mounting : "RU " + device.startRU + " / " + device.mounting}`;

  const query=await searchParams;
  const requestedTab = query.tab;
  const tab = requestedTab === "network" || requestedTab === "power" ? requestedTab : "elevation";
  const basePath = `/projects/${id}/racks/${rackId}`;
  const gridDevices = rack.devices.map(({ id, startRU, label, mounting, details, catalogDevice }) => ({ id, startRU, label, mounting, details, networkHref:`${basePath}?tab=network`, networkPorts:networkPorts(catalogDevice.rawData), connectedPorts:connections.flatMap(c=>c.fromDeviceId===id&&c.fromPort?[c.fromPort]:c.toDeviceId===id&&c.toPort?[c.toPort]:[]), catalogDevice: { id:catalogDevice.id,sku:catalogDevice.sku,model: catalogDevice.model, vendor: catalogDevice.vendor, heightRU: catalogDevice.heightRU, category: catalogDevice.category, pduModel:pduModelId(catalogDevice.rawData),outlets:readOutlets(catalogDevice.rawData),nodeNames:readNodeNames(catalogDevice.rawData) } }));
  const powerSaveRevision=powerInputsRevision(rackId,rack);
  const powerEquipment=rack.devices.map(d=>({id:d.id,name:`${d.label||d.catalogDevice.model} · U${d.startRU}`,model:d.catalogDevice.model,startRU:d.startRU,mounting:d.mounting,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData,details:d.details}));
  const shownConnections = connections.filter(c => tab === "power" ? c.cableType === "Power" : c.cableType !== "Power");

  const connectionWorkspace=<RackConnectionWindow rackId={rackId} basePath={basePath} devices={rack.devices.map(d=>({id:d.id,name:deviceName(d),catalogId:d.catalogDevice.id,startRU:d.startRU,category:d.catalogDevice.category,ports:networkPorts(d.catalogDevice.rawData)}))} connections={connections.filter(c=>c.cableType!=="Power").map(c=>({id:c.id,fromDeviceId:c.fromDeviceId,toDeviceId:c.toDeviceId,fromPort:c.fromPort,toPort:c.toPort,fromName:deviceName(c.fromDevice),toName:c.toDevice?deviceName(c.toDevice):externalName(c.external),cableType:c.cableType,external:c.external,label:c.label,lengthValue:c.lengthValue,lengthUnit:c.lengthUnit}))}><VisualPowerMap configuration={rack.configuration} equipment={powerEquipment} rackId={rackId} config={config} heightRU={rack.heightRU} devices={gridDevices}/></RackConnectionWindow>;

  return <main className="workspace-page">
    <header className="workspace-header">
      <div><Link href="/projects" className="text-sm text-muted-foreground hover:underline">← Projects</Link><p className="mt-3 text-xs text-muted-foreground"><Link href={`/projects/${id}`}>{rack.project.name}</Link></p><h1 className="mt-1 flex items-baseline gap-3 text-2xl font-semibold tracking-tight">{rack.name}<span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">{config.pockets?"U60 · 48U + 12 pockets":`${rack.heightRU}U`}</span></h1></div>
      <div className="workspace-tools"><Link href="/equipment" className="text-sm text-primary underline">Equipment library</Link><AppearanceMenu/><a href={`${basePath}/export`} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Download build PDF</a></div>
    </header>
    <RackStatusPane devices={gridDevices} equipment={powerEquipment} configuration={rack.configuration} heightRU={rack.heightRU} pockets={config.pockets} basePath={basePath} networkCables={connections.filter(c=>c.cableType!=="Power").length}>
    <RackNavigation basePath={basePath} active={tab}/>
    <RackAssistantPanel key={rackId} projectId={id} rackId={rackId} rackName={rack.name} basePath={basePath} aiEnabled={process.env.ONERACK_AI_ENABLED==='true'&&!!process.env.OPENAI_API_KEY&&!!process.env.ONERACK_AI_ALLOWANCE}/>
    {tab!=='elevation'&&<ClearLayoutControls rackId={rackId} kind={tab==='power'?'power':'network'}/>}
    {Array.isArray(source?.notes)&&<details className="mb-4 rounded-xl border border-border p-4"><summary>Workbook import notes · unresolved specifications and original wiring</summary><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">{source.notes.map(note=><li key={note}>{note}</li>)}</ul></details>}
    {tab === "elevation" ? <div className="space-y-4">
      <RackSettings key={JSON.stringify([rack.name,rack.heightRU,config])} rackId={rackId} name={rack.name} heightRU={rack.heightRU} config={config}/>
      <section className={`${cardClassName} elevation-card`}><RackConnectionWindow rackId={rackId} basePath={basePath} devices={rack.devices.map(d=>({id:d.id,name:deviceName(d),catalogId:d.catalogDevice.id,startRU:d.startRU,category:d.catalogDevice.category,ports:networkPorts(d.catalogDevice.rawData)}))} connections={connections.filter(c=>c.cableType!=="Power").map(c=>({id:c.id,fromDeviceId:c.fromDeviceId,toDeviceId:c.toDeviceId,fromPort:c.fromPort,toPort:c.toPort,fromName:deviceName(c.fromDevice),toName:c.toDevice?deviceName(c.toDevice):externalName(c.external),cableType:c.cableType,external:c.external,label:c.label,lengthValue:c.lengthValue,lengthUnit:c.lengthUnit}))}><RackWorkspace config={config} history={{undo:!!rack.history && rack.history.cursor>0,redo:!!rack.history && Array.isArray(rack.history.snapshots) && rack.history.cursor<rack.history.snapshots.length-1}} rackId={rackId} heightRU={rack.heightRU} catalog={catalog.map(c=>({...c,pduModel:pduModelId(c.rawData),outlets:readOutlets(c.rawData),nodeNames:readNodeNames(c.rawData)}))} devices={gridDevices} connectionCounts={Object.fromEntries(rack.devices.map(d => [d.id, connections.filter(c => c.fromDeviceId === d.id || c.toDeviceId === d.id).length]))}/></RackConnectionWindow></section>
    </div> : tab === "power" ? <div className="space-y-5"><nav className="flex gap-4 text-sm" aria-label="Power planner"><Link href={`${basePath}?tab=power&planner=feed`}>Shared single-/three-phase planner</Link>{rackPowerPlanner(rack.devices,config.pduPairs)==="raritan"&&<Link href={`${basePath}?tab=power&planner=raritan`}>Raritan workbook planner</Link>}</nav>{(query.planner!=="raritan"||rackPowerPlanner(rack.devices,config.pduPairs)==="feed") ? <FeedPowerPlanner savedDraft={(rack.configuration as Record<string,unknown> | null)?.powerDraft} key={"feed-"+rackId} saveRevision={powerSaveRevision} latestHref={`${basePath}?tab=power&planner=feed`} rackId={rackId} initial={readFeedInputs(rack.configuration,powerEquipment)} equipment={rack.devices.map(d=>({id:d.id,name:`${d.label||d.catalogDevice.model} · U${d.startRU}`,model:d.catalogDevice.model,startRU:d.startRU,mounting:d.mounting,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData,details:d.details}))}>{connectionWorkspace}</FeedPowerPlanner> : <PowerPlanner consumption={readFeedInputs(rack.configuration,powerEquipment).budgets} key={"raritan-"+rackId} saveRevision={powerSaveRevision} latestHref={`${basePath}?tab=power&planner=raritan`} rackId={rackId} initial={readPx3Settings(rack.configuration)} equipment={rack.devices.map(d=>({id:d.id,name:`${d.label||d.catalogDevice.model} · U${d.startRU}`,model:d.catalogDevice.model,startRU:d.startRU,mounting:d.mounting,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData,details:d.details}))}/>}<details className="mb-5"><summary>Equipment power supply specifications</summary><SystemSpecSummary mode="power" devices={rack.devices}/></details>{query.planner==="raritan"&&rackPowerPlanner(rack.devices,config.pduPairs)==="raritan"&&<section id="power-connections" tabIndex={-1} className={cardClassName}>{connectionWorkspace}</section>}</div> : <div className="network-workspace"><details className="mb-5"><summary>Equipment network specifications</summary><SystemSpecSummary mode="network" devices={rack.devices}/></details>{rack.devices.some(d=>d.catalogDevice.heightRU===8&&d.catalogDevice.category==="chassis")&&<details className="mb-5"><summary>Earlier proposed ConnectX configuration</summary><NetworkProfilePanel rackId={rackId} profiles={readNetworkProfiles(rack.configuration)} devices={rack.devices.filter(d=>d.catalogDevice.heightRU===8&&d.catalogDevice.category==="chassis").map(d=>({id:d.id,name:deviceName(d)}))}/></details>}
      <section className={cardClassName}><ConnectionsPanel key={`${query.fromDeviceId||""}:${query.fromPort||""}`} initialDeviceId={typeof query.fromDeviceId==="string"?query.fromDeviceId:undefined} initialPort={typeof query.fromPort==="string"?query.fromPort:undefined} rackId={rackId} matrixHref={`${basePath}/connections`} devices={rack.devices.map(d=>({id:d.id,name:deviceName(d),catalogId:d.catalogDevice.id,startRU:d.startRU,category:d.catalogDevice.category,ports:networkPorts(d.catalogDevice.rawData)}))} connections={shownConnections.map(c=>({id:c.id,fromDeviceId:c.fromDeviceId,toDeviceId:c.toDeviceId,fromPort:c.fromPort,toPort:c.toPort,fromName:deviceName(c.fromDevice),toName:c.toDevice?deviceName(c.toDevice):externalName(c.external),cableType:c.cableType,external:c.external,label:c.label,lengthValue:c.lengthValue,lengthUnit:c.lengthUnit}))}/></section>
    </div>}
    </RackStatusPane>
  </main>;
}

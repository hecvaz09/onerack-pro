import {isB300PowerDevice} from '@/lib/b300-power-inputs';
import {consumptionSummary} from '@/lib/power-consumption';
import {externalName,externalStatus} from '@/lib/external-connections';
import {analyzeFeeds} from '@/lib/feed-power';
import {feedRack,readFeedInputs} from '@/lib/feed-rack';
import {portName,resolvedCableLabel} from '@/lib/network-ports';
import {analyzePx3,readPx3Settings} from "@/lib/px3-power";
import {readRackConfig} from "@/lib/rack-config";
import { prisma } from "@/lib/prisma";
import { buildRackPdf } from "@/lib/build-document";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; rackId: string }> }) {
  const { id, rackId } = await params;
  try {
    const rack = await prisma.rack.findFirst({ where: { id: rackId, projectId: id, trashedAt:null, project: {trashedAt:null} }, include: { project: true, devices: { include: { catalogDevice: true }, orderBy: { startRU: "asc" } } } });
    if (!rack) return new Response("Rack not found", { status: 404 });
    const connections = await prisma.connection.findMany({ where: { fromDevice: { rackId }, OR: [{toDevice: {rackId}}, {toDeviceId:null}] }, include: { fromDevice: { include: { catalogDevice: true } }, toDevice: { include: { catalogDevice: true } } }, orderBy: { createdAt: "asc" } });
    const name = (d: typeof rack.devices[number]) => `${d.label || d.catalogDevice.model} @ ${d.catalogDevice.heightRU === 0 ? d.mounting : d.mounting + " RU " + d.startRU}`;
    const feedEquipment=rack.devices.map(d=>({id:d.id,name:name(d),sku:d.catalogDevice.sku,model:d.catalogDevice.model,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData,details:d.details}));
    const hasB300=rack.devices.some(d=>isB300PowerDevice(d.catalogDevice));
    const feedInputs=readFeedInputs(rack.configuration,hasB300?feedEquipment:undefined);
    const feed=feedRack(feedEquipment,feedInputs);
    const four=readRackConfig(rack.configuration).pduPairs===2;
    const useFeed=four||feed.loads.some(load=>load.assessment==='pdu-capacity');
    const bytes = await buildRackPdf({ consumption:feed.loads.map(d=>({name:d.name,summary:consumptionSummary(d)})),feedPower:useFeed?analyzeFeeds(feed.supplies,feed.loads,feed.cords,feedInputs.headroomPercent):undefined,power:useFeed?undefined:analyzePx3(rack.devices.map(d=>({id:d.id,name:name(d),sku:d.catalogDevice.sku,model:d.catalogDevice.model,mounting:d.mounting,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData,details:d.details})),readPx3Settings(rack.configuration)), project: rack.project.name, customer: rack.project.customer, rack: rack.name, heightRU: rack.heightRU, pockets:readRackConfig(rack.configuration).pockets, devices: rack.devices.map(d => ({ id: d.id, label: d.label || d.catalogDevice.model, sku:d.catalogDevice.sku, vendor: d.catalogDevice.vendor, model: d.catalogDevice.model, startRU: d.startRU, heightRU: d.catalogDevice.heightRU, mounting: d.mounting, details:d.details })), connections: connections.map(c => ({ from: `${name(c.fromDevice)} / ${portName(c.fromDevice.catalogDevice.rawData,c.fromPort)}`, to: c.toDevice?`${name(c.toDevice)} / ${portName(c.toDevice.catalogDevice.rawData,c.toPort)}`:`${externalName(c.external)} · ${externalStatus(c.external)}`, cableType: c.cableType, label: resolvedCableLabel(c) })) });
    return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="onerack-build-document.pdf"', "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("PDF export failed", error);
    return new Response("Couldn't generate the build document. Please try again.", { status: 500 });
  }
}

import {powerAssignmentLabel} from './b300-power-inputs.ts';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { isPocket, POCKET_BAYS, pocketPair } from "./onerack-layout.ts";
import { readDetails } from "./equipment-details.ts";
import type {PowerAnalysis} from "./px3-power.ts";
import {PX3_4068_OUTLETS} from "./pdu-models.ts";

export type BuildDocument = {
  consumption?:{name:string;summary:string}[];
  feedPower?:ReturnType<typeof import("./feed-power.ts").analyzeFeeds>&{
    verificationNotes?:string[];
    verificationReady?:boolean;
    headroomPercent?:number;
    supplies?:import("./feed-power.ts").Supply[];
  };
  power?:PowerAnalysis;
  project: string;
  customer: string | null;
  rack: string;
  heightRU: number;
  pockets?:boolean;
  devices: { id: string; label: string; sku?:string; vendor: string; model: string; startRU: number; heightRU: number; mounting?: string; details?:unknown }[];
  connections: { from: string; to: string; cableType: string | null; label: string | null }[];
};

// Standard PDF fonts cannot encode arbitrary Unicode. Normalize deliberately
// rather than allowing a customer-entered character to crash an export.
function printable(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[–—]/g, "-").replace(/↔/g, " <-> ").replace(/[^\x20-\x7e]/g, " ");
}

function wrap(value: string, width: number, font: PDFFont, size: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const char of printable(value)) {
    if (font.widthOfTextAtSize(line + char, size) > width && line) { lines.push(line); line = ""; }
    line += char;
  }
  lines.push(line);
  return lines;
}

export async function buildRackPdf(data: BuildDocument): Promise<Uint8Array> {
  if (!Number.isInteger(data.heightRU) || data.heightRU < 1 || data.heightRU > 60) throw new Error("Rack height must be between 1 and 60U.");
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${data.project} - ${data.rack} build document`);
  pdf.setAuthor("OneRack Pro");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(.12, .15, .19), muted = rgb(.4, .44, .49);
  const text = (page: PDFPage, value: string, x: number, y: number, size = 10, strong = false) => page.drawText(printable(value), { x, y, size, font: strong ? bold : font, color: ink });
  function page(title: string) {
    const p = pdf.addPage([595.28, 841.89]);
    text(p, "ONERACK PRO / BUILD DOCUMENT", 42, 799, 9, true);
    text(p, title, 42, 770, 21, true);
    let y = 748;
    for (const line of wrap(`${data.project} / ${data.customer || "No customer specified"} / ${data.rack}`, 510, font, 9).slice(0, 3)) { text(p, line, 42, y, 9); y -= 12; }
    return p;
  }
  const elevation = page("Rack Map");
  const bottom = 85, top = 688, x = 80, width = 360, row = (top - bottom) / data.heightRU;
  for (let ru = 1; ru <= data.heightRU; ru++) {
    const y = bottom + (ru - 1) * row;
    elevation.drawRectangle({ x, y, width, height: row, borderColor: rgb(.8, .82, .85), borderWidth: .35 });
    text(elevation, String(ru), 51, y + Math.max(1, (row - 7) / 2), 7);
  }
  for (const device of data.devices.filter(d => d.heightRU > 0 && !isPocket(data.heightRU, d.startRU, data.pockets===true))) {
    const end = device.startRU + device.heightRU - 1;
    if (device.startRU < 1 || end > data.heightRU) throw new Error(`Device ${device.id} falls outside the rack.`);
    const y = bottom + (device.startRU - 1) * row;
    elevation.drawRectangle({ x: x + 1, y: y + .5, width: width - 2, height: device.heightRU * row - 1, color: rgb(.9, .93, .96), borderColor: rgb(.48, .58, .7), borderWidth: .5 });
    const label = wrap(`${device.label} (${device.mounting || "front"}) | RU ${device.startRU}-${end}`, width - 16, font, 8)[0];
    text(elevation, label, x + 8, y + Math.max(1, (device.heightRU * row - 8) / 2), 8);
  }
  for (const device of data.devices.filter(d => isPocket(data.heightRU, d.startRU, data.pockets===true))) {
    const pair = pocketPair(device.startRU)!;
    if (device.heightRU < 1 || device.startRU + device.heightRU - 1 > pair[1]) throw new Error(`Device ${device.id} falls outside its pocket pair.`);
    const bay = POCKET_BAYS.find(b => [...b.left, ...b.right].some(p => p === device.startRU))!;
    const left = bay.left.some(p => p === device.startRU);
    const px = (left ? 15 : 450) + (device.startRU - pair[0]) * 30;
    const py = bottom + (bay.from - 1) * row;
    elevation.drawRectangle({x:px,y:py,width:28 * device.heightRU,height:(bay.to-bay.from+1)*row,color:rgb(.85,.9,.96),borderColor:muted,borderWidth:.5});
    text(elevation,`U${device.startRU}`,px+3,py+6,6);
  }
  text(elevation, `${data.heightRU}U / ${data.devices.length} devices / Occupancy view`, 42, 707, 10);

  function table(title: string, headings: string[], widths: number[], rows: string[][]) {
    let p: PDFPage, y: number;
    function start() {
      p = page(title); y = 692;
      let x = 42;
      headings.forEach((heading, i) => { text(p, heading, x, y, 9, true); x += widths[i]; });
      y -= 20;
    }
    start();
    if (!rows.length) text(p!, "No entries.", 42, y!, 10);
    for (const cells of rows) {
      const lines = cells.map((cell, i) => wrap(cell, widths[i] - 12, font, 8));
      const lineCount = Math.max(...lines.map(v => v.length));
      // Long user text is continued across pages rather than clipped.
      for (let line = 0; line < lineCount; line++) {
        if (y! < 65) start();
        let x = 42;
        lines.forEach((column, i) => { text(p!, column[line] || "", x, y!, 8); x += widths[i]; });
        y! -= 11;
      }
      y! -= 10;
    }
  }
  table("Placed devices", ["Device", "Manufacturer / model", "Rack units"], [175, 255, 80], data.devices.map(d => [d.label, `${d.vendor} / ${d.model}`, d.heightRU === 0 ? (d.mounting || "Rail") : `${d.mounting || "front"} ${d.startRU}-${d.startRU + d.heightRU - 1}`]));
  table("Cable manifest", ["From", "To", "Cable", "Label"], [155, 155, 80, 120], data.connections.map(c => [c.from, c.to, c.cableType || "Unspecified", c.label || ""]));
  const outlets=data.devices.flatMap(d=>Object.entries(readDetails(d.details).outlets).map(([number,a])=>[`${d.label} / ${d.mounting}`,number,(()=>{const target=data.devices.find(v=>v.id===a.deviceId);return target?target.label+(a.inlet?" / "+powerAssignmentLabel(target,a):""):"Unassigned";})(),a.notes]));
  if(outlets.length)table("Power outlet assignments",["PDU","Outlet","Equipment","Notes"],[160,45,150,155],outlets);
  if(data.consumption?.length)table("Consumption sources (PSU checks are separate)",["Equipment","Consumption and source"],[180,330],data.consumption.map(v=>[v.name,v.summary]));
  if(data.feedPower){
    const result=data.feedPower;
    const verification=result.verificationNotes||[];
    const status=result.ready?(result.scopeNotes?.length?"Within entered PDU capacity limits":"Design checks passed"):"NEEDS REVIEW - incomplete inputs, assignments or modeled conflicts";
    table(result.scopeNotes?.length?"Power connections / PDU capacity":"Power design / feed loss",["Check","Result"],[180,330],[
      ["Status",status],
      ["Verification",result.verificationReady===false||verification.length?"Pending site, equipment or estimate verification. Design results do not confirm physical installation.":"Calculated from saved inputs. Site verification and physical installation are separate."],
      ...(result.scopeNotes||[]).map(note=>["Scope",note]),
      ["Basis",`Saved demand and wiring; equal sharing across surviving cords. ${result.headroomPercent===undefined?'Configured':`${result.headroomPercent}%`} extra headroom applied once. Missing budgets are not zero-load devices.`],
      ["Electrical model","Each installed PDU uses its configured supply topology, outlet phase mapping, power factor and current limits. Three-phase currents use an ABC sinusoidal model; neutral current excludes harmonics."],
      ...result.issues.map(i=>["Unresolved",i]),
      ...verification.map(i=>["Verification pending",i]),
      ...result.scenarios.flatMap(s=>[
        [s.lost?`Feed ${s.lost} lost`:"Normal operation","Saved wiring"],
        ...s.totals.flatMap(p=>{
          const supply=result.supplies?.find(v=>v.id===p.id);
          return p.online?[
            [p.name,`${(p.watts/1000).toFixed(3)} kW / ${(p.va/1000).toFixed(3)} kVA`],
            [`${p.name} / input`,`${p.amps.toFixed(2)} / ${p.limitAmps} A`],
            ...p.phases.map((amps,i)=>[`${p.name} / ${p.phases.length>1?`L${i+1}`:'Line'}`,`${amps.toFixed(2)} / ${p.limitAmps} A`]),
            ...(p.phases.length>1?[[`${p.name} / phase spread`,`${p.spread.toFixed(2)} A`]]:[]),
            ...(supply?.topology==='three-phase-wye'?[[`${p.name} / fundamental neutral`,`${p.neutralAmps.toFixed(2)} A`]]:[]),
            ...Object.entries(p.branches).map(([branch,amps])=>[`${p.name} / branch ${branch}`,`${amps.toFixed(2)} / ${supply?.branches?.[branch]??'?'} A`]),
          ]:[[p.name,"Offline"]];
        }),
        ...s.unavailable.map(name=>["Redundancy limited",`${name}: single-PSU equipment is offline in this scenario.`]),
        ...s.errors.map(e=>["FAIL",e]),
      ]),
    ]);
    table("Power cabling / modeled loads",["Scenario / outlet","Branch / phase","Equipment / PSU","Calculated load"],[120,75,190,125],result.scenarios.flatMap(s=>s.outletLoads.map(c=>{
      const supply=result.supplies?.find(p=>p.id===c.pduId),outlet=supply?.outlets.find(o=>o.n===c.outlet),device=data.devices.find(d=>d.id===c.deviceId);
      return [
        `${s.lost?`Feed ${s.lost} lost`:'Normal'} / ${supply?.name||c.pduId} / P${c.outlet}`,
        `${outlet?.branch||'?'} / ${outlet?.phase||(supply?.topology==='single-phase'?'Line':'?')}`,
        `${device?.label||c.deviceId} / ${device?.mounting||''} U${device?.startRU??'?'} / ${powerAssignmentLabel(device,c)}`,
        `${c.watts.toFixed(1)} W / ${c.va.toFixed(1)} VA / ${c.amps.toFixed(2)} A`,
      ];
    })));
  }
  if(data.power){
    const power=data.power;
    table("Power planning / survivor loads",["Check","Result"],[180,330],[
      ["Status",Object.values(power.settings.budgets).some(b=>b.testOnly&&!b.passive)?"SYNTHETIC TEST - NOT VERIFIED FOR HARDWARE":power.ready?"Within modeled PDU limits":"NEEDS REVIEW - not a validated cabling plan"],
      ["Basis",`${power.settings.voltage} V Wye / default PF ${power.settings.pf} (device overrides apply) / extra headroom ${power.settings.headroomPercent??0}%. Each PDU carries full rack load independently; do not add A and B totals.`],
      ["Limits",`C13 12 A / C19 16 A / CB 20 A / usable phase ${power.settings.inputLimit} A`],
      ["Scope","Configured 1+1 or equal-sharing 3+3 groups carry the full chassis AC budget on either feed. Inrush, neutral/harmonics and upstream coordination not validated."],
      ...power.pdus.flatMap(p=>[[`PDU ${p.side} survives`,`${(p.watts/1000).toFixed(3)} kW / ${p.kva.toFixed(3)} kVA`],[`PDU ${p.side} phases`,p.phases.map((a,i)=>`L${i+1} ${a.toFixed(2)} A`).join(' / ')],...p.breakers.map((a,i)=>[`PDU ${p.side} CB${i+1}`,`${a.toFixed(2)} / 20 A`])]),
      ...power.issues.map(i=>[i.level.toUpperCase(),i.message]),
    ]);
    table("Power cabling / PSU schedule",["Feed / outlet","Breaker / phase","Equipment / PSU","Survivor load"],[85,95,235,95],power.pdus.flatMap(p=>p.outlets.map(o=>{
      const d=data.devices.find(d=>d.id===o.deviceId),map=PX3_4068_OUTLETS.find(v=>v.n===o.n);
      return [`${p.side} / ${o.n}`,`CB${map?.cb} / ${map?.phase}`,`${d?.label||o.deviceId} / ${d?.mounting||""} U${d?.startRU||"?"} / PSU ${o.inlet||"?"}`,`${o.watts} W / ${o.amps.toFixed(2)} A`];
    })));
  }
  const nodes=data.devices.flatMap(d=>Object.entries(readDetails(d.details).nodes).map(([name,n])=>[`${d.label} / U${d.startRU} / ${name}`,`${n.hostname} / ${n.ip}`,`${n.serial} / ${n.status}`,n.notes]));
  if(nodes.length)table("Node details",["Equipment / Node","Host / IP","Asset / status","Notes"],[155,125,115,115],nodes);
  const pages = pdf.getPages();
  pages.forEach((p, index) => p.drawText(`${index + 1} / ${pages.length}`, { x: 510, y: 32, font, size: 8, color: muted }));
  return pdf.save();
}

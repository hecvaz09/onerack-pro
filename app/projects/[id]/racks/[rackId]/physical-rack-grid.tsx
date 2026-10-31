"use client";
/* eslint-disable @next/next/no-img-element -- Local rack SVG faceplates. */
import {StandardRackFace} from "./standard-rack-face";
import {standardFaceGeometry} from "@/lib/rack-face-geometry";
import {RackPanSurface} from "./rack-pan-surface";
import {useState} from "react";
import {PsuConnectionDialog} from "./psu-connection-dialog";
import {ApcPduPanel} from "./apc-pdu-panel";
import {connectedPsuInlets,outletDestination,psuHoverDescription} from '@/lib/connection-highlights';
import {FaceConnections} from './face-connections';
import {catalogProfile,artworkUrl} from "@/lib/catalog-artwork";
import {ServerFrontPanel} from './server-front-panel';
import {PocketFace} from './pocket-face';
import {GrandTwinPanel} from './grandtwin-panel';
import {ServerRearPanel} from './server-rear-panel';
import type {NetworkPort} from '@/lib/network-ports';
import { ModelPduOutlets } from "./pdu-outlets";
import { PX3_4068_ID } from "@/lib/pdu-models";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { RackConfig } from "@/lib/rack-config";
import { isPocket, pocketBays } from "@/lib/onerack-layout";
import { colorForCategory } from "./device-colors";
import { readDetails, type Outlet } from "@/lib/equipment-details";
export type RackGridDevice = {
    id: string;
    pending?: boolean;
    details?: unknown;
    startRU: number;
    mounting: string;
    label: string | null;
    networkPorts?:NetworkPort[];
    connectedPorts?:string[];
    connectedPsus?:number[];
    psuDescription?:(inlet:number)=>string;
    networkHref?:string;
    catalogDevice: {
        id?: string;
        model: string;
        vendor: string;
        heightRU: number;
        category: string | null;
        pduModel?: string;
        sku?: string | null;
        outlets?: Outlet[];
        nodeNames?: string[];
    };
};
type Controls = {
    disabled?: boolean;
    draggingId?: string | null;
    selectedId?: string | null;
    onSelect?: (id: string) => void;
    onRemove?: (id: string) => void;
    onPlace?: (ru: number, mounting: string) => void;
    onContext?: (id: string, x: number, y: number) => void;
    onSlotContext?: (ru: number, mounting: string, x: number, y: number) => void;
    onOutlet?: (id: string, outlet: Outlet) => void;
    onPsu?: (id: string, inlet: number) => void;
    onNode?: (id: string, name: string) => void;
};
type Props = Controls & {
    config:RackConfig;
    heightRU: number;
    devices: RackGridDevice[];
    rear?: boolean;
    zoom?: number;
    preview?: {
        startRU: number;
        heightRU: number;
        error: string | null;
    } | null;
};
export function RackGrid({ heightRU, config, devices: sourceDevices, rear = false, zoom = 100, preview, ...controls }: Props) {
    const [powerTarget,setPowerTarget]=useState<{deviceId:string;inlet:number}|null>(null);
    const powerDevice=sourceDevices.find(d=>d.id===powerTarget?.deviceId);
    const ruPitch=!config.pockets&&(config.pduPairs===2||(heightRU===42&&config.profile==="apc-netshelter-42"))?43:28;
    const devices=sourceDevices.map(d=>({...d,connectedPsus:connectedPsuInlets(sourceDevices,d.id),psuDescription:(inlet:number)=>psuHoverDescription(sourceDevices,d,inlet)}));
    const face = rear ? "rear" : "front", slots = Array.from({ length: heightRU }, (_, i) => heightRU - i), row = (ru: number) => heightRU - ru + 1;
    const placed = devices.filter(d => d.catalogDevice.heightRU > 0 && !isPocket(heightRU, d.startRU,config.pockets));
    const occupied = new Set(placed.flatMap(d => Array.from({ length: d.catalogDevice.heightRU }, (_, i) => d.startRU + i)));
    const title = rear ? "Rear elevation" : "Front elevation";
    const numbers = <div className="physical-ru-rail">{slots.map(ru => <span key={ru} style={{height:ruPitch}} className={ru % 10 === 0 ? "decade" : ""}>{ru}</span>)}</div>;
    return <><RackPanSurface><div onClickCapture={e=>{
      const hit=e.target instanceof Element?e.target.closest("[data-psu-device]"):null;
      if(!hit)return;
      e.preventDefault();e.stopPropagation();
      const deviceId=hit.getAttribute("data-psu-device")!,inlet=Number(hit.getAttribute("data-psu-inlet"));
      if(devices.some(d=>d.id===deviceId)&&Number.isInteger(inlet)&&inlet>0){ if(controls.onPsu) controls.onPsu(deviceId,inlet); else setPowerTarget({deviceId,inlet}); }
    }} className={`onerack-physical ${face}-physical`} style={{ zoom: zoom / 100 }}>
    <div className="physical-face-title"><span>{title}</span><small>Left · Right</small></div>
    <div className={`elevation-assembly ${face}-assembly`}>
      {config.pockets && heightRU === 48 && <PocketColumn rear={rear} side="left" heightRU={heightRU} devices={devices} controls={controls}/>}
      {rear && config.pduB && config.pduPairs===2 && <PduColumn ruPitch={ruPitch} side="rear-left-2" heightRU={heightRU} devices={devices} controls={controls}/>}
      {rear && config.pduB && <PduColumn ruPitch={ruPitch} side="rear-left" heightRU={heightRU} devices={devices} controls={controls}/>}
      {numbers}
      <div data-rack-scroll aria-label={`${rear ? "Rear" : "Front"} rack map`} className="rack-frame"><div className="elevation-grid" style={{ gridTemplateRows: `repeat(${heightRU},${ruPitch}px)` }}>
        {slots.map(ru => <Slot key={ru} ru={ru} row={row(ru)} face={face} empty={!occupied.has(ru)} controls={controls}/>)}
        {placed.map(device => <Device key={device.id} device={device} face={face} controls={controls} standardBay={heightRU===42&&!config.pockets} row={row(device.startRU + device.catalogDevice.heightRU - 1)}/>)}
        {preview && !isPocket(heightRU, preview.startRU,config.pockets) && preview.heightRU > 0 && preview.startRU >= 1 && preview.startRU + preview.heightRU - 1 <= heightRU && <div data-placement-preview className={`physical-preview ${preview.error ? "invalid" : ""}`} style={{ gridRow: `${row(preview.startRU + preview.heightRU - 1)} / span ${preview.heightRU}` }}>{preview.error ? "Blocked" : `U${preview.startRU}–U${preview.startRU + preview.heightRU - 1}`}</div>}
      </div></div>
      {numbers}
      {rear && config.pduA && <PduColumn ruPitch={ruPitch} side="rear-right" heightRU={heightRU} devices={devices} controls={controls}/>}
      {rear && config.pduA && config.pduPairs===2 && <PduColumn ruPitch={ruPitch} side="rear-right-2" heightRU={heightRU} devices={devices} controls={controls}/>}
      {config.pockets && heightRU === 48 && <PocketColumn rear={rear} side="right" heightRU={heightRU} devices={devices} controls={controls}/>}
    </div><div className="physical-face-title physical-footer"><span>{title}</span><small>Left · Right</small></div>
  </div></RackPanSurface>{powerDevice&&powerTarget&&<PsuConnectionDialog device={powerDevice} inlet={powerTarget.inlet} devices={devices} onClose={()=>setPowerTarget(null)}/>}</>;
}
function Slot({ ru, row, face, empty, controls }: {
    ru: number;
    row: number;
    face: string;
    empty: boolean;
    controls: Controls;
}) {
    const { setNodeRef } = useDroppable({ id: `${face}-ru-${ru}`, data: { ru, mounting: face } });
    return <button ref={setNodeRef} type="button" tabIndex={controls.onPlace ? 0 : -1} disabled={controls.disabled} data-rack-ru={ru} className="physical-slot" style={{ gridRow: row }} aria-label={`${face} U${ru}${empty ? " empty" : " occupied"}`} onContextMenu={e => { e.preventDefault(); controls.onSlotContext?.(ru, face, e.clientX, e.clientY); }} onClick={() => empty && controls.onPlace?.(ru, face)}>{empty && <span>U{ru} — empty</span>}</button>;
}
function RemoveDot({ device, controls }: {
    device: RackGridDevice;
    controls: Controls;
}) {
    if (!controls.onRemove)
        return null;
    return <button type="button" className="device-remove-dot" disabled={controls.disabled || device.pending} aria-label={`Remove ${device.label || device.catalogDevice.model} at U${device.startRU}`} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); controls.onRemove?.(device.id); }}>×</button>;
}
function Device({ device, face, controls, row, pocket = false, standardBay = false }: {
    device: RackGridDevice;
    face: string;
    controls: Controls;
    row?: number;
    pocket?: boolean;
    standardBay?: boolean;
}) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `${face}:${device.id}`, disabled: controls.disabled || device.pending, data: { kind: "placed", deviceId: device.id, mounting: device.mounting, startRU: device.startRU, heightRU: device.catalogDevice.heightRU, pocket } });
    const name = device.label || device.catalogDevice.model;
    const rear = face.startsWith("rear");
    const chassisPanel=!pocket&&/AS-?\s*8126GS-TNMR/i.test(device.catalogDevice.model);
    const rearPanel=rear&&chassisPanel;
    const art=catalogProfile(device.catalogDevice.sku||'',device.catalogDevice.model);
    const b300=!pocket&&art?.key==='smc-b3008u';
    const switchWithoutLabel=device.catalogDevice.category==='switch'||art?.category==='switch';
    const blankPanel=!pocket&&art?.key==='blank-1u'&&device.catalogDevice.heightRU===1;
    // Power mapping exposes switch PSUs without changing the saved mounting
    // orientation used by Rack Map, network cabling and exports.
    const artFace=controls.onPsu&&device.catalogDevice.category==='switch'?'rear':(rear===(device.mounting==='rear'))?'front':'rear';
    const twin=!pocket&&art?.key==='smc-grandtwin';
    const standardFace=(standardBay||art?.key==='arista-7010tx')&&!!art&&!!standardFaceGeometry(art.key,artFace,device.catalogDevice.heightRU,pocket);
    const fitted=!!art&&['asus-esc8000a','smc-641e','fs-s3900','nvidia-qm8700'].includes(art.key)&&!pocket;
    const faceHeight=b300?640:device.catalogDevice.heightRU<=1?112:device.catalogDevice.heightRU===2?160:device.catalogDevice.heightRU===4?280:440;
    const crop=fitted?(device.catalogDevice.heightRU<=1?(art?.key==='nvidia-qm8700'&&artFace==='rear'?'22 25 756 70':'22 29 756 61'):art?.key==='asus-esc8000a'&&artFace==='rear'?'22 0 756 256':'22 29 756 227'):`0 0 800 ${faceHeight}`;
    const illustrated=!!art&&!chassisPanel&&art.category!=='pdu';
    return <div ref={setNodeRef} onPointerDown={event=>{
      const target=event.target instanceof Element?event.target:null;
      if(target?.closest('a,input,select,textarea,[role="button"]:not(.physical-device-handle),button:not(.physical-device-handle)'))return;
      listeners?.onPointerDown?.(event);
    }} data-movable={!controls.disabled&&!device.pending} data-device-block data-target-label={`${name} · U${device.startRU} · ${rear?"rear":"front"}`} data-device-id={device.id} className={`physical-device ${b300?"b300-chassis":""} ${blankPanel?"blanking-panel":""} ${switchWithoutLabel?"switch-without-label":""} ${pocket ? "pocket-device" : ""} ${illustrated ? "catalog-illustrated" : ""} ${fitted?"fitted-face":""} ${standardFace?"standard-face":""} ${chassisPanel ? `illustrated-chassis ${rear?"chassis-rear":"chassis-front"}` : ""}`} data-selected={controls.selectedId === device.id} data-multi-ru={device.catalogDevice.heightRU > 1} style={{ gridRow: row ? `${row} / span ${device.catalogDevice.heightRU}` : undefined, visibility: isDragging || controls.draggingId === device.id ? "hidden" : undefined, backgroundColor: standardFace||blankPanel||b300?"transparent":colorForCategory(device.catalogDevice.category) }}>
    <button type="button" {...attributes} aria-label={`${name} · U${device.startRU} · ${face}`} title={standardFace||blankPanel?`${name} · U${device.startRU} · ${artFace}`:undefined} className={`physical-device-handle ${chassisPanel?"chassis-nameplate":""}`} onClick={() => controls.onSelect?.(device.id)} onContextMenu={e => { e.preventDefault(); controls.onContext?.(device.id, e.clientX, e.clientY); }}>{!switchWithoutLabel&&!blankPanel&&!b300&&<><span className="equipment-name">{name}{standardFace&&` · U${device.startRU}`}</span>{device.catalogDevice.heightRU > 1 && !pocket && <small>U{device.startRU}–U{device.startRU + device.catalogDevice.heightRU - 1}</small>}</>}</button>
    {rear && !twin && !pocket && device.catalogDevice.nodeNames?.length ? <div className="rear-node-zones">{device.catalogDevice.nodeNames.map(name => <button type="button" key={name} disabled={controls.disabled} aria-label={`Edit ${name} at U${device.startRU}`} data-status={readDetails(device.details).nodes[name]?.status || "active"} onClick={() => controls.onNode?.(device.id, name)} onContextMenu={e => { e.preventDefault(); controls.onNode?.(device.id, name); }}>{name}</button>)}</div> : null}
    {illustrated&&pocket&&<PocketFace profile={art!} face={artFace}><FaceConnections vertical profile={art!} face={artFace} ports={device.networkPorts} connected={device.connectedPorts} psuDescription={device.psuDescription} psus={device.connectedPsus} href={device.networkHref} deviceId={device.id}/></PocketFace>}
    {illustrated&&!twin&&!pocket&&fitted&&<svg className="catalog-face-connections catalog-hardware-face" viewBox={crop} preserveAspectRatio="none" aria-label={`${art!.label} ${artFace} face`}>
      <image href={artworkUrl(art!,artFace)} width="800" height={faceHeight}/>
      <FaceConnections profile={art!} face={artFace} ports={device.networkPorts} connected={device.connectedPorts} psuDescription={device.psuDescription} psus={device.connectedPsus} href={device.networkHref} deviceId={device.id}/>
    </svg>}
    {illustrated&&standardFace&&<StandardRackFace profile={art!} face={artFace}><FaceConnections profile={art!} face={artFace} ports={device.networkPorts} connected={device.connectedPorts} psuDescription={device.psuDescription} psus={device.connectedPsus} href={device.networkHref} deviceId={device.id}/></StandardRackFace>}
    {illustrated&&!twin&&!pocket&&!fitted&&!standardFace&&!b300&&<><img className="catalog-rack-face" src={artworkUrl(art!,artFace)} alt={`${art!.label} ${artFace} schematic`}/><svg className="catalog-face-connections" viewBox={`0 0 800 ${faceHeight}`} preserveAspectRatio="none"><FaceConnections profile={art!} face={artFace} ports={device.networkPorts} connected={device.connectedPorts} psuDescription={device.psuDescription} psus={device.connectedPsus} href={device.networkHref} deviceId={device.id}/></svg></>}
    {/* Fit the B300 face to its existing RU envelope; artwork and ports share this transform. */}
    {b300&&<svg className="catalog-face-connections" viewBox="0 0 800 640" preserveAspectRatio="none" aria-label={`${art!.label} ${artFace} face`}><image href={artworkUrl(art!,artFace)} width="800" height="640" preserveAspectRatio="none"/><FaceConnections profile={art!} face={artFace} ports={device.networkPorts} connected={device.connectedPorts} href={device.networkHref} deviceId={device.id}/></svg>}
    {twin&&<GrandTwinPanel rack face={artFace} ports={device.networkPorts||[]} connected={device.connectedPorts||[]} psuDescription={device.psuDescription} psus={device.connectedPsus||[]} href={device.networkHref} deviceId={device.id} disabled={controls.disabled} onNode={controls.onNode?name=>controls.onNode?.(device.id,name):undefined}/>}
    {chassisPanel&&!rear&&<ServerFrontPanel/>}
    {rearPanel&&<ServerRearPanel ports={device.networkPorts||[]} connected={device.connectedPorts||[]} psuDescription={device.psuDescription} psus={device.connectedPsus||[]} href={device.networkHref} deviceId={device.id}/>}
    <RemoveDot device={device} controls={controls}/>
  </div>;
}
function PocketColumn({ rear, side, heightRU, devices, controls }: {
    rear: boolean;
    side: "left" | "right";
    heightRU: number;
    devices: RackGridDevice[];
    controls: Controls;
}) {
    const face = rear ? "rear" : "front";
    return <div className="physical-pockets" style={{ height: heightRU * 28 }}>{pocketBays(rear, side).map(bay => <div key={bay.from} className={`physical-pocket-bay ${bay.tone}`} style={{ top: (heightRU - bay.to) * 28, height: (bay.to - bay.from + 1) * 28 }}>{bay.positions.map(position => <Pocket key={position} position={position} face={face} devices={devices} controls={controls}/>)}</div>)}</div>;
}
function Pocket({ position, face, devices, controls }: {
    position: number;
    face: string;
    devices: RackGridDevice[];
    controls: Controls;
}) {
    const id = `${face}-pocket-${position}`, { setNodeRef, isOver } = useDroppable({ id, data: { ru: position, mounting: face, pocket: true } });
    const device = devices.find(d => d.catalogDevice.category === "switch" && position >= d.startRU && position < d.startRU + d.catalogDevice.heightRU);
    return <div ref={setNodeRef} className={`physical-pocket ${isOver ? "drop-over" : ""}`} data-drop-id={id}><span className="physical-pocket-label">U{position}</span>{device ? (position === device.startRU ? <div className="pocket-span" style={{ width: `${device.catalogDevice.heightRU * 100}%`, left: face === "rear" && device.catalogDevice.heightRU > 1 ? "-100%" : 0 }}><Device device={device} face={`${face}-pocket-${position}`} controls={controls} pocket/></div> : null) : <button className="empty-pocket" type="button" aria-label={`Place switch in ${face} pocket U${position}`} disabled={controls.disabled} onClick={() => controls.onPlace?.(position, face)}/>}</div>;
}
function PduColumn({ side, heightRU, ruPitch, devices, controls }: {
    side: string;
    heightRU: number;
    ruPitch:number;
    devices: RackGridDevice[];
    controls: Controls;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: side, data: { ru: 1, mounting: side } }), device = devices.find(d => d.mounting === side && d.catalogDevice.heightRU === 0), letter = side.startsWith("rear-left") ? "B" : "A";
    const { setNodeRef: setDragRef, attributes: dragAttributes, listeners: dragListeners, isDragging: dragging } = useDraggable({ id: device ? "pdu:" + device.id : "pdu-empty:" + side, disabled: !device || controls.disabled || device.pending, data: { kind: "placed", deviceId: device?.id, mounting: side, startRU: 1, heightRU: 0 } });
    const hidden = !!device && (dragging || controls.draggingId === device.id);
    const assignments = readDetails(device?.details).outlets;
    const modelLayout = device?.catalogDevice.pduModel === PX3_4068_ID;
    const apcLayout=/APDU10151ME/.test(device?.catalogDevice.sku||device?.catalogDevice.model||"");
    return <div ref={setNodeRef} data-mounting={side} className={`physical-pdu pdu-${letter} ${modelLayout ? "model-pdu" : ""} ${apcLayout?"apc-model-pdu":""} ${isOver ? "drop-over" : ""}`} style={{ height: heightRU * ruPitch }}><div className="physical-pdu-title">PDU-{letter}{side.endsWith("-2")?"2":devices.some(d=>d.mounting.endsWith("-2"))?"1":""}</div><button ref={setDragRef} {...(device ? dragAttributes : {})} {...(device ? dragListeners : {})} data-device-block={device ? true : undefined} style={{ visibility: hidden ? "hidden" : undefined, touchAction: "none" }} type="button" className={`physical-pdu-body ${modelLayout ? "pdu-model-handle" : device?.catalogDevice.outlets?.length ? "pdu-with-outlets" : ""}`} disabled={controls.disabled} aria-label={device ? `${device.label || device.catalogDevice.model} PDU-${letter}` : `Install PDU-${letter}`} onClick={() => device ? controls.onSelect?.(device.id) : controls.onPlace?.(1, side)} onContextMenu={e => { e.preventDefault(); if (device)
        controls.onContext?.(device.id, e.clientX, e.clientY); }}><span>{modelLayout ? <>PX3-4068YV<br/>{`${device?.catalogDevice.sku ?? ""} ${device?.catalogDevice.model ?? ""}`.match(/PX3-4068YV-(V2(?:-K[12])?)/i)?.[1] || "V2"}<br/>51 outlets</> : device ? device.label || device.catalogDevice.model : "Drop PDU here"}</span></button>{device && <>{apcLayout?<ApcPduPanel devices={devices} deviceId={device.id} networkHref={device.networkHref} ports={device.networkPorts} connected={device.connectedPorts} outlets={device.catalogDevice.outlets||[]} assignments={assignments} disabled={(controls.disabled&&!controls.onPsu)||device.pending} onOutlet={o=>controls.onOutlet?.(device.id,o)}/>:modelLayout ? <ModelPduOutlets devices={devices} deviceId={device.id} networkHref={device.networkHref} ports={device.networkPorts} connected={device.connectedPorts} letter={letter} disabled={(controls.disabled&&!controls.onPsu) || device.pending} hidden={hidden} assignments={assignments} onOutlet={outlet=>controls.onOutlet?.(device.id,outlet)}/> : <div className="pdu-outlets" style={{ visibility: hidden ? "hidden" : undefined }}>{device.catalogDevice.outlets?.slice().sort((a,b)=>((device.details as {whip?:string})?.whip==="down"?b.n-a.n:a.n-b.n)).map(outlet => <button type="button" key={outlet.n} disabled={controls.disabled&&!controls.onPsu} data-power-pdu={device.id} data-power-outlet={outlet.n} aria-label={`PDU-${letter} outlet ${outlet.n} ${outlet.type} · ${outletDestination(assignments[outlet.n],devices)}`} title={`Outlet ${outlet.n} · ${outlet.type} · ${outlet.cb?`CB ${outlet.cb}`:"Breaker unverified"} · ${outlet.phase} · ${outletDestination(assignments[outlet.n],devices)}`} data-assigned={!!assignments[outlet.n]?.deviceId} className={`pdu-outlet ${outlet.type.toLowerCase()}`} onClick={() => controls.onOutlet?.(device.id, outlet)}><span>{outlet.n}</span><i /></button>)}</div>}<RemoveDot device={device} controls={controls}/></>}</div>;
}

import {detailsObject} from './equipment-details.ts';

export type PduFeed = 'A' | 'B';
type Identity = {id?:string;mounting?:string;details?:unknown;pduFeed?:PduFeed|null};
export type PduPositionDevice = Identity & {id:string;mounting:string;label?:string|null;catalogDevice:{heightRU:number;category:string|null;model:string}};
export type PduPlacement = {id:string;mounting:string};
export type PduPositionItem = PduPlacement & {name:string;feed:PduFeed|undefined;number:1|2};
export const PDU_POSITIONS = [
  {value:'rear-left',label:'Left · inner'},
  {value:'rear-left-2',label:'Left · outer'},
  {value:'rear-right',label:'Right · inner'},
  {value:'rear-right-2',label:'Right · outer'},
] as const;

// Electrical identity belongs to the PDU. Position is only a legacy default.
// A configured supply takes precedence, just as it does in the Power Calculator.
export function pduFeed(device:Identity, configuration?:unknown):PduFeed|undefined {
  const supply=detailsObject(detailsObject(detailsObject(configuration).feedPower).supplies)[device.id||''];
  if(Object.hasOwn(detailsObject(supply),'feed'))return ['A','B'].includes(String(detailsObject(supply).feed))?detailsObject(supply).feed as PduFeed:undefined;
  if(Object.hasOwn(device,'pduFeed'))return device.pduFeed??undefined;
  const feed=detailsObject(device.details).feed;
  return feed==='A'||feed==='B'?feed:device.mounting?.startsWith('rear-right')?'A':device.mounting?.startsWith('rear-left')?'B':undefined;
}
export function pduNumber(device:Identity):1|2 {
  const number=detailsObject(device.details).pduNumber;
  return number===1||number===2?number:device.mounting?.endsWith('-2')?2:1;
}
export function pduPositionItems(devices:PduPositionDevice[],configuration:unknown):PduPositionItem[] {
  return devices.filter(d=>d.catalogDevice.category==='pdu'&&d.catalogDevice.heightRU===0).map(d=>({id:d.id,mounting:d.mounting,name:d.label||d.catalogDevice.model,feed:pduFeed(d,configuration),number:pduNumber(d)})).sort((a,b)=>(a.feed||'').localeCompare(b.feed||'')||a.number-b.number||a.id.localeCompare(b.id));
}
export function availablePduPositions(configuration:unknown) {
  const c=detailsObject(configuration);
  // Retain existing configuration keys; these flags enable physical rails.
  return PDU_POSITIONS.filter(p=>(c.pduPairs===2||!p.value.endsWith('-2'))&&(p.value.startsWith('rear-left')?c.pduB!==false:c.pduA!==false));
}
export function pduPlacementRevision(devices:PduPositionDevice[],configuration:unknown) {
  return JSON.stringify([availablePduPositions(configuration).map(p=>p.value),pduPositionItems(devices,configuration).map(p=>[p.id,p.mounting,p.feed??null,p.number])]);
}
export function swapPduSides(placements:PduPlacement[]):PduPlacement[] {
  return placements.map(p=>({...p,mounting:p.mounting.includes('left')?p.mounting.replace('left','right'):p.mounting.replace('right','left')}));
}
export function movePduInDraft(placements:PduPlacement[],id:string,mounting:string):PduPlacement[] {
  const original=placements.find(p=>p.id===id);
  if(!original)return placements;
  return placements.map(p=>p.id===id?{...p,mounting}:p.mounting===mounting?{...p,mounting:original.mounting}:p);
}
export function preservedPduIdentity(device:Identity,configuration:unknown) {
  const feed=pduFeed(device,configuration);
  if(!feed)throw Error('Set this PDU’s A/B feed in Power settings before moving it.');
  return {...detailsObject(device.details),feed,pduNumber:pduNumber(device)};
}
export function preparePduPlacement(devices:PduPositionDevice[],configuration:unknown,placements:PduPlacement[],revision:string):{error:string}|{updates:{id:string;mounting:string;details:ReturnType<typeof preservedPduIdentity>}[]} {
  if(revision!==pduPlacementRevision(devices,configuration))return {error:'PDU positions or feeds changed. Reload and arrange them again.'} as const;
  const items=pduPositionItems(devices,configuration),allowed=new Set<string>(availablePduPositions(configuration).map(p=>p.value));
  if(!Array.isArray(placements)||placements.length!==items.length||placements.length>4||placements.some(p=>!p||!items.some(d=>d.id===p.id)||!allowed.has(p.mounting))||new Set(placements.map(p=>p.id)).size!==items.length)return {error:'Choose an enabled position for every installed vertical PDU.'} as const;
  if(new Set(placements.map(p=>p.mounting)).size!==placements.length)return {error:'Each PDU needs its own position. Choose a different rail or swap the PDUs.'} as const;
  if(!items.every(p=>p.feed))return {error:'Set each PDU’s A/B feed in Power settings before moving it.'} as const;
  if(items.every(p=>placements.some(v=>v.id===p.id&&v.mounting===p.mounting)))return {updates:[]} as const;
  // Pin every PDU's original identity before any rail changes. Preserve all
  // outlet assignments, network metadata, whip orientation and unknown fields.
  return {updates:placements.map(p=>({id:p.id,mounting:p.mounting,details:preservedPduIdentity(devices.find(d=>d.id===p.id)!,configuration)}))} as const;
}

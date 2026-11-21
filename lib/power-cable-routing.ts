import {catalogProfile} from './catalog-artwork.ts';
import {catalogPowerInputs,tnmrPowerInputs} from './power-input-geometry.ts';
import type {FeedEquipment} from './feed-rack.ts';
import type {Cord} from './feed-power.ts';

export type PowerRoutingNote={deviceId:string;message:string;attention:boolean};
const railX:Record<string,number>={'rear-left-2':-.2,'rear-left':-.1,'rear-right':1.1,'rear-right-2':1.2};
export const powerRailPosition=(device:FeedEquipment|undefined)=>railX[device?.mounting||''];
export function powerInputPositions(device:FeedEquipment){
 const profile=catalogProfile(device.sku||'',device.model||'',device.rawData);
 const boxes=/AS-?\s*8126GS-TNMR/i.test(device.model||'')?tnmrPowerInputs:profile?catalogPowerInputs(profile):[];
 // Pocket faces rotate. Without rack pocket geometry, do not apply flat-face
 // coordinates; likewise a rear-mounted server exposes its front here.
 const rotated=device.category==='switch'&&Number(device.startRU)>=49&&Number(device.startRU)<=60;
 return new Map((rotated||device.mounting==='rear'&&device.category!=='switch'?[]:boxes).map(p=>[p.n,(p.box.x+p.box.w/2)/800]));
}
const inputKey=(c:Cord)=>`${c.deviceId}:${c.inlet}`;
export const powerEndpointKey=(c:Cord)=>`${c.pduId}:${c.outlet}`;

// Refine the existing calculator's checked outlets, never select new outlets.
// Its load model shares demand equally between a device's inputs: permuting
// unfixed input identities preserves every outlet, bank, phase and feed load.
export function routePowerAssignments(equipment:FeedEquipment[],assignments:Cord[],fixed:Cord[]){
 const devices=new Map(equipment.map(e=>[e.id,e])),locked=new Set(fixed.map(inputKey));
 const replacements=new Map<string,Cord>(),notes:PowerRoutingNote[]=[];
 for(const id of new Set(assignments.map(c=>c.deviceId))){
  const device=devices.get(id)!,all=assignments.filter(c=>c.deviceId===id),free=all.filter(c=>!locked.has(inputKey(c)));
  const positions=powerInputPositions(device),destination=(c:Cord)=>powerRailPosition(devices.get(c.pduId));
  if(all.some(c=>!positions.has(c.inlet)||destination(c)===undefined)){
   notes.push({deviceId:id,attention:true,message:'Cable routing needs review: PSU positions or PDU mounting are not available for this layout. Electrical assignments are retained.'});continue;
  }
  // Minimum-distance matching of at most 12 inputs, O(n² * 2^n). Squared
  // horizontal distances prefer ordered, non-crossing left/right pairings.
  // Equal costs retain existing inlet choices. Never permute saved inputs.
  const n=free.length,states=1<<n,cost=new Float64Array(states).fill(Infinity),changes=new Uint8Array(states).fill(255),previous=new Int16Array(states).fill(-1);
  cost[0]=0;changes[0]=0;
  const count=new Uint8Array(states);for(let mask=1;mask<states;mask++)count[mask]=count[mask>>1]+(mask&1);
  for(let mask=0;mask<states-1;mask++){
   const slot=count[mask],outlet=free[slot];
   for(let i=0;i<n;i++)if(!(mask&(1<<i))){
    const next=mask|(1<<i),distance=cost[mask]+(positions.get(free[i].inlet)!-destination(outlet))**2,changed=changes[mask]+Number(i!==slot);
    if(distance<cost[next]-1e-9||Math.abs(distance-cost[next])<1e-9&&changed<changes[next]){cost[next]=distance;changes[next]=changed;previous[next]=i;}
   }
  }
  for(let mask=states-1,slot=n-1;slot>=0;slot--){const i=previous[mask];replacements.set(powerEndpointKey(free[slot]),{...free[slot],inlet:free[i].inlet});mask^=1<<i;}
  const routed=all.map(c=>replacements.get(powerEndpointKey(c))||c);
  const opposite=routed.some(c=>(positions.get(c.inlet)!<.5)!==(destination(c)<.5));
  const crossed=routed.some((a,i)=>routed.slice(i+1).some(b=>(positions.get(a.inlet)!-positions.get(b.inlet)!)*(destination(a)-destination(b))< -1e-9));
  const saved=all.some(c=>locked.has(inputKey(c)));
  notes.push({deviceId:id,attention:opposite||crossed,message:opposite||crossed
   ?`Some inputs must reach the opposite side or cross an existing route with the checked outlets${saved?' and fixed saved wiring':''}. Use a managed path around the chassis edge; keep fans and service access clear.`
   :'PSUs matched to the PDU rails on the same side using the rear artwork. Keep cables in the side managers and clear of fans and service access.'});
 }
 return {assignments:assignments.map(c=>replacements.get(powerEndpointKey(c))||c),notes};
}

import {pduModelId,PX3_4068_ID} from './pdu-models.ts';
// Shared by every project: select by installed electrical models, not project identity.
export function rackPowerPlanner(devices:{catalogDevice:{category:string|null;rawData:unknown}}[],pduPairs:1|2=1):'raritan'|'feed'{
 const pdus=devices.filter(d=>d.catalogDevice.category==='pdu');
 return pduPairs===1&&pdus.length===2&&pdus.every(d=>pduModelId(d.catalogDevice.rawData)===PX3_4068_ID)?'raritan':'feed';
}

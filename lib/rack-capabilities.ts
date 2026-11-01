import {isB300PowerDevice} from './b300-power-inputs.ts';
import {pduModelId,PX3_4068_ID} from './pdu-models.ts';
// Shared by every project: select by installed electrical models, not project identity.
export function rackPowerPlanner(devices:{catalogDevice:{sku?:string|null;model?:string;category:string|null;rawData:unknown}}[],pduPairs:1|2=1):'raritan'|'feed'{
 if(devices.some(d=>isB300PowerDevice(d.catalogDevice)))return 'feed';
 const pdus=devices.filter(d=>d.catalogDevice.category==='pdu');
 return pduPairs===1&&pdus.length===2&&pdus.every(d=>pduModelId(d.catalogDevice.rawData)===PX3_4068_ID)?'raritan':'feed';
}

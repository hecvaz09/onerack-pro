import {feedRack,type FeedEquipment} from './feed-rack.ts';
import {supplyIssues,type FeedInputs} from './feed-power.ts';
export type SetupCheck={deviceId:string;name:string;field?:string;target:'power-equipment'|'power-feeds';message:string;blocking:boolean};
export function powerSetupAudit(equipment:FeedEquipment[],inputs:FeedInputs){
 const {loads,supplies}=feedRack(equipment,inputs),checks:SetupCheck[]=[];
 for(const d of loads){
  const add=(field:string,message:string,blocking=true)=>checks.push({deviceId:d.id,name:d.name,field,target:'power-equipment',message,blocking});
  if(!Number.isFinite(d.watts)||Number(d.watts)<=0)add('watts','Whole-system AC demand is missing.');
  if(!Number.isFinite(d.pf)||Number(d.pf)<=0||Number(d.pf)>1)add('pf','Power factor is missing or invalid.');
  if(!['C13','C19'].includes(d.connector))add('connector','Cord connector is missing or unsupported. Confirm C13 or C19 from the cord; Library inlet C14 maps to C13, C20 to C19.');
  if(!Number.isFinite(d.cordLimitAmps)||Number(d.cordLimitAmps)<=0)add('cordLimitAmps','Usable cord current is missing. Check the installed cord rating; a PSU input-current rating is not a cord rating.');
  if(!Number.isInteger(d.cords)||d.cords<2||d.cords>(d.assessment==='pdu-capacity'?12:6))add('cords','Review the number of power inputs used for planning.');
  if(!Number.isInteger(d.minimumCords)||d.minimumCords<1||Math.floor(d.cords/2)<d.minimumCords)add('minimumCords','Review the minimum surviving PSU count for loss of either feed.');
  if(!d.minVoltage||!d.maxVoltage)add('minVoltage','PSU voltage range is undocumented; planning verification remains pending.',false);
  if(d.assessment!=='pdu-capacity'&&!d.psuAcCapacity)add('psuAcCapacity','Supported AC load per PSU is undocumented; planning verification remains pending. DC output watts are not an AC limit.',false);
 }
 if(!supplies.some(p=>p.feed==='A')||!supplies.some(p=>p.feed==='B'))checks.push({deviceId:'feeds',name:'Rack power feeds',target:'power-feeds',message:'Both independent feeds A and B are required.',blocking:true});
 for(const p of supplies)for(const message of supplyIssues(p))checks.push({deviceId:p.id,name:p.name,target:'power-feeds',message,blocking:true});
 return checks;
}

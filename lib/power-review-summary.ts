type EquipmentLabel={name:string;model?:string|null};
export type ReviewGroup={message:string;devices:string[]};
// Presentation only: every original diagnostic remains available for inspection.
export function powerReviewSummary(issues:string[],equipment:EquipmentLabel[]){
 const assumptions:string[]=[],actions=new Map<string,ReviewGroup>();
 for(const issue of [...new Set(issues)]){
  if(issue.includes('power estimate uses unverified efficiency, power factor and load assumptions')){
   if(!assumptions.length)assumptions.push('Power estimates use assumed efficiency, power factor and workload. They are planning values, not measured consumption.');
   continue;
  }
  const device=[...equipment].sort((a,b)=>b.name.length-a.name.length).find(e=>issue.startsWith(e.name+':'));
  const message=device?issue.slice(device.name.length+1).trim():issue;
  const model=device?.model||device?.name||'';
  const key=model+'\n'+message;
  const group=actions.get(key)||{message:model?`${model}: ${message}`:message,devices:[]};
  if(device&&!group.devices.includes(device.name))group.devices.push(device.name);
  actions.set(key,group);
 }
 return {actions:[...actions.values()],assumptions};
}

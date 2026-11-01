"use server";
import {revalidatePath} from "next/cache";
import {rackMutation} from "@/lib/rack-mutation";
import {matchesPowerInputsRevision,powerInputsRevision,lockedPowerInputRack} from "@/lib/power-input-revision";
import {POWER_INPUT_CONFLICT} from "@/lib/power-input-state";
import {detailsObject,readDetails} from "@/lib/equipment-details";
import {readPx3Settings,px3SettingsError,balancePx3,powerRevision,type Px3Settings,type PowerEquipment} from "@/lib/px3-power";

export async function savePowerSettings(rackId:string,settings:Px3Settings,expectedRevision?:unknown){
  const error=px3SettingsError(settings);if(error)return {ok:false,error};
  try{
    const result=await rackMutation(rackId,async tx=>{
      const rack=await lockedPowerInputRack(tx,rackId);
      if(!rack)return {error:"Rack not found."};
      if(!matchesPowerInputsRevision(expectedRevision,rackId,rack))return {error:POWER_INPUT_CONFLICT,conflict:true as const};
      const budgets=Object.fromEntries(Object.entries(settings.budgets).filter(([id])=>rack.devices.some(d=>d.id===id)));
      const previous=rack.configuration as Record<string,unknown>;
      await tx.rack.update({where:{id:rackId},data:{configuration:JSON.parse(JSON.stringify({...previous,px3Power:{...settings,budgets}}))}});
      const savedRack=await tx.rack.findUniqueOrThrow({where:{id:rackId},include:{devices:{include:{catalogDevice:true}}}});
      return {projectId:rack.projectId,revision:powerInputsRevision(rackId,savedRack),saved:readPx3Settings(savedRack.configuration)};
    });
    if("error" in result)return {ok:false,error:result.error,conflict:'conflict' in result&&result.conflict===true};
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}`);return {ok:true,revision:result.revision,saved:result.saved};
  }catch{return {ok:false,error:"Could not save power settings."};}
}
export async function applyPowerBalance(rackId:string,revision:string,inputs?:Px3Settings,expectedInputRevision?:unknown){
  if(inputs){const error=px3SettingsError(inputs);if(error)return {ok:false,error};}
  if(typeof revision!=="string"||revision.length>2000000)return {ok:false,error:"Invalid plan."};
  try{
    const result=await rackMutation(rackId,async tx=>{
      const rack=inputs?await lockedPowerInputRack(tx,rackId):await tx.rack.findUnique({where:{id:rackId},include:{devices:{include:{catalogDevice:true},orderBy:{startRU:"asc"}}}});
      if(!rack)return {error:"Rack not found."};
      if(inputs&&!matchesPowerInputsRevision(expectedInputRevision,rackId,rack))return {error:POWER_INPUT_CONFLICT,conflict:true as const};
      const equipment:PowerEquipment[]=rack.devices.map(d=>({id:d.id,name:`${d.label||d.catalogDevice.model} · U${d.startRU}`,sku:d.catalogDevice.sku,model:d.catalogDevice.model,mounting:d.mounting,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData,details:d.details}));
      if((rack.configuration as {feedPower?:{cablePolicy?:string}}|null)?.feedPower?.cablePolicy==='low-ru-c13-switch-top')return {error:'This rack uses C13-only / dedicated switch outlet rules. Use the shared power planner to calculate and save cables.'};
      const savedSettings=readPx3Settings(rack.configuration);
      if(powerRevision(equipment,savedSettings)!==revision)return {error:"The rack or power inputs changed. Reload and preview a fresh plan."};
      const settings=inputs??savedSettings;
      const plan=balancePx3(equipment,settings);
      if(plan.error||!plan.analysis.ready)return {error:plan.error||"This plan is not ready to apply."};
      if(inputs)await tx.rack.update({where:{id:rackId},data:{configuration:JSON.parse(JSON.stringify({...rack.configuration as Record<string,unknown>,px3Power:settings}))}});
      for(const pdu of equipment.filter(d=>d.category==="pdu")){
        const details=detailsObject(pdu.details),outlets=detailsObject(details.outlets);
        const previous=readDetails(pdu.details).outlets;
        for(const [n,a] of Object.entries(previous))if(a.deviceId&&a.locked===false){
          const cleared:Record<string,unknown>={...detailsObject(outlets[n]),deviceId:"",notes:a.notes};
          delete cleared.inlet;delete cleared.locked;
          outlets[n]=cleared;
        }
        for(const a of plan.assignments.filter(a=>a.pduId===pdu.id))outlets[a.outlet]={...detailsObject(outlets[a.outlet]),deviceId:a.deviceId,inlet:a.inlet,locked:a.locked,notes:previous[a.outlet]?.notes||""};
        await tx.deviceInstance.update({where:{id:pdu.id},data:{details:JSON.parse(JSON.stringify({...details,outlets}))}});
      }
      if(inputs){
        const savedRack=await tx.rack.findUniqueOrThrow({where:{id:rackId},include:{devices:{include:{catalogDevice:true}}}});
        return {projectId:rack.projectId,revision:powerInputsRevision(rackId,savedRack),saved:readPx3Settings(savedRack.configuration)};
      }
      return {projectId:rack.projectId};
    });
    if("error" in result)return {ok:false,error:result.error,conflict:'conflict' in result&&result.conflict===true};
    revalidatePath(`/projects/${result.projectId}/racks/${rackId}`);return {ok:true,...('revision' in result?{revision:result.revision,saved:result.saved}:{})};
  }catch{return {ok:false,error:"Could not apply the plan. No partial cable changes were saved."};}
}

// Device AC demand is independent of PDU brand and workbook data.
export function acDemand(watts:number,pf:number,voltage:number,headroomPercent=0){
  if(![watts,pf,voltage,headroomPercent].every(Number.isFinite)||watts<0||pf<=0||pf>1||voltage<=0||headroomPercent<0||headroomPercent>100)throw new Error("Invalid AC demand inputs.");
  const plannedWatts=watts*(1+headroomPercent/100);
  return {watts:plannedWatts,va:plannedWatts/pf,amps:plannedWatts/pf/voltage};
}

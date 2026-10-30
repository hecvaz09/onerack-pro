export type PowerMeasurement={watts:number;source:string};
export type ConsumptionInput={watts?:unknown;measurement?:unknown;estimateSource?:unknown};
export function isMeasuredPower(value:ConsumptionInput){
 const m=value.measurement as PowerMeasurement|undefined;
 return !!m&&Number.isFinite(m.watts)&&m.watts>0&&m.watts===value.watts&&typeof m.source==='string'&&!!m.source.trim();
}
export function consumptionLabel(value:ConsumptionInput){
 return isMeasuredPower(value)?'Actual Measured Power Consumption (Live Verified Data)':value.estimateSource?'Estimated power consumption':'Entered power consumption (source not recorded)';
}
export function consumptionSummary(value:ConsumptionInput){
 return `${typeof value.watts==='number'?value.watts.toLocaleString('en-US'):'Not recorded'} W · ${consumptionLabel(value)}`;
}

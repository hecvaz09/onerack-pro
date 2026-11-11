export function supportedNetworkSpeeds(value:string):number[]|null{
 if(!value.trim())return [];
 const values=value.split(',').map(v=>Number(v.trim()));
 return values.length<=20&&values.every(n=>Number.isFinite(n)&&n>0&&n<=1000000)?[...new Set(values)].sort((a,b)=>a-b):null;
}
export function networkSpeedLabel(port:{speedGbps:number|null;supportedSpeedsGbps?:number[]}){
 return port.speedGbps?`${port.speedGbps} Gb/s`:port.supportedSpeedsGbps?.length?`Supports ${port.supportedSpeedsGbps.join('/')} Gb/s; link rate not set`:'Unknown speed';
}

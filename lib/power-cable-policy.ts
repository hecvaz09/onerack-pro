export type PowerCablePolicy='balanced'|'low-ru-c13-switch-top';
export const SWITCH_POWER_OUTLETS=[7,11,15,19,23,27] as const;
export function policyAllows(policy:PowerCablePolicy|undefined,category:string|null|undefined,outlet:{n:number;connectors:string[]}){
 if(policy!=='low-ru-c13-switch-top')return true;
 if(outlet.connectors.includes('C19')||!outlet.connectors.includes('C13'))return false;
 const reserved=(SWITCH_POWER_OUTLETS as readonly number[]).includes(outlet.n);
 return category==='switch'?reserved:!reserved;
}
export function equipmentRU(e:{startRU?:number;name:string}){return e.startRU??Number(e.name.match(/\bU(\d+)\b/)?.[1]??Number.MAX_SAFE_INTEGER);}

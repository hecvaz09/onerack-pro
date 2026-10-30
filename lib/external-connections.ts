export const EXTERNAL_STAGES={planned:'Planned',awaiting_site:'Rack end connected · Awaiting site',connected:'Connected on site'} as const;
export type ExternalEndpoint={site:string;equipment:string;port:string;status:keyof typeof EXTERNAL_STAGES;notes:string};
export function readExternal(value:unknown):ExternalEndpoint|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const v=value as Record<string,unknown>;
 if(!['site','equipment','port','notes'].every(k=>typeof v[k]==='string'&&(v[k] as string).length<=500)||!Object.hasOwn(EXTERNAL_STAGES,String(v.status)))return null;
 return {site:(v.site as string).trim(),equipment:(v.equipment as string).trim(),port:(v.port as string).trim(),notes:(v.notes as string).trim(),status:v.status as ExternalEndpoint['status']};
}
export function externalName(value:unknown):string{
 const e=readExternal(value);if(e&&!e.site&&!e.equipment&&!e.port)return 'External · To be assigned on site';return e?`External · ${[e.site,e.equipment,e.port||'Port TBD'].filter(Boolean).join(' / ')}`:'External destination';
}
export function externalStatus(value:unknown):string{const e=readExternal(value);return e?EXTERNAL_STAGES[e.status]:'';}

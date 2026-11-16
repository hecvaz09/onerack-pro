// Compatibility annotation only: a matching number does not prove its origin
// or the rating of a physical cable. Never change an existing numeric limit.
export function cableLimitSource(value:{connector?:string;cordLimitAmps?:number;cordLimitSource?:string}){
 if(!value.cordLimitAmps)return undefined;
 if(value.cordLimitSource)return value.cordLimitSource;
 if(value.connector==='C13'&&value.cordLimitAmps===12||value.connector==='C19'&&value.cordLimitAmps===16)
  return 'Saved planning limit matches a legacy default; its source and installed cable rating are unverified.';
 return 'Saved planning limit; installed cable rating remains unverified.';
}

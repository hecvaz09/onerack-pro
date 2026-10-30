import profiles from '../data/catalog/researched-profiles.json' with {type:'json'};
export type CatalogProfile=typeof profiles[number];
export function catalogProfile(sku:string,model=''):CatalogProfile|undefined{
  const exact=profiles.find(p=>p.skus.includes(sku));if(exact)return exact;
  if(/\[TEST\]/i.test(model))return profiles.find(p=>model.includes('AS-8126GS-TNMR')?p.key==='smc-as8126':model.includes('92348GC-X')?p.key==='cisco-92348':model.includes('9336C-FX2')?p.key==='cisco-9336':model.includes('PX3-4068YV')?p.key==='raritan-px3':false);
}
export function artworkUrl(profile:CatalogProfile,face:'front'|'rear',sku?:string){
 if(profile.key==='raritan-px3'&&sku){const variant=/K2$/i.test(sku)?'k2':'k1';return `/equipment-artwork/raritan-px3-${variant}-horizontal-${face}.svg`;}
 return `/equipment-artwork/${profile.key}-${face}.svg`;
}

// These existing SVGs deliberately stretch inside rack panels. Library previews
// must instead reserve the source viewBox proportions without editing shared art.
export function catalogReferenceDimensions(profile:CatalogProfile,face:'front'|'rear'){
 return profile.key==='smc-as8126'?{width:800,height:face==='front'?640:440}:undefined;
}

// Passive main-bay 1U cover only; never infer blanking hardware from a label.
export function isBlankingPanel(sku:string|null|undefined,model:string,heightRU:number,pocket=false){
 return !pocket&&heightRU===1&&catalogProfile(sku||'',model)?.key==='blank-1u';
}

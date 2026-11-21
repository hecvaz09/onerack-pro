import {readSystemSpecs,systemSpecsError} from './system-specs.ts';
import {networkPorts} from './network-ports.ts';
import {catalogProfile,artworkUrl} from './catalog-artwork.ts';
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
export type LibraryRecord={sku:string|null;model:string;rawData:unknown};
export function libraryIntegrity(records:LibraryRecord[],assetExists?:(path:string)=>boolean){
 const errors:string[]=[],skus=new Set<string>();
 for(const r of records){
  const sku=r.sku||r.model,raw=obj(r.rawData),error=systemSpecsError(raw.systemSpecs);
  if(skus.has(sku))errors.push(`${sku}: duplicate Library identity.`);skus.add(sku);
  if(error){errors.push(`${sku}: ${error}`);continue;}
  const specs=readSystemSpecs(raw);
  for(const c of specs.components)for(const [key,review] of Object.entries(c.fieldReviews||{}))
   if(review.value!==c.attributes[key]||review.model!==c.model||review.manufacturer!==c.manufacturer)errors.push(`${sku}: ${c.model} has a stale ${key} review.`);
  const count=specs.components.filter(c=>c.kind==='psu').reduce((n,c)=>n+c.quantity,0),old=Number(obj(raw.psu).count);
  if(count&&old&&old!==count)errors.push(`${sku}: legacy and structured PSU counts disagree.`);
  const ports=networkPorts(raw);if(new Set(ports.map(p=>p.id)).size!==ports.length)errors.push(`${sku}: duplicate network endpoint IDs.`);
  const profile=catalogProfile(r.sku||'',r.model,raw);
  const reference=obj(raw.catalogReference);
  if(profile)for(const face of ['front','rear'] as const)if(reference[face+'Svg']&&reference[face+'Svg']!==artworkUrl(profile,face,r.sku||undefined,raw))errors.push(`${sku}: stale ${face} artwork reference.`);
  if(profile&&assetExists)for(const face of ['front','rear'] as const){const path=artworkUrl(profile,face,r.sku||undefined,raw);if(!assetExists(path))errors.push(`${sku}: missing ${face} reference artwork.`);}
 }
 return errors;
}

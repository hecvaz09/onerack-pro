import {manufacturerSpecifications} from './manufacturer-specifications.ts';
import {mergeSystemSpecs,readSystemSpecs,systemSpecsError} from './system-specs.ts';
import {catalogProfile,artworkUrl} from './catalog-artwork.ts';
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
export const B300_PLANNING_NOTE='Twelve physical AC inputs are mapped for PDU capacity planning. Internal PSU redundancy and the installed module/cord configuration still require verification.';
export function synchronizeLibraryArtwork(sku:string,raw:Record<string,unknown>){
 const profile=catalogProfile(sku,'',raw),reference=obj(raw.catalogReference);
 return profile&&raw.catalogReference?{...raw,catalogReference:{...reference,profile:profile.key,frontSvg:artworkUrl(profile,'front',sku,raw),rearSvg:artworkUrl(profile,'rear',sku,raw)}}:raw;
}
// Explicit maintenance operation. Ordinary Library saves synchronize metadata,
// but do not silently apply newly researched specifications to existing models.
export function maintainLibraryReference(sku:string,raw:unknown){
 const original=obj(raw);
 const error=systemSpecsError(original.systemSpecs);if(error)throw new Error(error);
 const result=manufacturerSpecifications(sku,readSystemSpecs(raw));
 if(sku==='AS-8126GS-NB3RT')result.specs.notes=result.specs.notes.replace('Each illustrated PSU has paired AC inputs; the current visual power mapper does not validate that topology.',B300_PLANNING_NOTE);
 const data=mergeSystemSpecs(raw,result.specs);
 if(['SYS-420GP-TNR','SYS-821GV-TNR'].includes(sku)&&Number(obj(data.psu).count)===(sku==='SYS-420GP-TNR'?4:6)){
  // These two obsolete watt values have no reliable AC/DC meaning. Remove
  // their unused legacy copies; the structured, sourced PSU output is retained.
  const psu={...obj(data.psu)};delete psu.watts;data.psu=psu;
  if(Array.isArray(data.tags))data.tags=data.tags.filter(tag=>tag!==(sku==='SYS-420GP-TNR'?'3200W':'6400W'));
 }
 return {rawData:synchronizeLibraryArtwork(sku,data),changes:result.changes,conflicts:result.conflicts};
}

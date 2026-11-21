import {catalogBaseSku} from './catalog-identity.ts';
import {catalogProfile,artworkUrl} from './catalog-artwork.ts';

export type CatalogCopySource={id:string;revision:string};
type Source={sku:string;model:string;rawData:unknown};
const obj=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};

// Only the catalog model is read. DeviceInstance details, rack budgets and
// Connection rows are deliberately outside this operation.
export function duplicateCatalogRaw(source:Source){
 const raw=structuredClone(obj(source.rawData));
 // Discard legacy installation containers if one was embedded in a model.
 for(const key of ['details','installation','measurements','measurement','connections','cables','feedPower','px3Power','powerDraft','hostname','ip','serial'])delete raw[key];
 if(raw.powerLoad){
  const power={...obj(raw.powerLoad)};
  for(const key of ['watts','pf','measurement','estimateSource','pfEstimateSource'])delete power[key];
  raw.powerLoad=power;
 }
 // Voltage/topology/outlet limits describe the model. Site verification belongs
 // to each installation and must be confirmed again for a newly placed copy.
 if(raw.electricalProfile)raw.electricalProfile={...obj(raw.electricalProfile),confirmed:false};
 // The old watts field mixed chassis consumption with PSU output. A new
 // configuration keeps explicit component ratings, never this ambiguous value.
 if(raw.psu){const psu={...obj(raw.psu)};delete psu.watts;raw.psu=psu;}
 const baseSku=catalogBaseSku(source.sku,source.rawData),profile=catalogProfile(source.sku,source.model,source.rawData);
 raw.catalogReference={...obj(raw.catalogReference),baseSku,...(profile?{profile:profile.key,frontSvg:artworkUrl(profile,'front',baseSku),rearSvg:artworkUrl(profile,'rear',baseSku)}:{})};
 delete raw.libraryOnboarding;
 return raw;
}

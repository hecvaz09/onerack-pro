import {maintainLibraryReference} from './library-reference-maintenance.ts';
import {mergeSystemSpecs,readSystemSpecs,type CatalogInput,type SystemComponent} from './system-specs.ts';
import {NETWORK_REFERENCE_SOURCES as sources} from './manufacturer-network-references.ts';
import {onboardingMetadata} from './library-onboarding.ts';

const referenceSources:Record<string,string>={
 'UNC-ESC8000A-E12-26W10G':sources.asus,'UNC-FS-S3900-48T6S-R':sources.fs,
 'UNC-MQM8700-HS2F':sources.qm8700,'UNC-SSG-641E-E1CR36L':sources.storage,
};
export function grandTwinPowerReference():SystemComponent{
 return {id:'grandtwin-high-line-ac-reference',kind:'psu',manufacturer:'Supermicro',model:'SYS-211GT-HNTR shared AC supply reference; installed FRU unconfirmed',quantity:2,attributes:{inputVoltage:'200-240 VAC',redundancy:'1+1'},notes:'Two shared redundant supply modules documented in MNL-2513. High-line AC reference only; verify the installed FRU and applicable output derating. This is not a whole-chassis AC demand value.'};
}

// Explicit, model-scoped maintenance; never changes an installed device budget.
export function completeLibraryModel(input:Omit<CatalogInput,'specs'>,original:unknown){
 const specs=structuredClone(readSystemSpecs(original));
 if(!specs.sourceUrl&&referenceSources[input.sku])specs.sourceUrl=referenceSources[input.sku];
 if(['SYS-211GT-HNTR-CU1-TT019','SYS-211GT-HNTR-CK2-TT019'].includes(input.sku)&&!specs.components.some(c=>c.kind==='psu'))specs.components.push(grandTwinPowerReference());
 if(input.sku==='UNC-MQM8700-HS2F'&&!specs.components.some(c=>c.kind==='network'&&/^(MGMT|BMC|Management)$/i.test(c.attributes.slot||'')))specs.components.push({id:'qm8700-management',kind:'network',manufacturer:'NVIDIA / Mellanox',model:'Management Ethernet',quantity:1,attributes:{slot:'MGMT',ports:'1',protocol:'Ethernet',connector:'RJ45'},notes:'Dedicated 100/1000 RJ45 management port documented in the QM8700 product brief. Configured speed remains unconfirmed.'});
 if(input.sku==='UNC-APDU10151ME'){
  const c=specs.components.find(c=>c.id==='pdu-mgmt');
  if(c&&!c.notes.includes('990-91564B'))c.notes+=' Manufacturer guide 990-91564B documents one 10/100 port and one 10/100/1000 port. Shared supported speeds below are the common 10/100 capability only. Confirm which existing MGMT endpoint maps to the gigabit socket before planning a 1G link.';
 }
 const result=maintainLibraryReference(input.sku,mergeSystemSpecs(original,specs));
 const raw=result.rawData,updated={...input,specs:readSystemSpecs(raw)};
 return {...result,rawData:{...raw,systemSpecs:updated.specs,libraryOnboarding:onboardingMetadata(updated,raw)}};
}

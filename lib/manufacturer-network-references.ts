import type {SystemSpecs,SystemComponent} from './system-specs.ts';

// Capabilities describe the identified hardware. They never select a link speed,
// an optional adapter, a fabric, a transceiver or an installed power budget.
type Fill=(component:SystemComponent,field:string,value:string,source:string,reviewedAt?:string)=>void;
const SM='https://www.supermicro.com/en/products/system/';
export const NETWORK_REFERENCE_SOURCES={
 arista7010:'https://www.arista.com/assets/data/pdf/Datasheets/7010TX-Datasheet.pdf',
 arista7050:'https://www.arista.com/assets/data/pdf/Datasheets/7050X3-Datasheet.pdf',
 cisco92348:'https://www.cisco.com/c/en/us/td/docs/switches/datacenter/nexus9000/hw/n92348gc-x-hig/b_n92348GC-X-nxos-hardware-installation-guide/b_n9248GC-FX-nxos-hardware-installation-guide_chapter_01.html',
 cisco9336:'https://www.cisco.com/c/en/us/td/docs/switches/datacenter/nexus9000/hw/n9336cfx2_hig/guide/b_n9336cFX2_nxos_hardware_installation_guide/b_n9336cFX2_nxos_hardware_installation_guide_chapter_01.html',
 raritan:'https://cdn.raritan.com/product-selector/pdus/PX3-4068YV-V2/PX3-4068YV-V2-spec.pdf',
 fs:'https://resource.fs.com/mall/doc/2023010310561006npi3.pdf',
 qm8700:'https://network.nvidia.com/sites/default/files/doc-2020/pb-qm8700.pdf',
 cx6:'https://docs.nvidia.com/networking/display/nvidia-connectx-6-infiniband-ethernet-adapter-cards-user-manual.pdf',
 i350:'https://www.supermicro.com/en/support/resources/aoc/standard?show=SELECT&type=Capacity',
 asus:'https://dlcdnets.asus.com/pub/ASUS/server/ESC8000A-E12/Manual/E22384_ESC8000A-E12_UM_V4_WEB.pdf',
 grandtwin:SM+'GrandTwin/2U/SYS-211GT-HNTR',
 b300:'https://www.supermicro.com/en/support/manuals/product/system/as-8126gs-nb3rt/Content/introduction/overview-as-8126gs-nb3rt.htm',
 b300Mgmt:'https://store.supermicro.com/us_en/systems/gpu.html',
 tnmr:SM+'datasheet/as-8126gs-tnmr',
 storage:SM+'STORAGE/4U/SSG-641E-E1CR36L',
 gpu420:SM+'gpu/4u/sys-420gp-tnr',
 apc:'https://download.se.com/files?p_Doc_Ref=990-91564_EN',
 cisco92348Network:'https://www.cisco.com/c/en/us/td/docs/switches/datacenter/nexus9000/hw/n92348gc-x-hig/b_n92348GC-X-nxos-hardware-installation-guide/b_n9248GC-FX-nxos-hardware-installation-guide_chapter_0100.html',
 gpu821:'https://www.supermicro.com/manuals/superserver/8U/MNL-2637.pdf',
 cisco9336Network:'https://www.cisco.com/c/en/us/td/docs/switches/datacenter/nexus9000/hw/n9336cfx2_hig/guide/b_n9336cFX2_nxos_hardware_installation_guide/b_n9336cFX2_nxos_hardware_installation_guide_chapter_0100.html',
} as const;

export function completeManufacturerNetworkReferences(sku:string,specs:SystemSpecs,fill:Fill){
 const key=sku.toUpperCase(),s=NETWORK_REFERENCE_SOURCES;
 const apply=(c:SystemComponent,values:Record<string,string>,source:string)=>{
  for(const [field,value] of Object.entries(values))fill(c,field,value,source,'2026-11-16');
 };
 const ethernet=(c:SystemComponent,ports:string,connector:string,speeds:string,source:string)=>apply(c,{ports,protocol:'Ethernet',connector,supportedSpeedsGbps:speeds},source);
 for(const c of specs.components.filter(c=>c.kind==='network')){
  const model=c.model.toUpperCase(),slot=(c.attributes.slot||'').toUpperCase();
  if(model==='MCX653105A-HDAT'){
   apply(c,{ports:'1',connector:'QSFP56'},s.cx6);
   // This VPI adapter supports both protocols. Preserve the user's selection.
   if(c.attributes.protocol==='InfiniBand')apply(c,{protocol:'InfiniBand',supportedSpeedsGbps:'200'},s.cx6);
   if(c.attributes.protocol==='Ethernet')apply(c,{protocol:'Ethernet',supportedSpeedsGbps:'10,25,40,50,100,200'},s.cx6);
  }
  if(model==='AOC-SGP-I4')ethernet(c,'4','RJ45','1',s.i350);
  if(['SYS-211GT-HNTR-CU1-TT019','SYS-211GT-HNTR-CK2-TT019'].includes(key)&&/^Node [A-D] dedicated BMC$/i.test(c.model))ethernet(c,'1','RJ45','1',s.grandtwin);
  if(key==='AS-8126GS-NB3RT'){
   if(model==='X710 ONBOARD LAN')ethernet(c,'2','RJ45','10',s.b300);
   if(model==='DEDICATED IPMI MANAGEMENT LAN')ethernet(c,'1','RJ45','1',s.b300Mgmt);
   if(model==='INTEGRATED CONNECTX-8 SUPERNIC / OSFP')apply(c,{ports:'1',connector:'OSFP'},s.b300);
  }
  if(['AS-8126GS-TNMR','AS-8126GS-TNMR-2CX8-IB-DRAFT'].includes(key)){
   if(model==='X710 ONBOARD LAN')ethernet(c,'2','RJ45','10',s.tnmr);
   if(model==='DEDICATED BMC MANAGEMENT LAN')ethernet(c,'1','RJ45','1',s.tnmr);
  }
  if(key==='SYS-420GP-TNR'&&model==='INTEL I350 ONBOARD LAN')ethernet(c,'2','RJ45','1',s.gpu420);
  if(key==='SYS-821GV-TNR'&&model==='DEDICATED BMC MANAGEMENT')ethernet(c,'1','RJ45','0.1,1',s.gpu821);
  if(key==='UNC-SSG-641E-E1CR36L'){
   if(model==='ONBOARD 10GBE')ethernet(c,'2','RJ45','10',s.storage);
   if(model==='DEDICATED MANAGEMENT')ethernet(c,'1','RJ45','1',s.storage);
  }
  if(key==='UNC-ESC8000A-E12-26W10G'){
   if(model==='ONBOARD 10GBE')ethernet(c,'2','RJ45','10',s.asus);
   if(model==='DEDICATED MANAGEMENT')ethernet(c,'1','RJ45','0.01,0.1,1',s.asus);
  }
  if(key==='DCS-7010TX-48-R'){
   if(c.id==='arista7010tx-copper')ethernet(c,'48','RJ45','0.01,0.1,1',s.arista7010);
   if(c.id==='arista7010tx-uplinks')ethernet(c,'4','SFP28','1,10,25',s.arista7010);
   if(c.id==='arista7010tx-mgmt')ethernet(c,'1','RJ45','0.1,1',s.arista7010);
  }
  if(key==='DCS-7050CX3-32S'){
   if(model==='QSFP100 DATA PORTS')ethernet(c,'32','QSFP28','40,100',s.arista7050);
   if(model==='SFP+ PORTS')ethernet(c,'2','SFP+','10',s.arista7050);
   if(model==='MANAGEMENT ETHERNET')ethernet(c,'1','RJ45','0.01,0.1,1',s.arista7050);
  }
  if(key==='N9K-C92348GC-X'){
   if(model==='COPPER ACCESS PORTS')ethernet(c,'48','RJ45','0.1,1',s.cisco92348);
   if(model==='SFP28 UPLINKS')ethernet(c,'4','SFP28','1,10,25',s.cisco92348);
   if(model==='QSFP28 UPLINKS')ethernet(c,'2','QSFP28','40,100',s.cisco92348);
   if(slot==='MGMT')ethernet(c,'1','RJ45','0.01,0.1,1',s.cisco92348Network);
  }
  if(key==='N9K-C9336C-FX2'){
   if(model==='QSFP28 DATA PORTS')ethernet(c,'36','QSFP28','40,100',s.cisco9336);
   if(slot==='MGMT')ethernet(c,'1','RJ45','0.01,0.1,1',s.cisco9336Network);
  }
  if(key==='UNC-FS-S3900-48T6S-R'){
   if(c.id==='data')ethernet(c,'48','RJ45','0.01,0.1,1',s.fs);
   if(c.id==='uplink')ethernet(c,'6','SFP+','1,10',s.fs);
  }
  if(['QM8700','UNC-MQM8700-HS2F'].includes(key)&&['HDR INFINIBAND PORTS','QUANTUM HDR INFINIBAND'].includes(model))apply(c,{ports:'40',protocol:'InfiniBand',connector:'QSFP56',supportedSpeedsGbps:'200'},s.qm8700);
  if(['QM8700','UNC-MQM8700-HS2F'].includes(key)&&model==='MANAGEMENT ETHERNET')ethernet(c,'1','RJ45','0.1,1',s.qm8700);
  if(key==='UNC-APDU10151ME'&&c.id==='pdu-mgmt'){
   // Only the common speeds are established for both existing MGMT endpoints.
   // Which endpoint is the gigabit socket is not documented by their old labels.
   ethernet(c,'2','RJ45','0.01,0.1',s.apc);
  }
  if(['PX3-4068YV-V2-K1','PX3-4068YV-V2-K2'].includes(key)&&model==='CONTROLLER ETHERNET')ethernet(c,'2','RJ45','0.01,0.1,1',s.raritan);
 }
}

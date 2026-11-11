import {supportedNetworkSpeeds} from './network-speeds.ts';
import {breakoutPortNumbers} from './network-breakout.ts';
export const COMPONENT_FIELDS = {
  network: {label:'Network cards & onboard ports',singular:'Network interface',fields:[['node','Node identifier (multi-node chassis)','text'],['protocol','Protocol','Ethernet|InfiniBand|Fibre Channel|Other'],['ports','Ports per card','number'],['startPort','First physical port number','number'],['portNumberBase','PCIe port numbering starts at','0|1'],['breakoutPorts','100G to 4x25G breakout ports (e.g. 1-24)','text'],['speedGbps','Configured / selected speed per port (Gb/s)','number'],['supportedSpeedsGbps','Supported speeds (Gb/s, comma separated)','text'],['connector','Port / connector type','text'],['slot','PCIe / AIOM slot or onboard location','text']]},
  drive: {label:'Drives & storage',singular:'Drive',fields:[['type','Drive type','NVMe SSD|SAS SSD|SATA SSD|SAS HDD|SATA HDD|Other'],['capacityTB','Capacity per drive (TB)','number'],['formFactor','Form factor','text'],['interface','Interface / generation','text'],['location','Bay / location','text']]},
  psu: {label:'Power supplies',singular:'Power supply',fields:[['outputWatts','Rated DC output per PSU (W)','number'],['acCapacityWatts','Supported AC budget per PSU (W)','number'],['inlet','Equipment inlet type','C14|C20|C22|Hardwired|Other'],['inputVoltage','Input voltage range','text'],['redundancy','Redundancy arrangement','text'],['efficiency','Efficiency / certification','text']]},
  cpu: {label:'Processors',singular:'Processor',fields:[['cores','Cores per processor','number'],['socket','Socket','text'],['tdpWatts','TDP per processor (W)','number']]},
  memory: {label:'Memory',singular:'Memory module',fields:[['capacityGB','Capacity per module (GB)','number'],['type','Memory type','text'],['speed','Speed / data rate','text'],['ecc','ECC / buffering','text']]},
  gpu: {label:'GPUs & accelerators',singular:'Accelerator',fields:[['memoryGB','Memory per accelerator (GB)','number'],['interface','Interface / form factor','text'],['tdpWatts','TDP per accelerator (W)','number']]},
  other: {label:'Other components',singular:'Component',fields:[['type','Component type','text'],['location','Slot / location','text'],['specification','Specifications','text']]},
} as const;
export type ComponentKind=keyof typeof COMPONENT_FIELDS;
export type FieldReview={value:string;model:string;manufacturer:string;source:string;reviewedAt:string};
export type SystemComponent={id:string;kind:ComponentKind;manufacturer:string;model:string;quantity:number;attributes:Record<string,string>;notes:string;fieldReviews?:Record<string,FieldReview>};
export type SystemSpecs={version:1;description:string;sourceUrl:string;status:'draft'|'verified';notes:string;components:SystemComponent[];custom:{name:string;value:string}[]};
export type CatalogInput={sku:string;vendor:string;model:string;heightRU:number;category:string;specs:SystemSpecs};
export const CATEGORIES=['chassis','switch','pdu','node','accessory'] as const;
// Default editing sections describe the equipment role, not every possible internal part.
export function componentKindsForCategory(category:string):ComponentKind[]{
  if(category==='switch')return ['network','psu','other'];
  if(category==='pdu')return ['network','other'];
  if(category==='accessory')return ['other'];
  return ['network','drive','psu','cpu','memory','gpu','other'];
}
export function emptySystemSpecs():SystemSpecs{return {version:1,description:'',sourceUrl:'',status:'draft',notes:'',components:[],custom:[]};}
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const text=(v:unknown,max=500)=>typeof v==='string'&&v.length<=max;
export function systemSpecsError(value:unknown):string|null{
  const s=record(value);
  if(s.version!==1||!text(s.description,2000)||!text(s.notes,4000)||!text(s.sourceUrl,2000)||!['draft','verified'].includes(String(s.status)))return 'Check the description, notes and review status.';
  if(s.sourceUrl){try{if(!['https:','http:'].includes(new URL(String(s.sourceUrl)).protocol))return 'Use an http or https reference URL.';}catch{return 'Enter a valid reference URL.';}}
  if(!Array.isArray(s.components)||s.components.length>100||!Array.isArray(s.custom)||s.custom.length>100)return 'Use up to 100 component rows and 100 custom specifications.';
  const ids=new Set<string>();
  let totalPorts=0;
  for(const raw of s.components){const c=record(raw);if(!text(c.id,100)||!c.id||ids.has(String(c.id))||!Object.hasOwn(COMPONENT_FIELDS,String(c.kind)))return 'Invalid or duplicate component row.';ids.add(String(c.id));
    if(!text(c.manufacturer)||!text(c.model)||!String(c.model).trim()||!text(c.notes,2000)||!Number.isInteger(c.quantity)||Number(c.quantity)<1||Number(c.quantity)>512)return 'Each component needs a model or description and a quantity from 1 to 512.';
    const attrs=record(c.attributes);if(!c.attributes||typeof c.attributes!=='object'||Array.isArray(c.attributes))return 'Invalid component specifications.';
    const fields=COMPONENT_FIELDS[c.kind as ComponentKind].fields;
    if(c.fieldReviews!==undefined){
      if(!c.fieldReviews||typeof c.fieldReviews!=='object'||Array.isArray(c.fieldReviews))return 'Invalid field reviews.';
      for(const [key,rawReview] of Object.entries(c.fieldReviews)){
        const review=record(rawReview);
        if(!fields.some(f=>f[0]===key)||!text(review.value)||!text(review.model)||!text(review.manufacturer)||!text(review.source,2000)||!text(review.reviewedAt,30)||!/^\d{4}-\d{2}-\d{2}$/.test(String(review.reviewedAt)))return 'Invalid reviewed specification.';
        try{if(new URL(String(review.source)).protocol!=='https:')return 'Reviewed specifications need an HTTPS source.';}catch{return 'Reviewed specifications need a valid source URL.';}
      }
    }
    for(const [key,v] of Object.entries(attrs)){const field=fields.find(f=>f[0]===key);if(!field||!text(v))return 'Invalid component field.';
      if(v&&field[2]==='number'&&(!Number.isFinite(Number(v))||Number(v)<=0||Number(v)>1000000||(['ports','startPort'].includes(key)&&!Number.isInteger(Number(v)))))return `${field[1]} must be a positive ${key==='ports'?'whole ':''}number.`;
      if(v&&field[2].includes('|')&&!field[2].split('|').includes(String(v)))return `Choose a supported value for ${field[1]}.`;
    }
    if(c.kind==='network'&&attrs.supportedSpeedsGbps&&supportedNetworkSpeeds(String(attrs.supportedSpeedsGbps))===null)return 'Enter supported speeds as positive numbers separated by commas.';
    if(c.kind==='network'&&attrs.startPort&&(Number(attrs.startPort)>512||Number(attrs.startPort)+Number(attrs.ports||1)-1>512))return 'Physical port numbers must be between 1 and 512.';
    if(c.kind==='network'&&attrs.breakoutPorts){
      const ports=breakoutPortNumbers(String(attrs.breakoutPorts)),first=Number(attrs.startPort)||1,count=Number(attrs.ports)||0;
      if(!ports||!ports.length||ports.some(n=>n<first||n>=first+count))return 'Breakout ports must be within this interface group (for example 1-24).';
      if(String(attrs.slot).toLowerCase()!=='front'||attrs.protocol!=='Ethernet'||Number(attrs.speedGbps)!==100||String(attrs.connector).toUpperCase()!=='QSFP28')return '4x25G breakout requires front Ethernet 100G QSFP28 ports.';
      totalPorts+=ports.length*3*Number(c.quantity);
    }
    if(c.kind==='network'&&attrs.ports){
      totalPorts+=Number(attrs.ports)*Number(c.quantity);
      if(Number(attrs.ports)>512||totalPorts>4096)return 'Use at most 512 ports per interface and 4,096 ports per system.';
    }
  }
  for(const raw of s.custom){const f=record(raw);if(!text(f.name,200)||!String(f.name).trim()||!text(f.value,2000))return 'Each custom specification needs a name (up to 200 characters) and a value up to 2,000 characters.';}
  return null;
}
export function readSystemSpecs(raw:unknown):SystemSpecs{const value=record(raw).systemSpecs;return value&&!systemSpecsError(value)?value as SystemSpecs:emptySystemSpecs();}
export function catalogInputError(input:CatalogInput):string|null{
  if(!input||![input.sku,input.vendor,input.model].every(v=>text(v,200)&&v.trim()))return 'Enter a SKU, manufacturer and model (up to 200 characters each).';
  if(!CATEGORIES.includes(input.category as typeof CATEGORIES[number])||!Number.isInteger(input.heightRU)||input.heightRU<0||input.heightRU>60||(input.heightRU===0&&!['pdu','node'].includes(input.category)))return 'Use 1–60 RU, or 0 RU for a vertical PDU or chassis node.';
  return systemSpecsError(input.specs);
}
export function mergeSystemSpecs(raw:unknown,specs:SystemSpecs):Record<string,unknown>&{systemSpecs:SystemSpecs}{return {...record(raw),systemSpecs:specs};}

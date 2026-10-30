import layout from '../data/catalog/b300-front-layout.json' with {type:'json'};
import type {NetworkPort} from './network-ports.ts';

// Exact existing catalog component identities; never derive saved IDs from labels.
export function b300NetworkBox(port:NetworkPort){
 let id:unknown;try{id=JSON.parse(port.id);}catch{return;}
 if(!Array.isArray(id)||id.length!==3||!Number.isInteger(id[1])||!Number.isInteger(id[2]))return;
 const [component,card,number]=id;
 if(component==='smc-b300-nb3rt-cx8'&&number===1&&card>=1&&card<=8)return layout.cx8[card-1];
 if(component==='smc-b300-nb3rt-lan'&&card===1&&number>=1&&number<=2)return layout.lan[number-1];
 if(component==='smc-b300-nb3rt-bmc'&&card===1&&number===1)return layout.mgmt;
}

import {r940PowerInputs} from './dell-r940-layout.ts';
import type {CatalogProfile} from './catalog-artwork.ts';
import {b300PowerInputBoxes} from './b300-power-inputs.ts';
import {arista7010PsuBoxes} from './arista-7010tx-layout.ts';

export type PowerInputBox={n:number;box:{x:number;y:number;w:number;h:number}};
// Shared with the existing rear artwork; identities and drawings stay unchanged.
// All these coordinates use an 800-wide source face.
export const grandTwinPowerInputs:PowerInputBox[]=[2,1].map(n=>({n,box:{x:n===2?33:413,y:97,w:21,h:30}}));
export const tnmrPsuModules=[{x:12,y:106},{x:208,y:106},{x:404,y:106},{x:600,y:106},{x:12,y:196},{x:600,y:196}];
export const tnmrPowerInputs:PowerInputBox[]=tnmrPsuModules.map((p,i)=>({n:i+1,box:{x:p.x+9,y:p.y+19,w:30,h:40}}));
export function catalogPowerInputs(profile:CatalogProfile):PowerInputBox[]{
 const key=profile.key;
 if(key==='dell-r940')return r940PowerInputs;
 if(key==='smc-b3008u')return b300PowerInputBoxes;
 if(key==='smc-grandtwin')return grandTwinPowerInputs;
 if(key==='smc-as8126')return tnmrPowerInputs;
 if(key==='arista-7010tx')return arista7010PsuBoxes.map(({n,box})=>({n,box:{...box}}));
 if(key==='fs-s3900')return [{n:1,box:{x:35,y:43,w:30,h:30}},{n:2,box:{x:732,y:43,w:30,h:30}}];
 if(key==='asus-esc8000a')return [43,283,417,625].map((x,i)=>({n:i+1,box:{x:x+83,y:208,w:28,h:31}}));
 if(key==='smc-641e')return [{n:2,box:{x:39,y:48,w:27,h:28}},{n:1,box:{x:39,y:99,w:27,h:28}}];
 if(key==='smc-510p')return [2,1].map((n,i)=>({n,box:{x:37+i*88,y:47,w:23,h:29}}));
 if(key==='smc-821gv')return [1,2,3,4].map((n,i)=>({n,box:{x:32+i*184,y:326,w:180,h:88}})).concat([{n:5,box:{x:32,y:128,w:180,h:92}},{n:6,box:{x:584,y:128,w:180,h:92}}]);
 if(profile.category==='switch')return key==='arista-7050cx3'?[{n:1,box:{x:40,y:46,w:24,h:29}},{n:2,box:{x:633,y:46,w:24,h:29}}]:[{n:1,box:{x:42,y:44,w:22,h:30}},{n:2,box:{x:716,y:44,w:22,h:30}}];
 return [];
}

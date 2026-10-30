export type Arista7010Box={x:number;y:number;w:number;h:number};
// Coordinates share the source SVG's 800x112 space, before the existing rack-face transform.
export function arista7010NetworkBox(position:string|undefined,number:number|undefined):Arista7010Box|undefined{
 if(position==='mgmt')return number===1?{x:732,y:43,w:21,h:18}:undefined;
 if(position!=='switch-data'||!Number.isInteger(number)||number!<1||number!>52)return;
 const n=number!;
 if(n<=48){const index=n-1,bank=Math.floor(index/12),column=Math.floor(index%12/2);return {x:33+bank*153+column*23.5,y:45+index%2*21,w:21,h:15};}
 const index=n-49;return {x:648+Math.floor(index/2)*33,y:45+index%2*21,w:27,h:15};
}
export const arista7010PsuBoxes=[{n:1,box:{x:44,y:47,w:38,h:24}},{n:2,box:{x:724,y:47,w:38,h:24}}] as const;

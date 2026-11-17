// Dell R940 Technical Guide figures 1/2; Broadcom rNDC figure 15.
// The selected 57414 replaces the four-port reference card in the same rear bay.
// Coordinates use the artwork's 800 x 224 source space.
export const R940_FACE_HEIGHT=224;
export const r940PowerInputs=[
 {n:1,box:{x:30,y:153,w:38,h:48}},
 {n:2,box:{x:650,y:153,w:38,h:48}},
];
export function r940NetworkBox(position:string|undefined,number:number|undefined){
 if(position==='mgmt'&&number===1)return {x:208,y:151,w:24,h:21};
 if(position==='rndc'&&(number===1||number===2))return {x:481,y:number===1?44:96,w:26,h:31};
}

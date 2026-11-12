// APDU11350ME revision 0 sheets 1–2 and the manufacturer's numbered front photo.
// Cord-up: odd C13/C15 on the right, even combination receptacles on the left.
// Rotation must never change a saved outlet identity.
export function isApdu11350(sku?:string|null,model?:string|null){
 return [sku,model].some(value=>value?.toUpperCase()==='APDU11350ME');
}
export function apdu11350Bank(n:number):number|undefined {
 if(!Number.isInteger(n)||n<1||n>48)return;
 return Math.floor((n-1)/24)*3+Math.floor(((n-1)%24)/4)%3+1;
}
export const APDU11350_WHIP_DOWN=Array.from({length:12},(_,group)=>
 [47-group*4,48-group*4,45-group*4,46-group*4]);

export type CableLength={lengthValue?:number|null;lengthUnit?:string|null};
export function cableLength(c:CableLength):string{return c.lengthValue!=null&&c.lengthValue>0&&(c.lengthUnit==='ft'||c.lengthUnit==='m')?`${c.lengthValue} ${c.lengthUnit}`:'—';}
export function validCableLength(value:unknown,unit:unknown):boolean{return value==null?unit==null:typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=100000&&(unit==='ft'||unit==='m');}

export function breakoutPortNumbers(value:string):number[]|null {
 if(!value.trim())return [];
 const result=new Set<number>();
 for(const term of value.split(',')){
  const match=term.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);if(!match)return null;
  const first=Number(match[1]),last=Number(match[2]||match[1]);
  if(first<1||last<first||last>512)return null;
  for(let n=first;n<=last;n++)result.add(n);
 }
 return [...result].sort((a,b)=>a-b);
}
export const BREAKOUT_CABLE='Breakout 100G to 4x25G';

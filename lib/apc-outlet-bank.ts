// APDU10151ME: UNC workbook Power-Cable_Layout photograph shows four gray
// then four black outlets per eight-outlet group, numbered from the whip.
// User confirmed gray = B1 and black = B2. This does not establish amp limits.
export function apcOutletBreaker(outlet:number):1|2|undefined {
  if(!Number.isInteger(outlet)||outlet<1||outlet>40)return;
  return (outlet-1)%8<4?1:2;
}

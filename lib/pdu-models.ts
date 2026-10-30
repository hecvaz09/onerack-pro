// SO949293 build document: 3-Power Logical embedded numbered drawing;
// 4-Power Calculator B14:E40 and L14:O37. Coordinates are normalized within
// the drawing's enclosure (not rack units). K1/K2 share outlet identities.
export type PduModelOutlet = { n: number; type: "C13" | "C19"; cb: number; phase: string; x: number; y: number };
export const PX3_4068_ID = "raritan-px3-4068yv-v2";
// Usable continuous limits for this verified electrical profile, not generic
// limits for all C13/C19 products. Keep hardware ratings separate from demand.
export const PX3_4068_POWER = { minVoltage:400,maxVoltage:415,inputAmps:80,breakerAmps:20,outletAmps:{C13:12,C19:16} } as const;
const bankPhases = ["L3", "L2", "L1", "L3", "L2", "L1"];
const bankCenters = [
  [280,307,334,371], [474,502,529,565], [666,694,722,760],
  [1108,1136,1164,1202], [1298,1326,1354,1392], [1496,1524,1552,1590],
];
export const PX3_4068_OUTLETS: readonly PduModelOutlet[] = [
  ...bankCenters.flatMap((rows, bank) => rows.flatMap((y, row) => [0,1].map(column => ({
    n: 47 - bank * 8 + column * 4 - row,
    type: (row === 3 ? "C19" : "C13") as "C13" | "C19",
    cb: 14 - bank * 2 + column,
    phase: bankPhases[bank], x: column === 0 ? 25 : 75, y: (y - 16) / 1748 * 100,
  })))),
  ...[1,2,3].map(n => ({n,type:"C19" as const,cb:n,phase:`L${n}`,x:17+(n-1)*33,y:(1718-16)/1748*100})),
];
export function pduModelId(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  const model = (raw as Record<string,unknown>).model;
  if (typeof model === "string" && /^PX3-4068YV-V2(?:-?K[12])?$/i.test(model)) return PX3_4068_ID;
}

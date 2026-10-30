// OneRack's canonical 48U + twelve side-pocket rack, transcribed from
// rack-elevation.html POCKETS_*_DEFAULT. These are physical positions, not RUs.
export const POCKET_BAYS = [
    { from: 35, to: 44, left: [49, 50], right: [55, 56], tone: "management" },
    { from: 20, to: 29, left: [51, 52], right: [57, 58], tone: "production" },
    { from: 3, to: 12, left: [53, 54], right: [59, 60], tone: "management" },
] as const;
export function isPocket(rackHeight: number, position: number, pockets: boolean) {
    return pockets && rackHeight === 48 && Number.isInteger(position) && position >= 49 && position <= 60;
}
export function pocketPair(position: number) {
    return POCKET_BAYS.flatMap(bay => [bay.left, bay.right]).find(pair => pair.some(value => value === position));
}
export function pocketBays(rear: boolean, side: "left" | "right") {
    return POCKET_BAYS.map(bay => ({ ...bay, positions: rear ? [...bay[side === "left" ? "right" : "left"]].reverse() : [...bay[side]] }));
}

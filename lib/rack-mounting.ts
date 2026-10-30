import { placementError, type OccupiedDevice } from "./rack-validation.ts";
import { isPocket, pocketPair } from "./onerack-layout.ts";

export function mountingError(rackHeight: number, startRU: number, heightRU: number, category: string | null, mounting: string,
  devices: (OccupiedDevice & { mounting: string })[], movingId?: string, options: {pockets:boolean;pduA?:boolean;pduB?:boolean;pduPairs?:1|2} = {pockets:false}): string | null {
  if (!["front", "rear", "rear-left", "rear-right", "rear-left-2", "rear-right-2"].includes(mounting)) return "Choose a valid mounting position.";
  if (heightRU === 0) {
    if (category !== "pdu") return "Only vertical PDUs can use the side rails.";
    if (!/^rear-(left|right)(-2)?$/.test(mounting)) return "Choose a rear left or rear right rail for a vertical PDU.";
    if (mounting.endsWith("-2") && options.pduPairs!==2) return "Enable four PDU rails in rack settings first.";
    if ((mounting.startsWith("rear-left") && options.pduB === false) || (mounting.startsWith("rear-right") && options.pduA === false)) return "This PDU rail is disabled in the rack profile.";
    return devices.some(d => d.id !== movingId && d.mounting === mounting) ? "This rear rail already has a PDU." : null;
  }
  if (mounting !== "front" && mounting !== "rear") return "Rack-unit devices must mount on the front or rear face.";
  if (isPocket(rackHeight, startRU, options.pockets)) {
    if (category !== "switch") return "Only switches can go in side pockets.";
    const pair = pocketPair(startRU)!;
    if (!Number.isInteger(heightRU) || heightRU < 1 || startRU + heightRU - 1 > pair[1]) return "This switch won't fit in this pocket pair.";
    return devices.some(d => d.id !== movingId && isPocket(rackHeight, d.startRU, options.pockets) && startRU < d.startRU + d.heightRU && d.startRU < startRU + heightRU)
      ? "This side pocket is already occupied." : null;
  }
  // Conservative physical occupancy: reserve the RU through the rack until
  // equipment depth is modeled. Vertical rails consume no horizontal RU.
  return placementError(rackHeight, startRU, heightRU, devices.filter(d => d.heightRU > 0 && !isPocket(rackHeight, d.startRU, options.pockets)), movingId);
}

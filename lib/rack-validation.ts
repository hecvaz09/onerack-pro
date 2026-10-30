export type OccupiedDevice = {
  id: string;
  startRU: number;
  heightRU: number;
  name: string;
};

export function parseRackUnit(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const result = Number(value.trim());
  return Number.isSafeInteger(result) && result > 0 ? result : null;
}

export function placementError(
  rackHeight: number,
  startRU: number,
  heightRU: number,
  devices: OccupiedDevice[],
  movingId?: string,
): string | null {
  if (!Number.isSafeInteger(rackHeight) || rackHeight < 1) return "Invalid rack height.";
  if (!Number.isSafeInteger(startRU) || startRU < 1) return "Starting RU must be a positive whole number.";
  if (!Number.isSafeInteger(heightRU) || heightRU < 1) return "Only devices with a positive whole-number RU height can be placed in this grid.";
  const endRU = startRU + heightRU - 1;
  if (endRU > rackHeight) return `A ${heightRU}U device won't fit at RU ${startRU} in a ${rackHeight}U rack.`;
  const conflict = devices.find(device => device.id !== movingId && startRU <= device.startRU + device.heightRU - 1 && device.startRU <= endRU);
  return conflict ? `RU ${startRU}–${endRU} overlaps ${conflict.name} at RU ${conflict.startRU}–${conflict.startRU + conflict.heightRU - 1}.` : null;
}

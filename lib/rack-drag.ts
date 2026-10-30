// Existing devices preserve the grabbed row; catalog drops use the pointed RU
// as the bottom of the new device. Never clamp an invalid drop to a different RU.
export function grabbedRowOffset(heightRU: number, pointerY: number, top: number, height: number) {
  const row = Math.max(0, Math.min(heightRU - 1, Math.floor((pointerY - top) / (height / heightRU))));
  return heightRU - 1 - row;
}

export function dropStartRU(pointedRU: number, grabbedOffset: number) {
  return pointedRU - grabbedOffset;
}

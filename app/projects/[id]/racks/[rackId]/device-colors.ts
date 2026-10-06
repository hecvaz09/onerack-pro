// Fixed cool tints, independent of the theme accent: devices keep their colors whichever
// accent is chosen.
export const CATEGORY_COLORS: Record<string, string> = {
  chassis: "#2d3f54",
  switch: "#2a4a42",
  accessory: "#34343a",
};

export const FALLBACK_COLOR = "#34343a";

// A hairline a step lighter than each fill, so blocks read as solid units on frosted cards.
export const CATEGORY_BORDERS: Record<string, string> = {
  chassis: "#415a74",
  switch: "#3d6b5e",
  accessory: "#4a4a52",
};

export const FALLBACK_BORDER = "#4a4a52";

export function colorForCategory(category: string | null) {
  return CATEGORY_COLORS[category ?? ""] ?? FALLBACK_COLOR;
}

export function borderForCategory(category: string | null) {
  return CATEGORY_BORDERS[category ?? ""] ?? FALLBACK_BORDER;
}

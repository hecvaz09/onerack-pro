export const CATEGORY_COLORS: Record<string, string> = {
  chassis: "#cdd9ec",
  switch: "#f5e0b8",
  accessory: "#e4e4e7",
};

export const FALLBACK_COLOR = "#e4e4e7";

export function colorForCategory(category: string | null) {
  return CATEGORY_COLORS[category ?? ""] ?? FALLBACK_COLOR;
}

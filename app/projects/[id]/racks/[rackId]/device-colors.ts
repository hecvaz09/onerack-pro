export const CATEGORY_COLORS: Record<string, string> = {
  chassis: "#00d4f5",
  switch: "#f59e0b",
  accessory: "#8888cc",
};

export const FALLBACK_COLOR = "#d4d4d8";

export function colorForCategory(category: string | null) {
  return CATEGORY_COLORS[category ?? ""] ?? FALLBACK_COLOR;
}

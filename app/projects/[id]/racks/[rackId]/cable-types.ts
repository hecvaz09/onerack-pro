export const CABLE_META: Record<string, { abbr: string; color: string }> = {
  DAC: { abbr: "DAC", color: "#ef4444" },
  "Fiber (SFP28/QSFP28)": { abbr: "FIB", color: "#3b82f6" },
  "Cat6/Cat6a": { abbr: "CAT", color: "#22c55e" },
  Breakout: { abbr: "BRK", color: "#a855f7" },
  Power: { abbr: "PWR", color: "#f59e0b" },
};

export const FALLBACK_CABLE = { abbr: "•", color: "#71717a" };

export function cableMeta(type: string | null) {
  return CABLE_META[type ?? ""] ?? FALLBACK_CABLE;
}

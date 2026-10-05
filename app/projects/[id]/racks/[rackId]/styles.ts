// Shared visual styles for the rack page's sections, labels and form controls.

// Borderless: cards float on the gray canvas on a soft two-layer shadow alone.
export const cardClassName =
  "rounded-2xl bg-card p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.08)]";

export const sectionLabelClassName =
  "text-xs font-semibold tracking-wider text-muted-foreground uppercase";

export const inputClassName =
  "h-9 rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20";

export const listRowClassName =
  "flex items-center justify-between gap-4 rounded-md px-3 py-2.5 transition-colors hover:bg-muted/60";

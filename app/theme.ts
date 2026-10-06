// Shared by the theme picker (client) and the no-flash script in the root layout (server),
// so it must not be a "use client" module.

export const BACKGROUNDS = ["warm", "blue", "aurora", "plum", "graphite", "ember"] as const;
export const ACCENTS = ["champagne", "apple", "mint", "lavender", "rose", "amber"] as const;

export type ThemeBackground = (typeof BACKGROUNDS)[number];
export type ThemeAccent = (typeof ACCENTS)[number];

export const DEFAULT_BACKGROUND: ThemeBackground = "warm";
export const DEFAULT_ACCENT: ThemeAccent = "apple";

export const BG_STORAGE_KEY = "onerack-bg";
export const ACCENT_STORAGE_KEY = "onerack-accent";

// Runs inline in <head> before first paint, so the saved theme applies without a flash
// of the default. Unknown or missing values fall back to the defaults.
export const themeInitScript = `(function () {
  var d = document.documentElement;
  var bg = ${JSON.stringify(DEFAULT_BACKGROUND)};
  var accent = ${JSON.stringify(DEFAULT_ACCENT)};
  try {
    var savedBg = localStorage.getItem(${JSON.stringify(BG_STORAGE_KEY)});
    var savedAccent = localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)});
    if (${JSON.stringify(BACKGROUNDS)}.indexOf(savedBg) !== -1) bg = savedBg;
    if (${JSON.stringify(ACCENTS)}.indexOf(savedAccent) !== -1) accent = savedAccent;
  } catch (e) {}
  d.dataset.bg = bg;
  d.dataset.accent = accent;
})();`;

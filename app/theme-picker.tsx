"use client";

import { useEffect, useState } from "react";
import {
  ACCENT_STORAGE_KEY,
  ACCENTS,
  BACKGROUNDS,
  BG_STORAGE_KEY,
  DEFAULT_ACCENT,
  DEFAULT_BACKGROUND,
  type ThemeAccent,
  type ThemeBackground,
} from "./theme";

const pillClassName =
  "inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-xs capitalize text-muted-foreground backdrop-blur-md transition-colors hover:text-foreground";
const activePillClassName = "border-primary text-foreground ring-1 ring-primary";

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the theme still applies.
  }
}

export function ThemePicker() {
  // Null until mounted: the server can't know the saved theme, so nothing is marked
  // active on the first render (avoids a hydration mismatch).
  const [bg, setBg] = useState<ThemeBackground | null>(null);
  const [accent, setAccent] = useState<ThemeAccent | null>(null);

  useEffect(() => {
    const savedBg = readStored(BG_STORAGE_KEY, BACKGROUNDS, DEFAULT_BACKGROUND);
    const savedAccent = readStored(ACCENT_STORAGE_KEY, ACCENTS, DEFAULT_ACCENT);
    document.documentElement.dataset.bg = savedBg;
    document.documentElement.dataset.accent = savedAccent;
    setBg(savedBg);
    setAccent(savedAccent);
  }, []);

  function chooseBg(value: ThemeBackground) {
    document.documentElement.dataset.bg = value;
    store(BG_STORAGE_KEY, value);
    setBg(value);
  }

  function chooseAccent(value: ThemeAccent) {
    document.documentElement.dataset.accent = value;
    store(ACCENT_STORAGE_KEY, value);
    setAccent(value);
  }

  return (
    <div className="space-y-2">
      <PickerRow label="Background">
        {BACKGROUNDS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={bg === value}
            onClick={() => chooseBg(value)}
            className={`${pillClassName} ${bg === value ? activePillClassName : ""}`}
          >
            <span
              aria-hidden="true"
              className="size-3.5 rounded-full border border-white/20"
              style={{ background: `var(--theme-bg-${value})` }}
            />
            {value}
          </button>
        ))}
      </PickerRow>
      <PickerRow label="Accent">
        {ACCENTS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={accent === value}
            onClick={() => chooseAccent(value)}
            className={`${pillClassName} ${accent === value ? activePillClassName : ""}`}
          >
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ background: `var(--theme-accent-${value})` }}
            />
            {value}
          </button>
        ))}
      </PickerRow>
    </div>
  );
}

function PickerRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

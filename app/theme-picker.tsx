"use client";

import { useSyncExternalStore } from "react";
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

function subscribeTheme(notify: () => void) {
  function storageChanged(event: StorageEvent) {
    if (event.storageArea !== localStorage) return;
    if (event.key === BG_STORAGE_KEY || event.key === null) {
      document.documentElement.setAttribute("data-bg", readStored(BG_STORAGE_KEY, BACKGROUNDS, DEFAULT_BACKGROUND));
    }
    if (event.key === ACCENT_STORAGE_KEY || event.key === null) {
      document.documentElement.setAttribute("data-accent", readStored(ACCENT_STORAGE_KEY, ACCENTS, DEFAULT_ACCENT));
    }
    if (event.key !== null && event.key !== BG_STORAGE_KEY && event.key !== ACCENT_STORAGE_KEY) return;
    notify();
  }
  window.addEventListener("onerack:theme", notify);
  window.addEventListener("storage", storageChanged);
  return () => {
    window.removeEventListener("onerack:theme", notify);
    window.removeEventListener("storage", storageChanged);
  };
}

function changeTheme(attribute: string, storageKey: string, value: string) {
  document.documentElement.setAttribute(attribute, value);
  store(storageKey, value);
  window.dispatchEvent(new Event("onerack:theme"));
}

const serverTheme = () => null;
const backgroundSnapshot = () => document.documentElement.getAttribute("data-bg") || DEFAULT_BACKGROUND;
const accentSnapshot = () => document.documentElement.getAttribute("data-accent") || DEFAULT_ACCENT;

export function ThemePicker() {
  // Null until mounted: the server can't know the saved theme, so nothing is marked
  // active on the first render (avoids a hydration mismatch).
  const bg = useSyncExternalStore(subscribeTheme, backgroundSnapshot, serverTheme);
  const accent = useSyncExternalStore(subscribeTheme, accentSnapshot, serverTheme);

  function chooseBg(value: ThemeBackground) {
    changeTheme("data-bg", BG_STORAGE_KEY, value);
  }

  function chooseAccent(value: ThemeAccent) {
    changeTheme("data-accent", ACCENT_STORAGE_KEY, value);
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
            {value === "silver" ? "Etched Silver" : value === "sage" ? "Sage Channels" : value === "mesh" ? "Champagne Mesh" : value === "silicon" ? "Silicon Ice" : value === "datacenter" ? "Data center" : value}
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

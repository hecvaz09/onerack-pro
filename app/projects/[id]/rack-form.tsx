"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createRack } from "./actions";

const inputClassName =
  "h-8 rounded-lg border border-input bg-card px-2.5 text-sm outline-none backdrop-blur-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const STANDARD_HEIGHTS = [25, 42, 48, 50, 60];
const DEFAULT_HEIGHT = "48";

export function RackForm({ projectId }: { projectId: string }) {
  const [heightChoice, setHeightChoice] = useState(DEFAULT_HEIGHT);

  return (
    <form
      action={createRack.bind(null, projectId)}
      // React resets the form after the action runs; keep the custom input in sync.
      onReset={() => setHeightChoice(DEFAULT_HEIGHT)}
      className="mb-6 flex flex-col gap-2 sm:flex-row"
    >
      <input
        type="text"
        name="name"
        required
        placeholder="Rack name"
        className={`${inputClassName} flex-1`}
      />
      <select
        name="heightChoice"
        defaultValue={DEFAULT_HEIGHT}
        onChange={(event) => setHeightChoice(event.target.value)}
        aria-label="Rack height"
        className={`${inputClassName} w-full sm:w-28`}
      >
        {STANDARD_HEIGHTS.map((height) => (
          <option key={height} value={height}>
            {height}U
          </option>
        ))}
        <option value="other">Other…</option>
      </select>
      {heightChoice === "other" && (
        <input
          type="number"
          name="customHeight"
          required
          min={1}
          max={60}
          placeholder="Custom U"
          aria-label="Custom height (RU)"
          className={`${inputClassName} w-full sm:w-24`}
        />
      )}
      <Button type="submit">Add rack</Button>
    </form>
  );
}

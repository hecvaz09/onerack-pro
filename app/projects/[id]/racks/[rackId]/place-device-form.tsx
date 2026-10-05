"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { placeDevice, type PlaceDeviceState } from "./actions";
import { inputClassName } from "./styles";

type CatalogOption = {
  id: string;
  vendor: string;
  model: string;
  heightRU: number;
};

export function PlaceDeviceForm({
  rackId,
  rackHeightRU,
  catalog,
}: {
  rackId: string;
  rackHeightRU: number;
  catalog: CatalogOption[];
}) {
  const [state, formAction, isPending] = useActionState<PlaceDeviceState, FormData>(
    placeDevice.bind(null, rackId),
    null,
  );

  const error = state && "error" in state ? state.error : null;
  // Refill only after an error; after a success React resets the form to empty.
  const values = state && "error" in state ? state.values : null;

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Remount when the refill values change so defaultValue is applied. */}
      <form
        key={values ? JSON.stringify(values) : "empty"}
        action={formAction}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <select
          name="catalogDeviceId"
          required
          defaultValue={values?.catalogDeviceId ?? ""}
          aria-label="Catalog device"
          className={`${inputClassName} min-w-0 flex-1`}
        >
          <option value="" disabled>
            Choose a device…
          </option>
          {catalog.map((device) => (
            <option key={device.id} value={device.id}>
              {device.vendor} — {device.model} ({device.heightRU}U)
            </option>
          ))}
        </select>
        <input
          type="number"
          name="startRU"
          required
          min={1}
          max={rackHeightRU}
          defaultValue={values?.startRU ?? ""}
          placeholder="Start RU"
          aria-label="Start RU"
          className={`${inputClassName} w-full sm:w-24`}
        />
        <input
          type="text"
          name="label"
          defaultValue={values?.label ?? ""}
          placeholder="Label (optional)"
          className={`${inputClassName} w-full sm:w-36`}
        />
        <Button type="submit" size="lg" disabled={isPending} className="px-4">
          {isPending ? "Placing…" : "Place device"}
        </Button>
      </form>
    </div>
  );
}

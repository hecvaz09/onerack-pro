"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createConnection, deleteConnection } from "./actions";

const inputClassName =
  "h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const CABLE_TYPES = ["DAC", "Fiber (SFP28/QSFP28)", "Cat6/Cat6a", "Breakout", "Power", "Other"];

export type ConnectionDevice = { id: string; name: string };

export type ConnectionRow = {
  id: string;
  fromName: string;
  toName: string;
  cableType: string | null;
  label: string | null;
};

type FormValues = { fromDeviceId: string; toDeviceId: string; cableType: string; label: string };
type FormState = { error: string; values: FormValues } | { ok: true } | null;

export function ConnectionsPanel({
  rackId,
  devices,
  connections,
}: {
  rackId: string;
  devices: ConnectionDevice[];
  connections: ConnectionRow[];
}) {
  // createConnection takes plain arguments, so adapt it to the form here and keep the
  // submitted values on errors so the form can refill them.
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async (_prev, formData) => {
      const values: FormValues = {
        fromDeviceId: String(formData.get("fromDeviceId") ?? ""),
        toDeviceId: String(formData.get("toDeviceId") ?? ""),
        cableType: String(formData.get("cableType") ?? ""),
        label: String(formData.get("label") ?? ""),
      };
      const result = await createConnection(
        rackId,
        values.fromDeviceId,
        values.toDeviceId,
        values.cableType || null,
        values.label || null,
      );
      return result.ok ? { ok: true } : { error: result.error, values };
    },
    null,
  );

  const error = state && "error" in state ? state.error : null;
  const values = state && "error" in state ? state.values : null;

  return (
    <section>
      <h2 className="mt-8 mb-3 text-lg font-semibold">Connections</h2>

      {devices.length < 2 ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Place at least two devices to connect them.
        </p>
      ) : (
        <div className="mb-4">
          {error && (
            <p role="alert" className="mb-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {/* Remount when the refill values change so defaultValue is applied. */}
          <form
            key={values ? JSON.stringify(values) : "empty"}
            action={formAction}
            className="grid gap-2 sm:grid-cols-2"
          >
            <DeviceSelect
              name="fromDeviceId"
              label="From device"
              devices={devices}
              defaultValue={values?.fromDeviceId}
            />
            <DeviceSelect
              name="toDeviceId"
              label="To device"
              devices={devices}
              defaultValue={values?.toDeviceId}
            />
            <select
              name="cableType"
              defaultValue={values?.cableType ?? ""}
              aria-label="Cable type"
              className={inputClassName}
            >
              <option value="">Cable type (optional)</option>
              {CABLE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input
              type="text"
              name="label"
              defaultValue={values?.label ?? ""}
              placeholder="Label (optional)"
              className={inputClassName}
            />
            <Button type="submit" disabled={isPending} className="sm:col-span-2 sm:justify-self-start">
              {isPending ? "Adding…" : "Add connection"}
            </Button>
          </form>
        </div>
      )}

      <ConnectionList rackId={rackId} connections={connections} />
    </section>
  );
}

function DeviceSelect({
  name,
  label,
  devices,
  defaultValue,
}: {
  name: string;
  label: string;
  devices: ConnectionDevice[];
  defaultValue?: string;
}) {
  return (
    <select
      name={name}
      required
      defaultValue={defaultValue ?? ""}
      aria-label={label}
      className={`${inputClassName} min-w-0`}
    >
      <option value="" disabled>
        {label}…
      </option>
      {devices.map((device) => (
        <option key={device.id} value={device.id}>
          {device.name}
        </option>
      ))}
    </select>
  );
}

function ConnectionList({ rackId, connections }: { rackId: string; connections: ConnectionRow[] }) {
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startRemoving] = useTransition();

  function remove(connectionId: string) {
    setPendingId(connectionId);
    startRemoving(async () => {
      const result = await deleteConnection(connectionId, rackId);
      setRemoveError(result.ok ? null : result.error);
      setPendingId(null);
    });
  }

  if (connections.length === 0) {
    return <p className="text-sm text-muted-foreground">No connections yet.</p>;
  }

  return (
    <>
      {removeError && (
        <p role="alert" className="mb-2 text-sm text-destructive">
          {removeError}
        </p>
      )}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {connections.map((connection) => (
          <li key={connection.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">
                {connection.fromName} ↔ {connection.toName}
              </p>
              {(connection.cableType || connection.label) && (
                <p className="truncate text-sm text-muted-foreground">
                  {[connection.cableType, connection.label].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pendingId === connection.id}
              onClick={() => remove(connection.id)}
            >
              {pendingId === connection.id ? "Removing…" : "Remove"}
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}

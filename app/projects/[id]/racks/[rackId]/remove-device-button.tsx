"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { removeDevice } from "./actions";

export function RemoveDeviceButton({ deviceId, rackId }: { deviceId: string; rackId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <span className="flex shrink-0 items-center gap-2">
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await removeDevice(deviceId, rackId);
            setError(result.ok ? null : result.error);
          })
        }
      >
        {isPending ? "Removing…" : "Remove"}
      </Button>
    </span>
  );
}

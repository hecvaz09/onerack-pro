"use client";

export function RemoveDeviceButton({ name, disabled = false, onRemove }: {
  name: string;
  disabled?: boolean;
  onRemove: () => void;
}) {
  return (
    <button type="button" disabled={disabled} aria-label={`Remove ${name}`}
      className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
      onClick={onRemove}>Remove</button>
  );
}

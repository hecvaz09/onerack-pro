type RackGridDevice = {
  id: string;
  startRU: number;
  label: string | null;
  catalogDevice: {
    model: string;
    vendor: string;
    heightRU: number;
    category: string | null;
  };
};

const CATEGORY_COLORS: Record<string, string> = {
  chassis: "#00d4f5",
  switch: "#f59e0b",
  accessory: "#8888cc",
};
const FALLBACK_COLOR = "#d4d4d8";

const ROW_HEIGHT = "1.75rem"; // h-7

export function RackGrid({ heightRU, devices }: { heightRU: number; devices: RackGridDevice[] }) {
  // 0U devices (PDUs, twin nodes) have no RU span to draw.
  const placed = devices.filter((device) => device.catalogDevice.heightRU >= 1);

  const occupied = new Set<number>();
  for (const device of placed) {
    for (let ru = device.startRU; ru < device.startRU + device.catalogDevice.heightRU; ru++) {
      occupied.add(ru);
    }
  }

  // Grid rows run top to bottom, RUs run bottom to top: the top row is the highest RU.
  const rowFor = (ru: number) => heightRU - ru + 1;
  const ruSlots = Array.from({ length: heightRU }, (_, i) => heightRU - i);

  return (
    <div className="w-full max-w-sm rounded-lg border-2 border-border bg-muted/40 p-2">
      <div
        className="grid gap-x-2"
        style={{
          gridTemplateColumns: "2rem 1fr",
          gridTemplateRows: `repeat(${heightRU}, ${ROW_HEIGHT})`,
        }}
      >
        {ruSlots.map((ru) => (
          <span
            key={`label-${ru}`}
            className="flex items-center justify-end text-xs text-muted-foreground tabular-nums"
            style={{ gridColumn: 1, gridRow: rowFor(ru) }}
          >
            {ru}
          </span>
        ))}

        {ruSlots
          .filter((ru) => !occupied.has(ru))
          .map((ru) => (
            <div
              key={`slot-${ru}`}
              className="border-b border-dashed border-border bg-background/60"
              style={{ gridColumn: 2, gridRow: rowFor(ru) }}
            />
          ))}

        {placed.map((device) => {
          const topRU = device.startRU + device.catalogDevice.heightRU - 1;
          const name = device.label || device.catalogDevice.model;
          const color =
            CATEGORY_COLORS[device.catalogDevice.category ?? ""] ?? FALLBACK_COLOR;

          return (
            <div
              key={device.id}
              title={`${name} — ${device.catalogDevice.vendor} ${device.catalogDevice.model} (RU ${device.startRU}–${topRU})`}
              className="m-px flex items-center justify-center overflow-hidden rounded-sm border border-black/20 px-2 text-xs font-medium text-neutral-900"
              style={{
                gridColumn: 2,
                gridRow: `${rowFor(topRU)} / span ${device.catalogDevice.heightRU}`,
                backgroundColor: color,
              }}
            >
              <span className="truncate">{name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import Link from "next/link";

export function RackNavigation({ basePath, active }: { basePath: string; active: "elevation" | "network" | "power" }) {
  return <nav className="rack-navigation" aria-label="Rack workspace">
    {([['elevation', 'Rack Map'], ['network', 'Network connections'], ['power', 'Power layout']] as const).map(([key, label]) =>
      <Link key={key} href={key === 'elevation' ? basePath : `${basePath}?tab=${key}`} aria-current={active === key ? 'page' : undefined}>{label}</Link>
    )}
  </nav>;
}

import Link from "next/link";

export function DatabaseNotice({ reason }: { reason: "missing" | "unavailable" | "schema" }) {
  const title = reason === "missing" ? "Database setup needed" : reason === "schema" ? "Database needs initialization" : "Projects are temporarily unavailable";
  const description = reason === "missing"
    ? "This independent copy of OneRack Pro does not have a database connection yet. Connect its development database to create and save projects."
    : reason === "schema"
      ? "The connected database is missing the tables this version of OneRack Pro needs."
      : "OneRack Pro could not reach its project database. Try again once the connection is restored.";

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← OneRack Pro</Link>
      <section className="mt-8 rounded-xl border border-border bg-card p-8 backdrop-blur-xl" aria-labelledby="database-status-title">
        <p className="text-sm font-medium text-muted-foreground">Projects</p>
        <h1 id="database-status-title" className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{description}</p>
        <p className="mt-3 text-sm text-muted-foreground">Project editing is unavailable until setup is complete.</p>
        {process.env.NODE_ENV === "development" && reason !== "unavailable" && (
          <details className="mt-6 rounded-lg border border-border p-4 text-sm">
            <summary className="cursor-pointer font-medium">Development setup</summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>Use a separate Neon development database for this Codex checkout.</li>
              <li>Set its <code>DATABASE_URL</code> and <code>DIRECT_URL</code> in this project’s <code>.env</code> file.</li>
              <li>Run <code>npx prisma migrate deploy</code> and <code>npx prisma db seed</code>.</li>
              <li>Restart <code>npm run dev</code>, then return to Projects.</li>
            </ol>
          </details>
        )}
        <form action="/projects" method="get" className="mt-6">
          <button type="submit" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Check again</button>
        </form>
      </section>
    </main>
  );
}

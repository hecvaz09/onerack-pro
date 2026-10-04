import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { RackForm } from "./rack-form";

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;

  // Render per request so the rack list reflects the database, not build time.
  await connection();

  const project = await prisma.project.findUnique({
    where: { id },
    include: { racks: { orderBy: { createdAt: "asc" } } },
  });

  if (!project) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/projects" className="text-sm text-muted-foreground hover:underline">
        ← Back to projects
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{project.name}</h1>

      {(project.customer || project.location || project.notes) && (
        <dl className="mt-3 space-y-1 text-sm">
          {project.customer && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Customer</dt>
              <dd>{project.customer}</dd>
            </div>
          )}
          {project.location && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Location</dt>
              <dd>{project.location}</dd>
            </div>
          )}
          {project.notes && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Notes</dt>
              <dd className="whitespace-pre-line">{project.notes}</dd>
            </div>
          )}
        </dl>
      )}

      <h2 className="mt-8 mb-3 text-lg font-semibold">Racks</h2>

      <RackForm projectId={id} />

      {project.racks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No racks yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {project.racks.map((rack) => (
            <li key={rack.id} className="flex items-baseline justify-between gap-4 px-4 py-3">
              <Link
                href={`/projects/${id}/racks/${rack.id}`}
                className="min-w-0 truncate font-medium hover:underline"
              >
                {rack.name}
              </Link>
              <span className="shrink-0 text-sm text-muted-foreground">{rack.heightRU}U</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

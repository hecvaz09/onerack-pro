import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { createProject } from "./actions";

export default async function ProjectsPage() {
  // Render per request so the list reflects the database, not build time.
  await connection();

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Projects</h1>

      <form action={createProject} className="mb-8 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          name="name"
          required
          placeholder="Project name"
          className="h-8 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <input
          type="text"
          name="customer"
          placeholder="Customer (optional)"
          className="h-8 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit">Create project</Button>
      </form>

      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {projects.map((project) => (
            <li key={project.id} className="flex items-baseline justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <Link
                  href={`/projects/${project.id}`}
                  className="block truncate font-medium hover:underline"
                >
                  {project.name}
                </Link>
                {project.customer && (
                  <p className="truncate text-sm text-muted-foreground">{project.customer}</p>
                )}
              </div>
              <time
                dateTime={project.createdAt.toISOString()}
                className="shrink-0 text-sm text-muted-foreground"
              >
                {project.createdAt.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

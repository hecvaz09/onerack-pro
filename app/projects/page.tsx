import {ProjectActions} from "./project-actions";
import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { createProject } from "./actions";
import { DatabaseNotice } from "./database-notice";

export default async function ProjectsPage({searchParams}:PageProps<"/projects">) {
  const query=await searchParams;
  const notice=query.notice==='project-trashed'?'Project moved to Trash. Its racks, connections and history are preserved.':query.notice==='project-restored'?'Project restored. Choose a project to continue.':null;
  // Render per request so the list reflects the database, not build time.
  await connection();

  if (!process.env.DATABASE_URL?.trim()) {
    return <DatabaseNotice reason="missing" />;
  }

  let projects,trashedProjects;
  try {
    [projects,trashedProjects] = await Promise.all([
      prisma.project.findMany({where:{trashedAt:null},orderBy:{createdAt:"desc"},include:{_count:{select:{racks:true}}}}),
      prisma.project.findMany({where:{trashedAt:{not:null}},orderBy:{trashedAt:"desc"},include:{_count:{select:{racks:true}}}}),
    ]);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "P2021" || code === "P2022") return <DatabaseNotice reason="schema" />;
    if (["P1000", "P1001", "P1002", "P1003", "P1010", "P1017", "P2024", "ECONNREFUSED", "ETIMEDOUT"].includes(String(code))) {
      return <DatabaseNotice reason="unavailable" />;
    }
    throw error;
  }

  return (
    <main className="workspace-page">
      {notice&&<p role="status" className="mb-4 rounded-lg border border-border bg-card p-3 text-sm">{notice}</p>}
      {process.env.RACKLAB_AUTH_ENABLED === "true" && <form action="/api/session/logout" method="post" className="mb-4 flex justify-end"><button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground">Sign out</button></form>}
      <header className="mb-8"><p className="mb-2 text-sm text-muted-foreground">OneRack Pro</p><Link href="/equipment" className="float-right rounded-lg border border-border px-4 py-2 text-sm">Equipment library →</Link><h1 className="text-3xl font-semibold tracking-tight">Projects</h1><p className="mt-2 text-sm text-muted-foreground">Create a project or continue an existing rack build.</p></header><div className="projects-overview"><section className="rounded-2xl border border-border bg-card p-6 backdrop-blur-md"><h2 className="mb-4 text-lg font-medium">New project</h2>

      <form action={createProject} className="flex flex-col gap-3">
        <input
          type="text"
          name="name"
          required
          placeholder="Project name"
          aria-label="Project name"
          className="h-10 shrink-0 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <input
          type="text"
          name="customer"
          placeholder="Customer (optional)"
          aria-label="Customer (optional)"
          className="h-10 shrink-0 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit">Create project</Button>
      </form></section><section><h2 className="mb-4 text-lg font-medium">Current projects</h2>

      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects yet.</p>
      ) : (
        <ul className="project-cards">
          {projects.map((project) => (
            <li key={project.id} className="flex items-baseline justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-5 backdrop-blur-md">
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
              <div className="flex shrink-0 items-center gap-3"><time
                dateTime={project.createdAt.toISOString()}
                className="shrink-0 text-sm text-muted-foreground"
              >
                {project.createdAt.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </time><ProjectActions project={{id:project.id,name:project.name,rackCount:project._count.racks}}/></div>
            </li>
          ))}
        </ul>
      )}
      <details className="mt-6 rounded-xl border border-border p-4"><summary className="cursor-pointer font-medium">Trash · {trashedProjects.length}</summary>{trashedProjects.length===0?<p className="mt-3 text-sm text-muted-foreground">Trash is empty.</p>:<ul className="mt-3 divide-y divide-border">{trashedProjects.map(project=><li key={project.id} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate font-medium">{project.name}</p><p className="text-xs text-muted-foreground">{project._count.racks} racks preserved · {project.id}</p></div><ProjectActions trashed project={{id:project.id,name:project.name,rackCount:project._count.racks}}/></li>)}</ul>}</details>
      </section></div>
    </main>
  );
}

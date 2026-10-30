import {RackActions} from "./rack-actions";
import rackStyles from "./rack-actions.module.css";
import {ProjectActions} from "../project-actions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { RackForm } from "./rack-form";

export default async function ProjectPage({ params,searchParams }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const query=await searchParams;
  const notice=query.notice==='rack-trashed'?'Rack moved to Trash. Your other racks and project are unchanged.':query.notice==='rack-restored'?'Rack restored with its equipment, cables and history.':null;

  // Render per request so the rack list reflects the database, not build time.
  await connection();

  const project = await prisma.project.findFirst({
    where: { id,trashedAt:null },
    include: { racks: { orderBy: [{ createdAt: "asc" }, { name: "asc" }, { id: "asc" }] } },
  });

  if (!project) notFound();
  const activeRacks=project.racks.filter(rack=>!rack.trashedAt),trashedRacks=project.racks.filter(rack=>rack.trashedAt);

  return (
    <main className="workspace-page">
      {notice&&<p role="status" className="mb-4 rounded-lg border border-border bg-card p-3 text-sm">{notice}</p>}
      <Link href="/projects" className="text-sm text-muted-foreground hover:underline">
        ← Back to projects
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4"><h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1><ProjectActions project={{id:project.id,name:project.name,rackCount:project.racks.length}}/></div>

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

      <h2 className="mt-8 mb-3 text-lg font-semibold">Racks · {activeRacks.length}</h2>

      <RackForm projectId={id} />

      {activeRacks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No racks yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {activeRacks.map((rack) => (
            <li key={rack.id} className={`${rackStyles.row} flex items-center justify-between gap-4 px-4 py-3`}>
              <Link
                href={`/projects/${id}/racks/${rack.id}`}
                className="min-w-0 truncate font-medium hover:underline"
              >
                {rack.name}
              </Link>
              <div className="flex shrink-0 items-center gap-3"><span className="text-sm text-muted-foreground">{rack.heightRU}U</span><RackActions projectId={id} rack={{id:rack.id,name:rack.name,heightRU:rack.heightRU}}/></div>
            </li>
          ))}
        </ul>
      )}
      <details className="mt-6 rounded-xl border border-border bg-card p-4"><summary className="cursor-pointer font-medium">Rack Trash · {trashedRacks.length}</summary>{trashedRacks.length===0?<p className="mt-3 text-sm text-muted-foreground">Rack Trash is empty.</p>:<ul className="mt-3 divide-y divide-border">{trashedRacks.map(rack=><li key={rack.id} className={`${rackStyles.row} flex items-center justify-between gap-4 py-3`}><div className="min-w-0"><p className="font-medium">{rack.name} · {rack.heightRU}U</p><p className="break-all text-xs text-muted-foreground">{rack.id}</p></div><RackActions projectId={id} rack={{id:rack.id,name:rack.name,heightRU:rack.heightRU}} trashed/></li>)}</ul>}</details>
    </main>
  );
}

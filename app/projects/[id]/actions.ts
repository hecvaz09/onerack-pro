"use server";
import { revalidatePath } from "next/cache";
import {requireActiveProject} from "@/lib/project-lifecycle";
import { prisma } from "@/lib/prisma";
import { rackSettingsFromForm } from "@/lib/rack-config";
export async function createRack(projectId: string, formData: FormData): Promise<{ok:true}|{ok:false;error:string}> {
  const settings = rackSettingsFromForm(formData);
  if ("error" in settings) return {ok:false,error:settings.error!};
  try {
    await prisma.$transaction(async tx=>{
      await requireActiveProject(tx,projectId);
      await tx.rack.create({data:{...settings,projectId}});
    },{maxWait:10000,timeout:30000});
    revalidatePath(`/projects/${projectId}`);
    return {ok:true};
  } catch { return {ok:false,error:"Could not create the rack. Please try again."}; }
}

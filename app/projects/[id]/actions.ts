"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createRack(projectId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const parsedHeight = Number.parseInt(String(formData.get("heightRU") ?? ""), 10);
  const heightRU = Number.isNaN(parsedHeight) ? 42 : Math.min(60, Math.max(1, parsedHeight));

  if (!name) return;

  await prisma.rack.create({
    data: { name, heightRU, projectId },
  });

  revalidatePath(`/projects/${projectId}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createRack(projectId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const heightChoice = String(formData.get("heightChoice") ?? "");

  let heightRU: number;
  if (heightChoice === "other") {
    const customHeight = Number.parseInt(String(formData.get("customHeight") ?? ""), 10);
    heightRU = Number.isNaN(customHeight) || customHeight < 1 || customHeight > 60 ? 42 : customHeight;
  } else {
    heightRU = Number.parseInt(heightChoice, 10);
  }
  if (Number.isNaN(heightRU) || heightRU < 1 || heightRU > 60) heightRU = 48;

  if (!name) return;

  await prisma.rack.create({
    data: { name, heightRU, projectId },
  });

  revalidatePath(`/projects/${projectId}`);
}

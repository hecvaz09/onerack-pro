"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createProject(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const customer = String(formData.get("customer") ?? "").trim();

  if (!name) return;

  await prisma.project.create({
    data: { name, customer: customer || null },
  });

  revalidatePath("/projects");
}

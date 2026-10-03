"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type PlaceDeviceValues = {
  catalogDeviceId: string;
  startRU: string;
  label: string;
};

export type PlaceDeviceState =
  | { error: string; values: PlaceDeviceValues }
  | { success: true }
  | null;

export async function placeDevice(
  rackId: string,
  prevState: PlaceDeviceState,
  formData: FormData,
): Promise<PlaceDeviceState> {
  // Echoed back on errors so the form can refill what the user submitted.
  const values: PlaceDeviceValues = {
    catalogDeviceId: String(formData.get("catalogDeviceId") ?? "").trim(),
    startRU: String(formData.get("startRU") ?? "").trim(),
    label: String(formData.get("label") ?? "").trim(),
  };
  const fail = (error: string) => ({ error, values });

  const { catalogDeviceId } = values;
  const startRU = Number.parseInt(values.startRU, 10);
  const label = values.label || null;

  if (!catalogDeviceId) return fail("Choose a device to place.");
  if (Number.isNaN(startRU)) return fail("Enter a starting RU.");

  const [rack, catalogDevice] = await Promise.all([
    prisma.rack.findUnique({
      where: { id: rackId },
      include: { devices: { include: { catalogDevice: true } } },
    }),
    prisma.catalogDevice.findUnique({ where: { id: catalogDeviceId } }),
  ]);

  if (!rack) return fail("Rack not found.");
  if (!catalogDevice) return fail("Device not found in the catalog.");
  if (catalogDevice.heightRU < 1) {
    return fail("0U devices can't be placed in the RU grid yet");
  }

  if (startRU < 1) return fail("Starting RU must be 1 or higher.");

  const endRU = startRU + catalogDevice.heightRU - 1;
  if (endRU > rack.heightRU) {
    return fail(
      `${catalogDevice.model} is ${catalogDevice.heightRU}U and won't fit at RU ${startRU} in a ${rack.heightRU}U rack.`,
    );
  }

  const conflict = rack.devices.find((existing) => {
    const existingEnd = existing.startRU + existing.catalogDevice.heightRU - 1;
    return startRU <= existingEnd && existing.startRU <= endRU;
  });
  if (conflict) {
    const conflictEnd = conflict.startRU + conflict.catalogDevice.heightRU - 1;
    const conflictName = conflict.label || conflict.catalogDevice.model;
    return fail(
      `RU ${startRU}–${endRU} overlaps ${conflictName} at RU ${conflict.startRU}–${conflictEnd}.`,
    );
  }

  await prisma.deviceInstance.create({
    data: { catalogDeviceId, startRU, label, rackId },
  });

  revalidatePath(`/projects/${rack.projectId}/racks/${rackId}`);
  return { success: true };
}

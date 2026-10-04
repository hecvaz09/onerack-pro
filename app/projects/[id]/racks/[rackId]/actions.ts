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

export type MoveDeviceResult = { ok: true } | { ok: false; error: string };

export async function moveDevice(
  rackId: string,
  deviceId: string,
  toStartRU: number,
): Promise<MoveDeviceResult> {
  try {
    const [rack, movedDevice] = await Promise.all([
      prisma.rack.findUnique({
        where: { id: rackId },
        include: { devices: { include: { catalogDevice: true } } },
      }),
      prisma.deviceInstance.findUnique({
        where: { id: deviceId },
        include: { catalogDevice: true },
      }),
    ]);

    if (!rack) return { ok: false, error: "Rack not found." };
    if (!movedDevice || movedDevice.rackId !== rackId) {
      return { ok: false, error: "Device not found in this rack." };
    }

    if (!Number.isInteger(toStartRU) || toStartRU < 1) {
      return { ok: false, error: "Starting RU must be 1 or higher." };
    }

    const { heightRU, model } = movedDevice.catalogDevice;
    const endRU = toStartRU + heightRU - 1;
    if (endRU > rack.heightRU) {
      return {
        ok: false,
        error: `${model} is ${heightRU}U and won't fit at RU ${toStartRU} in a ${rack.heightRU}U rack.`,
      };
    }

    // Exclude the device being moved, or it would always overlap its own old position.
    const conflict = rack.devices
      .filter((existing) => existing.id !== deviceId)
      .find((existing) => {
        const existingEnd = existing.startRU + existing.catalogDevice.heightRU - 1;
        return toStartRU <= existingEnd && existing.startRU <= endRU;
      });
    if (conflict) {
      const conflictEnd = conflict.startRU + conflict.catalogDevice.heightRU - 1;
      const conflictName = conflict.label || conflict.catalogDevice.model;
      return {
        ok: false,
        error: `RU ${toStartRU}–${endRU} overlaps ${conflictName} at RU ${conflict.startRU}–${conflictEnd}.`,
      };
    }

    await prisma.deviceInstance.update({
      where: { id: deviceId },
      data: { startRU: toStartRU },
    });

    revalidatePath(`/projects/${rack.projectId}/racks/${rackId}`);
    return { ok: true };
  } catch (error) {
    console.error("moveDevice failed", error);
    return { ok: false, error: "Couldn't move the device. Please try again." };
  }
}

export type ConnectionResult = { ok: true } | { ok: false; error: string };

export async function createConnection(
  rackId: string,
  fromDeviceId: string,
  toDeviceId: string,
  cableType: string | null,
  label: string | null,
): Promise<ConnectionResult> {
  try {
    if (!fromDeviceId || !toDeviceId) {
      return { ok: false, error: "Choose both devices to connect." };
    }
    if (fromDeviceId === toDeviceId) {
      return { ok: false, error: "A device can't be connected to itself." };
    }

    const [rack, fromDevice, toDevice] = await Promise.all([
      prisma.rack.findUnique({ where: { id: rackId }, select: { projectId: true } }),
      prisma.deviceInstance.findUnique({ where: { id: fromDeviceId }, select: { rackId: true } }),
      prisma.deviceInstance.findUnique({ where: { id: toDeviceId }, select: { rackId: true } }),
    ]);

    if (!rack) return { ok: false, error: "Rack not found." };
    if (!fromDevice || !toDevice) return { ok: false, error: "Device not found." };
    if (fromDevice.rackId !== rackId || toDevice.rackId !== rackId) {
      return { ok: false, error: "Only devices in this rack can be connected." };
    }

    // Either direction counts: A→B and B→A are the same cable.
    const pair = [fromDeviceId, toDeviceId];
    const existing = await prisma.connection.findFirst({
      where: { fromDeviceId: { in: pair }, toDeviceId: { in: pair } },
      select: { id: true },
    });
    if (existing) return { ok: false, error: "These devices are already connected." };

    await prisma.connection.create({
      data: {
        fromDeviceId,
        toDeviceId,
        cableType: cableType?.trim() || null,
        label: label?.trim() || null,
      },
    });

    revalidatePath(`/projects/${rack.projectId}/racks/${rackId}`);
    return { ok: true };
  } catch (error) {
    console.error("createConnection failed", error);
    return { ok: false, error: "Couldn't create the connection. Please try again." };
  }
}

export async function deleteConnection(
  connectionId: string,
  rackId: string,
): Promise<ConnectionResult> {
  try {
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
      select: { fromDevice: { select: { rackId: true, rack: { select: { projectId: true } } } } },
    });
    if (!connection || connection.fromDevice.rackId !== rackId) {
      return { ok: false, error: "Connection not found in this rack." };
    }

    await prisma.connection.delete({ where: { id: connectionId } });

    revalidatePath(`/projects/${connection.fromDevice.rack.projectId}/racks/${rackId}`);
    return { ok: true };
  } catch (error) {
    console.error("deleteConnection failed", error);
    return { ok: false, error: "Couldn't remove the connection. Please try again." };
  }
}

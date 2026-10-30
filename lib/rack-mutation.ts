import {requireActiveRack} from "@/lib/rack-trash";
import {requireActiveProjectForRack} from "@/lib/project-lifecycle";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { rackSnapshot, recordRackChange } from "@/lib/rack-history";

// Every write affecting a rack takes the same transaction-scoped lock.
// Validation runs after the lock, so a second request sees the first write.
export function rackMutation<T>(rackId: string, mutate: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async tx => {
    await requireActiveProjectForRack(tx,rackId);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${rackId}, 0))::text`;
    await requireActiveRack(tx,rackId);
    const before = await rackSnapshot(tx, rackId);
    const result = await mutate(tx);
    await recordRackChange(tx, rackId, before);
    return result;
  }, { maxWait: 10000, timeout: 30000 });
}

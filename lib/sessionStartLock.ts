import type { Prisma } from "@prisma/client";

/**
 * Serializes session starts for one user and mode for the life of the current
 * transaction. Without this lock, two requests can both observe the final
 * available monthly slot and both create a session.
 */
export async function acquireSessionStartLock(
  tx: Prisma.TransactionClient,
  userId: string,
  mode: string
): Promise<void> {
  const key = `inturview:session-start:${userId}:${mode}`;
  // Return an integer rather than PostgreSQL's `void` lock result; Prisma
  // cannot deserialize a raw `void` column.
  await tx.$queryRaw`SELECT 1::int AS acquired WHERE pg_advisory_xact_lock(hashtext(${key})) IS NULL`;
}

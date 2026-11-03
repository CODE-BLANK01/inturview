// The frozen loop a batch of candidates runs: the published version, or for a
// preview the draft frozen at the moment it was previewed.
import { prisma } from "./db";

export interface SnapshotSource {
  loopTemplateId: string;
  loopVersion: number;
  preview?: boolean;
  previewSnapshot?: unknown;
}

export async function campaignSnapshot(c: SnapshotSource): Promise<unknown | null> {
  if (c.preview && c.previewSnapshot) return c.previewSnapshot;
  const v = await prisma.loopTemplateVersion.findUnique({
    where: { loopTemplateId_version: { loopTemplateId: c.loopTemplateId, version: c.loopVersion } },
    select: { snapshot: true },
  });
  return v?.snapshot ?? null;
}

/** Fields to select on a campaign so campaignSnapshot can read it. */
export const SNAPSHOT_FIELDS = { loopTemplateId: true, loopVersion: true, preview: true, previewSnapshot: true } as const;

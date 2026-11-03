// Page and API guards for /hire/[org]. Everything workspace-scoped goes
// through these; they never trust an organization ID from the client.
import { notFound, redirect } from "next/navigation";
import { prisma } from "./db";
import { requireUser, type SessionUser } from "./auth";
import type { Permission } from "./permissions";
import { accessAllows, resolveWorkspaceAccess, type WorkspaceAccess } from "./workspaces";

export type HireUser = SessionUser & { emailVerified: boolean };

/** The signed-in, verified user for a /hire page, or a redirect that brings them back. */
export async function requireHireUser(returnTo: string): Promise<HireUser> {
  const user = await requireUser();
  if (!user) redirect(`/signin?callbackUrl=${encodeURIComponent(returnTo)}`);
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { emailVerifiedAt: true } });
  if (!row?.emailVerifiedAt) redirect(`/verify-email?next=${encodeURIComponent(returnTo)}`);
  return { ...user, emailVerified: true };
}

/** For pages: 404 unless the viewer may `permission` in this workspace. */
export async function requireWorkspace(
  slug: string,
  permission: Permission = "workspace.view",
): Promise<WorkspaceAccess & { user: HireUser }> {
  const user = await requireHireUser(`/hire/${slug}`);
  const access = await resolveWorkspaceAccess(slug, user);
  if (!access || !accessAllows(access, permission)) notFound();
  return { ...access, user };
}

/** For API routes: the access, or the response to send instead. */
export async function workspaceApi(
  slug: string,
  permission: Permission,
): Promise<{ ok: true; access: WorkspaceAccess; user: SessionUser } | { ok: false; response: Response }> {
  const user = await requireUser();
  if (!user) return { ok: false, response: Response.json({ error: "Not signed in" }, { status: 401 }) };
  const access = await resolveWorkspaceAccess(slug, user);
  // Same answer for "doesn't exist" and "not yours".
  if (!access) return { ok: false, response: Response.json({ error: "Not found" }, { status: 404 }) };
  if (!accessAllows(access, permission)) {
    return { ok: false, response: Response.json({ error: "Your role can't do that." }, { status: 403 }) };
  }
  // Support access is read-only.
  if (!access.role && permission !== "workspace.view" && permission !== "applications.viewAll") {
    return { ok: false, response: Response.json({ error: "Support access is read-only." }, { status: 403 }) };
  }
  return { ok: true, access, user };
}

// Where hiring pages and APIs live for the current owner. Client-safe.
export interface HiringPaths {
  /** API root: `${api}/questions`, `${api}/loops`, `${api}/campaigns`, `${api}/invites`, `${api}/round-runs`. */
  api: string;
  questions: string;
  loops: string;
  invites: string;
  /** Workspaces only: hiring roles and the candidates pipeline. */
  roles: string;
  candidates: string;
  /** True inside a company workspace (the inturview library is read-only there). */
  workspace: boolean;
}

export const ADMIN_PATHS: HiringPaths = {
  api: "/api/admin",
  questions: "/admin/content/questions",
  loops: "/admin/content/loops",
  invites: "/admin/campaigns",
  roles: "/admin/campaigns",
  candidates: "/admin/campaigns",
  workspace: false,
};

export function workspacePaths(slug: string): HiringPaths {
  return {
    api: `/api/hire/${slug}`,
    questions: `/hire/${slug}/questions`,
    loops: `/hire/${slug}/loops`,
    invites: `/hire/${slug}/invites`,
    roles: `/hire/${slug}/roles`,
    candidates: `/hire/${slug}/candidates`,
    workspace: true,
  };
}

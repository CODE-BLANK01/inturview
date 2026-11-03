// Workspace permission matrix (docs/architecture/three-products.md §3).
// Pure data so it can be unit tested and shown in the UI without a database.
import type { OrgRole } from "@prisma/client";

export const PERMISSIONS = [
  "workspace.view",
  "workspace.editProfile",
  "workspace.billing",
  "workspace.transferOrDelete",
  "members.manageStaff", // invite/remove recruiters and reviewers
  "members.manageAdmins", // invite/remove/change admins and owners
  "roles.edit",
  "loops.edit",
  "questions.edit",
  "invitations.send",
  "reviewers.assign",
  "applications.viewAll",
  "applications.review", // notes and ratings; reviewers only on assigned applications
  "applications.decide",
  "applications.rescore",
  "applicantData.exportOrDelete",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const STAFF: Permission[] = [
  "workspace.view",
  "roles.edit",
  "loops.edit",
  "questions.edit",
  "invitations.send",
  "reviewers.assign",
  "applications.viewAll",
  "applications.review",
  "applications.decide",
  "applications.rescore",
];

const MATRIX: Record<OrgRole, ReadonlySet<Permission>> = {
  OWNER: new Set(PERMISSIONS),
  ADMIN: new Set<Permission>([...STAFF, "workspace.editProfile", "members.manageStaff", "applicantData.exportOrDelete"]),
  RECRUITER: new Set(STAFF),
  // Reviewers see and review only what they're assigned; callers scope the query.
  REVIEWER: new Set<Permission>(["workspace.view", "applications.review"]),
};

export function can(role: OrgRole, permission: Permission): boolean {
  return MATRIX[role].has(permission);
}

/** Who `actor` may invite, remove, or set as `target` role. */
export function canManageRole(actor: OrgRole, target: OrgRole): boolean {
  if (target === "OWNER" || target === "ADMIN") return can(actor, "members.manageAdmins");
  return can(actor, "members.manageStaff");
}

export const ROLE_LABELS: Record<OrgRole, string> = {
  OWNER: "Owner",
  ADMIN: "Workspace admin",
  RECRUITER: "Recruiter",
  REVIEWER: "Reviewer",
};

export const ROLE_BLURBS: Record<OrgRole, string> = {
  OWNER: "Everything, including billing, admins and deleting the workspace.",
  ADMIN: "Company profile and teammates, plus everything a recruiter can do.",
  RECRUITER: "Roles, loops, questions, invitations, reviews and decisions.",
  REVIEWER: "Reviews only the applications assigned to them.",
};

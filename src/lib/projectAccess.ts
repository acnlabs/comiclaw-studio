import { forbidden } from "@/lib/auth";

export type ProjectAccessFields = {
  visibility: string;
  isPrivate: boolean;
  ownerUserId: string | null;
};

export function isPublicProject(project: { visibility: string }): boolean {
  return project.visibility === "PUBLIC";
}

/** Anonymous or logged-in view access for a project. */
export function canViewProject(
  project: ProjectAccessFields,
  sub: string | null
): boolean {
  if (project.visibility === "PUBLIC") return true;
  if (!project.isPrivate) return true;
  return Boolean(sub && project.ownerUserId === sub);
}

export function assertCanViewProject(
  project: ProjectAccessFields,
  sub: string | null
): Response | null {
  if (canViewProject(project, sub)) return null;
  return forbidden("You don't have access to this project");
}

/** Humans may contribute when project is PUBLIC, or when they own a PRIVATE project. */
export function canUserContribute(
  project: ProjectAccessFields,
  sub: string
): boolean {
  if (project.visibility === "PUBLIC") return true;
  return project.ownerUserId === sub;
}

export function assertCanUserContribute(
  project: ProjectAccessFields,
  sub: string
): Response | null {
  if (canUserContribute(project, sub)) return null;
  return forbidden("Only PUBLIC project members or the owner can contribute");
}

/** Block enabling privacy on PUBLIC projects. */
export function assertPrivacyAllowed(
  visibility: string,
  isPrivate: boolean
): Response | null {
  if (visibility === "PUBLIC" && isPrivate) {
    return forbidden("PUBLIC projects cannot be private");
  }
  return null;
}

import { prisma } from "@/lib/db";
import { ownerFields, ownerFromRecord } from "@/lib/owner";

export const PROJECT_FORMAT_VIDEO = "VIDEO";
export const PROJECT_FORMAT_DRAMA = "DRAMA";

export type ProjectFormat = typeof PROJECT_FORMAT_VIDEO | typeof PROJECT_FORMAT_DRAMA;

export function isDramaShell(format: string | null | undefined): boolean {
  return format === PROJECT_FORMAT_DRAMA;
}

export function parseProjectFormat(value: string | null | undefined): ProjectFormat {
  return value === PROJECT_FORMAT_DRAMA ? PROJECT_FORMAT_DRAMA : PROJECT_FORMAT_VIDEO;
}

/** Create-time combinations that would mix two containers or nest a show inside a show. */
export function invalidDramaCreate(args: {
  format?: string | null;
  dramaProjectId?: string | null;
  columnId?: string | null;
  parentProjectId?: string | null;
}): string | null {
  const format = parseProjectFormat(args.format);
  const dramaId = args.dramaProjectId?.trim() || null;
  const columnId = args.columnId?.trim() || null;
  const parentProjectId = args.parentProjectId?.trim() || null;
  if (format === PROJECT_FORMAT_DRAMA && dramaId) {
    return "A drama project cannot belong to another drama";
  }
  if (format === PROJECT_FORMAT_DRAMA && columnId) {
    return "A drama project cannot attach to a column";
  }
  if (format === PROJECT_FORMAT_DRAMA && parentProjectId) {
    return "A drama project cannot be a co-creation";
  }
  if (dramaId && columnId) {
    return "A drama episode cannot attach to a column";
  }
  if (dramaId && parentProjectId) {
    return "A co-creation cannot be a drama episode";
  }
  return null;
}

export async function nextDramaOrder(dramaProjectId: string): Promise<number> {
  const latest = await prisma.project.findFirst({
    where: { dramaProjectId, dramaOrder: { not: null } },
    orderBy: { dramaOrder: "desc" },
    select: { dramaOrder: true },
  });
  return (latest?.dramaOrder ?? 0) + 1;
}

export async function loadDramaShell(dramaProjectId: string): Promise<DramaShell | null> {
  const row = await prisma.project.findUnique({
    where: { id: dramaProjectId },
    select: {
      id: true,
      format: true,
      visibility: true,
      isPrivate: true,
      acnOrgId: true,
      contributePolicy: true,
      ownerKind: true,
      ownerUserId: true,
      ownerAgentId: true,
      ownerOrgId: true,
    },
  });
  if (!row || row.format !== PROJECT_FORMAT_DRAMA) return null;
  return row;
}

export type DramaShell = {
  id: string;
  visibility: string;
  isPrivate: boolean;
  acnOrgId: string | null;
  contributePolicy: string | null;
  ownerKind?: string | null;
  ownerUserId: string | null;
  ownerAgentId?: string | null;
  ownerOrgId?: string | null;
};

export function dramaEpisodeCreateData(
  shell: DramaShell,
  draft: { name: string; description?: string | null },
  dramaOrder: number,
) {
  return {
    name: draft.name,
    description: draft.description ?? null,
    format: PROJECT_FORMAT_VIDEO,
    dramaProjectId: shell.id,
    dramaOrder,
    visibility: shell.visibility,
    ...(shell.visibility === "PUBLIC" ? { isPrivate: false } : { isPrivate: shell.isPrivate }),
    ...ownerFields(ownerFromRecord(shell)),
    acnOrgId: shell.acnOrgId,
    contributePolicy: shell.contributePolicy,
  };
}

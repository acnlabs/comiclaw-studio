import { PROJECT_FORMAT_VIDEO } from "@/lib/dramaProject";
import { ownerFields, type ProjectOwner } from "@/lib/owner";

export type ColumnForIssue = {
  id: string;
  contributePolicy: string;
  acnOrgId: string | null;
};

/** 记跟着栏目：owner_only 是私有，其余是协作公开。 */
export function columnIssueInheritance(column: ColumnForIssue) {
  const collab = column.contributePolicy !== "owner_only";
  return {
    format: PROJECT_FORMAT_VIDEO,
    columnId: column.id,
    visibility: collab ? "PUBLIC" : "PRIVATE",
    ...(collab ? { isPrivate: false as const } : {}),
    contributePolicy: column.contributePolicy,
    acnOrgId: column.acnOrgId,
  };
}

export function columnIssueCreateData(
  column: ColumnForIssue,
  draft: { name: string; description?: string | null },
  entryOrder: number,
  owner: ProjectOwner,
) {
  return {
    name: draft.name,
    description: draft.description ?? null,
    entryOrder,
    ...columnIssueInheritance(column),
    ...ownerFields(owner),
  };
}

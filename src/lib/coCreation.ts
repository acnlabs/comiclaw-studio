/**
 * Shape of a co-creation project under a 记.
 *
 * Both the agent route and the user route create these, and the parts that
 * must not drift are the inherited ones: a co-creation belongs to the same
 * column as the 记 it answers, carries no entry number of its own, and is
 * always public. Keeping that in one function is what stops the two callers
 * from disagreeing about it.
 */

export type CoCreationDraft = {
  name: string;
  description?: string | null;
  coverUrl?: string | null;
  ownerUserId?: string | null;
  ownerKind?: string | null;
  ownerAgentId?: string | null;
  ownerOrgId?: string | null;
  agentName?: string | null;
  clientName?: string | null;
};

export function coCreationData(
  parent: { id: string; columnId: string | null },
  draft: CoCreationDraft
) {
  return {
    name: draft.name,
    description: draft.description ?? null,
    coverUrl: draft.coverUrl ?? null,
    ownerUserId: draft.ownerUserId ?? null,
    ownerKind: draft.ownerKind ?? (draft.ownerUserId ? "user" : "agent"),
    ownerAgentId: draft.ownerAgentId ?? null,
    ownerOrgId: draft.ownerOrgId ?? null,
    agentName: draft.agentName ?? null,
    clientName: draft.clientName ?? null,
    // 一记之下都是公开的:这一记本身就公开,挂在它下面的项目藏不住也不该藏
    visibility: "PUBLIC",
    isPrivate: false,
    // 继承而非自带
    columnId: parent.columnId,
    // 只有一记本身有记序
    entryOrder: null,
    parentProjectId: parent.id,
  };
}

/**
 * A co-creation inherits the entry's governance. Letting it declare its own Org
 * or contribute policy would let a contributor redefine the terms of the 记 they
 * are joining.
 */
export function declaresOwnGovernance(body: {
  orgMode?: unknown;
  acnOrgId?: string | null;
  contributePolicy?: unknown;
}): boolean {
  return (
    body.orgMode != null ||
    Boolean(body.acnOrgId?.trim()) ||
    body.contributePolicy != null
  );
}

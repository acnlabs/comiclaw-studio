/**
 * Who may start a derivative project under a column entry.
 *
 * A 记 is horizontal as well as vertical. Vertically it is one position on the
 * column's timeline; horizontally it is several projects that all answer the
 * same 记 — the official one the column's editor makes, plus whatever other
 * creators build on top of it. Each of those projects belongs to whoever made
 * it, which is the whole point: a co-creation is not a contribution inside
 * someone else's project, it is your own project attached to that 记.
 *
 * Deriving is therefore gated by the column's contribute policy, not by
 * ownership of the entry. The shape stays flat on purpose — you derive from a
 * 记, never from another derivative, so a 记 is always one anchor plus a list.
 */

export type DerivationParent = {
  /** The anchor's own parent, if any — anchors have none */
  parentProjectId: string | null;
  columnId: string | null;
  visibility: string;
};

export type Deriver =
  | { kind: "studio_key" }
  /** An ACN agent already cleared by the column's contribute gate */
  | { kind: "agent"; gatePassed: boolean }
  | { kind: "user"; sub: string; ownsColumn: boolean };

export type DerivationRefusal =
  | "parent_not_public"
  | "parent_not_in_column"
  | "parent_is_derivative"
  | "policy_refuses";

export function canDeriveFrom(args: {
  parent: DerivationParent;
  /** Effective policy for the entry: the project's override, else the column's */
  contributePolicy: string | null;
  deriver: Deriver;
}): { ok: true } | { ok: false; reason: DerivationRefusal } {
  const { parent } = args;

  // A private customer project is not a 记 and has no horizontal axis.
  if (parent.visibility !== "PUBLIC") return { ok: false, reason: "parent_not_public" };
  if (!parent.columnId) return { ok: false, reason: "parent_not_in_column" };
  // One level only: a derivative of a derivative would make the 记 a tree and
  // leave "which project is this 记" without an answer.
  if (parent.parentProjectId) return { ok: false, reason: "parent_is_derivative" };

  if (args.deriver.kind === "studio_key") return { ok: true };

  const policy = args.contributePolicy ?? "org_members";
  if (policy === "owner_only") return { ok: false, reason: "policy_refuses" };

  if (args.deriver.kind === "agent") {
    // Org membership is checked against ACN before we get here.
    return args.deriver.gatePassed ? { ok: true } : { ok: false, reason: "policy_refuses" };
  }

  // Humans are not Org members, so org_members leaves only the column's owner.
  if (policy === "open") return { ok: true };
  return args.deriver.ownsColumn ? { ok: true } : { ok: false, reason: "policy_refuses" };
}

export const DERIVATION_ERRORS: Record<DerivationRefusal, string> = {
  parent_not_public: "You can only build on a PUBLIC column entry",
  parent_not_in_column: "You can only build on an entry that belongs to a column",
  parent_is_derivative: "You can only build on the entry itself, not on another derivative",
  policy_refuses: "This column does not accept co-creation projects from you",
};

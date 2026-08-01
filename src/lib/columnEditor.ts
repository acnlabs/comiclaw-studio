/**
 * Who may open an entry in a column.
 *
 * A column's daily loop belongs to its editor agent — comiclaw opens today's
 * entry, writes the hook, and the community contributes to it. That first step
 * used to sit behind `STUDIO_API_KEY`, which the editor does not have and
 * should not: it is the full-access ops key, and an agent's behaviour can be
 * steered by whatever it reads. So the column names its editor instead, and
 * the editor acts as itself.
 *
 * The opening is deliberately narrow. An ACN identity gets in only to create a
 * PUBLIC entry, only in a column that named it, and only when the request is
 * not also trying to bind or create an Org. Everything else — private customer
 * projects, Org binding, any column that named nobody — stays with the Studio
 * key.
 */

export type EntryOpenRequest = {
  visibility: string;
  columnId: string | null;
  /** Any attempt to create or attach an ACN Org in the same call */
  wantsOrgBind: boolean;
};

export type EntryOpener =
  | { kind: "studio_key" }
  | { kind: "agent"; agentId: string };

export type EntryOpenRefusal =
  | "not_public"
  | "no_column"
  | "column_has_no_editor"
  | "not_the_editor"
  | "org_bind_not_allowed";

export function canOpenEntry(args: {
  request: EntryOpenRequest;
  column: { editorAgentId: string | null } | null;
  opener: EntryOpener;
}): { ok: true } | { ok: false; reason: EntryOpenRefusal } {
  // The Studio key is ops: it keeps doing everything it did before.
  if (args.opener.kind === "studio_key") return { ok: true };

  if (args.request.visibility !== "PUBLIC") return { ok: false, reason: "not_public" };
  if (!args.request.columnId) return { ok: false, reason: "no_column" };
  if (!args.column?.editorAgentId) {
    return { ok: false, reason: "column_has_no_editor" };
  }
  if (args.column.editorAgentId.trim() !== args.opener.agentId.trim()) {
    return { ok: false, reason: "not_the_editor" };
  }
  // Binding an Org decides where money and governance land. That is not
  // something an editor should be able to do while opening a daily entry.
  if (args.request.wantsOrgBind) {
    return { ok: false, reason: "org_bind_not_allowed" };
  }
  return { ok: true };
}

export const ENTRY_OPEN_ERRORS: Record<EntryOpenRefusal, string> = {
  not_public: "An agent may only open PUBLIC column entries",
  no_column: "An agent may only create projects inside a column it edits",
  column_has_no_editor: "This column has no editor agent",
  not_the_editor: "You are not this column's editor agent",
  org_bind_not_allowed:
    "An editor agent cannot bind or create an ACN Org while opening an entry",
};

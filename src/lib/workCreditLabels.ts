import type { MessageKey } from "@/lib/i18n";
import type { CreditKind, CreditRow } from "@/lib/workCredit";

const KIND_KEYS: Record<CreditKind, MessageKey> = {
  appear: "series.castMember",
  script: "credit.script",
  asset: "credit.asset",
  storyboard: "credit.storyboard",
  film: "credit.film",
};

export function creditLabelKeys(row: CreditRow): MessageKey[] {
  return row.kinds.map((kind) =>
    kind === "appear" && row.lead ? "series.castLead" : KIND_KEYS[kind],
  );
}

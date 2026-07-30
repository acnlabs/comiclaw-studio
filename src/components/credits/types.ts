import type {
  EarnedByCharacter,
  EarnedRow,
  SpentByAction,
  SpentRow,
} from "@/lib/creditsLedger";

export type Ledger = {
  earned: { total: number; byCharacter: EarnedByCharacter[]; rows: EarnedRow[] };
  spent: {
    total: number;
    byAction: SpentByAction[];
    failedCount: number;
    rows: SpentRow[];
  };
};

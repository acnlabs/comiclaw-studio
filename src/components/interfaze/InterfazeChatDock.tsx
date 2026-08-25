"use client";

import { useEffect } from "react";
import InterfazeChat from "@/components/interfaze/InterfazeChat";
import { useT } from "@/components/LocaleProvider";

const TITLE_ID = "interfaze-chat-title";

export default function InterfazeChatDock({
  agentId,
  agentName,
  metadata,
  open,
  onClose,
}: {
  agentId: string;
  agentName?: string;
  metadata?: Record<string, unknown>;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useT();
  const title = agentName?.trim()
    ? t("interfaze.chatWith", { name: agentName.trim() })
    : t("interfaze.title");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.documentElement.classList.add("interfaze-dock-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("interfaze-dock-open");
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/50 md:hidden"
        aria-label={t("detail.close")}
        onClick={onClose}
      />
      <aside
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80dvh] flex-col rounded-t-2xl border border-zinc-800 bg-zinc-900 p-4 md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[var(--interfaze-dock-width)] md:rounded-none md:border-y-0 md:border-r-0 md:border-l"
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
      >
        <div className="mb-3 flex items-center justify-between gap-3 pr-1">
          <h2 id={TITLE_ID} className="truncate text-sm font-semibold text-zinc-50">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("detail.close")}
            title={t("detail.close")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
          >
            ✕
          </button>
        </div>
        {agentId ? (
          <InterfazeChat
            agentId={agentId}
            metadata={metadata}
            fill
            className="min-h-0 flex-1"
          />
        ) : null}
      </aside>
    </>
  );
}

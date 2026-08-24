"use client";

import { Modal } from "@/components/ui";
import InterfazeChat from "@/components/interfaze/InterfazeChat";
import { useT } from "@/components/LocaleProvider";

const TITLE_ID = "interfaze-chat-title";

export default function InterfazeChatModal({
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

  return (
    <Modal open={open} onClose={onClose} titleId={TITLE_ID}>
      <div className="pr-8">
        <h2 id={TITLE_ID} className="text-lg font-semibold text-zinc-50">
          {title}
        </h2>
        {open && agentId ? (
          <InterfazeChat
            agentId={agentId}
            metadata={metadata}
            className="mt-4"
          />
        ) : null}
      </div>
    </Modal>
  );
}

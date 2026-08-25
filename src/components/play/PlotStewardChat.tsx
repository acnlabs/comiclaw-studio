"use client";

import { useState } from "react";
import InterfazeChatDock from "@/components/interfaze/InterfazeChatDock";
import { useT } from "@/components/LocaleProvider";

export default function PlotStewardChat({
  agentId,
  plotId,
}: {
  agentId: string;
  plotId: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(true);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full rounded-full bg-accent px-5 py-2.5 text-center text-sm font-medium text-zinc-950 hover:opacity-90"
      >
        {t("play.plotChatGuide")}
      </button>
      <InterfazeChatDock
        open={open}
        agentId={agentId}
        agentName={t("play.plotGuide")}
        metadata={{ plotId, role: "steward" }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

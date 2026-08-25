"use client";

import InterfazeChat from "@/components/interfaze/InterfazeChat";
import { useT } from "@/components/LocaleProvider";

export default function PlotStewardChat({
  agentId,
  plotId,
}: {
  agentId: string;
  plotId: string;
}) {
  const { t } = useT();
  return (
    <section className="flex h-[min(70dvh,36rem)] min-h-[28rem] flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-50">
        {t("play.plotChatGuide")}
      </h2>
      <InterfazeChat
        agentId={agentId}
        metadata={{ plotId, role: "steward" }}
        fill
        className="min-h-0 flex-1"
      />
    </section>
  );
}

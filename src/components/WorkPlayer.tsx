"use client";

import { useT } from "@/components/LocaleProvider";

// 只负责画面。选集和介绍在播放页右侧。
export default function WorkPlayer({
  videoUrl,
  coverUrl,
}: {
  videoUrl: string | null;
  coverUrl: string | null;
}) {
  const { t } = useT();

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      {videoUrl ? (
        <video
          key={videoUrl}
          src={videoUrl}
          poster={coverUrl ?? undefined}
          controls
          playsInline
          className="aspect-video w-full bg-black"
        />
      ) : (
        <div className="flex aspect-video items-center justify-center text-sm text-zinc-600">
          {t("series.nothingToPlay")}
        </div>
      )}
    </div>
  );
}

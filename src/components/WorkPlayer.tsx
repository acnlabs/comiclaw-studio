"use client";

import { useState } from "react";
import { fmtDuration } from "@/lib/format";

interface EpisodeData {
  id: string;
  order: number;
  title: string | null;
  videoUrl: string;
  duration: number | null;
}

// 作品播放器:短视频直接播放,短剧带分集列表
export default function WorkPlayer({
  videoUrl,
  coverUrl,
  episodes,
}: {
  videoUrl: string | null;
  coverUrl: string | null;
  episodes: EpisodeData[];
}) {
  const [current, setCurrent] = useState<EpisodeData | null>(episodes[0] ?? null);
  const src = current?.videoUrl ?? videoUrl;

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
        {src ? (
          <video
            key={src}
            src={src}
            poster={coverUrl ?? undefined}
            controls
            playsInline
            className="aspect-video w-full"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center text-sm text-zinc-600">
            暂无可播放内容
          </div>
        )}
      </div>

      {episodes.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3">
          <h3 className="px-2 pb-2 text-sm font-medium text-zinc-400">
            选集(全 {episodes.length} 集)
          </h3>
          <div className="grid max-h-80 grid-cols-4 gap-2 overflow-y-auto lg:grid-cols-3">
            {episodes.map((e) => (
              <button
                key={e.id}
                onClick={() => setCurrent(e)}
                className={`rounded-xl px-2 py-2.5 text-center text-sm transition-colors ${
                  current?.id === e.id
                    ? "bg-accent font-medium text-zinc-950"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
                title={e.title ?? undefined}
              >
                <div>{e.order}</div>
                {e.duration != null && (
                  <div
                    className={`mt-0.5 text-[10px] ${
                      current?.id === e.id ? "text-zinc-800" : "text-zinc-500"
                    }`}
                  >
                    {fmtDuration(e.duration)}
                  </div>
                )}
              </button>
            ))}
          </div>
          {current?.title && (
            <p className="px-2 pt-2 text-xs text-zinc-500">
              第 {current.order} 集:{current.title}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

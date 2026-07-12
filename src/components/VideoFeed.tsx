"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export interface FeedItem {
  id: string;
  kind: string;
  category: string | null;
  title: string;
  description: string | null;
  authorName: string | null;
  playUrl: string;
  coverUrl: string | null;
  episodeCount: number;
}

// TikTok 式竖版信息流:滚动吸附逐条观看,进入视口自动播放
export default function VideoFeed({ items }: { items: FeedItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = entry.target as HTMLVideoElement;
          if (entry.intersectionRatio >= 0.6) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      },
      { root: container, threshold: [0, 0.6] }
    );

    for (const v of videoRefs.current) {
      if (v) observer.observe(v);
    }
    return () => observer.disconnect();
  }, [items.length]);

  const scrollByPage = (dir: 1 | -1) => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollBy({ top: dir * container.clientHeight, behavior: "smooth" });
  };

  const togglePlay = (video: HTMLVideoElement | null) => {
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-zinc-500">
        还没有发布的作品。项目发行上架后会自动出现在这里。
      </div>
    );
  }

  return (
    <div className="relative flex-1">
      <div
        ref={containerRef}
        className="h-[calc(100dvh-3rem)] snap-y snap-mandatory overflow-y-auto scroll-smooth"
      >
        {items.map((item, i) => (
          <section
            key={item.id}
            className="flex h-full snap-start snap-always items-center justify-center p-2 sm:p-3"
          >
            {/* 自适应舞台:横版铺宽上下留黑,竖版居中两侧留黑 */}
            <div className="relative h-full w-full overflow-hidden rounded-xl bg-black">
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                src={item.playUrl}
                poster={item.coverUrl ?? undefined}
                loop
                muted={muted}
                playsInline
                preload="metadata"
                onClick={(e) => togglePlay(e.currentTarget)}
                className="h-full w-full cursor-pointer object-contain"
              />

              {/* 类型角标 */}
              <span className="absolute left-3 top-3 rounded-md bg-zinc-950/70 px-2 py-0.5 text-xs font-medium text-accent">
                {item.kind === "SERIES" ? (item.category ?? "短剧") : "短视频"}
              </span>

              {/* 底部信息 */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-4 pt-16">
                {item.authorName && (
                  <p className="text-sm font-semibold text-zinc-100">@{item.authorName}</p>
                )}
                <p className="mt-0.5 line-clamp-2 text-sm text-zinc-200">{item.title}</p>
                {item.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{item.description}</p>
                )}
                {item.kind === "SERIES" && (
                  <Link
                    href={`/w/${item.id}`}
                    className="pointer-events-auto mt-2 inline-flex items-center gap-1 rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-zinc-950 transition-opacity hover:opacity-90"
                  >
                    观看全集(全 {item.episodeCount} 集)→
                  </Link>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* 右侧悬浮控制 */}
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-2 sm:right-6">
        <button
          onClick={() => setMuted((m) => !m)}
          title={muted ? "开启声音" : "静音"}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-base backdrop-blur transition-colors hover:bg-zinc-800"
        >
          {muted ? "🔇" : "🔊"}
        </button>
        <button
          onClick={() => scrollByPage(-1)}
          title="上一个"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-300 backdrop-blur transition-colors hover:bg-zinc-800"
        >
          ↑
        </button>
        <button
          onClick={() => scrollByPage(1)}
          title="下一个"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-300 backdrop-blur transition-colors hover:bg-zinc-800"
        >
          ↓
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useT } from "@/components/LocaleProvider";
import WorkDiscussion from "@/components/WorkDiscussion";

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
  /** 评论主体:短视频是自己,短剧是当前正片那一集 */
  videoId: string;
  episodeId?: string | null;
  /** 官方推荐位 */
  featured?: boolean;
}

/** 停留这么久才算看过一次;划过去不算 */
const PLAY_COUNTS_AFTER_MS = 3000;

// TikTok 式竖版信息流:滚动吸附逐条观看,进入视口自动播放
export default function VideoFeed({ items }: { items: FeedItem[] }) {
  const { t, tCategory } = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [muted, setMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);

  useEffect(() => {
    setCommentsOpen(false);
  }, [activeIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 只有真的停下来看了才算一次播放,划过去不算——热度要经得起看
    const pending = new Map<Element, ReturnType<typeof setTimeout>>();
    const counted = new Set<string>();

    const stopTimer = (target: Element) => {
      const timer = pending.get(target);
      if (timer) clearTimeout(timer);
      pending.delete(target);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = entry.target as HTMLVideoElement;
          const workId = video.dataset.workId;
          if (entry.intersectionRatio >= 0.6) {
            const idx = videoRefs.current.indexOf(video);
            if (idx >= 0) setActiveIndex(idx);
            video.play().catch(() => {});
            if (workId && !counted.has(workId) && !pending.has(video)) {
              pending.set(
                video,
                setTimeout(() => {
                  pending.delete(video);
                  counted.add(workId);
                  // 记不上不影响观看,服务端还会按会话+小时去重
                  void fetch("/api/feed/plays", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ workId }),
                    keepalive: true,
                  }).catch(() => {});
                }, PLAY_COUNTS_AFTER_MS)
              );
            }
          } else {
            video.pause();
            stopTimer(video);
          }
        }
      },
      { root: container, threshold: [0, 0.6] }
    );

    for (const v of videoRefs.current) {
      if (v) observer.observe(v);
    }
    return () => {
      observer.disconnect();
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
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
        {t("feed.empty")}
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
                data-work-id={item.id}
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
              <div className="absolute left-3 top-3 flex items-center gap-2">
                <span className="rounded-md bg-zinc-950/70 px-2 py-0.5 text-xs font-medium text-accent">
                  {item.kind === "SERIES"
                    ? item.category
                      ? tCategory(item.category)
                      : t("common.series")
                    : t("common.video")}
                </span>
                {item.featured && (
                  <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-zinc-950">
                    {t("feed.featured")}
                  </span>
                )}
              </div>

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
                    href={`/series/${item.id}`}
                    className="pointer-events-auto mt-2 inline-flex items-center gap-1 rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-zinc-950 transition-opacity hover:opacity-90"
                  >
                    {t("feed.watchAll", { n: item.episodeCount })}
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
          onClick={() => setCommentsOpen(true)}
          aria-label={t("feed.comments")}
          title={t("feed.comments")}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-base backdrop-blur transition-colors hover:bg-zinc-800"
        >
          💬
        </button>
        <button
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? t("feed.unmute") : t("feed.mute")}
          title={muted ? t("feed.unmute") : t("feed.mute")}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-base backdrop-blur transition-colors hover:bg-zinc-800"
        >
          {muted ? "🔇" : "🔊"}
        </button>
        <button
          onClick={() => scrollByPage(-1)}
          aria-label={t("feed.prev")}
          title={t("feed.prev")}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-300 backdrop-blur transition-colors hover:bg-zinc-800"
        >
          ↑
        </button>
        <button
          onClick={() => scrollByPage(1)}
          aria-label={t("feed.next")}
          title={t("feed.next")}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-300 backdrop-blur transition-colors hover:bg-zinc-800"
        >
          ↓
        </button>
      </div>

      {commentsOpen && items[activeIndex] && (
        <div
          className="absolute inset-0 z-40 flex items-end bg-black/50"
          onClick={() => setCommentsOpen(false)}
        >
          <div
            className="max-h-[70%] w-full overflow-y-auto rounded-t-2xl border border-zinc-800 bg-zinc-950 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setCommentsOpen(false)}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                {t("feed.closeComments")}
              </button>
            </div>
            <WorkDiscussion
              workId={items[activeIndex].id}
              videoId={items[activeIndex].videoId}
              episodeId={items[activeIndex].episodeId}
              title={items[activeIndex].title}
              className="rounded-none border-0 bg-transparent p-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}

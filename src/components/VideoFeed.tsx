"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import { useT } from "@/components/LocaleProvider";
import AuthorCredit from "@/components/AuthorCredit";
import FeedCastLine from "@/components/FeedCastLine";
import WorkDiscussion from "@/components/WorkDiscussion";
import type { AppearanceCredit } from "@/lib/workAppearance";

export interface FeedItem {
  id: string;
  kind: string;
  category: string | null;
  title: string;
  description: string | null;
  authorName: string | null;
  authorHandle?: string | null;
  authorHref?: string | null;
  castVisible?: AppearanceCredit[];
  castExtra?: number;
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
/** 播到这里算完播。片子 loop,ended 不一定稳定,所以也看进度 */
const COMPLETE_AT_RATIO = 0.9;

type FeedEventKind = "play" | "skip" | "complete";

function eventPath(kind: FeedEventKind) {
  return kind === "play" ? "/api/feed/plays" : "/api/feed/signals";
}

// TikTok 式竖版信息流:滚动吸附逐条观看,进入视口自动播放
export default function VideoFeed({ items }: { items: FeedItem[] }) {
  const { t, tCategory } = useT();
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const signedInRef = useRef(isAuthenticated);
  const tokenRef = useRef(getAccessTokenSilently);
  const [muted, setMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);

  signedInRef.current = isAuthenticated;
  tokenRef.current = getAccessTokenSilently;

  useEffect(() => {
    setCommentsOpen(false);
  }, [activeIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 只有真的停下来看了才算一次播放,划过去不算——热度要经得起看
    const pending = new Map<Element, ReturnType<typeof setTimeout>>();
    const played = new Set<string>();
    const skipped = new Set<string>();
    const completed = new Set<string>();

    const post = (kind: FeedEventKind, workId: string, token?: string) => {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (token) headers.authorization = `Bearer ${token}`;
      const body = kind === "play" ? { workId } : { workId, kind };
      return fetch(eventPath(kind), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        keepalive: true,
      });
    };

    // 热度必须马上记。身份是事后补上的,等 Auth0 会把播放弄丢
    const report = (kind: FeedEventKind, workId: string) => {
      void post(kind, workId).catch(() => {});
      if (!signedInRef.current) return;
      void tokenRef
        .current({ authorizationParams: { audience: AUTH0_AUDIENCE } })
        .then((token) => post(kind, workId, token))
        .catch(() => {});
    };

    const stopTimer = (target: Element) => {
      const timer = pending.get(target);
      if (timer) clearTimeout(timer);
      pending.delete(target);
    };

    const markComplete = (workId: string | undefined) => {
      if (!workId || completed.has(workId)) return;
      completed.add(workId);
      report("complete", workId);
    };

    const onTimeUpdate = (event: Event) => {
      const video = event.currentTarget as HTMLVideoElement;
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      if (video.currentTime / duration >= COMPLETE_AT_RATIO) {
        markComplete(video.dataset.workId);
      }
    };

    const onEnded = (event: Event) => {
      markComplete((event.currentTarget as HTMLVideoElement).dataset.workId);
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
            if (workId && !played.has(workId) && !pending.has(video)) {
              pending.set(
                video,
                setTimeout(() => {
                  pending.delete(video);
                  played.add(workId);
                  report("play", workId);
                }, PLAY_COUNTS_AFTER_MS)
              );
            }
          } else {
            video.pause();
            const wasPending = pending.has(video);
            stopTimer(video);
            // 还没撑到起算播放就划走 → skip。已经起算或已完播的不再记划走
            if (
              workId &&
              wasPending &&
              !played.has(workId) &&
              !completed.has(workId) &&
              !skipped.has(workId)
            ) {
              skipped.add(workId);
              report("skip", workId);
            }
          }
        }
      },
      { root: container, threshold: [0, 0.6] }
    );

    for (const v of videoRefs.current) {
      if (!v) continue;
      v.addEventListener("timeupdate", onTimeUpdate);
      v.addEventListener("ended", onEnded);
      observer.observe(v);
    }
    return () => {
      observer.disconnect();
      for (const v of videoRefs.current) {
        v?.removeEventListener("timeupdate", onTimeUpdate);
        v?.removeEventListener("ended", onEnded);
      }
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
                <AuthorCredit
                  handle={item.authorHandle}
                  authorName={item.authorName}
                  href={item.authorHref}
                  className="pointer-events-auto text-sm font-semibold text-zinc-100 hover:text-accent"
                />
                <FeedCastLine
                  visible={item.castVisible ?? []}
                  extra={item.castExtra ?? 0}
                  className="mt-0.5 text-xs font-medium text-zinc-200"
                />
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
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900/80 text-zinc-100 backdrop-blur transition-colors hover:bg-zinc-800"
        >
          <CommentIcon />
        </button>
        <button
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? t("feed.unmute") : t("feed.mute")}
          title={muted ? t("feed.unmute") : t("feed.mute")}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900/80 text-zinc-100 backdrop-blur transition-colors hover:bg-zinc-800"
        >
          {muted ? <MutedIcon /> : <SoundIcon />}
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

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 8h10M7 12h6m-8 7.5V6.8A1.8 1.8 0 0 1 6.8 5h10.4A1.8 1.8 0 0 1 19 6.8v7.4a1.8 1.8 0 0 1-1.8 1.8H9.2L5 19.5Z"
      />
    </svg>
  );
}

function MutedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
      <path strokeLinecap="round" d="m16 10 5 5m0-5-5 5" />
    </svg>
  );
}

function SoundIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
      <path strokeLinecap="round" d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8 8 0 0 1 0 12" />
    </svg>
  );
}

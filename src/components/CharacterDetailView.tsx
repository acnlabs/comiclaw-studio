"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/components/LocaleProvider";
import { CollapsibleText } from "@/components/ui";
import CastingButton from "@/components/CastingButton";

interface WorkRef {
  id: string;
  title: string;
  coverUrl: string | null;
  kind: string; // VIDEO(短视频) | SERIES(短剧)
}

export interface CharacterDetailData {
  id: string;
  name: string;
  tagline: string | null;
  persona: string | null;
  styleTags: string | null;
  imageUrl: string;
  audioUrl: string | null;
  gallery: string | null;
  introVideoUrl: string | null;
  acnAgentId: string | null;
  agentName: string | null;
  agentSummary: string | null;
  agentUrl: string | null;
  openForCasting: boolean;
  licensePoints: number;
  createdAt: string;
}

type Slide = { type: "image" | "video"; url: string };

// OpenSea 式详情页,但左栏(缩略图切换 + 大图 + 音色)在桌面端完全固定,
// 只有右栏信息区内部滚动;移动端退化为整页正常滚动。
export default function CharacterDetailView({
  character: c,
  works,
  prevId,
  nextId,
}: {
  character: CharacterDetailData;
  works: WorkRef[];
  prevId: string | null;
  nextId: string | null;
}) {
  const { t, fmtDate } = useT();
  const gallery = (c.gallery ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const slides: Slide[] = [
    { type: "image", url: c.imageUrl },
    ...gallery.map((url): Slide => ({ type: "image", url })),
    ...(c.introVideoUrl ? [{ type: "video", url: c.introVideoUrl } as Slide] : []),
  ];
  const [activeSlide, setActiveSlide] = useState(0);
  const styleTags = (c.styleTags ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard?.writeText(window.location.href).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const hasAgentProfile = Boolean(c.agentName || c.agentSummary || c.agentUrl || c.acnAgentId);
  // 三个分区始终显示(空内容显示占位提示),导航不隐藏
  const navItems = [
    { id: "sec-digital-human", label: t("char.navDigitalHuman") },
    { id: "sec-agent-profile", label: t("char.navAgentProfile") },
    { id: "sec-works", label: t("char.navWorks") },
  ];

  const current = slides[activeSlide];

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col px-4 py-6 sm:px-8 md:h-[calc(100vh-3rem)] md:overflow-hidden md:py-4">
      {/* 顶部导航条:返回 + 缩略图切换 + 上/下一个角色(桌面端固定,不随任何内容滚动) */}
      <div className="mb-4 flex shrink-0 items-center gap-3 border-b border-zinc-800 pb-4">
        <Link
          href="/characters"
          aria-label="back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
        >
          ←
        </Link>
        {slides.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {slides.map((s, i) => (
              <button
                key={i}
                onClick={() => setActiveSlide(i)}
                className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                  activeSlide === i ? "border-accent" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                {s.type === "video" ? (
                  <>
                    <video src={s.url} muted preload="metadata" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-[10px] text-white">
                      ▶
                    </span>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.url} alt="" className="h-full w-full object-cover" />
                )}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex gap-2">
          {prevId && (
            <Link
              href={`/characters/${prevId}`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
            >
              ↑
            </Link>
          )}
          {nextId && (
            <Link
              href={`/characters/${nextId}`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
            >
              ↓
            </Link>
          )}
        </div>
      </div>

      <div className="grid flex-1 gap-8 md:min-h-0 md:grid-cols-2">
        {/* 视觉区(左栏):图片/视频完整展示(object-contain)+ 音色试听。桌面端占满剩余高度,不滚动。 */}
        <div className="flex flex-col gap-3 md:h-full md:min-h-0">
          <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-zinc-800 bg-black md:aspect-auto md:min-h-0 md:flex-1">
            {current.type === "video" ? (
              <video
                key={current.url}
                src={current.url}
                controls
                playsInline
                className="h-full w-full object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.url} alt={c.name} className="h-full w-full object-contain" />
            )}
          </div>
          {c.audioUrl && (
            <div className="shrink-0">
              <p className="mb-1 text-xs text-zinc-500">{t("char.voice")}</p>
              <audio src={c.audioUrl} controls preload="none" className="h-9 w-full" />
            </div>
          )}
        </div>

        {/* 信息区(右栏):唯一可滚动区域,桌面端内部滚动条,移动端随页面正常滚动 */}
        <div className="space-y-5 md:h-full md:overflow-y-auto md:pr-1">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-zinc-50">{c.name}</h1>
              {c.openForCasting && (
                <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
                  ✓ {t("char.castingBadge")}
                </span>
              )}
            </div>
            {c.tagline && <p className="mt-1.5 text-sm text-zinc-400">{c.tagline}</p>}
          </div>

          <span className="inline-block rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-500">
            {t("char.digitalHuman")}
          </span>

          {/* 统计栏 */}
          <div className="grid grid-cols-2 gap-4 rounded-2xl border border-zinc-800 px-4 py-3 sm:grid-cols-4">
            <Stat label={t("char.statWorks")} value={String(works.length)} />
            <Stat label={t("char.statVoice")} value={c.audioUrl ? t("char.yes") : t("char.no")} />
            <Stat
              label={t("char.statPrice")}
              value={
                c.licensePoints > 0
                  ? t("char.pointsPerProject", { n: c.licensePoints })
                  : t("char.free")
              }
            />
            <Stat label={t("char.statCreated")} value={fmtDate(c.createdAt)} />
          </div>

          {/* CTA:主按钮 = 添加到我的项目(选角授权),次按钮 = 复制链接 */}
          <div className="flex gap-3">
            <CastingButton
              characterId={c.id}
              licensePoints={c.licensePoints}
              openForCasting={c.openForCasting}
            />
            <button
              onClick={copyLink}
              className="flex-1 rounded-full border border-zinc-700 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500"
            >
              {copied ? `✓ ${t("char.linkCopied")}` : t("char.copyLink")}
            </button>
          </div>

          {/* 锚点导航:点击跳转到下方对应分区,不隐藏其他内容 */}
          {navItems.length > 1 && (
            <div className="sticky top-0 z-10 -mx-4 flex gap-1.5 bg-[#0b0b10] px-4 py-2 sm:-mx-8 sm:px-8 md:mx-0 md:bg-transparent md:px-0">
              {navItems.map((n) => (
                <button
                  key={n.id}
                  onClick={() => jumpTo(n.id)}
                  className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
                >
                  {n.label}
                </button>
              ))}
            </div>
          )}

          {/* ① 数字人:人设/风格(音色已移至左侧视觉区) */}
          <section id="sec-digital-human" className="space-y-3 border-t border-zinc-800/60 pt-4">
            <h2 className="text-sm font-semibold text-zinc-200">{t("char.navDigitalHuman")}</h2>
            {c.persona ? (
              <CollapsibleText text={c.persona} />
            ) : (
              <p className="text-sm text-zinc-600">{t("char.noExtra")}</p>
            )}
            {styleTags.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs text-zinc-500">{t("char.style")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {styleTags.map((tag, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ② 智能体档案:次要信息,这个数字人属于哪个智能体(无内容也显示占位) */}
          <section id="sec-agent-profile" className="space-y-2 border-t border-zinc-800/60 pt-5">
            <h2 className="text-sm font-semibold text-zinc-200">{t("char.navAgentProfile")}</h2>
            {!hasAgentProfile ? (
              <p className="text-sm text-zinc-600">{t("char.noAgentProfile")}</p>
            ) : (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-xs">
                    🤖
                  </span>
                  {c.agentName && <span className="font-medium text-zinc-100">{c.agentName}</span>}
                  {c.acnAgentId && (
                    <span className="rounded-md border border-zinc-700 px-1.5 py-0.5 text-xs text-zinc-500">
                      ACN · {c.acnAgentId}
                    </span>
                  )}
                </div>
                {c.agentSummary && (
                  <div className="mt-2">
                    <CollapsibleText text={c.agentSummary} />
                  </div>
                )}
                {c.agentUrl && (
                  <a
                    href={c.agentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block rounded-full border border-accent/40 px-3.5 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
                  >
                    {t("char.viewAgent")} →
                  </a>
                )}
              </div>
            )}
          </section>

          {/* ③ 作品(无作品也显示占位) */}
          <section id="sec-works" className="space-y-2 border-t border-zinc-800/60 pt-5 pb-2">
            <h2 className="text-sm font-semibold text-zinc-200">{t("char.navWorks")}</h2>
            {works.length === 0 ? (
              <p className="text-sm text-zinc-600">{t("char.noWorks")}</p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {works.map((w) => (
                  <Link key={w.id} href={`/series/${w.id}`} className="group">
                    <div className="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
                      {w.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={w.coverUrl}
                          alt={w.title}
                          className="aspect-video w-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex aspect-video items-center justify-center text-lg">🎬</div>
                      )}
                      <span className="absolute left-1 top-1 rounded bg-zinc-950/80 px-1.5 py-0.5 text-[10px] text-accent">
                        {w.kind === "SERIES" ? t("common.series") : t("common.video")}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-zinc-400">{w.title}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-zinc-100">{value}</p>
    </div>
  );
}

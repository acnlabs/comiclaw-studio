"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/components/LocaleProvider";

interface WorkRef {
  id: string;
  title: string;
  coverUrl: string | null;
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
  acnAgentId: string | null;
  agentName: string | null;
  agentSummary: string | null;
  agentUrl: string | null;
  openForCasting: boolean;
  createdAt: string;
}

type Tab = "persona" | "traits" | "works";

// OpenSea 式资产详情页布局:顶部缩略图导航条 + 左大图/右信息面板对半分 +
// 统计栏 + CTA + Tabs + 属性表
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
  const images = [c.imageUrl, ...gallery];
  const [activeImg, setActiveImg] = useState(0);
  const styleTags = (c.styleTags ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "persona", label: t("char.tabPersona"), show: Boolean(c.persona || c.tagline) },
    { key: "traits", label: t("char.tabTraits"), show: styleTags.length > 0 },
    { key: "works", label: t("char.tabWorks"), show: works.length > 0 },
  ];
  const availableTabs = tabs.filter((tb) => tb.show);
  const [tab, setTab] = useState<Tab>(availableTabs[0]?.key ?? "persona");
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard?.writeText(window.location.href).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1800px] flex-1 px-4 py-6 sm:px-8">
      {/* 顶部导航条:返回 + 缩略图 + 上/下一个角色 */}
      <div className="mb-6 flex items-center gap-3 border-b border-zinc-800 pb-4">
        <Link
          href="/characters"
          aria-label="back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
        >
          ←
        </Link>
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImg(i)}
                className={`h-11 w-11 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                  activeImg === i ? "border-accent" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" className="h-full w-full object-cover" />
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

      <div className="grid items-start gap-8 md:grid-cols-2">
        {/* 大图:左栏固定,随页面滚动保持在视口内 */}
        <div className="md:sticky md:top-20">
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[activeImg]} alt={c.name} className="aspect-square w-full object-cover" />
          </div>
        </div>

        {/* 信息面板:右栏正常滚动 */}
        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-zinc-50">{c.name}</h1>
              {c.openForCasting && (
                <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
                  ✓ {t("char.castingBadge")}
                </span>
              )}
            </div>
            {c.agentName && (
              <div className="mt-1.5 flex items-center gap-1.5 text-sm text-zinc-400">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[10px]">
                  🤖
                </span>
                {t("char.byAgent")}:
                {c.agentUrl ? (
                  <a href={c.agentUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    {c.agentName}
                  </a>
                ) : (
                  <span>{c.agentName}</span>
                )}
              </div>
            )}
            {c.tagline && <p className="mt-2 text-sm text-zinc-400">{c.tagline}</p>}
          </div>

          {/* 类型/ACN 徽标条(对齐 OpenSea 的 ERC721 / Chain / Token ID 行) */}
          <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
            <span className="rounded-md border border-zinc-800 px-2 py-1">{t("char.digitalHuman")}</span>
            {c.acnAgentId && (
              <span className="rounded-md border border-zinc-800 px-2 py-1">ACN · {c.acnAgentId}</span>
            )}
          </div>

          {/* 统计栏(对齐 Top offer / Floor / Rarity / Last sale) */}
          <div className="grid grid-cols-2 gap-4 rounded-2xl border border-zinc-800 px-4 py-3 sm:grid-cols-4">
            <Stat label={t("char.statWorks")} value={String(works.length)} />
            <Stat label={t("char.statVoice")} value={c.audioUrl ? t("char.yes") : t("char.no")} />
            <Stat
              label={t("char.statCasting")}
              value={c.openForCasting ? t("char.castingOpen") : t("char.castingClosed")}
            />
            <Stat label={t("char.statCreated")} value={fmtDate(c.createdAt)} />
          </div>

          {/* CTA(对齐 Buy now / Make offer) */}
          <div className="flex gap-3">
            {c.agentUrl && (
              <a
                href={c.agentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-full bg-accent py-2.5 text-center text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90"
              >
                {t("char.viewAgent")}
              </a>
            )}
            <button
              onClick={copyLink}
              className="flex-1 rounded-full border border-zinc-700 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500"
            >
              {copied ? `✓ ${t("char.linkCopied")}` : t("char.copyLink")}
            </button>
          </div>

          {/* Tabs(对齐 Details / Orders / Activity) */}
          {availableTabs.length > 0 && (
            <div>
              <div className="flex gap-4 border-b border-zinc-800">
                {availableTabs.map((tb) => (
                  <button
                    key={tb.key}
                    onClick={() => setTab(tb.key)}
                    className={`relative pb-2.5 text-sm font-medium transition-colors ${
                      tab === tb.key ? "text-accent" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {tb.label}
                    {tab === tb.key && (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-accent" />
                    )}
                  </button>
                ))}
              </div>

              <div className="pt-4">
                {tab === "persona" && (
                  <div className="space-y-3">
                    {c.persona && (
                      <p className="text-sm leading-relaxed text-zinc-300">{c.persona}</p>
                    )}
                    {c.audioUrl && (
                      <div>
                        <p className="mb-1 text-xs text-zinc-500">{t("char.voice")}</p>
                        <audio src={c.audioUrl} controls preload="none" className="h-9 w-full" />
                      </div>
                    )}
                    {c.agentSummary && (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                        <p className="mb-1 text-xs font-medium text-zinc-500">{t("char.byAgent")}</p>
                        <p className="text-sm leading-relaxed text-zinc-400">{c.agentSummary}</p>
                      </div>
                    )}
                    {!c.persona && !c.audioUrl && !c.agentSummary && (
                      <p className="text-sm text-zinc-600">{t("char.noExtra")}</p>
                    )}
                  </div>
                )}

                {tab === "traits" && (
                  <div className="overflow-hidden rounded-xl border border-zinc-800">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/50 text-left text-xs text-zinc-500">
                          <th className="px-3 py-2 font-medium">{t("char.attribute")}</th>
                          <th className="px-3 py-2 font-medium">{t("char.value")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {styleTags.map((tag, i) => (
                          <tr key={i} className="border-b border-zinc-800/60 last:border-0">
                            <td className="px-3 py-2 text-zinc-500">{t("char.style")}</td>
                            <td className="px-3 py-2 text-zinc-200">{tag}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {tab === "works" && (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {works.map((w) => (
                      <Link key={w.id} href={`/series/${w.id}`} className="group">
                        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
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
                        </div>
                        <p className="mt-1 truncate text-xs text-zinc-400">{w.title}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
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

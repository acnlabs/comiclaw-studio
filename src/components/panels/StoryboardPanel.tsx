"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import type { ShotData } from "@/lib/types";
import type { MessageKey } from "@/lib/i18n";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import { fmtDuration } from "@/lib/format";
import { EmptyState, ShotMedia, Modal } from "@/components/ui";

// 分区小标题
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-xs font-medium tracking-wide text-zinc-500">{children}</p>
  );
}

// 渲染生成提示词:@资产名 识别为带头像的内联引用(只读);过长时可折叠
function PromptText({
  prompt,
  assetRefs,
}: {
  prompt: string;
  assetRefs: ShotData["assetRefs"];
}) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  const isLong = prompt.length > 140 || prompt.split("\n").length > 4;

  const parts = prompt.split(/(@[^\s@,,。.;;、()()「」"']+)/g);
  const rendered = parts.map((part, i) => {
    if (!part.startsWith("@")) return <span key={i}>{part}</span>;
    const token = part.slice(1);
    const match = assetRefs.find(
      ({ asset }) =>
        asset.name.startsWith(token) || token.startsWith(asset.name.split(/[\s((]/)[0])
    );
    const img = match?.asset.versions?.[0]?.imageUrl;
    return (
      <span
        key={i}
        className="mx-0.5 inline-flex items-center gap-1 rounded bg-accent/10 px-1 align-middle font-sans text-accent"
      >
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
        )}
        @{token}
      </span>
    );
  });

  return (
    <div className="rounded-lg bg-zinc-950/60 px-3 py-2">
      <p
        className={`whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-400 ${
          isLong && !expanded ? "line-clamp-3" : ""
        }`}
      >
        {rendered}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-accent transition-opacity hover:opacity-80"
        >
          {expanded ? t("shot.collapse") : t("shot.expand")}
        </button>
      )}
    </div>
  );
}

// 分镜 = 输入(描述/资产) → 提示词 → 输出(候选视频)
function ShotCard({ shot, shareToken }: { shot: ShotData; shareToken: string }) {
  const { t } = useT();
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const router = useRouter();

  const takes = shot.versions.filter((v) => v.mediaType === "VIDEO");
  const frames = shot.versions.filter((v) => v.mediaType !== "VIDEO");

  const initialTake =
    shot.selectedVersion != null && takes.some((v) => v.version === shot.selectedVersion)
      ? shot.selectedVersion
      : takes[0]?.version;
  const [selTake, setSelTake] = useState<number | undefined>(initialTake);
  const [busy, setBusy] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const currentTake = takes.find((v) => v.version === selTake) ?? takes[0];
  const mainMedia = currentTake ?? frames[0];
  const isPicked = shot.selectedVersion != null && currentTake?.version === shot.selectedVersion;

  const pick = async () => {
    if (!currentTake || busy) return;
    setBusy(true);
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: AUTH0_AUDIENCE },
      });
      const res = await fetch(`/api/user/shots/${shot.id}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shareToken, version: currentTake.version }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  // ① 分镜描述 + 台词
  const descSection = (
    <div>
      <SectionLabel>{t("shot.secInput")}</SectionLabel>
      {shot.action ? (
        <p className="text-sm leading-relaxed text-zinc-300">{shot.action}</p>
      ) : (
        <p className="text-sm text-zinc-600">—</p>
      )}
      {shot.dialogue && (
        <p className="mt-2 rounded-lg bg-zinc-800/60 px-3 py-2 text-sm italic text-zinc-300">
          「{shot.dialogue}」
        </p>
      )}
    </div>
  );

  // ② 出镜资产(头像胶囊)
  const assetsSection = shot.assetRefs.length > 0 && (
    <div>
      <SectionLabel>{t("shot.secAssets")}</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {shot.assetRefs.map(({ asset }) => {
          const img = asset.versions?.[0]?.imageUrl;
          return (
            <span
              key={asset.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 py-0.5 pl-0.5 pr-2.5 text-xs text-zinc-300"
            >
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-700 text-[10px] text-zinc-400">
                  {t(`assetType.${asset.type}` as MessageKey).slice(0, 1)}
                </span>
              )}
              {asset.name}
            </span>
          );
        })}
      </div>
    </div>
  );

  // ③ 生成提示词
  const promptSection = shot.prompt && (
    <div>
      <SectionLabel>{t("shot.secPrompt")}</SectionLabel>
      <PromptText prompt={shot.prompt} assetRefs={shot.assetRefs} />
    </div>
  );

  // ④ 输出视频(主画面 + 候选缩略图 + 选片)
  const outputSection = (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <SectionLabel>
          {t("shot.secOutput")}
          {takes.length > 1 && (
            <span className="ml-1 text-zinc-600">
              · {t("shot.candidates", { n: takes.length })}
            </span>
          )}
        </SectionLabel>
        {takes.length > 1 && isAuthenticated && currentTake && !isPicked && (
          <button
            onClick={pick}
            disabled={busy}
            className="rounded-full border border-accent/40 px-3 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
          >
            ★ {t("shot.select")} V{currentTake.version}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="relative aspect-video">
          {mainMedia ? (
            <ShotMedia
              mediaUrl={mainMedia.mediaUrl}
              mediaType={mainMedia.mediaType}
              alt={shot.title ?? `镜头 ${shot.order}`}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-600">
              {t("panel.storyboard.inProgress")}
            </div>
          )}
          {shot.selectedVersion != null && (
            <span className="absolute right-2 top-2 rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-zinc-950">
              ★ {t("shot.selectedBadge", { n: shot.selectedVersion })}
            </span>
          )}
          {mainMedia && (
            <button
              onClick={() => setDetailOpen(true)}
              aria-label={t("detail.expand")}
              title={t("detail.expand")}
              className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-md bg-zinc-950/80 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
            >
              ⤢
            </button>
          )}
        </div>

        {/* 候选视频缩略图条 */}
        {takes.length > 1 && (
          <div className="flex items-center gap-1.5 px-2 py-2">
            {takes.map((take) => (
              <button
                key={take.id}
                onClick={() => setSelTake(take.version)}
                className={`relative h-11 w-[72px] shrink-0 overflow-hidden rounded border-2 transition-colors ${
                  currentTake?.version === take.version
                    ? "border-accent"
                    : "border-transparent opacity-60 hover:opacity-100"
                }`}
                title={`V${take.version}`}
              >
                <video src={take.mediaUrl} muted preload="metadata" className="h-full w-full object-cover" />
                {shot.selectedVersion === take.version && (
                  <span className="absolute right-0.5 top-0.5 rounded bg-accent px-1 text-[10px] font-bold text-zinc-950">
                    ★
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {takes.length === 0 && (
        <p className="mt-1.5 text-xs text-zinc-600">{t("shot.noTakes")}</p>
      )}
      {currentTake?.notes && (
        <p className="mt-1.5 text-xs text-amber-200/80">V{currentTake.version}:{currentTake.notes}</p>
      )}
    </div>
  );

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      {/* 镜头标题行 */}
      <div className="mb-3 flex items-center gap-2 border-b border-zinc-800/60 pb-3">
        <span className="rounded-md bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent">
          {String(shot.order).padStart(2, "0")}
        </span>
        {shot.title && <h3 className="font-medium text-zinc-100">{shot.title}</h3>}
        {shot.duration != null && (
          <span className="text-xs text-zinc-500">{fmtDuration(shot.duration)}</span>
        )}
      </div>

      {/* 输入(左) → 输出(右);窄屏上下堆叠 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          {descSection}
          {assetsSection}
          {promptSection}
        </div>
        {outputSection}
      </div>

      {/* 放大弹层 */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)}>
        {mainMedia && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 pr-10">
              <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-bold text-accent">
                {String(shot.order).padStart(2, "0")}
              </span>
              {shot.title && <h3 className="text-lg font-semibold text-zinc-100">{shot.title}</h3>}
              {shot.duration != null && (
                <span className="text-xs text-zinc-500">{fmtDuration(shot.duration)}</span>
              )}
            </div>
            <div className="overflow-hidden rounded-xl bg-zinc-950">
              <div className="aspect-video w-full">
                <ShotMedia
                  mediaUrl={mainMedia.mediaUrl}
                  mediaType={mainMedia.mediaType}
                  alt={shot.title ?? `镜头 ${shot.order}`}
                />
              </div>
            </div>
            {descSection}
            {assetsSection}
            {promptSection}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function StoryboardPanel({
  shots,
  shareToken,
}: {
  shots: ShotData[];
  shareToken: string;
}) {
  const { t } = useT();
  if (shots.length === 0) return <EmptyState text={t("panel.storyboard.empty")} />;

  const total = shots.reduce((sum, s) => sum + (s.duration ?? 0), 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        {t("panel.storyboard.summary", { n: shots.length })}
        {total > 0 && <> · {t("panel.storyboard.totalDuration", { t: fmtDuration(total) })}</>}
      </p>
      <div className="space-y-4">
        {shots.map((shot) => (
          <ShotCard key={shot.id} shot={shot} shareToken={shareToken} />
        ))}
      </div>
    </div>
  );
}

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

// 分镜 = 输入(描述/台词/提示词/资产/参考帧) + 输出(候选视频,客户选片)
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
  // 主画面:输出视频优先;还没有视频时用最新参考图占位(生成中状态)
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

  const infoBlock = (
    <>
      {shot.action && <p className="text-sm leading-relaxed text-zinc-400">{shot.action}</p>}
      {shot.dialogue && (
        <p className="rounded-lg bg-zinc-800/60 px-3 py-2 text-sm italic text-zinc-300">
          「{shot.dialogue}」
        </p>
      )}
      {shot.assetRefs.length > 0 && (
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
      )}
      {shot.prompt && (
        <div>
          <p className="mb-0.5 text-xs text-zinc-600">{t("shot.promptLabel")}</p>
          <p className="rounded-lg bg-zinc-950/60 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-500">
            {shot.prompt}
          </p>
        </div>
      )}
    </>
  );

  // 候选视频缩略图条(主画面下方,点击切换,选中标星)
  const takesStrip = takes.length > 1 && (
    <div className="flex items-center gap-1.5 bg-zinc-950 px-2 pb-2">
      {takes.map((take) => (
        <button
          key={take.id}
          onClick={() => setSelTake(take.version)}
          className={`relative h-12 w-20 shrink-0 overflow-hidden rounded border-2 transition-colors ${
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
  );

  const outputBlock = (
    <div className="space-y-1.5 border-t border-zinc-800/60 pt-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-zinc-500">
          {takes.length > 0
            ? `${t("shot.takes")} · ${t("shot.candidates", { n: takes.length })}`
            : t("shot.noTakes")}
        </span>
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
      {currentTake?.notes && (
        <p className="text-xs text-amber-200/80">V{currentTake.version}:{currentTake.notes}</p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 md:flex-row">
      {/* 输出侧:主画面 + 候选缩略图条 */}
      <div className="shrink-0 bg-zinc-950 md:w-[400px] lg:w-[460px]">
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
        <div className="absolute left-2 top-2 flex items-center gap-1.5">
          <span className="rounded-md bg-zinc-950/80 px-2 py-0.5 text-xs font-bold text-accent">
            {String(shot.order).padStart(2, "0")}
          </span>
          {shot.duration != null && (
            <span className="rounded-md bg-zinc-950/80 px-2 py-0.5 text-xs text-zinc-300">
              {fmtDuration(shot.duration)}
            </span>
          )}
        </div>
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
      {takesStrip}
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
            {infoBlock}
            {outputBlock}
          </div>
        )}
      </Modal>

      <div className="min-w-0 flex-1 space-y-2 px-4 py-3">
        {shot.title && <h3 className="font-medium text-zinc-100">{shot.title}</h3>}
        {infoBlock}
        {outputBlock}
      </div>
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
      {/* 纵向单列:每个镜头一行,输入/输出信息全部直接可见 */}
      <div className="space-y-4">
        {shots.map((shot) => (
          <ShotCard key={shot.id} shot={shot} shareToken={shareToken} />
        ))}
      </div>
    </div>
  );
}

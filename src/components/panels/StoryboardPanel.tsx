"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import type { ShotData } from "@/lib/types";
import type { MessageKey } from "@/lib/i18n";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import { fmtDuration } from "@/lib/format";
import { VersionPills, EmptyState, Badge, ShotMedia } from "@/components/ui";

function ShotCard({ shot, shareToken }: { shot: ShotData; shareToken: string }) {
  const { t } = useT();
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const router = useRouter();
  const [selected, setSelected] = useState(shot.selectedVersion ?? shot.versions[0]?.version ?? 1);
  const [busy, setBusy] = useState(false);
  const current = shot.versions.find((v) => v.version === selected) ?? shot.versions[0];

  const hasCandidates = shot.versions.length > 1;
  const isPicked = shot.selectedVersion != null && current?.version === shot.selectedVersion;

  const pick = async () => {
    if (!current || busy) return;
    setBusy(true);
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: AUTH0_AUDIENCE },
      });
      const res = await fetch(`/api/user/shots/${shot.id}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shareToken, version: current.version }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
      <div className="relative aspect-video bg-zinc-950">
        {current ? (
          <ShotMedia
            mediaUrl={current.mediaUrl}
            mediaType={current.mediaType}
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
      </div>

      <div className="space-y-2 px-4 py-3">
        {shot.title && <h3 className="font-medium text-zinc-100">{shot.title}</h3>}
        {shot.action && <p className="text-xs leading-relaxed text-zinc-400">{shot.action}</p>}
        {shot.dialogue && (
          <p className="rounded-lg bg-zinc-800/60 px-3 py-2 text-xs italic text-zinc-300">
            「{shot.dialogue}」
          </p>
        )}
        {shot.assetRefs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {shot.assetRefs.map(({ asset }) => (
              <Badge key={asset.id}>
                {t(`assetType.${asset.type}` as MessageKey)} · {asset.name}
              </Badge>
            ))}
          </div>
        )}
        {current?.notes && (
          <p className="text-xs text-amber-200/80">V{current.version}:{current.notes}</p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <VersionPills
            versions={shot.versions.map((v) => v.version)}
            selected={current?.version ?? 1}
            onSelect={setSelected}
          />
          {hasCandidates && isAuthenticated && current && !isPicked && (
            <button
              onClick={pick}
              disabled={busy}
              className="rounded-full border border-accent/40 px-3 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
            >
              ★ {t("shot.select")}
            </button>
          )}
        </div>
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shots.map((shot) => (
          <ShotCard key={shot.id} shot={shot} shareToken={shareToken} />
        ))}
      </div>
    </div>
  );
}

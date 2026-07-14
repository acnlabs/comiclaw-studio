"use client";

import { useEffect, useState, type RefObject } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import type { CommentData } from "@/lib/types";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import { Badge } from "@/components/ui";

function fmtTimecode(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// 成片版本的时间码批注:列表(点击时间码跳转)+ 发表(带当前播放时间)
export default function CommentSection({
  shareToken,
  filmVersionId,
  comments,
  videoRef,
}: {
  shareToken: string;
  filmVersionId: string;
  comments: CommentData[];
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const { isAuthenticated, isLoading, user, getAccessTokenSilently, loginWithRedirect } = useAuth0();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useT();
  const [content, setContent] = useState("");
  const [useTimecode, setUseTimecode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // 跟踪播放位置(供"在当前时间批注"的时间显示与提交)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("seeked", onTime);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("seeked", onTime);
    };
  }, [videoRef, filmVersionId]);

  const seek = (tc: number) => {
    const v = videoRef.current;
    if (v) {
      v.currentTime = tc;
      v.play().catch(() => {});
    }
  };

  const submit = async () => {
    if (!content.trim() || busy) return;
    setBusy(true);
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: AUTH0_AUDIENCE },
      });
      const timecode = useTimecode ? currentTime : null;
      const res = await fetch("/api/user/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shareToken,
          filmVersionId,
          timecode,
          content,
          authorName: user?.name ?? user?.nickname ?? null,
        }),
      });
      if (res.ok) {
        setContent("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
      <h3 className="text-sm font-medium text-zinc-300">
        {t("comments.title")}
        {comments.length > 0 && (
          <span className="ml-1.5 text-xs text-zinc-600">{comments.length}</span>
        )}
      </h3>

      {comments.length === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-zinc-600">{t("comments.empty")}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {comments.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5 text-sm">
              {c.timecode != null ? (
                <button
                  onClick={() => seek(c.timecode!)}
                  className="shrink-0 rounded-md bg-accent/10 px-2 py-0.5 font-mono text-xs font-medium text-accent transition-colors hover:bg-accent/20"
                >
                  {fmtTimecode(c.timecode)}
                </button>
              ) : (
                <span className="shrink-0 rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
                  {t("comments.general")}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-zinc-300">{c.content}</p>
                <p className="mt-0.5 text-xs text-zinc-600">
                  {c.authorName ?? "—"}
                  {c.status === "RESOLVED" && (
                    <span className="ml-2 inline-block">
                      <Badge tone="green">{t("comments.resolved")}</Badge>
                    </span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-zinc-800 pt-4">
        {isLoading ? null : !isAuthenticated ? (
          <button
            onClick={() => loginWithRedirect({ appState: { returnTo: pathname || "/" } })}
            className="rounded-full bg-zinc-800 px-4 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            {t("comments.loginToComment")}
          </button>
        ) : (
          <div className="space-y-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("comments.placeholder")}
              rows={2}
              className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent"
            />
            <div className="flex items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500">
                <input
                  type="checkbox"
                  checked={useTimecode}
                  onChange={(e) => setUseTimecode(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                {useTimecode
                  ? t("comments.atCurrent", { t: fmtTimecode(currentTime) })
                  : t("comments.general")}
              </label>
              <button
                onClick={submit}
                disabled={busy || !content.trim()}
                className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {t("comments.submit")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

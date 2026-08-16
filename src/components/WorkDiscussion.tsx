"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import { useT } from "@/components/LocaleProvider";
import { agentPlanetFeedPostUrl } from "@/lib/agentLinks";

const API_BASE = (
  process.env.NEXT_PUBLIC_AGENTPLANET_API_URL ?? "https://api.agentplanet.org"
).replace(/\/+$/, "");

type FeedComment = {
  id: string;
  author_type: "agent" | "human" | "guest";
  author_name: string;
  content: string;
  created_at: string;
};

export default function WorkDiscussion({
  workId,
  videoId,
  episodeId,
  title,
  className,
}: {
  workId: string;
  /** 当前这条片子的 Work id;没有独立短视频时退回这一集自己的 id */
  videoId: string;
  episodeId?: string | null;
  title: string;
  className?: string;
}) {
  const { t } = useT();
  const { isAuthenticated, loginWithRedirect, getAccessTokenSilently } = useAuth0();
  const [postId, setPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const found = await fetch(
      `${API_BASE}/api/labs/posts/by-subject?subject_type=video&subject_id=${encodeURIComponent(videoId)}`,
      { cache: "no-store" },
    );
    if (!found.ok) {
      setPostId(null);
      setComments([]);
      return;
    }
    const body = (await found.json()) as { post?: { id?: string } };
    const id = body.post?.id ?? null;
    setPostId(id);
    if (!id) {
      setComments([]);
      return;
    }
    const res = await fetch(`${API_BASE}/api/labs/posts/${id}/comments`, { cache: "no-store" });
    if (!res.ok) {
      setComments([]);
      return;
    }
    const data = (await res.json()) as { comments?: FeedComment[] };
    setComments(data.comments ?? []);
  }, [videoId]);

  useEffect(() => {
    setPostId(null);
    setComments([]);
    setError(null);
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    if (!isAuthenticated) {
      await loginWithRedirect();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: AUTH0_AUDIENCE },
      });
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
      let id = postId;
      if (!id) {
        const created = await fetch(`${API_BASE}/api/labs/posts/ensure-subject`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            subject_type: "video",
            subject_id: videoId,
            content: title,
            tags: ["video", "comiclaw"],
            subject_url:
              typeof window !== "undefined"
                ? episodeId
                  ? `${window.location.origin}/series/${workId}?ep=${encodeURIComponent(episodeId)}`
                  : `${window.location.origin}/series/${workId}`
                : undefined,
          }),
        });
        if (!created.ok) {
          throw new Error(t("series.commentFailed"));
        }
        const post = (await created.json()) as { id?: string };
        id = post.id ?? null;
        setPostId(id);
      }
      if (!id) throw new Error(t("series.commentFailed"));
      const commented = await fetch(`${API_BASE}/api/labs/posts/${id}/comments`, {
        method: "POST",
        headers,
        body: JSON.stringify({ content: text.trim() }),
      });
      if (!commented.ok) {
        throw new Error(t("series.commentFailed"));
      }
      setText("");
      await load();
    } catch {
      setError(t("series.commentFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={
        className ??
        "mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5"
      }
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-zinc-300">{t("series.discussion")}</h2>
        {postId && (
          <a
            href={agentPlanetFeedPostUrl(postId)}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:underline"
          >
            {t("series.openOnAgentPlanet")}
          </a>
        )}
      </div>

      {comments.length === 0 ? (
        <p className="mb-4 text-sm text-zinc-500">{t("series.discussionEmpty")}</p>
      ) : (
        <div className="mb-4 space-y-3">
          {comments.map((comment) => (
            <article key={comment.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
                <span className="font-medium text-zinc-300">{comment.author_name}</span>
                <span>{new Date(comment.created_at).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-zinc-200">{comment.content}</p>
            </article>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            isAuthenticated ? t("series.commentPlaceholder") : t("series.loginToComment")
          }
          className="h-20 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
        />
        <div className="mt-2 flex items-center justify-end">
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-zinc-950 disabled:opacity-50"
          >
            {busy ? t("series.commenting") : t("series.commentSubmit")}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </form>
    </section>
  );
}

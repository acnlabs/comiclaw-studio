"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import { WALLET_URL } from "@/components/CreditsBadge";
import { embedSessionContext } from "@/lib/embedContext";
import type { MessageKey } from "@/lib/i18n";

const REFRESH_SKEW_MS = 30_000;
const MIN_HEIGHT = 480;

type SessionPayload = {
  embedUrl?: string;
  chatId?: string;
  expiresAt?: string | null;
  expiresIn?: number | null;
  error?: string;
  code?: string;
};

function iframeOrigin(src: string): string {
  try {
    return new URL(src).origin;
  } catch {
    return "";
  }
}

function errorKey(code?: string): MessageKey {
  if (code === "NOT_CONFIGURED") return "interfaze.notConfigured";
  if (code === "UNAUTHORIZED" || code === "AUTH_TOKEN_FAILED") return "chat.sessionExpired";
  if (code === "insufficient_credits") return "interfaze.noCredits";
  if (code === "embed_origin_forbidden") return "interfaze.originForbidden";
  if (code === "chat_forbidden") return "interfaze.chatForbidden";
  if (
    code === "embed_token_invalid" ||
    code === "embed_scope_denied" ||
    code === "embed_chat_mismatch"
  ) {
    return "interfaze.tokenInvalid";
  }
  if (
    code === "UPSTREAM_ERROR" ||
    code === "embed_metadata_invalid" ||
    code === "embed_context_invalid"
  ) {
    return "interfaze.upstreamError";
  }
  return "interfaze.error";
}

export default function InterfazeChat({
  agentId,
  metadata,
  className,
}: {
  agentId: string;
  metadata?: Record<string, unknown>;
  className?: string;
}) {
  const { isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const { t } = useT();
  const [embedUrl, setEmbedUrl] = useState("");
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const refreshAt = useRef<number | null>(null);
  const metaKey = JSON.stringify(metadata ?? {});

  const load = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    setErrorCode(null);
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: AUTH0_AUDIENCE },
      });
      const metadata =
        metaKey === "{}" ? undefined : (JSON.parse(metaKey) as Record<string, unknown>);
      const res = await fetch("/api/user/chat/session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId,
          metadata,
          context: embedSessionContext(metadata),
          parentOrigin: window.location.origin,
          theme: "dark",
        }),
      });
      const data = (await res.json().catch(() => null)) as SessionPayload | null;
      if (!res.ok || !data?.embedUrl) {
        setErrorCode(data?.code || "UPSTREAM_ERROR");
        setEmbedUrl("");
        return;
      }
      setEmbedUrl(data.embedUrl);
      const fromIn =
        typeof data.expiresIn === "number"
          ? Date.now() + data.expiresIn * 1000
          : null;
      const fromAt = data.expiresAt ? Date.parse(data.expiresAt) : NaN;
      refreshAt.current =
        (fromIn ?? (Number.isFinite(fromAt) ? fromAt : Date.now() + 900_000)) -
        REFRESH_SKEW_MS;
    } catch (err) {
      console.error("[interfaze] session failed:", err);
      setErrorCode("AUTH_TOKEN_FAILED");
      setEmbedUrl("");
    } finally {
      setLoading(false);
    }
  }, [agentId, getAccessTokenSilently, metaKey]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    void load();
  }, [isAuthenticated, isLoading, load]);

  useEffect(() => {
    if (!embedUrl || refreshAt.current == null) return;
    const wait = Math.max(5_000, refreshAt.current - Date.now());
    const id = window.setTimeout(() => void load(), wait);
    return () => window.clearTimeout(id);
  }, [embedUrl, load]);

  useEffect(() => {
    if (!embedUrl) return;
    const allowed = iframeOrigin(embedUrl);
    const onMessage = (e: MessageEvent) => {
      if (allowed && e.origin !== allowed) return;
      const payload = e.data as { type?: string; height?: number; code?: string } | null;
      if (!payload || typeof payload.type !== "string") return;
      if (payload.type === "interfaze:ready" || payload.type === "interfaze:resize") {
        if (typeof payload.height === "number" && payload.height > 0) {
          setHeight(Math.max(MIN_HEIGHT, payload.height));
        }
        return;
      }
      if (payload.type === "interfaze:error") {
        setErrorCode(payload.code || "interfaze.error");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embedUrl]);

  if (isLoading) return null;
  if (!isAuthenticated) {
    return <p className="text-sm text-zinc-500">{t("interfaze.needLogin")}</p>;
  }

  if (errorCode && !embedUrl) {
    const showTopUp = errorCode === "insufficient_credits";
    return (
      <div className={`rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-6 text-sm text-zinc-300 ${className ?? ""}`}>
        <p>{t(errorKey(errorCode))}</p>
        {showTopUp ? (
          <a
            href={WALLET_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-accent hover:underline"
          >
            {t("chat.topUp")}
          </a>
        ) : (
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 text-accent hover:underline"
          >
            {t("interfaze.retry")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {loading && !embedUrl ? (
        <p className="text-sm text-zinc-500">{t("interfaze.loading")}</p>
      ) : null}
      {embedUrl ? (
        <iframe
          title={t("interfaze.title")}
          src={embedUrl}
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-950"
          style={{ height }}
          allow="clipboard-write"
        />
      ) : null}
    </div>
  );
}

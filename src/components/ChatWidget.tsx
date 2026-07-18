"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import { WALLET_URL } from "@/components/CreditsBadge";
import type { MessageKey } from "@/lib/i18n";

// 全站唯一的对话入口事件:SiteNav 的按钮(登录后)派发此事件打开面板,
// 而不是维护一份跨组件共享的 Context——与 CreditsBadge 的刷新事件同一套模式。
export const CHAT_OPEN_EVENT = "chat:open";

// 从后端返回的错误 body(JSON 字符串)里取出 code,映射成本地化文案 + 兜底链接。
// useChat 在响应非 2xx 时会把 `await response.text()` 整个塞进 Error.message。
function describeError(raw: string | undefined): { messageKey: MessageKey; link?: { href: string; labelKey: MessageKey } } {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { code?: string };
      if (parsed.code === "NOT_CONFIGURED") return { messageKey: "chat.notConfigured" };
      if (parsed.code === "RATE_LIMITED") return { messageKey: "chat.rateLimited" };
      if (parsed.code === "NO_CREDITS") {
        return { messageKey: "chat.noCredits", link: { href: WALLET_URL, labelKey: "chat.topUp" } };
      }
    } catch {
      // 不是 JSON(比如网络层错误),走默认文案
    }
  }
  return { messageKey: "chat.error" };
}

export default function ChatWidget() {
  const { isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(CHAT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CHAT_OPEN_EVENT, onOpen);
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async () => {
          const token = await getAccessTokenSilently({
            authorizationParams: { audience: AUTH0_AUDIENCE },
          });
          return { Authorization: `Bearer ${token}` };
        },
      }),
    [getAccessTokenSilently]
  );

  const { messages, sendMessage, status, error, clearError } = useChat({ transport });

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [open, messages, status]);

  if (isLoading || !isAuthenticated) return null;

  const busy = status === "submitted" || status === "streaming";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    clearError();
    sendMessage({ text });
    setInput("");
  }

  return (
    <>
      {open && (
        <div className="fixed inset-x-3 bottom-3 z-40 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-96">
          <div className="flex h-[70vh] max-h-[560px] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
                <span>🦞</span> comiclaw
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label={t("detail.close")}
                title={t("detail.close")}
                className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {messages.length === 0 && (
                <p className="rounded-xl bg-zinc-800/60 px-3 py-2 text-sm text-zinc-300">
                  {t("chat.welcome")}
                </p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-accent text-zinc-950"
                        : "bg-zinc-800/60 text-zinc-200"
                    }`}
                  >
                    {m.parts.map((p, i) =>
                      p.type === "text" ? <span key={i}>{p.text}</span> : null
                    )}
                  </div>
                </div>
              ))}
              {status === "submitted" && (
                <p className="px-1 text-xs text-zinc-500">{t("chat.thinking")}</p>
              )}
              {error &&
                (() => {
                  const { messageKey, link } = describeError(error.message);
                  return (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                      <p>{t(messageKey)}</p>
                      {link && (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block font-medium underline underline-offset-2"
                        >
                          {t(link.labelKey)} →
                        </a>
                      )}
                    </div>
                  );
                })()}
            </div>

            <form onSubmit={handleSubmit} className="border-t border-zinc-800 p-2.5">
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t("chat.placeholder")}
                  disabled={busy}
                  className="min-w-0 flex-1 rounded-full bg-zinc-800 px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-medium text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {t("chat.send")}
                </button>
              </div>
              <p className="mt-1.5 px-1 text-[11px] text-zinc-600">{t("chat.disclaimer")}</p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import LocaleToggle from "@/components/LocaleToggle";
import UserMenu from "@/components/UserMenu";
import { CHAT_OPEN_EVENT } from "@/components/ChatWidget";
import type { MessageKey } from "@/lib/i18n";
import { COMICLAW_CHAT_URL } from "@/lib/agentLinks";

const MENUS: { href: string; labelKey: MessageKey }[] = [
  { href: "/", labelKey: "nav.recommend" },
  { href: "/series", labelKey: "nav.series" },
  { href: "/characters", labelKey: "nav.characters" },
  { href: "/studio", labelKey: "nav.studio" },
];

export default function SiteNav() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth0();
  const { t } = useT();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="sticky top-0 z-20 border-b border-zinc-800/80 bg-[#0b0b10]/90 backdrop-blur">
      <div className="flex h-12 w-full items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="text-sm font-bold tracking-widest text-accent">
          COMICLAW
        </Link>
        <nav className="flex h-full items-center gap-1">
          {MENUS.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`relative flex h-full items-center px-3 text-sm font-medium transition-colors ${
                isActive(m.href) ? "text-accent" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t(m.labelKey)}
              {isActive(m.href) && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />
              )}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {/* 全站固定入口:不管有没有登录、在哪个页面,都能找到 comiclaw 本人 ——
              浏览推荐流/角色市场/短剧的冷启动访客,此前完全没有路径能"回到"
              创作这一切的智能体本身(comiclaw → Studio 单向,反向没有路)。
              不在小屏幕隐藏:分享链接流量很可能恰恰在移动端,收缩成图标而不是消失。
              登录用户:打开站内嵌入面板(ChatWidget,身份/限流走我们自己的代理)。
              未登录:退回外部飞书 bot 链接(站内代理需要 Auth0 身份,匿名用户没有)。 */}
          {isAuthenticated ? (
            <button
              onClick={() => window.dispatchEvent(new Event(CHAT_OPEN_EVENT))}
              aria-label={t("nav.chatWithComiclaw")}
              title={t("nav.chatWithComiclaw")}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-zinc-950 transition-opacity hover:opacity-90 sm:px-3.5"
            >
              <span className="text-sm leading-none">🦞</span>
              <span className="hidden sm:inline">{t("nav.chatWithComiclaw")}</span>
            </button>
          ) : (
            <a
              href={COMICLAW_CHAT_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("nav.chatWithComiclaw")}
              title={t("nav.chatWithComiclaw")}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-zinc-950 transition-opacity hover:opacity-90 sm:px-3.5"
            >
              <span className="text-sm leading-none">🦞</span>
              <span className="hidden sm:inline">{t("nav.chatWithComiclaw")}</span>
            </a>
          )}
          <UserMenu />
          <LocaleToggle />
        </div>
      </div>
    </div>
  );
}

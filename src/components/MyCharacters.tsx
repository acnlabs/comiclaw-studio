"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { useT } from "@/components/LocaleProvider";
import { AUTH0_AUDIENCE } from "@/lib/auth0";

interface MyCharacter {
  id: string;
  name: string;
  imageUrl: string;
  isPublic: boolean;
  licensePoints: number;
  listed: boolean;
  licensedProjectCount: number;
}

// 角色页顶部的「我的角色」:登录客户名下的数字人。
// 收益归因在 /credits,这里只讲资产本身。
export default function MyCharacters() {
  const { isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const { t } = useT();
  const [characters, setCharacters] = useState<MyCharacter[] | null>(null);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    (async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: AUTH0_AUDIENCE },
        });
        const res = await fetch("/api/user/characters", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setCharacters(data.characters ?? []);
      } catch {
        setCharacters([]);
      }
    })();
  }, [isAuthenticated, isLoading, getAccessTokenSilently]);

  // Nothing owned yet is the common case on a public marketplace page, so stay
  // out of the way instead of showing an empty box above everyone's browse view.
  if (!characters || characters.length === 0) return null;

  return (
    <section className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-5 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-100">{t("myChar.title")}</h2>
        <Link
          href="/credits"
          className="text-xs text-accent underline-offset-4 hover:underline"
        >
          {t("myChar.earningsLink")}
        </Link>
      </div>
      <p className="mt-1 mb-4 text-sm text-zinc-500">{t("myChar.subtitle")}</p>

      <ul className="space-y-3">
        {characters.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-4"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.imageUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <Link
                href={c.isPublic ? `/characters/${c.id}` : "#"}
                className={`truncate font-medium text-zinc-100 ${c.isPublic ? "hover:text-accent" : "cursor-default"}`}
              >
                {c.name}
              </Link>
              <div className="mt-1 text-xs text-zinc-500">
                {c.licensePoints > 0
                  ? t("char.pointsPerProject", { n: c.licensePoints })
                  : t("char.free")}
                {!c.isPublic && ` · ${t("myChar.notPublic")}`}
              </div>
            </div>
            <div className="shrink-0 text-right text-sm text-zinc-400">
              {t("myChar.licensedCount", { n: c.licensedProjectCount })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

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
  totalCreditsEarnedGross: number;
}

// 登录客户名下的数字人角色 + 在 Studio 范围内的选角授权收益统计。
// 只在客户名下有角色时渲染(大多数客户没有,不占空间)。
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

  if (!characters || characters.length === 0) return null;

  return (
    <div>
      <h2 className="mt-12 mb-1 text-lg font-semibold text-zinc-100">{t("myChar.title")}</h2>
      <p className="mb-4 text-sm text-zinc-500">{t("myChar.subtitle")}</p>

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
            <div className="shrink-0 text-right">
              <div className="text-sm font-medium text-zinc-100">
                {t("myChar.licensedCount", { n: c.licensedProjectCount })}
              </div>
              <div className="mt-0.5 text-xs text-accent">
                {t("myChar.earned", { n: c.totalCreditsEarnedGross })}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-zinc-600">{t("myChar.walletHint")}</p>
    </div>
  );
}

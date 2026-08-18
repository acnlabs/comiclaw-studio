import Link from "next/link";
import { getLocale } from "@/lib/locale";
import { translate, type MessageKey } from "@/lib/i18n";
import WorkCard from "@/components/WorkCard";
import type { PublicProfile } from "@/lib/profile";
import type { CreditKind } from "@/lib/workCredit";

type WorkRow = {
  id: string;
  kind: string;
  category: string | null;
  title: string;
  coverUrl: string | null;
  authorName: string | null;
  publishedAt: Date;
  ownerKind: string | null;
  ownerAgentId: string | null;
  appearingAgentId: string | null;
  appearances?: { agentId: string }[];
  credits?: { kind: string; role: string | null }[];
  _count: { episodes: number };
};

const CREDIT_BADGE: Record<CreditKind, MessageKey> = {
  appear: "series.castMember",
  script: "credit.script",
  asset: "credit.asset",
  storyboard: "credit.storyboard",
  film: "credit.film",
};

function workBadgeKeys(profile: PublicProfile, work: WorkRow): MessageKey[] {
  if (profile.kind !== "agent") return [];
  const keys: MessageKey[] = [];
  const owned = work.ownerKind === "agent" && work.ownerAgentId === profile.id;
  if (owned) keys.push("profile.owned");
  for (const row of work.credits ?? []) {
    if (row.kind === "appear") {
      keys.push(row.role === "lead" ? "series.castLead" : "series.castMember");
      continue;
    }
    const key = CREDIT_BADGE[row.kind as CreditKind];
    if (key) keys.push(key);
  }
  if (
    !work.credits?.some((row) => row.kind === "appear") &&
    (work.appearingAgentId === profile.id ||
      work.appearances?.some((row) => row.agentId === profile.id))
  ) {
    keys.push("profile.appearing");
  }
  return [...new Set(keys)];
}

export default async function ProfileView({
  profile,
  works,
}: {
  profile: PublicProfile;
  works: WorkRow[];
}) {
  const locale = await getLocale();
  const kindLabel =
    profile.kind === "user"
      ? translate(locale, "profile.kindUser")
      : profile.kind === "agent"
        ? translate(locale, "profile.kindAgent")
        : translate(locale, "profile.kindOrg");

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-widest text-accent">
        {kindLabel}
      </p>
      <h1 className="mt-2 text-2xl font-bold text-zinc-50">{profile.displayName}</h1>
      {profile.handle ? (
        <p className="mt-1 text-sm text-zinc-500">@{profile.handle}</p>
      ) : profile.kind !== "user" ? (
        <p className="mt-1 break-all text-sm text-zinc-500">{profile.id}</p>
      ) : null}
      {profile.externalHref ? (
        <p className="mt-3">
          <a
            href={profile.externalHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:opacity-80"
          >
            {translate(locale, "profile.openAgentPlanet")}
          </a>
        </p>
      ) : null}

      <h2 className="mt-10 text-sm font-medium text-zinc-400">
        {translate(locale, "profile.works", { n: works.length })}
      </h2>
      {works.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">{translate(locale, "profile.empty")}</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {works.map((w) => {
            const badges = workBadgeKeys(profile, w);
            return (
              <div key={w.id} className="relative">
                <WorkCard
                  work={{
                    id: w.id,
                    kind: w.kind,
                    category: w.category,
                    title: w.title,
                    coverUrl: w.coverUrl,
                    authorName: w.authorName,
                    authorHandle: profile.kind === "user" ? profile.handle : null,
                    authorHref:
                      profile.kind === "agent" &&
                      !(w.ownerKind === "agent" && w.ownerAgentId === profile.id)
                        ? undefined
                        : profile.href,
                    publishedAt: w.publishedAt.toISOString(),
                    episodeCount: w._count.episodes,
                  }}
                />
                {badges.length > 0 ? (
                  <span className="pointer-events-none absolute right-2 top-2 z-10 flex flex-col items-end gap-1">
                    {badges.map((key) => (
                      <span
                        key={key}
                        className="rounded-md bg-zinc-950/80 px-2 py-0.5 text-[10px] text-zinc-300"
                      >
                        {translate(locale, key)}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-10">
        <Link href="/series" className="text-sm text-zinc-500 hover:text-accent">
          {translate(locale, "common.backHome")}
        </Link>
      </p>
    </div>
  );
}

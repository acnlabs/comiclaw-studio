import Link from "next/link";
import { mastheadTint } from "@/lib/mastheadTint";
import type { CatalogSkill } from "@/lib/skillsCatalog";
import { loc } from "@/lib/skillsCatalog";
import type { Locale } from "@/lib/i18n";

export default function SkillCard({
  skill,
  locale,
  officialLabel,
}: {
  skill: CatalogSkill;
  locale: Locale;
  officialLabel: string;
}) {
  const title = loc(locale, skill.title);
  const summary = loc(locale, skill.summary);

  return (
    <Link
      href={`/skills/${skill.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 transition-colors hover:border-zinc-600"
    >
      <div
        className={`relative aspect-[16/9] bg-gradient-to-br ${mastheadTint(skill.slug)}`}
      >
        <div className="flex h-full w-full flex-col justify-end px-4 pb-4">
          <span className="font-mono text-xs tracking-wide text-zinc-300/80">
            {skill.name}
          </span>
          <span className="mt-1 line-clamp-2 text-xl font-semibold tracking-tight text-zinc-50">
            {title}
          </span>
        </div>
        {skill.official ? (
          <span className="absolute left-2 top-2 rounded-md bg-zinc-950/80 px-2 py-0.5 text-xs font-medium text-accent">
            {officialLabel}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col px-4 py-3.5">
        <p className="line-clamp-3 text-sm leading-relaxed text-zinc-400">
          {summary}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {skill.tags.map((tag) => (
            <span
              key={loc(locale, tag)}
              className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-[11px] text-zinc-400"
            >
              {loc(locale, tag)}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

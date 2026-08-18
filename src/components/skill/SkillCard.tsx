import Link from "next/link";
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
      className="group flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 transition-colors hover:border-zinc-600"
    >
      <div className="flex flex-wrap items-center gap-2">
        {skill.official ? (
          <span className="rounded-md bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
            {officialLabel}
          </span>
        ) : null}
        <span className="font-mono text-xs tracking-wide text-zinc-500">
          {skill.name}
        </span>
      </div>
      <span className="mt-2 text-lg font-semibold tracking-tight text-zinc-50">
        {title}
      </span>
      <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-zinc-400">
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
    </Link>
  );
}

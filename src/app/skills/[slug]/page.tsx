import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";
import { getSkill, loc, SKILL_SLUG_ALIASES, SKILLS } from "@/lib/skillsCatalog";
import SkillInstall from "@/components/skill/SkillInstall";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return SKILLS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const canonical = SKILL_SLUG_ALIASES[slug] ?? slug;
  const skill = getSkill(canonical);
  if (!skill) return {};
  const locale = await getLocale();
  return { title: `${loc(locale, skill.title)} · ComicLaw` };
}

export default async function SkillDetailPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const canonical = SKILL_SLUG_ALIASES[slug];
  if (canonical) redirect(`/skills/${canonical}`);
  const skill = getSkill(slug);
  if (!skill) notFound();

  const locale = await getLocale();
  const t = (k: Parameters<typeof translate>[1]) => translate(locale, k);
  const title = loc(locale, skill.title);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <Link
        href="/skills"
        className="text-sm text-zinc-500 transition-colors hover:text-zinc-200"
      >
        ← {t("skills.back")}
      </Link>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {skill.official ? (
          <span className="rounded-md bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
            {t("skills.official")}
          </span>
        ) : null}
        <span className="font-mono text-xs text-zinc-500">{skill.name}</span>
      </div>

      <h1 className="mt-3 text-2xl font-bold text-zinc-50">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        {loc(locale, skill.summary)}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {skill.tags.map((tag) => (
          <span
            key={loc(locale, tag)}
            className="rounded-full bg-zinc-800/80 px-2.5 py-0.5 text-xs text-zinc-400"
          >
            {loc(locale, tag)}
          </span>
        ))}
      </div>

      <SkillInstall
        command={skill.installCommand}
        installLabel={t("skills.install")}
        copyLabel={t("skills.copyInstall")}
        copiedLabel={t("skills.copied")}
      />

      <div className="mt-10 space-y-8">
        {skill.sections.map((section) => (
          <section key={loc(locale, section.title)}>
            <h2 className="text-sm font-semibold text-zinc-100">
              {loc(locale, section.title)}
            </h2>
            <ul className="mt-2.5 space-y-2">
              {section.items.map((item) => (
                <li
                  key={loc(locale, item)}
                  className="flex gap-2 text-sm leading-relaxed text-zinc-300"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  {loc(locale, item)}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-10">
        <a
          href={skill.githubUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          {t("skills.viewOnGithub")} →
        </a>
      </p>
    </div>
  );
}

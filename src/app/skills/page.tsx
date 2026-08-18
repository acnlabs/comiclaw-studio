import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";
import { SKILLS } from "@/lib/skillsCatalog";
import SkillCard from "@/components/skill/SkillCard";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: `${translate(locale, "skills.title")} · ComicLaw` };
}

export default async function SkillsPage() {
  const locale = await getLocale();
  const t = (k: Parameters<typeof translate>[1]) => translate(locale, k);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-bold text-zinc-50">{t("skills.title")}</h1>
      <p className="mt-1 max-w-3xl text-sm text-zinc-500">{t("skills.subtitle")}</p>

      {SKILLS.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-800 py-20 text-center text-sm text-zinc-500">
          {t("skills.empty")}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SKILLS.map((skill) => (
            <SkillCard
              key={skill.slug}
              skill={skill}
              locale={locale}
              officialLabel={t("skills.official")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

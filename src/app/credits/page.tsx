import { getLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";
import CreditsLedger from "@/components/credits/CreditsLedger";

export const dynamic = "force-dynamic";

export default async function CreditsPage() {
  const locale = await getLocale();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-bold text-zinc-50">
        {translate(locale, "credits.title")}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        {translate(locale, "credits.subtitle")}
      </p>
      <CreditsLedger />
    </div>
  );
}

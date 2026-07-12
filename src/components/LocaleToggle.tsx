"use client";

import { useRouter } from "next/navigation";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { useT } from "@/components/LocaleProvider";

export default function LocaleToggle() {
  const router = useRouter();
  const { locale } = useT();
  const next = locale === "zh" ? "en" : "zh";

  const switchLocale = () => {
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000`;
    router.refresh();
  };

  return (
    <button
      onClick={switchLocale}
      title={next === "en" ? "Switch to English" : "切换为中文"}
      className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
    >
      {next === "en" ? "EN" : "中文"}
    </button>
  );
}

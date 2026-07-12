"use client";

import Link from "next/link";
import { useT } from "@/components/LocaleProvider";

export default function NotFound() {
  const { t } = useT();
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <div className="text-xs tracking-widest text-accent">COMICLAW STUDIO</div>
      <h1 className="mt-4 text-2xl font-bold text-zinc-50">{t("notFound.title")}</h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-400">{t("notFound.desc")}</p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-accent px-5 py-2 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90"
      >
        {t("common.backHome")}
      </Link>
    </div>
  );
}

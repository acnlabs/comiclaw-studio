"use client";

import { createContext, useContext, useMemo } from "react";
import { translate, translateCategory, type Locale, type MessageKey } from "@/lib/i18n";
import { fmtDate as fmtDateRaw } from "@/lib/format";

interface LocaleContextValue {
  locale: Locale;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  tCategory: (category: string) => string;
  fmtDate: (iso: string | null | undefined) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  t: (key, params) => translate("en", key, params),
  tCategory: (category) => category,
  fmtDate: (iso) => fmtDateRaw(iso, "en"),
});

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      t: (key, params) => translate(locale, key, params),
      tCategory: (category) => translateCategory(locale, category),
      fmtDate: (iso) => fmtDateRaw(iso, locale),
    }),
    [locale]
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useT() {
  return useContext(LocaleContext);
}

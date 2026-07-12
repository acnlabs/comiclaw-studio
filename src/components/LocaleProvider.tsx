"use client";

import { createContext, useContext, useMemo } from "react";
import { translate, translateCategory, type Locale, type MessageKey } from "@/lib/i18n";

interface LocaleContextValue {
  locale: Locale;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  tCategory: (category: string) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "zh",
  t: (key, params) => translate("zh", key, params),
  tCategory: (category) => category,
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
    }),
    [locale]
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useT() {
  return useContext(LocaleContext);
}

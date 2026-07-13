import type { Metadata } from "next";
import "./globals.css";
import SiteNav from "@/components/SiteNav";
import AuthProvider from "@/components/AuthProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import { getLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: "ComicLaw",
    description: translate(locale, "meta.description"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html lang={locale === "zh" ? "zh-CN" : "en"} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <LocaleProvider locale={locale}>
            <SiteNav />
            {children}
          </LocaleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

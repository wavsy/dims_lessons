import type { Metadata } from "next";
import { Caveat, EB_Garamond, Nunito, Plus_Jakarta_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { BroomFlight } from "@/components/broom-flight";
import { CoinRain } from "@/components/coin-rain";
import { ForestPassage } from "@/components/forest-passage";
import { ThemeProvider, type Theme } from "@/components/theme";
import "../globals.css";

const nunito = Nunito({ subsets: ["latin", "cyrillic"], variable: "--font-nunito" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
const garamond = EB_Garamond({ subsets: ["latin", "cyrillic"], variable: "--font-garamond" });
const caveat = Caveat({ subsets: ["latin", "cyrillic"], variable: "--font-caveat" });

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  const stored = (await cookies()).get("theme")?.value;
  const theme: Theme = stored === "dark" ? "dark" : "light";

  return (
    <html
      lang={locale}
      className={`${nunito.variable} ${jakarta.variable} ${garamond.variable} ${caveat.variable}${theme === "dark" ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider initial={theme}>
            {children}
            <ForestPassage />
            <BroomFlight />
            <CoinRain />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

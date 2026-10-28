import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { BrandLink } from "@/components/brand-link";
import { ErrorBanner } from "@/components/error-banner";
import { primaryButton } from "@/components/fields";
import { LanguageSwitch } from "@/components/language-switch";
import { choosePassword } from "@/lib/actions";
import { getSession } from "@/lib/auth";

export default async function PasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  const session = await getSession();
  if (!session || session.role === "student") {
    redirect({ href: "/login", locale });
    throw new Error("Redirect failed");
  }
  const t = await getTranslations("auth");

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-5 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <BrandLink />
        <LanguageSwitch />
      </div>
      <h1 className="font-display text-4xl">{t("chooseTitle")}</h1>
      <p className="mt-2 text-soft">{t("chooseLead")}</p>
      <ErrorBanner code={error} />
      <form action={choosePassword} className="mt-6 space-y-4 rounded-2xl bg-ivory p-5 shadow-card">
        <label className="block">
          <span className="label">{t("password")}</span>
          <input className="field" name="password" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        <button className={primaryButton} type="submit">
          {t("chooseSave")}
        </button>
      </form>
    </div>
  );
}

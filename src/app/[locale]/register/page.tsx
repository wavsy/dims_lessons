import { getTranslations } from "next-intl/server";
import { ErrorBanner } from "@/components/error-banner";
import { primaryButton } from "@/components/fields";
import { LanguageSwitch } from "@/components/language-switch";
import { BrandLink } from "@/components/brand-link";
import { RegisterForm } from "@/components/register-form";
import { Link } from "@/i18n/navigation";
import { choiceOptions } from "@/lib/labels";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; code?: string; pays?: string }>;
}) {
  const { error, sent, code, pays } = await searchParams;
  const t = await getTranslations("register");
  const options = await choiceOptions();

  return (
    <div className="mx-auto min-h-screen max-w-lg px-5 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <BrandLink />
        <LanguageSwitch />
      </div>
      {sent === "1" ? (
        <div className="rise rounded-2xl bg-ivory p-6 shadow-card">
          <h1 className="font-display text-4xl">{t("thanksTitle")}</h1>
          <p className="mt-3 text-soft">{t("thanksLead")}</p>
          <Link className={`${primaryButton} mt-6`} href="/login">
            {t("signIn")}
          </Link>
        </div>
      ) : (
        <>
          <p className="kicker">{t("kicker")}</p>
          <h1 className="mt-2 font-display text-4xl">{t("title")}</h1>
          <p className="mt-2 text-soft">{t("lead")}</p>
          <p className="mt-3 text-sm text-soft">{t("privacy")}</p>
          <Link href="/join" className="mt-3 inline-block text-sm font-bold text-soft">
            {t("otherParent")}
          </Link>
          <ErrorBanner code={error} />
          <RegisterForm subjects={options.subjects} code={code ?? ""} pays={pays === "1"} />
        </>
      )}
    </div>
  );
}

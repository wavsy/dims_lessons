import { getTranslations } from "next-intl/server";
import { BrandLink } from "@/components/brand-link";
import { ErrorBanner } from "@/components/error-banner";
import { primaryButton } from "@/components/fields";
import { LanguageSwitch } from "@/components/language-switch";
import { Link } from "@/i18n/navigation";
import { requestParentJoin } from "@/lib/actions";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; code?: string }>;
}) {
  const { error, sent, code } = await searchParams;
  const t = await getTranslations("join");

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
          <ErrorBanner code={error} />
          <form action={requestParentJoin} className="mt-6 space-y-4 rounded-2xl bg-ivory p-5 shadow-card">
            <label className="block">
              <span className="label">{t("name")}</span>
              <input className="field" name="name" required />
            </label>
            <label className="block">
              <span className="label">{t("email")}</span>
              <input className="field" name="email" type="email" required autoComplete="email" />
            </label>
            <label className="block">
              <span className="label">{t("code")}</span>
              <input className="field" name="code" inputMode="numeric" required defaultValue={code ?? ""} />
            </label>
            <button className={primaryButton} type="submit">
              {t("submit")}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

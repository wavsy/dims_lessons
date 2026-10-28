import { getTranslations } from "next-intl/server";
import { LanguageSwitch } from "@/components/language-switch";
import { BrandLink } from "@/components/brand-link";
import { primaryButton } from "@/components/fields";
import { Link } from "@/i18n/navigation";
import { signInStudent, signInWithPassword } from "@/lib/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const t = await getTranslations("auth");

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-5 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <BrandLink />
        <LanguageSwitch />
      </div>
      <h1 className="font-display text-4xl">{t("signInTitle")}</h1>
      <p className="mt-2 text-soft">{t("signInLead")}</p>
      {error === "invalid" ? <p className="mt-6 rounded-2xl bg-butter px-4 py-3 text-sm font-bold">{t("invalid")}</p> : null}
      {error === "expired" ? <p className="mt-6 rounded-2xl bg-butter px-4 py-3 text-sm font-bold">{t("expired")}</p> : null}
      <form action={signInWithPassword} className="mt-6 space-y-4 rounded-2xl bg-ivory p-5 shadow-card">
        <label className="block">
          <span className="label">{t("email")}</span>
          <input className="field" name="email" type="email" required autoComplete="username" />
        </label>
        <label className="block">
          <span className="label">{t("password")}</span>
          <input className="field" name="password" type="password" required autoComplete="current-password" />
        </label>
        <button className={primaryButton} type="submit">
          {t("enter")}
        </button>
      </form>

      <h2 className="mt-10 font-display text-3xl">{t("studentTitle")}</h2>
      <p className="mt-2 text-soft">{t("studentLead")}</p>
      {error === "student" ? <p className="mt-6 rounded-2xl bg-butter px-4 py-3 text-sm font-bold">{t("studentFail")}</p> : null}
      <form action={signInStudent} className="mt-6 space-y-4 rounded-2xl bg-ivory p-5 shadow-card">
        <label className="block">
          <span className="label">{t("name")}</span>
          <input className="field" name="name" required autoComplete="username" />
        </label>
        <label className="block">
          <span className="label">{t("pin")}</span>
          <input className="field" name="pin" inputMode="numeric" autoComplete="off" required minLength={4} maxLength={6} />
        </label>
        <button className={primaryButton} type="submit">
          {t("enter")}
        </button>
      </form>
      <Link href="/register" className="mt-6 text-sm font-bold text-soft">
        {t("register")}
      </Link>
      <Link href="/join" className="mt-2 text-sm font-bold text-soft">
        {t("join")}
      </Link>
      <Link href="/" className="mt-6 text-sm font-bold text-soft">
        {t("back")}
      </Link>
    </div>
  );
}

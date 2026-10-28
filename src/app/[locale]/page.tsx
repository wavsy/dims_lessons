import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { primaryButton, butterButton } from "@/components/fields";
import { LanguageSwitch } from "@/components/language-switch";
import { NotebookStory } from "@/components/notebook-story";
import { StudioFilm } from "@/components/studio-film";
import { WelcomeHero } from "@/components/welcome-hero";
import { getSession, homeFor } from "@/lib/auth";

export default async function WelcomePage() {
  const t = await getTranslations("welcome");
  const landing = await getTranslations("landing");
  const meta = await getTranslations("meta");
  const session = await getSession();

  return (
    <div className="mx-auto w-full max-w-6xl overflow-x-clip px-4 sm:px-8 lg:px-12">
      <div className="flex min-h-screen flex-col py-6 lg:justify-center lg:py-10">
        <div className="mb-8 flex justify-end">
          <LanguageSwitch />
        </div>
        <WelcomeHero
          title={meta("title")}
          kicker={t("kicker")}
          lead={t("lead")}
          signIn={t("signIn")}
          coverTitle={landing("cover")}
          bookCopy={{
            title: landing("cover"),
            kicker: t("kicker"),
            date: landing("page.today.date"),
            rows: [
              [landing("page.today.r1"), landing("page.today.s1")],
              [landing("page.today.r2"), landing("page.today.s2")],
              [landing("page.today.r3"), landing("page.today.s3")],
            ],
            note: landing("bookNote"),
          }}
          continueHref={session ? homeFor(session.role) : undefined}
          continueLabel={session ? t("continue") : undefined}
        />
      </div>

      <NotebookStory />
      <StudioFilm />

      <section className="landing-end">
        <h2 className="landing-end-title font-display">{landing("endTitle")}</h2>
        <p className="mt-4 max-w-md text-[17px] text-soft">{landing("endLead")}</p>
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
          <Link className={primaryButton} href={session ? homeFor(session.role) : "/login"}>
            {session ? t("continue") : t("signIn")}
          </Link>
          <Link className={butterButton} href="/register">
            {t("register")}
          </Link>
          <Link className={butterButton} href="/student">
            {t("student")}
          </Link>
        </div>
      </section>
    </div>
  );
}

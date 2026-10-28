import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ThemeSwitch } from "@/components/theme";

export default async function NotFound() {
  const t = await getTranslations("meta");
  return (
    <div className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5">
      <div className="absolute top-6 right-5">
        <ThemeSwitch />
      </div>
      <h1 className="font-display text-5xl">{t("title")}</h1>
      <p className="mt-3 text-soft">This page is not here.</p>
      <Link href="/" className="mt-6 font-bold text-apricot">
        Home
      </Link>
    </div>
  );
}

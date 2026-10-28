"use client";

import { useLocale } from "next-intl";
import { useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { rememberLocale } from "@/lib/actions";
import { PillRail } from "./pill-rail";
import { ThemeSwitch } from "./theme";

export function LanguageSwitch({ trailing }: { trailing?: ReactNode }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();

  function choose(next: "en" | "bg") {
    if (next === locale) return;
    start(async () => {
      await rememberLocale(next);
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
      <PillRail>
        {(["en", "bg"] as const).map((code) => (
          <button
            key={code}
            type="button"
            data-nav-item=""
            disabled={pending}
            aria-pressed={locale === code}
            onClick={() => choose(code)}
            className="nav-item"
          >
            {code === "en" ? "EN" : "БГ"}
          </button>
        ))}
        {trailing}
      </PillRail>
      <ThemeSwitch />
    </div>
  );
}

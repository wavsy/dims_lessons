"use client";

import { useTranslations } from "next-intl";
import { createContext, useContext, useState, type ReactNode } from "react";
import { PillRail } from "./pill-rail";

export type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  choose: (next: Theme) => void;
} | null>(null);

function writeTheme(next: Theme) {
  document.documentElement.classList.toggle("dark", next === "dark");
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

export function ThemeProvider({ initial, children }: { initial: Theme; children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initial);

  function choose(next: Theme) {
    if (next === theme) return;
    setTheme(next);
    writeTheme(next);
  }

  return <ThemeContext.Provider value={{ theme, choose }}>{children}</ThemeContext.Provider>;
}

export function ThemeSwitch() {
  const t = useTranslations("theme");
  const context = useContext(ThemeContext);
  if (!context) return null;
  const { theme, choose } = context;

  return (
    <div role="group" aria-label={t("label")}>
      <PillRail>
        <button
          type="button"
          data-nav-item=""
          className="nav-item theme-item"
          aria-pressed={theme === "light"}
          aria-label={t("light")}
          onClick={() => choose("light")}
        >
          <SunIcon />
        </button>
        <button
          type="button"
          data-nav-item=""
          className="nav-item theme-item"
          aria-pressed={theme === "dark"}
          aria-label={t("dark")}
          onClick={() => choose("dark")}
        >
          <MoonIcon />
        </button>
      </PillRail>
    </div>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3.2v2.1M12 18.7V20.8M3.2 12h2.1M18.7 12h2.1M5.8 5.8l1.5 1.5M16.7 16.7l1.5 1.5M18.2 5.8l-1.5 1.5M7.3 16.7l-1.5 1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M16.2 14.8A6.2 6.2 0 0 1 9.4 6.6 6.4 6.4 0 1 0 16.2 14.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

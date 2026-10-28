"use client";

import { useTranslations } from "next-intl";

export const CHAPTERS = ["today", "money", "family", "student"] as const;
export type Chapter = (typeof CHAPTERS)[number];

function Tick() {
  return (
    <svg className="hand-tick" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 13 L10 18 L20 5" pathLength={1} />
    </svg>
  );
}

function Circle() {
  return (
    <svg className="hand-circle" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 C6 3 3 7 3 12 C3 17 7 21 12 21 C17 21 21 17 21 12 C21 7 17 4 11 4" pathLength={1} />
    </svg>
  );
}

export function NotebookPage({ chapter }: { chapter: Chapter }) {
  const t = useTranslations(`landing.page.${chapter}`);

  if (chapter === "today") {
    return (
      <div className="hand-page">
        <p className="hand-head">{t("date")}</p>
        <ul className="hand-list">
          <li>
            <Tick />
            <span>{t("r1")}</span>
            <em>{t("s1")}</em>
            <small className="hand-stamp">{t("saved")}</small>
          </li>
          <li>
            <Circle />
            <span>{t("r2")}</span>
            <em>{t("s2")}</em>
          </li>
          <li>
            <Circle />
            <span>{t("r3")}</span>
            <em>{t("s3")}</em>
          </li>
        </ul>
      </div>
    );
  }

  if (chapter === "money") {
    return (
      <div className="hand-page">
        <ul className="hand-list">
          <li>
            <span>{t("r1")}</span>
            <em className="hand-due">{t("v1")}</em>
          </li>
          <li>
            <span>{t("r2")}</span>
            <span className="hand-pack" aria-hidden="true">
              <i className="is-used" />
              <i className="is-used" />
              <i className="is-used" />
              <i />
              <i />
            </span>
          </li>
          <li className="hand-sub">{t("v2")}</li>
        </ul>
        <p className="hand-settled">
          <Tick />
          {t("settled")}
        </p>
      </div>
    );
  }

  if (chapter === "family") {
    return (
      <div className="hand-page">
        <p className="hand-head">{t("lesson")}</p>
        <p className="hand-line">{t("homework")}</p>
        <p className="hand-note">{t("note")}</p>
        <p className="hand-lock">{t("readOnly")}</p>
      </div>
    );
  }

  return (
    <div className="hand-page">
      <p className="hand-label">{t("todo")}</p>
      <p className="hand-line hand-box">
        <span className="hand-check" aria-hidden="true" />
        {t("task")}
      </p>
      <p className="hand-label">{t("studied")}</p>
      <p className="hand-line">{t("topic")}</p>
      <p className="hand-pin">
        {t("pin")} <span>• • • •</span>
      </p>
    </div>
  );
}

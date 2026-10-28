"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CHAPTERS, NotebookPage } from "./notebook-page";

export function NotebookStory() {
  const t = useTranslations("landing");
  const [active, setActive] = useState(0);
  const [turns, setTurns] = useState(0);
  const stepsRef = useRef<(HTMLElement | null)[]>([]);
  const activeRef = useRef(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (index === activeRef.current) continue;
          activeRef.current = index;
          setActive(index);
          setTurns((count) => count + 1);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const step of stepsRef.current) if (step) observer.observe(step);
    return () => observer.disconnect();
  }, []);

  const chapter = CHAPTERS[active];

  return (
    <section className="story" aria-labelledby="story-title">
      <div className="story-intro">
        <p className="kicker">{t("kicker")}</p>
        <h2 id="story-title" className="story-title font-display">
          {t("title")}
        </h2>
      </div>

      <div className="story-grid">
        <div className="story-stick" aria-hidden="true">
          <div className="story-scene">
            <div className="story-shadow" />
            <div className="story-orbit">
              <div className="spellbook story-book">
                <div className="spell-board spell-board-left" />
                <div className="spell-board spell-board-right" />
                <div className="spell-pages">
                  <div className="spell-sheet spell-sheet-left">
                    <div key={`left-${active}`} className="story-left">
                      <span className="story-num">{active + 1}</span>
                      <span className="story-name">{t(`chapters.${active}.name`)}</span>
                      <span className="story-count">
                        {t("chapter")} {active + 1} {t("of")} {CHAPTERS.length}
                      </span>
                    </div>
                  </div>
                  <div className="spell-sheet spell-sheet-right">
                    <div key={`right-${chapter}`} className="story-right">
                      <NotebookPage chapter={chapter} />
                    </div>
                  </div>
                  {turns > 0 ? (
                    <div key={`leaf-${turns}`} className="story-leaf">
                      <div className="spell-leaf-face spell-leaf-front" />
                      <div className="spell-leaf-face spell-leaf-back" />
                    </div>
                  ) : null}
                  <div className="spell-gutter" />
                  <div className="spell-ribbon story-ribbon" />
                </div>
              </div>
            </div>
          </div>
          <ol className="story-dots">
            {CHAPTERS.map((name, index) => (
              <li key={name} className={index === active ? "is-on" : undefined} />
            ))}
          </ol>
        </div>

        <ol className="story-steps">
          {CHAPTERS.map((name, index) => (
            <li
              key={name}
              ref={(node) => {
                stepsRef.current[index] = node;
              }}
              data-index={index}
              className={`story-step${index === active ? " is-on" : ""}`}
            >
              <p className="kicker">
                {String(index + 1).padStart(2, "0")} · {t(`chapters.${index}.name`)}
              </p>
              <h3 className="story-step-title font-display">{t(`chapters.${index}.title`)}</h3>
              <p className="story-step-body">{t(`chapters.${index}.body`)}</p>
              <div className="story-card" aria-hidden="true">
                <NotebookPage chapter={name} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

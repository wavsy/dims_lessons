"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Charm } from "@/components/charm";
import { primaryButton } from "@/components/fields";
import { useEscape } from "@/components/use-escape";

type Step = "closed" | "done" | "answer" | "wait";

export function HomeworkWand({ homework }: { homework: string }) {
  const t = useTranslations("studentHome");
  const [step, setStep] = useState<Step>("closed");
  const [answer, setAnswer] = useState("");
  const titleId = useId();

  useEscape(step !== "closed", () => setStep("closed"), 1);

  useEffect(() => {
    if (step !== "answer") return;
    const field = document.getElementById("homework-answer");
    if (field instanceof HTMLInputElement) field.focus();
  }, [step]);

  function enter(event: FormEvent) {
    event.preventDefault();
    if (!answer.trim()) return;
    setStep("closed");
    setAnswer("");
    window.dispatchEvent(new Event("lessons:coins"));
  }

  return (
    <>
      <button type="button" className="charm-button" aria-label={t("wand")} onClick={() => setStep("done")}>
        <Charm name="wand" live />
      </button>
      {step !== "closed"
        ? createPortal(
            <div className="fixed inset-0 z-50">
              <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" aria-label={t("close")} onClick={() => setStep("closed")} />
              <div className="pointer-events-none relative flex h-full items-end justify-center p-3 sm:items-center sm:p-8">
                <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="rise pointer-events-auto w-full max-w-sm rounded-[28px] bg-ivory p-5 shadow-card">
                  <p className="text-sm font-bold text-soft">{homework}</p>
                  {step === "done" ? (
                    <>
                      <h2 id={titleId} className="mt-2 font-display text-3xl">
                        {t("doneAsk")}
                      </h2>
                      <div className="mt-5 flex items-center justify-between gap-3">
                        <button type="button" className="nav-link text-sm text-ink/70" onClick={() => setStep("wait")}>
                          {t("doneNo")}
                        </button>
                        <button type="button" className={primaryButton} onClick={() => setStep("answer")}>
                          {t("doneYes")}
                        </button>
                      </div>
                    </>
                  ) : null}
                  {step === "wait" ? (
                    <>
                      <h2 id={titleId} className="mt-2 font-display text-3xl">
                        {t("doneWait")}
                      </h2>
                      <div className="mt-5 flex justify-end">
                        <button type="button" className={primaryButton} onClick={() => setStep("closed")}>
                          {t("close")}
                        </button>
                      </div>
                    </>
                  ) : null}
                  {step === "answer" ? (
                    <form onSubmit={enter}>
                      <h2 id={titleId} className="mt-2 font-display text-3xl">
                        {t("answerAsk")}
                      </h2>
                      <label className="mt-4 block">
                        <span className="label">{t("answerLabel")}</span>
                        <input
                          id="homework-answer"
                          className="field"
                          value={answer}
                          onChange={(event) => setAnswer(event.target.value)}
                          autoComplete="off"
                        />
                      </label>
                      <div className="mt-5 flex items-center justify-between gap-3">
                        <button type="button" className="nav-link text-sm text-ink/70" onClick={() => setStep("closed")}>
                          {t("close")}
                        </button>
                        <button type="submit" className={primaryButton} disabled={!answer.trim()}>
                          {t("enter")}
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

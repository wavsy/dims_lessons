"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { noteDeal } from "@/lib/actions";
import { useEscape } from "@/components/use-escape";

function readNumber(raw: string) {
  const value = Number(raw.trim().replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function moneyText(euros: number) {
  return Number.isInteger(euros) ? String(euros) : euros.toFixed(2);
}

function typed(previous: string, next: string) {
  if (previous === "0" && /^0\d/.test(next)) return next.replace(/^0+/, "") || "0";
  return next;
}

function unitsFor(euros: number, unitPrice: number, unit: "lessons" | "hours") {
  if (unit === "hours") return moneyText(Math.round((euros / unitPrice) * 10) / 10);
  return String(Math.max(0, Math.round(euros / unitPrice)));
}

function amountFor(units: number, unitPrice: number) {
  return moneyText(units * unitPrice);
}

export function PaymentSuggest({
  clientId,
  priceCents,
  billingMode,
  amountLabel,
  lessonsLabel,
  hoursLabel,
  priceLessonLabel,
  priceHourLabel,
  hintLesson,
  hintHour,
  locale,
  currency,
  changeLabel,
  dealTitle,
  dealLead,
  perLessonLabel,
  perHourLabel,
  saveLabel,
  cancelLabel,
}: {
  clientId: string;
  priceCents: number;
  billingMode: string;
  amountLabel: string;
  lessonsLabel: string;
  hoursLabel: string;
  priceLessonLabel: string;
  priceHourLabel: string;
  hintLesson: string;
  hintHour: string;
  locale: string;
  currency: string;
  changeLabel: string;
  dealTitle: string;
  dealLead: string;
  perLessonLabel: string;
  perHourLabel: string;
  saveLabel: string;
  cancelLabel: string;
}) {
  const starting = billingMode === "per_hour" ? "per_hour" : billingMode === "prepaid" ? "prepaid" : "per_lesson";
  const [mode, setMode] = useState(starting);
  const [price, setPrice] = useState(priceCents > 0 ? moneyText(priceCents / 100) : "");
  const [amount, setAmount] = useState("0");
  const [count, setCount] = useState("0");
  const [linked, setLinked] = useState<"amount" | "count" | null>(null);
  const [pinned, setPinned] = useState(priceCents > 0);
  const [open, setOpen] = useState(false);
  const [draftMode, setDraftMode] = useState<"per_lesson" | "per_hour">(starting === "per_hour" ? "per_hour" : "per_lesson");
  const [draftPrice, setDraftPrice] = useState(priceCents > 0 ? moneyText(priceCents / 100) : "");
  const titleId = useId();

  useEscape(open, () => setOpen(false), 2);

  const unit = mode === "per_hour" ? "hours" : "lessons";

  function rate() {
    return readNumber(price) ?? 0;
  }

  function applyRate(nextRate: number, nextUnit: "lessons" | "hours") {
    const euros = readNumber(amount);
    const units = readNumber(count);
    if (euros != null && euros > 0) {
      setCount(unitsFor(euros, nextRate, nextUnit));
      setLinked("count");
    } else if (units != null && units > 0) {
      setAmount(amountFor(units, nextRate));
      setLinked("amount");
    }
  }

  function openDeal() {
    setDraftMode(mode === "per_hour" ? "per_hour" : "per_lesson");
    setDraftPrice(price);
    setOpen(true);
  }

  function note() {
    const nextRate = readNumber(draftPrice) ?? 0;
    if (!nextRate) return;
    const nextUnit = draftMode === "per_hour" ? "hours" : "lessons";
    setMode(draftMode);
    setPrice(moneyText(nextRate));
    setPinned(true);
    applyRate(nextRate, nextUnit);
    setOpen(false);
    void noteDeal(clientId, draftMode, Math.round(nextRate * 100));
  }

  const unitPrice = rate();
  const shownHint =
    unitPrice > 0
      ? (unit === "hours" ? hintHour : hintLesson).replace(
          "@@",
          new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-GB", {
            style: "currency",
            currency: currency === "BGN" ? "BGN" : "EUR",
          }).format(unitPrice),
        )
      : "";

  return (
    <>
      <input type="hidden" name="billing" value={mode} />
      <input type="hidden" name="price" value={price} />
      {pinned ? null : (
        <label className="block sm:col-span-2">
          <span className="label">{mode === "per_hour" ? priceHourLabel : priceLessonLabel}</span>
          <input
            className="field"
            inputMode="decimal"
            value={price}
            onChange={(event) => {
              const next = event.target.value;
              setPrice(next);
              const nextRate = readNumber(next) ?? 0;
              if (!nextRate) return;
              applyRate(nextRate, unit);
            }}
          />
        </label>
      )}
      <label className="block">
        <span className="label">{amountLabel}</span>
        <input
          className={`field ${linked === "amount" ? "is-linked" : ""}`}
          name="amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => {
            const next = typed(amount, event.target.value);
            setAmount(next);
            setLinked(null);
            const nextRate = rate();
            const euros = readNumber(next);
            if (!nextRate || euros == null) return;
            setCount(unitsFor(euros, nextRate, unit));
            setLinked("count");
          }}
        />
      </label>
      <label className="block">
        <span className="label">{unit === "hours" ? hoursLabel : lessonsLabel}</span>
        <input
          className={`field ${linked === "count" ? "is-linked" : ""}`}
          name={unit === "hours" ? "hoursAdded" : "lessonsAdded"}
          inputMode={unit === "hours" ? "decimal" : "numeric"}
          value={count}
          onChange={(event) => {
            const next = typed(count, event.target.value);
            setCount(next);
            setLinked(null);
            const nextRate = rate();
            const units = readNumber(next);
            if (!nextRate || units == null) return;
            setAmount(amountFor(units, nextRate));
            setLinked("amount");
          }}
        />
      </label>
      {shownHint ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-soft sm:col-span-2">
          <span>{shownHint}</span>
          <button
            type="button"
            className="inline-flex min-h-6 items-center rounded-full border border-ink/15 px-2 py-0.5 text-xs font-bold text-ink"
            onClick={openDeal}
          >
            {changeLabel}
          </button>
        </p>
      ) : null}
      {open
        ? createPortal(
            <div className="fixed inset-0 z-50">
              <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" aria-label={cancelLabel} onClick={() => setOpen(false)} />
              <div className="pointer-events-none relative flex h-full items-end justify-center p-3 sm:items-center sm:p-8">
                <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="rise pointer-events-auto w-full max-w-sm rounded-[28px] bg-ivory p-5 shadow-card">
                  <h2 id={titleId} className="font-display text-3xl">
                    {dealTitle}
                  </h2>
                  <p className="mt-2 text-sm text-soft">{dealLead}</p>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      aria-pressed={draftMode === "per_lesson"}
                      className={`rounded-full px-4 py-2 text-sm ${draftMode === "per_lesson" ? "bg-ink text-paper" : "bg-ivory text-ink shadow-card"}`}
                      onClick={() => setDraftMode("per_lesson")}
                    >
                      {perLessonLabel}
                    </button>
                    <button
                      type="button"
                      aria-pressed={draftMode === "per_hour"}
                      className={`rounded-full px-4 py-2 text-sm ${draftMode === "per_hour" ? "bg-ink text-paper" : "bg-ivory text-ink shadow-card"}`}
                      onClick={() => setDraftMode("per_hour")}
                    >
                      {perHourLabel}
                    </button>
                  </div>
                  <label className="mt-4 block">
                    <span className="label">{draftMode === "per_hour" ? priceHourLabel : priceLessonLabel}</span>
                    <input
                      className="field"
                      inputMode="decimal"
                      value={draftPrice}
                      onChange={(event) => setDraftPrice(event.target.value)}
                    />
                  </label>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <button type="button" className="nav-link text-sm text-ink/70" onClick={() => setOpen(false)}>
                      {cancelLabel}
                    </button>
                    <button type="button" className="btn btn-ink inline-flex min-h-10 items-center rounded-full px-4 text-sm" onClick={note}>
                      {saveLabel}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { useEscape } from "@/components/use-escape";

export type SignupCard = {
  id: string;
  name: string;
  subject: string;
  portrait: "girl" | "boy";
};

export function SignupBoard({
  cards,
  closeLabel,
  panels,
}: {
  cards: SignupCard[];
  closeLabel: string;
  panels: Record<string, ReactNode>;
}) {
  const [open, setOpen] = useState<string | null>(null);

  useEscape(open !== null, () => setOpen(null));

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((card) => (
          <li key={card.id}>
            <button
              type="button"
              onClick={() => setOpen(card.id)}
              className="flex h-full w-full flex-col rounded-[28px] bg-ivory p-3 text-left shadow-card transition hover:-translate-y-0.5"
            >
              <img
                src={card.portrait === "boy" ? "/portrait-boy.jpg" : "/portrait-girl.jpg"}
                alt=""
                width={1024}
                height={1024}
                className="aspect-square w-full rounded-[22px] object-cover object-[center_18%]"
              />
              <span className="mt-3 font-display text-2xl leading-none">{card.name}</span>
              <span className="mt-1 text-sm text-soft">{card.subject}</span>
            </button>
          </li>
        ))}
      </ul>
      {open ? (
        <div className="fixed inset-0 z-40">
          <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" aria-label={closeLabel} onClick={() => setOpen(null)} />
          <div className="pointer-events-none relative flex h-full items-end justify-center p-3 sm:items-center sm:p-8">
            <div role="dialog" aria-modal="true" className="rise pointer-events-auto max-h-[min(88vh,760px)] w-full max-w-lg overflow-y-auto rounded-[28px] bg-ivory p-5 shadow-card sm:p-7">
              <div className="mb-4 flex justify-end">
                <button type="button" className="nav-link text-sm text-ink/70" onClick={() => setOpen(null)}>
                  {closeLabel}
                </button>
              </div>
              {panels[open]}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

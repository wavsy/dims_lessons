"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Charm } from "@/components/charm";
import { PhoneLink } from "@/components/phone-link";

export type TeacherCard = {
  name: string;
  email: string;
  phone: string;
  code: string;
};

export function TeacherReveal({
  teacher,
  labels,
  className,
  children,
}: {
  teacher: TeacherCard;
  labels: { close: string; phone: string; email: string; code: string; noPhone: string };
  className: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-50">
              <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" aria-label={labels.close} onClick={() => setOpen(false)} />
              <div className="pointer-events-none relative flex h-full items-end justify-center p-3 sm:items-center sm:p-8">
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={titleId}
                  className="rise pointer-events-auto relative w-full max-w-md overflow-visible"
                >
                  <div className="rounded-[28px] bg-ivory p-6 shadow-card">
                    <div className="pr-28">
                      <p className="kicker">{labels.code}</p>
                      <h2 id={titleId} className="mt-2 font-display text-4xl">
                        {teacher.name}
                      </h2>
                      {teacher.code ? <p className="mt-2 text-sm tracking-[0.28em] text-soft">{teacher.code}</p> : null}
                    </div>
                    <dl className="mt-6">
                      <div className="flex items-baseline justify-between gap-6 border-t border-ink/10 py-3">
                        <dt className="text-sm text-soft">{labels.email}</dt>
                        <dd>
                          {teacher.email ? (
                            <a className="underline decoration-ink/30 underline-offset-4" href={`mailto:${teacher.email}`}>
                              {teacher.email}
                            </a>
                          ) : (
                            "—"
                          )}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-6 border-t border-ink/10 py-3">
                        <dt className="text-sm text-soft">{labels.phone}</dt>
                        <dd>{teacher.phone ? <PhoneLink phone={teacher.phone} /> : <span className="text-soft">{labels.noPhone}</span>}</dd>
                      </div>
                    </dl>
                    <button type="button" className="nav-link mt-4 text-sm text-ink/70" onClick={() => setOpen(false)}>
                      {labels.close}
                    </button>
                  </div>
                  <span className="teacher-lantern" aria-hidden="true">
                    <span className="charm-lights">
                      <i /><i /><i /><i /><i /><i />
                    </span>
                    <span className="charm-lights charm-lights-soft">
                      <i /><i /><i /><i />
                    </span>
                    <Charm name="lantern" live />
                  </span>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

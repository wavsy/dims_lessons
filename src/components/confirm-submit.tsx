"use client";

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEscape } from "@/components/use-escape";

export function ConfirmSubmit({
  label,
  title,
  message,
  cancel,
  className = "text-sm font-bold text-soft underline-offset-2 hover:underline",
}: {
  label: string;
  title: string;
  message: string;
  cancel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEscape(open, () => setOpen(false), 2);

  function commit() {
    const form = opener.current?.closest("form");
    setOpen(false);
    form?.requestSubmit();
  }

  return (
    <>
      <button ref={opener} type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-50">
              <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" aria-label={cancel} onClick={() => setOpen(false)} />
              <div className="pointer-events-none relative flex h-full items-end justify-center p-3 sm:items-center sm:p-8">
                <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="rise pointer-events-auto w-full max-w-sm rounded-[28px] bg-ivory p-5 shadow-card">
                  <h2 id={titleId} className="font-display text-3xl">
                    {title}
                  </h2>
                  <p className="mt-2 text-sm text-soft">{message}</p>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <button type="button" className="nav-link text-sm text-ink/70" onClick={() => setOpen(false)}>
                      {cancel}
                    </button>
                    <button type="button" className="btn btn-ink inline-flex min-h-10 items-center rounded-full px-4 text-sm" onClick={commit}>
                      {label}
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

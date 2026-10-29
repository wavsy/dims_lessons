"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

const FILM = "/video/dims-lessons-film";

export function StudioFilm() {
  const t = useTranslations("landing");
  const previewRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fullRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) preview.play().catch(() => {});
        else preview.pause();
      },
      { threshold: 0.35 },
    );
    observer.observe(preview);
    return () => observer.disconnect();
  }, []);

  function open() {
    previewRef.current?.pause();
    dialogRef.current?.showModal();
    const full = fullRef.current;
    if (full) {
      full.currentTime = 0;
      full.play().catch(() => {});
    }
  }

  function onClose() {
    fullRef.current?.pause();
  }

  return (
    <section className="film" aria-labelledby="film-title">
      <div className="film-copy">
        <p className="kicker">{t("filmKicker")}</p>
        <h2 id="film-title" className="film-title font-display">
          {t("filmTitle")}
        </h2>
      </div>
      <button type="button" className="film-photo" onClick={open} aria-label={t("play")}>
        <span className="film-tape film-tape-a" aria-hidden="true" />
        <span className="film-tape film-tape-b" aria-hidden="true" />
        <video ref={previewRef} muted loop playsInline preload="metadata" poster={`${FILM}-poster.jpg`}>
          <source src={`${FILM}.mp4`} type="video/mp4" />
        </video>
        <span className="film-play" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        </span>
        <span className="film-caption">{t("play")}</span>
      </button>

      <dialog
        ref={dialogRef}
        className="film-dialog"
        onClose={onClose}
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <video ref={fullRef} controls playsInline preload="none" poster={`${FILM}-poster.jpg`}>
          <source src={`${FILM}.mp4`} type="video/mp4" />
        </video>
        <form method="dialog">
          <button type="submit" className="film-close">
            {t("close")}
          </button>
        </form>
      </dialog>
    </section>
  );
}

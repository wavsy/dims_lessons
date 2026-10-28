"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { addLessonFeedback } from "@/lib/actions";
import { primaryButton } from "@/components/fields";
import { useEscape } from "@/components/use-escape";

export type ParentLesson = {
  id: string;
  date: string;
  meta: string;
  duration: string;
  materials: string;
  homework: string;
};

export function ParentLessons({
  clientId,
  lessons,
  labels,
}: {
  clientId: string;
  lessons: ParentLesson[];
  labels: {
    materials: string;
    homework: string;
    duration: string;
    giveFeedback: string;
    feedbackTitle: string;
    feedbackLead: string;
    feedbackSend: string;
    close: string;
  };
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const titleId = useId();
  const feedbackTitleId = useId();
  const open = lessons.find((lesson) => lesson.id === openId) ?? null;
  const feedback = lessons.find((lesson) => lesson.id === feedbackId) ?? null;

  useEscape(open !== null, () => setOpenId(null));
  useEscape(feedback !== null, () => setFeedbackId(null), 1);

  function ask(id: string) {
    setBody("");
    setFeedbackId(id);
  }

  return (
    <>
      <ul className="mt-5 space-y-3">
        {lessons.map((lesson) => (
          <li key={lesson.id} className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <button
              type="button"
              className="min-w-0 flex-1 rounded-2xl bg-ivory p-4 text-left shadow-card"
              onClick={() => setOpenId(lesson.id)}
            >
              <LessonBody lesson={lesson} labels={labels} />
            </button>
            <button type="button" className={`${primaryButton} shrink-0 self-center`} onClick={() => ask(lesson.id)}>
              {labels.giveFeedback}
            </button>
          </li>
        ))}
      </ul>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-40">
              <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" aria-label={labels.close} onClick={() => setOpenId(null)} />
              <div className="pointer-events-none relative flex h-full items-end justify-center overflow-y-auto p-3 sm:items-center sm:p-8">
                <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="rise pointer-events-auto w-full max-w-xl rounded-[28px] bg-ivory p-6 shadow-card sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-soft">{open.date}</p>
                      <h2 id={titleId} className="mt-2 font-display text-4xl">
                        {open.meta}
                      </h2>
                      <p className="mt-2 text-soft">
                        {labels.duration}: {open.duration}
                      </p>
                    </div>
                    <button type="button" className="nav-link text-sm text-ink/70" onClick={() => setOpenId(null)}>
                      {labels.close}
                    </button>
                  </div>
                  {open.materials ? (
                    <p className="mt-6 text-lg">
                      <span className="font-bold">{labels.materials}: </span>
                      {open.materials}
                    </p>
                  ) : null}
                  {open.homework ? (
                    <p className="mt-3 text-lg">
                      <span className="font-bold">{labels.homework}: </span>
                      {open.homework}
                    </p>
                  ) : null}
                  <div className="mt-8">
                    <button type="button" className={primaryButton} onClick={() => ask(open.id)}>
                      {labels.giveFeedback}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {feedback
        ? createPortal(
            <div className="fixed inset-0 z-50">
              <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" aria-label={labels.close} onClick={() => setFeedbackId(null)} />
              <div className="pointer-events-none relative flex h-full items-end justify-center p-3 sm:items-center sm:p-8">
                <form action={addLessonFeedback} role="dialog" aria-modal="true" aria-labelledby={feedbackTitleId} className="rise pointer-events-auto w-full max-w-md rounded-[28px] bg-ivory p-6 shadow-card">
                  <input type="hidden" name="clientId" value={clientId} />
                  <input type="hidden" name="lessonId" value={feedback.id} />
                  <p className="text-sm font-bold text-soft">
                    {feedback.date} · {feedback.meta}
                  </p>
                  <h2 id={feedbackTitleId} className="mt-2 font-display text-3xl">
                    {labels.feedbackTitle}
                  </h2>
                  <p className="mt-2 text-sm text-soft">{labels.feedbackLead}</p>
                  <label className="mt-4 block">
                    <span className="label">{labels.giveFeedback}</span>
                    <textarea className="field min-h-28" name="body" value={body} onChange={(event) => setBody(event.target.value)} required />
                  </label>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <button type="button" className="nav-link text-sm text-ink/70" onClick={() => setFeedbackId(null)}>
                      {labels.close}
                    </button>
                    <button type="submit" className={primaryButton} disabled={!body.trim()}>
                      {labels.feedbackSend}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function LessonBody({
  lesson,
  labels,
}: {
  lesson: ParentLesson;
  labels: { materials: string; homework: string };
}) {
  return (
    <>
      <p className="font-bold">{lesson.date}</p>
      <p className="text-sm text-soft">{lesson.meta}</p>
      {lesson.materials ? (
        <p className="mt-2 text-sm">
          <span className="font-bold">{labels.materials}: </span>
          {lesson.materials}
        </p>
      ) : null}
      {lesson.homework ? (
        <p className="mt-1 text-sm">
          <span className="font-bold">{labels.homework}: </span>
          {lesson.homework}
        </p>
      ) : null}
    </>
  );
}

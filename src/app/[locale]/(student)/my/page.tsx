import { getLocale, getTranslations } from "next-intl/server";
import { HomeworkWand } from "@/components/homework-gate";
import { EmptyState } from "@/components/empty-state";
import { TeacherReveal } from "@/components/teacher-reveal";
import { requireSession } from "@/lib/auth";
import { getStudentView } from "@/lib/db";
import { formatCode, formatDay } from "@/lib/format";
import { choiceOptions, labelOf } from "@/lib/labels";

export default async function StudentHomePage() {
  const session = await requireSession("student");
  const view = await getStudentView(session.user_id);
  const client = view?.client;
  const locale = await getLocale();
  const t = await getTranslations("studentHome");
  const options = await choiceOptions();
  const lessons = view?.lessons ?? [];
  const homework = lessons.filter((lesson) => lesson.homework.trim());
  const teacher = view?.teacher ?? null;

  if (!client) {
    return <EmptyState title={t("emptyTitle")} lead={t("emptyLead")} />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker">{t("kicker")}</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">{client.name}</h1>
          <p className="mt-2 text-soft">{t("title")}</p>
          {client.public_code ? <p className="mt-3 text-sm tracking-[0.28em] text-soft">{t("code")} {formatCode(client.public_code)}</p> : null}
        </div>
        {teacher ? (
          <TeacherReveal
            className="btn btn-ink inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium"
            teacher={{
              name: teacher.name,
              email: teacher.email,
              phone: teacher.phone.trim(),
              code: formatCode(teacher.public_code ?? ""),
            }}
            labels={{ close: t("close"), phone: t("phone"), email: t("email"), code: t("teacher"), noPhone: t("noPhone") }}
          >
            {t("teacher")}
          </TeacherReveal>
        ) : null}
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold tracking-[0.14em] text-soft uppercase">{t("todo")}</h2>
        {homework.length === 0 ? <p className="text-soft">{t("noHomework")}</p> : null}
        <ul className="space-y-3">
          {homework.slice(0, 4).map((lesson, index) => {
            const latest = index === 0;
            return (
              <li key={lesson.id} className={`${latest ? "todo-live" : "rise bg-ivory"} flex items-center gap-4 rounded-2xl p-4 shadow-card`}>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-soft">{formatDay(lesson.occurred_on, locale)}</span>
                  <span className="mt-1 block text-lg font-bold">{lesson.homework}</span>
                </span>
                {latest ? <HomeworkWand homework={lesson.homework} /> : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold tracking-[0.14em] text-soft uppercase">{t("history")}</h2>
        {lessons.length === 0 ? <EmptyState title={t("emptyTitle")} lead={t("emptyLead")} /> : null}
        <ul className="space-y-3">
          {lessons.map((lesson) => (
            <li key={lesson.id} className="rounded-2xl bg-ivory p-4 shadow-card">
              <p className="font-bold">
                {formatDay(lesson.occurred_on, locale)}
                {lesson.duration_hours ? ` · ${t("hours", { count: lesson.duration_hours })}` : ""}
              </p>
              <p className="text-sm text-soft">
                {labelOf(options.subjects, lesson.subject)} · {labelOf(options.platforms, lesson.platform)} ·{" "}
                {labelOf(options.locations, lesson.location)}
              </p>
              {lesson.materials ? (
                <p className="mt-2 text-sm">
                  <span className="font-bold">{t("materials")}: </span>
                  {lesson.materials}
                </p>
              ) : null}
              {lesson.homework ? (
                <p className="mt-1 text-sm">
                  <span className="font-bold">{t("homework")}: </span>
                  {lesson.homework}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

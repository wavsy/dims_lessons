import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { BookMark } from "@/components/book-mark";
import { ErrorBanner } from "@/components/error-banner";
import { ParentLessons } from "@/components/parent-lessons";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { getClient, listLessons, parentLinkedTo } from "@/lib/db";
import { formatDay } from "@/lib/format";
import { choiceOptions, labelOf } from "@/lib/labels";

export default async function ChildPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await getSession();
  if (!session || session.role !== "parent" || !(await parentLinkedTo(session.user_id, id))) notFound();
  const client = await getClient(id);
  if (!client) notFound();

  const locale = await getLocale();
  const t = await getTranslations("parent");
  const options = await choiceOptions();
  const lessons = await listLessons(client.id);

  return (
    <div>
      <Link href="/family" className="text-sm font-bold text-soft">
        {t("title")}
      </Link>
      <div className="spell-cameo">
        <BookMark />
      </div>
      <h1 className="font-display text-4xl">{client.name}</h1>
      <p className="mt-2 text-soft">{t("readOnly")}</p>
      {client.school || client.grade ? (
        <p className="mt-2 text-sm">
          {[client.school, client.grade].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      <div className="mt-4">
        <ErrorBanner code={query.error} />
      </div>
      {query.saved === "1" ? <p className="mt-3 text-sm font-bold text-sage">{t("feedbackSaved")}</p> : null}
      {lessons.length === 0 ? <p className="mt-6 text-soft">{t("noLessons")}</p> : null}
      {lessons.length > 0 ? (
        <ParentLessons
          clientId={client.id}
          lessons={lessons.map((lesson) => ({
            id: lesson.id,
            date: formatDay(lesson.occurred_on, locale),
            meta: `${labelOf(options.subjects, lesson.subject)} · ${labelOf(options.platforms, lesson.platform)} · ${labelOf(options.locations, lesson.location)}`,
            duration: t("hours", { count: lesson.duration_hours }),
            materials: lesson.materials,
            homework: lesson.homework,
          }))}
          labels={{
            materials: t("materials"),
            homework: t("homework"),
            duration: t("duration"),
            giveFeedback: t("giveFeedback"),
            feedbackTitle: t("feedbackTitle"),
            feedbackLead: t("feedbackLead"),
            feedbackSend: t("feedbackSend"),
            close: t("close"),
          }}
        />
      ) : null}
    </div>
  );
}

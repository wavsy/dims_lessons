import { getLocale, getTranslations } from "next-intl/server";
import { FeedbackBoard, type FeedbackTicket } from "@/components/feedback-board";
import { listFeedbackNotes, listFeedbackRequests } from "@/lib/db";
import { formatDay, lessonWhen } from "@/lib/format";
import { choiceOptions, labelOf } from "@/lib/labels";

export default async function TeacherFeedbackPage() {
  const t = await getTranslations("feedback");
  const locale = await getLocale();
  const options = await choiceOptions();
  const notes = await listFeedbackNotes();
  const aboutLesson = (note: (typeof notes)[number]) => {
    const when = lessonWhen(note.lesson_on, note.lesson_subject, locale, (value) => labelOf(options.subjects, value));
    return when ? t("aboutLesson", { when }) : "";
  };
  const requests = await listFeedbackRequests();
  const requestTickets = requests.map((request) => ({
    id: request.id,
    kind: "request",
    who: request.parent_name ?? "",
    about: request.client_name ?? "",
    title: request.open_question,
    body: request.open_answer,
    date: formatDay(request.created_at, locale),
    mood: request.status === "answered" ? request.overall : null,
    scores:
      request.status === "answered"
        ? [
            { label: t("pace"), value: request.pace ?? 3 },
            { label: t("following"), value: request.following_score ?? 3 },
            { label: t("homework"), value: request.homework_score ?? 3 },
          ]
        : [],
    archived: request.archived === 1,
    waiting: request.status !== "answered",
  }));

  const noteTickets = notes.map((note) => ({
    id: note.id,
    kind: "note",
    who: note.parent_name,
    about: note.client_name ?? "",
    lesson: aboutLesson(note),
    title: note.body,
    body: "",
    date: formatDay(note.created_at, locale),
    mood: null,
    scores: [],
    archived: note.archived === 1,
    waiting: false,
  }));

  const pending = requestTickets.filter((ticket) => ticket.waiting && !ticket.archived);
  const received = [
    ...requestTickets.filter((ticket) => !ticket.waiting && !ticket.archived),
    ...noteTickets.filter((ticket) => !ticket.archived),
  ];
  const archived = [...requestTickets, ...noteTickets].filter((ticket) => ticket.archived);

  return (
    <div>
      <p className="kicker">{t("kicker")}</p>
      <h1 className="mt-2 mb-6 font-display text-4xl sm:text-5xl">{t("title")}</h1>
      <FeedbackBoard
        pending={pending.map(strip)}
        received={received.map(strip)}
        archived={archived.map(strip)}
        empty={{ title: t("emptyTitle"), lead: t("emptyLead") }}
        pendingEmpty={{ title: t("pendingEmptyTitle"), lead: t("pendingEmptyLead") }}
        labels={{
          pending: t("pending"),
          received: t("received"),
          archive: t("archive"),
          archiveAction: t("archiveAction"),
          restore: t("restore"),
          restoreAsk: t("restoreAsk"),
          restoreLead: t("restoreLead"),
          archiveAsk: t("archiveAsk"),
          archiveLead: t("archiveLead"),
          cancel: t("cancel"),
        }}
      />
    </div>
  );
}

function strip(ticket: {
  id: string;
  kind: string;
  who: string;
  about: string;
  lesson?: string;
  title: string;
  body: string;
  date: string;
  mood: number | null;
  scores: { label: string; value: number }[];
}): FeedbackTicket {
  return { ...ticket, kind: ticket.kind === "note" ? "note" : "request" };
}

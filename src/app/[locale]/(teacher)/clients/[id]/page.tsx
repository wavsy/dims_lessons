import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ClientBoard, type PanelId, type StatusTone, type WidgetModel } from "@/components/client-board";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ErrorBanner } from "@/components/error-banner";
import { Area, butterButton, Field, primaryButton, SelectField } from "@/components/fields";
import { LessonRecords } from "@/components/lesson-records";
import { PhoneLink } from "@/components/phone-link";
import { StudentFeedback, type FeedbackItem } from "@/components/student-feedback";
import { StudentProfile } from "@/components/student-profile";
import { PaymentSuggest } from "@/components/payment-suggest";
import { PaymentTotal } from "@/components/payment-total";
import { SavePaymentButton } from "@/components/save-payment";
import { Link } from "@/i18n/navigation";
import {
  addPayment,
  archiveStudent,
  linkParentAction,
  linkParentByCode,
  unlinkParentAction,
  logDetailedLesson,
  markSelfPayer,
  removePayment,
  removeStudent,
  restoreStudent,
  savePin,
  saveProfile,
  sendFeedbackRequest,
} from "@/lib/actions";
import { getSession } from "@/lib/auth";
import {
  getClient,
  getTeacherById,
  listFeedbackRequests,
  listLessons,
  listNotesForClient,
  listParentsOfClient,
  listPayments,
} from "@/lib/db";
import { formatCode, formatDay, formatMoney, lessonWhen, todayISO } from "@/lib/format";
import { packFigure } from "@/lib/stats";
import { choiceOptions, labelOf } from "@/lib/labels";

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; edit?: string; panel?: string; paid?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await getSession();
  const client = await getClient(id);
  if (!client || client.teacher_id !== session?.user_id) notFound();

  const teacher = (await getTeacherById(session.user_id))!;
  const locale = await getLocale();
  const t = await getTranslations("client");
  const feedback = await getTranslations("feedback");
  const settings = await getTranslations("settings");
  const status = await getTranslations("status");
  const options = await choiceOptions();
  const lessons = await listLessons(client.id);
  const payments = await listPayments(client.id);
  const parents = await listParentsOfClient(client.id);
  const notes = await listNotesForClient(client.id);
  const requests = (await listFeedbackRequests()).filter((request) => request.client_id === client.id);
  const money = (cents: number) => formatMoney(cents, teacher.currency, locale);
  const price = (client.price_cents / 100).toFixed(2);
  const meta = [
    labelOf(options.subjects, client.subject_default),
    labelOf(options.platforms, client.platform_default),
    labelOf(options.locations, client.location_default),
  ].join(" · ");
  const latestLesson = lessons[0];
  const feedbackItems = feedbackFeed(requests, notes, locale, feedback, (note) => {
    const when = lessonWhen(note.lesson_on, note.lesson_subject, locale, (value) => labelOf(options.subjects, value));
    return when ? feedback("aboutLesson", { when }) : "";
  });
  const currentFeedback = feedbackItems.filter((item) => !item.archived);
  const archivedFeedback = feedbackItems.filter((item) => item.archived);
  const latestFeedback = currentFeedback.find((item) => !item.waiting) ?? currentFeedback[0];
  const standing = standingWidget(client.billing_mode, client.stats, {
    balance: t("widgetBalance"),
    settled: status("settled"),
    lessonOver: t("lessonOver"),
    lessonsOver: t("lessonsOver"),
    hourOver: t("hourOver"),
    hoursOver: t("hoursOver"),
    lessonLeft: t("lessonLeft"),
    lessonsLeft: t("lessonsLeft"),
    hourLeft: t("hourLeft"),
    hoursLeft: t("hoursLeft"),
  });
  const profileBits = [labelOf(options.kinds, client.kind), client.school, client.grade].filter(Boolean).join(" · ");
  const portrait = client.portrait === "boy" ? "boy" : "girl";
  const profileFacts = [
    { label: t("code"), value: client.public_code ? formatCode(client.public_code) : "—" },
    { label: t("kind"), value: labelOf(options.kinds, client.kind) },
    { label: t("subject"), value: labelOf(options.subjects, client.subject_default) },
    { label: t("platform"), value: labelOf(options.platforms, client.platform_default) },
    { label: t("place"), value: labelOf(options.locations, client.location_default) },
    { label: t("billing"), value: labelOf(options.billing, client.billing_mode) },
    { label: client.billing_mode === "per_hour" ? t("priceHour") : t("price"), value: money(client.price_cents) },
    { label: t("portrait"), value: portrait === "boy" ? t("boy") : t("girl") },
    ...(client.school ? [{ label: t("school"), value: client.school }] : []),
    ...(client.grade ? [{ label: t("grade"), value: client.grade }] : []),
    ...(client.interests ? [{ label: t("interests"), value: client.interests }] : []),
    ...(client.ambitions ? [{ label: t("ambitions"), value: client.ambitions }] : []),
    { label: t("pin"), value: client.pin_set ? t("pinSet") : t("pinOff") },
  ];

  const widgets: WidgetModel[] = [
    {
      id: "lesson",
      panel: "lesson",
      label: t("widgetLesson"),
      figure: latestLesson ? formatDay(latestLesson.occurred_on, locale) : "—",
      caption: latestLesson ? "" : t("noLessons"),
      meta: latestLesson
        ? [
            t("hours", { count: latestLesson.duration_hours || 1 }),
            labelOf(options.subjects, latestLesson.subject),
            latestLesson.platform ? labelOf(options.platforms, latestLesson.platform) : "",
            latestLesson.location ? labelOf(options.locations, latestLesson.location) : "",
          ]
            .filter(Boolean)
            .join(" · ")
        : undefined,
      lines: latestLesson
        ? [
            { label: t("materials"), value: latestLesson.materials.trim() || " - " },
            { label: t("homework"), value: latestLesson.homework.trim() || " - ", emphasis: true },
          ]
        : undefined,
      tone: "feature",
      size: "hero",
      display: "stat",
    },
    {
      id: "standing",
      panel: "payments",
      label: standing.label,
      figure: standing.figure,
      caption: standing.caption,
      detail:
        (client.billing_mode === "per_lesson" || client.billing_mode === "per_hour") && client.price_cents === 0
          ? t("setPrice")
          : undefined,
      tone: "blush",
      size: "wide",
      display: "stat",
      status: standing.status,
    },
    {
      id: "lessons",
      panel: "lessons",
      label: t("widgetLessons"),
      figure: String(lessons.length),
      caption: latestLesson ? latestLesson.materials || latestLesson.homework || formatDay(latestLesson.occurred_on, locale) : t("noLessons"),
      tone: "plain",
      size: "wide",
      display: "stat",
    },
    {
      id: "profile",
      panel: "profile",
      label: t("widgetProfile"),
      figure: money(client.price_cents),
      caption: labelOf(options.billing, client.billing_mode),
      detail: profileBits || undefined,
      notes: [client.pin_set ? t("pinSet") : t("pinOff")],
      tone: "plain",
      size: "wide",
      display: "stat",
    },
    {
      id: "parents",
      panel: "parents",
      label: t("widgetParents"),
      figure: parents.length === 1 ? parents[0].name : String(parents.length),
      caption:
        parents.length === 0
          ? t("noParents")
          : parents.length === 1 && client.pays_self
            ? t("paysSelf")
            : parents.length === 1
              ? parents[0].email.endsWith("@lessons.local")
                ? formatCode(parents[0].public_code)
                : parents[0].email
              : parents.map((parent) => parent.name).join(", "),
      tone: "plain",
      size: "tile",
      display: parents.length === 1 ? "story" : "stat",
    },
    {
      id: "feedback",
      panel: "feedback",
      label: t("widgetFeedback"),
      figure: latestFeedback ? excerpt(latestFeedback.title) : t("noNotes"),
      caption: latestFeedback ? `${latestFeedback.who} · ${latestFeedback.date}` : parents.length === 0 ? t("needParent") : "",
      tone: "plain",
      size: "tile",
      display: latestFeedback ? "story" : "stat",
    },
  ];

  const titles: Record<PanelId, string> = {
    lesson: t("details"),
    payments: t("receive"),
    lessons: t("history"),
    profile: t("profile"),
    parents: t("parents"),
    feedback: t("widgetFeedback"),
  };

  const notice = (
    <div className="mb-4 space-y-3">
      <ErrorBanner code={query.error} />
      {query.saved === "1" ? <p className="text-sm font-bold text-sage">{settings("saved")}</p> : null}
    </div>
  );

  return (
    <div>
      <Link href="/today" className="text-sm text-soft">
        {t("back")}
      </Link>
      <header className="mt-3 mb-6">
        <h1 className="font-display text-4xl sm:text-5xl">{client.name}</h1>
        <p className="mt-1 text-soft">{meta}</p>
        {client.public_code ? <p className="mt-3 text-sm tracking-[0.28em] text-soft">{formatCode(client.public_code)}</p> : null}
        {client.status === "archived" ? <p className="mt-3 text-sm font-semibold">{t("archived")}</p> : null}
      </header>
      <ClientBoard
        widgets={widgets}
        titles={titles}
        closeLabel={t("close")}
        initialPanel={query.edit === "profile" ? "profile" : isPanel(query.panel) ? query.panel : panelForError(query.error)}
        notice={notice}
        panels={{
          lesson: (
            <div className="space-y-6">
              {latestLesson ? (
                <div className="rounded-3xl bg-paper px-4 py-3">
                  <p className="font-bold">
                    {formatDay(latestLesson.occurred_on, locale)} · {t("hours", { count: latestLesson.duration_hours || 1 })}
                  </p>
                  <p className="text-sm text-soft">
                    {labelOf(options.subjects, latestLesson.subject)}
                    {latestLesson.platform ? ` · ${labelOf(options.platforms, latestLesson.platform)}` : ""}
                    {latestLesson.location ? ` · ${labelOf(options.locations, latestLesson.location)}` : ""}
                  </p>
                  <p className="mt-2 text-sm">
                    <span className="text-soft">{t("materials")}. </span>
                    {latestLesson.materials.trim() || " - "}
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    <span className="font-normal text-soft">{t("homework")}. </span>
                    {latestLesson.homework.trim() || " - "}
                  </p>
                </div>
              ) : (
                <p className="text-soft">{t("noLessons")}</p>
              )}
            <form action={logDetailedLesson} className="grid gap-4">
              <input type="hidden" name="clientId" value={client.id} />
              <input type="hidden" name="kind" value={client.kind} />
              <input type="hidden" name="billing" value={client.billing_mode} />
              <Field label={t("date")} name="date" type="date" defaultValue={todayISO()} required />
              <Field label={t("duration")} name="duration" defaultValue="1" inputMode="decimal" />
              <SelectField label={t("subject")} name="subject" defaultValue={client.subject_default} options={options.subjects} />
              <SelectField label={t("platform")} name="platform" defaultValue={client.platform_default} options={options.platforms} />
              <SelectField label={t("place")} name="location" defaultValue={client.location_default} options={options.locations} />
              <Area label={t("materials")} name="materials" placeholder={t("materialsEmpty")} />
              <Area label={t("homework")} name="homework" placeholder={t("homeworkEmpty")} />
              <div className="justify-self-start">
                <button className={primaryButton} type="submit">
                  {t("log")}
                </button>
              </div>
            </form>
            </div>
          ),
          payments: (
            <div className="space-y-6">
              <form action={addPayment} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="clientId" value={client.id} />
                <Field label={t("date")} name="date" type="date" defaultValue={todayISO()} required />
                <PaymentSuggest
                  clientId={client.id}
                  priceCents={client.price_cents}
                  billingMode={client.billing_mode}
                  amountLabel={t("amount")}
                  lessonsLabel={t("lessonsAdded")}
                  hoursLabel={t("hoursAdded")}
                  priceLessonLabel={t("price")}
                  priceHourLabel={t("priceHour")}
                  hintLesson={t("suggestLesson", { price: "@@" })}
                  hintHour={t("suggestHour", { price: "@@" })}
                  locale={locale}
                  currency={teacher.currency}
                  changeLabel={t("changeDeal")}
                  dealTitle={t("dealTitle")}
                  dealLead={t("dealLead")}
                  perLessonLabel={labelOf(options.billing, "per_lesson")}
                  perHourLabel={labelOf(options.billing, "per_hour")}
                  saveLabel={t("dealSave")}
                  cancelLabel={t("cancel")}
                />
                <div className="justify-self-start sm:col-span-2">
                  <SavePaymentButton label={t("savePayment")} celebrate={query.paid === "1"} />
                </div>
              </form>
              <div>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-2xl">{t("payments")}</h3>
                  <PaymentTotal label={t("total")} amount={money(client.stats.paidCents)} />
                </div>
                {payments.length === 0 ? <p className="text-soft">{t("noPayments")}</p> : null}
                <RecordList>
                  {payments.map((payment) => (
                    <li key={payment.id} className="flex items-center justify-between gap-3 rounded-3xl bg-paper px-4 py-3">
                      <div>
                        <p className="font-bold">{formatDay(payment.paid_on, locale)}</p>
                        <p className="text-sm text-soft">
                          {money(payment.amount_cents)}
                          {payment.hours_added ? ` · ${t("addedHours", { count: payment.hours_added })}` : ""}
                          {payment.lessons_added ? ` · ${t("addedLessons", { count: payment.lessons_added })}` : ""}
                        </p>
                      </div>
                      <form action={removePayment}>
                        <input type="hidden" name="paymentId" value={payment.id} />
                        <ConfirmSubmit label={t("remove")} title={t("removeAsk")} message={t("removeConfirm")} cancel={t("cancel")} />
                      </form>
                    </li>
                  ))}
                </RecordList>
              </div>
            </div>
          ),
          lessons: (
            <LessonRecords
              lessons={lessons.map((lesson) => ({
                id: lesson.id,
                occurredOn: lesson.occurred_on,
                duration: String(lesson.duration_hours || 1),
                subject: lesson.subject,
                platform: lesson.platform || client.platform_default,
                location: lesson.location || client.location_default,
                materials: lesson.materials,
                homework: lesson.homework,
                title: `${formatDay(lesson.occurred_on, locale)} · ${t("hours", { count: lesson.duration_hours || 1 })}`,
                meta: `${labelOf(options.subjects, lesson.subject)} · ${labelOf(options.platforms, lesson.platform)} · ${labelOf(options.locations, lesson.location)}`,
              }))}
              subjects={options.subjects}
              platforms={options.platforms}
              places={options.locations}
              emptyLabel={t("noLessons")}
              labels={{
                edit: t("editLesson"),
                save: t("saveLesson"),
                cancel: t("cancel"),
                remove: t("remove"),
                removeAsk: t("removeAsk"),
                removeConfirm: t("removeConfirm"),
                date: t("date"),
                duration: t("duration"),
                subject: t("subject"),
                platform: t("platform"),
                place: t("place"),
                materials: t("materials"),
                homework: t("homework"),
                materialsPlaceholder: t("materialsEmpty"),
                homeworkPlaceholder: t("homeworkEmpty"),
              }}
            />
          ),
          profile: (
            <div>
            <StudentProfile
              portrait={portrait}
              name={client.name}
              facts={profileFacts}
              editLabel={settings("edit")}
              cancelLabel={settings("cancel")}
              startEditing={query.edit === "profile"}
              footer={
                <>
                  {client.status === "archived" ? (
                    <form action={restoreStudent}>
                      <input type="hidden" name="clientId" value={client.id} />
                      <ConfirmSubmit
                        label={t("restoreStudent")}
                        title={t("restoreAsk")}
                        message={t("restoreLead")}
                        cancel={t("cancel")}
                        className="text-sm font-bold"
                      />
                    </form>
                  ) : (
                    <form action={archiveStudent}>
                      <input type="hidden" name="clientId" value={client.id} />
                      <ConfirmSubmit
                        label={t("archiveStudent")}
                        title={t("archiveAsk")}
                        message={t("archiveLead")}
                        cancel={t("cancel")}
                        className="text-sm font-bold"
                      />
                    </form>
                  )}
                  <form action={removeStudent}>
                    <input type="hidden" name="clientId" value={client.id} />
                    <ConfirmSubmit label={t("removeStudent")} title={t("removeAsk")} message={t("removeStudentConfirm")} cancel={t("cancel")} />
                  </form>
                </>
              }
            >
              <form action={saveProfile} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="clientId" value={client.id} />
                <Field label={t("name")} name="name" defaultValue={client.name} required />
                <SelectField label={t("kind")} name="kind" defaultValue={client.kind} options={options.kinds} />
                <SelectField label={t("subject")} name="subject" defaultValue={client.subject_default} options={options.subjects} />
                <SelectField label={t("platform")} name="platform" defaultValue={client.platform_default} options={options.platforms} />
                <SelectField label={t("place")} name="location" defaultValue={client.location_default} options={options.locations} />
                <Field
                  label={client.billing_mode === "per_hour" ? t("priceHour") : t("price")}
                  name="price"
                  defaultValue={price}
                  inputMode="decimal"
                />
                <SelectField label={t("billing")} name="billing" defaultValue={client.billing_mode} options={options.billing} />
                <SelectField
                  label={t("portrait")}
                  name="portrait"
                  defaultValue={portrait}
                  options={[
                    { value: "girl", label: t("girl") },
                    { value: "boy", label: t("boy") },
                  ]}
                />
                <Field label={t("school")} name="school" defaultValue={client.school} />
                <Field label={t("grade")} name="grade" defaultValue={client.grade} />
                <div className="sm:col-span-2">
                  <Area label={t("interests")} name="interests" defaultValue={client.interests} />
                </div>
                <div className="sm:col-span-2">
                  <Area label={t("ambitions")} name="ambitions" defaultValue={client.ambitions} />
                </div>
                <div className="justify-self-start sm:col-span-2">
                  <button className={primaryButton} type="submit">
                    {t("saveProfile")}
                  </button>
                </div>
              </form>
            </StudentProfile>
            <form action={savePin} className="mt-8 grid gap-4 border-t border-ink/10 pt-6">
              <h3 className="font-display text-2xl">{t("pin")}</h3>
              <p className="text-sm text-soft">{t("pinHint")}</p>
              <input type="hidden" name="clientId" value={client.id} />
              <Field label={t("pin")} name="pin" inputMode="numeric" />
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="clearPin" />
                {t("clearPin")}
              </label>
              <div className="justify-self-start">
                <button className={butterButton} type="submit">
                  {t("savePin")}
                </button>
              </div>
            </form>
            </div>
          ),
          parents: (
            <div className="space-y-6">
              {client.pays_self ? (
                <div className="rounded-3xl bg-peach px-4 py-3">
                  <p className="font-bold">{t("paysSelf")}</p>
                  <p className="mt-1 text-sm tracking-[0.2em] text-soft">{formatCode(client.public_code)}</p>
                </div>
              ) : (
                <form action={markSelfPayer}>
                  <input type="hidden" name="clientId" value={client.id} />
                  <button className={butterButton} type="submit">
                    {t("markSelf")}
                  </button>
                </form>
              )}
              {parents.length === 0 ? <p className="text-soft">{t("noParents")}</p> : null}
              <RecordList>
                {parents.map((parent) => (
                    <li key={parent.id} className="flex items-start justify-between gap-3 rounded-3xl bg-paper px-4 py-3">
                      <div>
                        <p className="font-bold">{parent.name}</p>
                        <p className="text-sm tracking-[0.16em] text-soft">{formatCode(parent.public_code)}</p>
                        {parent.email.endsWith("@lessons.local") ? null : <p className="text-sm text-soft">{parent.email}</p>}
                        {parent.phone ? (
                          <p className="text-sm">
                            <PhoneLink phone={parent.phone} />
                          </p>
                        ) : null}
                        {parent.occupation ? <p className="text-sm">{parent.occupation}</p> : null}
                        {parent.social ? <p className="text-sm">{parent.social}</p> : null}
                      </div>
                      <RemoveParent clientId={client.id} parentId={parent.id} t={t} />
                    </li>
                  ))}
              </RecordList>
              <section className="rounded-[28px] border border-ink/10 bg-blush/50 p-4">
                <h3 className="font-display text-2xl">{t("linkAnother")}</h3>
                <p className="mt-1 mb-4 text-sm text-soft">{t("linkAnotherLead")}</p>
                <form action={linkParentByCode} className="grid gap-4">
                  <input type="hidden" name="clientId" value={client.id} />
                  <Field label={t("linkCode")} name="code" hint={t("linkCodeHint")} inputMode="numeric" />
                  <div className="justify-self-start">
                    <button className={primaryButton} type="submit">
                      {t("link")}
                    </button>
                  </div>
                </form>
                <div className="mt-6 border-t border-ink/10 pt-5">
                  <h3 className="mb-3 font-display text-2xl">{t("addParent")}</h3>
                  <form action={linkParentAction} className="grid gap-4 sm:grid-cols-2">
                    <input type="hidden" name="clientId" value={client.id} />
                    <Field label={t("parentName")} name="parentName" />
                    <Field label={t("parentEmail")} name="parentEmail" type="email" />
                    <Field label={t("parentPhone")} name="parentPhone" type="tel" />
                    <Field label={t("parentSocial")} name="parentSocial" />
                    <Field label={t("parentOccupation")} name="parentOccupation" />
                    <div className="justify-self-start sm:col-span-2">
                      <button className={primaryButton} type="submit">
                        {t("link")}
                      </button>
                    </div>
                  </form>
                </div>
              </section>
            </div>
          ),
          feedback: (
            <StudentFeedback
              items={currentFeedback}
              archived={archivedFeedback}
              back={`/clients/${client.id}`}
              labels={{
                request: t("requestFeedback"),
                archive: t("feedbackArchive"),
                latest: t("feedbackLatest"),
                empty: t("noNotes"),
                archiveEmpty: t("feedbackArchiveEmpty"),
                waiting: feedback("waiting"),
                archiveAction: feedback("archiveAction"),
                restore: feedback("restore"),
                archiveAsk: feedback("archiveAsk"),
                archiveLead: feedback("archiveLead"),
                restoreAsk: feedback("restoreAsk"),
                restoreLead: feedback("restoreLead"),
                cancel: feedback("cancel"),
              }}
              request={
                parents.length === 0 ? (
                  <p className="text-soft">{t("needParent")}</p>
                ) : (
                  <form action={sendFeedbackRequest} className="grid gap-4 rounded-[28px] bg-paper p-4">
                    <input type="hidden" name="clientId" value={client.id} />
                    <SelectField
                      label={feedback("parentLabel")}
                      name="parentId"
                      defaultValue={parents[0]?.id}
                      options={parents.map((parent) => ({ value: parent.id, label: parent.name }))}
                    />
                    <Area label={t("question")} name="question" defaultValue={feedback("defaultQuestion")} />
                    <div className="justify-self-start">
                      <button className={primaryButton} type="submit">
                        {t("sendRequest")}
                      </button>
                    </div>
                  </form>
                )
              }
            />
          ),
        }}
      />
    </div>
  );
}

function RemoveParent({
  clientId,
  parentId,
  t,
}: {
  clientId: string;
  parentId: string;
  t: (key: "remove" | "removeParentAsk" | "removeParentLead" | "cancel") => string;
}) {
  return (
    <form action={unlinkParentAction} className="shrink-0">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="parentId" value={parentId} />
      <ConfirmSubmit label={t("remove")} title={t("removeParentAsk")} message={t("removeParentLead")} cancel={t("cancel")} />
    </form>
  );
}

function RecordList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <ul className={`space-y-3 ${className}`}>{children}</ul>;
}

function excerpt(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 110) return clean;
  return `${clean.slice(0, 110).trim()}…`;
}

function panelForError(error?: string): PanelId | null {
  if (error === "invalidAmount") return "payments";
  if (error === "invalidPin") return "profile";
  if (error === "unknownCode") return "parents";
  return null;
}

function standingWidget(
  billingMode: string,
  stats: Parameters<typeof packFigure>[1],
  copy: {
    balance: string;
    settled: string;
    lessonOver: string;
    lessonsOver: string;
    hourOver: string;
    hoursOver: string;
    lessonLeft: string;
    lessonsLeft: string;
    hourLeft: string;
    hoursLeft: string;
  },
): { label: string; figure: string; caption: string; status: StatusTone } {
  const pack = packFigure(billingMode, stats);
  const one = pack.count === 1;
  const caption =
    pack.kind === "over"
      ? pack.unit === "hours"
        ? one
          ? copy.hourOver
          : copy.hoursOver
        : one
          ? copy.lessonOver
          : copy.lessonsOver
      : pack.kind === "left"
        ? pack.unit === "hours"
          ? one
            ? copy.hourLeft
            : copy.hoursLeft
          : one
            ? copy.lessonLeft
            : copy.lessonsLeft
        : copy.settled;
  return { label: copy.balance, figure: String(pack.count), caption, status: pack.tone };
}

const panels = ["lesson", "payments", "lessons", "profile", "parents", "feedback"] as const;

function isPanel(value?: string): value is PanelId {
  return panels.some((panel) => panel === value);
}

function feedbackFeed(
  requests: Awaited<ReturnType<typeof listFeedbackRequests>>,
  notes: Awaited<ReturnType<typeof listNotesForClient>>,
  locale: string,
  feedback: (key: "pace" | "following" | "homework" | "overall", values?: Record<string, string | number>) => string,
  aboutLesson: (note: Awaited<ReturnType<typeof listNotesForClient>>[number]) => string,
): (FeedbackItem & { archived: boolean; sort: string })[] {
  const fromRequests = requests.map((request) => ({
    id: request.id,
    kind: "request" as const,
    who: request.parent_name ?? "",
    date: formatDay(request.answered_at || request.created_at, locale),
    sort: request.answered_at || request.created_at,
    title: request.open_question,
    body: request.open_answer,
    waiting: request.status !== "answered",
    archived: request.archived === 1,
    scores:
      request.status === "answered"
        ? [
            { label: feedback("pace"), value: request.pace ?? 3 },
            { label: feedback("following"), value: request.following_score ?? 3 },
            { label: feedback("homework"), value: request.homework_score ?? 3 },
            { label: feedback("overall"), value: request.overall ?? 3 },
          ]
        : [],
  }));
  const fromNotes = notes.map((note) => ({
    id: note.id,
    kind: "note" as const,
    who: note.parent_name,
    date: formatDay(note.created_at, locale),
    sort: note.created_at,
    lesson: aboutLesson(note),
    title: note.body,
    body: "",
    waiting: false,
    archived: note.archived === 1,
    scores: [],
  }));
  return [...fromRequests, ...fromNotes].sort((a, b) => {
    if (a.waiting !== b.waiting) return a.waiting ? 1 : -1;
    return b.sort.localeCompare(a.sort);
  });
}

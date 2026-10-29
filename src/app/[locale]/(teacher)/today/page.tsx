import { getLocale, getTranslations } from "next-intl/server";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { EmptyState } from "@/components/empty-state";
import { primaryButton } from "@/components/fields";
import { LessonButton } from "@/components/lesson-button";
import { StatusLine } from "@/components/pack-dot";
import { Link } from "@/i18n/navigation";
import { restoreStudent } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { listClients } from "@/lib/db";
import { choiceOptions, labelOf } from "@/lib/labels";
import { describePack, type Tone } from "@/lib/stats";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const query = await searchParams;
  const archived = query.view === "archive";
  const session = await requireSession("teacher");
  // The teacher's id is session.user_id, so the clients load straight away
  const [locale, t, clientCopy, common, status, options, rows] = await Promise.all([
    getLocale(),
    getTranslations("today"),
    getTranslations("client"),
    getTranslations("common"),
    getTranslations("status"),
    choiceOptions(),
    listClients(session.user_id, archived ? "archived" : "active"),
  ]);
  const clients = rows.sort((a, b) => {
    const left = packRank(describePack(a.billing_mode, a.stats, packText(status)).tone);
    const right = packRank(describePack(b.billing_mode, b.stats, packText(status)).tone);
    if (left !== right) return left - right;
    return a.name.localeCompare(b.name, locale);
  });

  return (
    <div>
      <p className="kicker">{t("kicker")}</p>
      <div className="mt-2 mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl sm:text-5xl">{t("title")}</h1>
        <div className="flex items-center gap-4">
          <Link href={archived ? "/today" : "/today?view=archive"} className="nav-link text-sm text-ink/70">
            {archived ? t("active") : t("archive")}
          </Link>
          {archived ? null : (
            <Link className={primaryButton} href="/clients/new">
              {t("add")}
            </Link>
          )}
        </div>
      </div>
      {archived ? <p className="mb-4 text-sm font-semibold text-soft">{t("archive")}</p> : null}
      {clients.length === 0 ? (
        <EmptyState title={archived ? t("emptyArchive") : t("emptyTitle")} lead={archived ? t("emptyArchiveLead") : t("emptyLead")} />
      ) : (
        <ul className="space-y-3">
          {clients.map((client, index) => {
            const described = describePack(client.billing_mode, client.stats, packText(status));
            return (
              <li
                key={client.id}
                className="rise flex flex-col gap-4 rounded-2xl bg-ivory p-4 shadow-card sm:flex-row sm:items-center"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <Link href={`/clients/${client.id}`} className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-bold">{client.name}</h2>
                  <p className="text-sm text-soft">
                    {labelOf(options.subjects, client.subject_default)} · {labelOf(options.platforms, client.platform_default)} ·{" "}
                    {labelOf(options.locations, client.location_default)}
                  </p>
                  <StatusLine text={described.text} tone={described.tone} />
                </Link>
                {archived ? (
                  <form action={restoreStudent}>
                    <input type="hidden" name="clientId" value={client.id} />
                    <ConfirmSubmit
                      label={t("restore")}
                      title={clientCopy("restoreAsk")}
                      message={clientCopy("restoreLead")}
                      cancel={clientCopy("cancel")}
                      className={primaryButton}
                    />
                  </form>
                ) : (
                  <LessonButton
                    clientId={client.id}
                    label={t("lesson")}
                    savedLabel={t("saved")}
                    title={t("lengthTitle")}
                    lead={t("lengthLead")}
                    otherLabel={t("otherLength")}
                    hoursLabel={t("hoursLabel")}
                    saveLabel={t("lesson")}
                    closeLabel={clientCopy("close")}
                    platformLabel={clientCopy("platform")}
                    placeLabel={clientCopy("place")}
                    materialsLabel={clientCopy("materials")}
                    homeworkLabel={clientCopy("homework")}
                    materialsPlaceholder={clientCopy("materialsEmpty")}
                    homeworkPlaceholder={clientCopy("homeworkEmpty")}
                    optionalLabel={common("optional")}
                    platforms={options.platforms}
                    places={options.locations}
                    defaultPlatform={client.platform_default}
                    defaultPlace={client.location_default}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function packText(status: Awaited<ReturnType<typeof getTranslations<"status">>>) {
  return (key: string, values?: Record<string, string | number>) => status(key as "settled", values as never);
}

function packRank(tone: Tone) {
  if (tone === "empty") return 0;
  if (tone === "low") return 1;
  if (tone === "ok") return 2;
  return 3;
}

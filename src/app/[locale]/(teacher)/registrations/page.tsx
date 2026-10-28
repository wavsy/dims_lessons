import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { EmptyState } from "@/components/empty-state";
import { ErrorBanner } from "@/components/error-banner";
import { butterButton, primaryButton } from "@/components/fields";
import { InviteLink } from "@/components/invite-link";
import { PhoneLink } from "@/components/phone-link";
import { SignupBoard } from "@/components/signup-board";
import { acceptParentRequest, acceptRegistration, declineParentRequest, declineRegistration } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { getTeacherById, listPendingParentRequests, listPendingRegistrations } from "@/lib/db";
import { formatCode } from "@/lib/format";
import { choiceOptions, labelOf } from "@/lib/labels";

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await requireSession("teacher");
  const teacher = await getTeacherById(session.user_id);
  const t = await getTranslations("signups");
  const client = await getTranslations("client");
  const options = await choiceOptions();
  const rows = await listPendingRegistrations();
  const parentRequests = await listPendingParentRequests();
  const panels = Object.fromEntries(
    rows.map((row) => [
      row.id,
      <div key={row.id}>
        <img
          src={row.portrait === "boy" ? "/portrait-boy.jpg" : "/portrait-girl.jpg"}
          alt=""
          width={1024}
          height={1024}
          className="mb-4 aspect-[4/3] w-full rounded-[22px] object-cover object-[center_18%]"
        />
        <h2 className="font-display text-4xl">{row.child_name}</h2>
        <p className="mt-1 text-soft">{labelOf(options.subjects, row.subject)}</p>
        <dl className="mt-6">
          <Fact label={t("child")} value={row.child_name} />
          <Fact label={client("subject")} value={labelOf(options.subjects, row.subject)} />
          <Fact label={client("school")} value={row.school || "—"} />
          <Fact label={client("grade")} value={row.grade || "—"} />
          <Fact label={client("interests")} value={row.interests || "—"} />
          <Fact label={client("ambitions")} value={row.ambitions || "—"} />
          <Fact label={t("parent")} value={row.parent_name} />
          <Fact label={client("parentEmail")} value={row.parent_email} />
          <Fact label={client("parentPhone")} value={row.parent_phone ? <PhoneLink phone={row.parent_phone} /> : "—"} />
          <Fact label={client("parentOccupation")} value={row.parent_occupation || "—"} />
          <Fact label={client("parentSocial")} value={row.parent_social || "—"} />
        </dl>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <form action={acceptRegistration}>
            <input type="hidden" name="id" value={row.id} />
            <button className={primaryButton} type="submit">
              {t("accept")}
            </button>
          </form>
          <form action={declineRegistration}>
            <input type="hidden" name="id" value={row.id} />
            <ConfirmSubmit
              label={t("decline")}
              title={t("declineAsk")}
              message={t("declineLead")}
              cancel={client("cancel")}
              className={butterButton}
            />
          </form>
        </div>
      </div>,
    ]),
  );

  return (
    <div>
      <p className="kicker">{t("kicker")}</p>
      <div className="mt-2 mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl sm:text-5xl">{t("title")}</h1>
        {teacher?.public_code ? (
          <InviteLink code={formatCode(teacher.public_code)} label={t("invite")} copiedLabel={t("inviteCopied")} />
        ) : null}
      </div>
      <p className="-mt-4 mb-6 max-w-md text-sm text-soft">{t("inviteLead")}</p>
      <ErrorBanner code={error} />
      {rows.length === 0 && parentRequests.length === 0 ? (
        <EmptyState title={t("emptyTitle")} lead={t("emptyLead")} />
      ) : null}
      {rows.length > 0 ? (
        <SignupBoard
          closeLabel={client("close")}
          cards={rows.map((row) => ({
            id: row.id,
            name: row.child_name,
            subject: labelOf(options.subjects, row.subject),
            portrait: row.portrait === "boy" ? "boy" : "girl",
          }))}
          panels={panels}
        />
      ) : null}
      {parentRequests.length > 0 ? (
        <section className="mt-8 space-y-4">
          <h2 className="font-display text-3xl">{t("otherParent")}</h2>
          <p className="max-w-md text-sm text-soft">{t("otherParentLead")}</p>
          <ul className="space-y-4">
            {parentRequests.map((request) => (
              <li key={request.id} className="rounded-[28px] bg-ivory p-5 shadow-card">
                <h3 className="font-display text-3xl">{request.name}</h3>
                <p className="mt-1 text-soft">{request.email}</p>
                <p className="mt-3 text-sm">{t("forStudent", { name: request.client_name })}</p>
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <form action={acceptParentRequest}>
                    <input type="hidden" name="id" value={request.id} />
                    <button className={primaryButton} type="submit">
                      {t("accept")}
                    </button>
                  </form>
                  <form action={declineParentRequest}>
                    <input type="hidden" name="id" value={request.id} />
                    <ConfirmSubmit
                      label={t("decline")}
                      title={t("declineAsk")}
                      message={t("declineLead")}
                      cancel={client("cancel")}
                      className={butterButton}
                    />
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-t border-ink/10 py-3">
      <dt className="text-sm text-soft">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

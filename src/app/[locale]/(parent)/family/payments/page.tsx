import { getLocale, getTranslations } from "next-intl/server";
import { ChestGate } from "@/components/chest-gate";
import { EmptyState } from "@/components/empty-state";
import { requireSession } from "@/lib/auth";
import { getTeacher, listPaymentsForParent } from "@/lib/db";
import { formatDay, formatMoney } from "@/lib/format";

export default async function ParentPaymentsPage() {
  const session = await requireSession("parent");
  const teacher = await getTeacher();
  const locale = await getLocale();
  const t = await getTranslations("parent");
  const payments = await listPaymentsForParent(session.user_id);
  const money = (cents: number) => formatMoney(cents, teacher?.currency ?? "EUR", locale);

  return (
    <div>
      <div className="charm-host">
        <div className="max-w-[34rem] pr-28">
          <p className="kicker">{t("paymentsKicker")}</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">{t("paymentsTitle")}</h1>
          <p className="mt-2 text-soft">{t("paymentsLead")}</p>
        </div>
        <ChestGate />
      </div>
      {payments.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={t("paymentsEmpty")} lead={t("paymentsEmptyLead")} />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {payments.map((payment) => (
            <li key={payment.id} className="rounded-2xl bg-ivory p-4 shadow-card">
              <p className="font-bold">{formatDay(payment.paid_on, locale)}</p>
              <p className="text-sm text-soft">{payment.client_name}</p>
              <p className="mt-2 text-lg">
                {money(payment.amount_cents)}
                {payment.hours_added ? ` · ${t("addedHours", { count: payment.hours_added })}` : ""}
                {payment.lessons_added ? ` · ${t("addedLessons", { count: payment.lessons_added })}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

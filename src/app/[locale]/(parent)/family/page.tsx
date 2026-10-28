import { getLocale, getTranslations } from "next-intl/server";
import { Charm } from "@/components/charm";
import { EmptyState } from "@/components/empty-state";
import { StatusLine } from "@/components/pack-dot";
import { TeacherReveal } from "@/components/teacher-reveal";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/auth";
import { getParentById, getTeacher, listClientsOfParent } from "@/lib/db";
import { formatCode, formatMoney } from "@/lib/format";
import { choiceOptions, labelOf } from "@/lib/labels";
import { describeStats } from "@/lib/stats";

export default async function FamilyPage() {
  const session = await requireSession("parent");
  const teacher = await getTeacher();
  const locale = await getLocale();
  const t = await getTranslations("parent");
  const status = await getTranslations("status");
  const options = await choiceOptions();
  const parent = await getParentById(session.user_id);
  const children = await listClientsOfParent(session.user_id);
  const money = (cents: number) => formatMoney(cents, teacher?.currency ?? "EUR", locale);
  const phone = teacher?.phone?.trim() ?? "";

  return (
    <div>
      <p className="kicker">{t("kicker")}</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">{t("title")}</h1>
      <p className="mt-2 text-soft">{t("readOnly")}</p>
      {parent?.public_code ? <p className="mt-3 text-sm tracking-[0.28em] text-soft">{t("code")} {formatCode(parent.public_code)}</p> : null}

      {teacher ? (
        <div className="charm-host mt-8">
          <TeacherReveal
            className="enchanted enchanted-edge flex w-full items-center gap-4 rounded-2xl p-5 pr-24 text-left shadow-card"
            teacher={{
              name: teacher.name,
              email: teacher.email,
              phone,
              code: formatCode(teacher.public_code ?? ""),
            }}
            labels={{ close: t("close"), phone: t("phone"), email: t("email"), code: t("teacher"), noPhone: t("noPhone") }}
          >
            <span className="min-w-0 flex-1">
              <span className="text-sm font-bold text-soft">{t("teacher")}</span>
              <span className="mt-1 block font-display text-3xl">{teacher.name}</span>
              {phone ? <span className="mt-3 block text-sm text-soft">{phone}</span> : <span className="mt-2 block text-sm text-soft">{t("noPhone")}</span>}
            </span>
          </TeacherReveal>
          <Charm name="lantern" play className="charm-seat charm-seat-lantern" />
        </div>
      ) : null}

      {children.length === 0 ? (
        <div className="mt-5">
          <EmptyState title={t("emptyTitle")} lead={t("emptyLead")} />
        </div>
      ) : (
        <ul className="mt-6 space-y-8">
          {children.map((child) => {
            const described = describeStats(child.stats, (key, values) => status(key as "leftOne", values as never), money);
            return (
              <li key={child.id} className="charm-host">
                <Link href={`/family/${child.id}`} className="enchanted enchanted-edge flex items-center gap-4 rounded-2xl p-4 pr-24 shadow-card">
                  <span className="min-w-0 flex-1">
                    <span className="block text-xl font-bold">{child.name}</span>
                    <span className="block text-sm text-soft">
                      {labelOf(options.subjects, child.subject_default)} · {labelOf(options.locations, child.location_default)}
                    </span>
                    <StatusLine text={described.text} tone={described.tone} />
                  </span>
                </Link>
                <Charm name="book" play className="charm-seat charm-seat-book" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

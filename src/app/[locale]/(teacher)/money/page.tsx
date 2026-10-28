import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PhoneLink } from "@/components/phone-link";
import { StatusLine } from "@/components/pack-dot";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/auth";
import { getTeacherById, listClients, listParentsOfClient } from "@/lib/db";
import { formatCode } from "@/lib/format";
import { describePack, packFigure } from "@/lib/stats";

export default async function MoneyPage() {
  const session = await requireSession("teacher");
  const teacher = (await getTeacherById(session.user_id))!;
  const locale = await getLocale();
  const t = await getTranslations("money");
  const clientCopy = await getTranslations("client");
  const status = await getTranslations("status");
  const clients = await listClients(teacher.id);
  const cards = (
    await Promise.all(
      clients.map(async (client) => {
        const pack = packFigure(client.billing_mode, client.stats);
        const described = describePack(client.billing_mode, client.stats, (key, values) =>
          status(key as "leftOne", values as never),
        );
        return { client, pack, described, parents: await listParentsOfClient(client.id) };
      }),
    )
  ).filter(({ pack }) => pack.kind === "over" || (pack.kind === "left" && pack.count <= 2));

  return (
    <div>
      <p className="kicker">{t("kicker")}</p>
      <h1 className="mt-2 mb-6 font-display text-4xl sm:text-5xl">{t("title")}</h1>
      {cards.length === 0 ? (
        <EmptyState title={t("emptyTitle")} lead={t("emptyLead")} />
      ) : (
        <ul className="space-y-4">
          {cards.map(({ client, described, parents }) => (
            <li key={client.id} className="rise rounded-[28px] bg-ivory p-5 shadow-card">
              <Link href={`/clients/${client.id}`} className="block">
                <h2 className="font-display text-3xl">{client.name}</h2>
              </Link>
              <StatusLine text={described.text} tone={described.tone} />
              {client.pays_self ? <p className="mt-2 text-sm text-soft">{clientCopy("paysSelf")}</p> : null}
              <p className="mt-4 text-sm font-bold tracking-[0.14em] text-soft uppercase">{t("reach")}</p>
              {parents.length === 0 ? <p className="mt-2 text-sm text-soft">{t("noPayer")}</p> : null}
              <ul className="mt-3 space-y-3">
                {parents.map((parent) => {
                  const email = parent.email.endsWith("@lessons.local") ? "" : parent.email;
                  return (
                    <li key={parent.id} className="rounded-3xl bg-paper px-4 py-3">
                      <p className="font-bold">{parent.name}</p>
                      <p className="text-sm text-soft">{t("payer")}</p>
                      {parent.public_code ? <p className="mt-1 text-sm tracking-[0.16em] text-soft">{formatCode(parent.public_code)}</p> : null}
                      {parent.phone ? (
                        <p className="mt-2 text-sm">
                          <PhoneLink phone={parent.phone} />
                        </p>
                      ) : null}
                      {email ? (
                        <p className="mt-1 text-sm">
                          <a className="underline decoration-ink/30 underline-offset-4" href={`mailto:${email}`}>
                            {email}
                          </a>
                        </p>
                      ) : null}
                      {parent.social ? <p className="mt-1 text-sm">{parent.social}</p> : null}
                      {!parent.phone && !email && !parent.social ? <p className="mt-2 text-sm text-soft">{t("noContact")}</p> : null}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

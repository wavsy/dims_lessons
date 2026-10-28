import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Shell } from "@/components/shell";
import { getSession, homeFor, passwordStillNeeded } from "@/lib/auth";

export default async function ParentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getSession();
  if (!session) {
    redirect({ href: "/login", locale });
    throw new Error("Redirect failed");
  }
  if (session.role !== "parent") {
    redirect({ href: homeFor(session.role), locale });
    throw new Error("Redirect failed");
  }
  if (await passwordStillNeeded()) {
    redirect({ href: "/account/password", locale });
    throw new Error("Redirect failed");
  }
  const t = await getTranslations("nav");

  return (
    <Shell
      homeHref="/family"
      signOutLabel={t("signOut")}
      items={[
        { href: "/family", label: t("home"), match: "exact" },
        { href: "/family/feedback", label: t("feedback"), match: "exact" },
        { href: "/family/payments", label: t("payments"), match: "exact" },
      ]}
    >
      {children}
    </Shell>
  );
}

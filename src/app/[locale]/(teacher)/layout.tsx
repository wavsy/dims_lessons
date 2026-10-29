import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Shell } from "@/components/shell";
import { getSession, homeFor } from "@/lib/auth";
import { openRequestCount, pendingParentRequestCount, pendingRegistrationCount } from "@/lib/db";

export default async function TeacherLayout({
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
  if (session.role !== "teacher") {
    redirect({ href: homeFor(session.role), locale });
    throw new Error("Redirect failed");
  }

  const [t, registrations, parentRequests, feedback] = await Promise.all([
    getTranslations("nav"),
    pendingRegistrationCount(),
    pendingParentRequestCount(),
    openRequestCount(),
  ]);
  const signups = registrations + parentRequests;

  return (
    <Shell
      homeHref="/today"
      signOutLabel={t("signOut")}
      items={[
        { href: "/today", label: t("today"), match: "exact" },
        { href: "/money", label: t("money"), match: "exact" },
        { href: "/registrations", label: t("signups"), match: "exact", badge: signups },
        { href: "/feedback", label: t("feedback"), match: "exact", badge: feedback },
        { href: "/settings", label: t("settings"), match: "exact" },
      ]}
    >
      {children}
    </Shell>
  );
}

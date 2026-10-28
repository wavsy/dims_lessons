import { getTranslations } from "next-intl/server";
import { ErrorBanner } from "@/components/error-banner";
import { SettingsView } from "@/components/settings-view";
import { formatCode } from "@/lib/format";
import { requireSession } from "@/lib/auth";
import { getTeacherById } from "@/lib/db";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  const session = await requireSession("teacher");
  const teacher = (await getTeacherById(session.user_id))!;
  const t = await getTranslations("settings");
  const hasNotice = Boolean(error || saved === "1");

  return (
    <SettingsView
      teacher={{
        name: teacher.name,
        email: teacher.email,
        phone: teacher.phone,
        currency: teacher.currency,
        code: formatCode(teacher.public_code ?? ""),
      }}
      startEditing={Boolean(error)}
      notice={
        hasNotice ? (
          <div className="mt-4">
            <ErrorBanner code={error} />
            {saved === "1" ? <p className="text-sm font-bold text-sage">{t("saved")}</p> : null}
          </div>
        ) : null
      }
    />
  );
}

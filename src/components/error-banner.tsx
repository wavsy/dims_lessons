import { getTranslations } from "next-intl/server";

const keys = ["required", "emailTaken", "invalidAmount", "invalidPin", "unknownCode", "short"] as const;

export async function ErrorBanner({ code }: { code?: string }) {
  if (!code || !keys.includes(code as (typeof keys)[number])) return null;
  const t = await getTranslations("errors");
  return (
    <p className="mb-4 rounded-2xl bg-butter px-4 py-3 text-sm font-bold">
      {t(code as (typeof keys)[number])}
    </p>
  );
}

import "server-only";
import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { mintPublicCode, type Parent } from "./db";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";

type ProfileRow = {
  id: string;
  role: "teacher" | "parent";
  name: string;
  email: string;
  phone: string;
  social: string;
  occupation: string;
  locale: string;
  public_code: string | null;
  created_at: string;
};

function asParent(row: ProfileRow): Parent {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? "",
    social: row.social ?? "",
    occupation: row.occupation ?? "",
    locale: row.locale || "en",
    public_code: row.public_code ?? "",
  };
}

export async function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  if (!host) return "http://localhost:3000";
  return `${proto}://${host}`;
}

async function findUserId(email: string) {
  const admin = createAdminClient();
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return found.id;
    if (data.users.length < 200) return undefined;
  }
  return undefined;
}

export async function ensureProfile(user: User) {
  const admin = createAdminClient();
  const { data: existing, error } = await admin.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (existing) return existing as ProfileRow;

  const email = user.email?.toLowerCase();
  if (!email) return null;
  const teacherEmail = process.env.TEACHER_EMAIL?.trim().toLowerCase();
  const asTeacher = Boolean(teacherEmail && email === teacherEmail);
  const asParent = user.user_metadata?.role === "parent";
  if (!asTeacher && !asParent) return null;

  const { data, error: insertError } = await admin
    .from("profiles")
    .insert({
      id: user.id,
      role: asTeacher ? "teacher" : "parent",
      name: String(user.user_metadata?.name || email.split("@")[0]),
      email,
      public_code: await mintPublicCode(),
    })
    .select("*")
    .single();
  if (insertError) throw new Error(insertError.message);
  return data as ProfileRow;
}

export async function inviteParent(input: {
  name: string;
  email: string;
  phone: string;
  social: string;
  occupation: string;
  locale: string;
}): Promise<Parent> {
  const email = input.email.trim().toLowerCase();
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin.from("profiles").select("*").eq("email", email).maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing?.role === "teacher") throw new Error("email_taken");
  if (existing?.role === "parent") {
    const { error } = await admin
      .from("profiles")
      .update({
        name: input.name || existing.name,
        phone: input.phone || existing.phone,
        social: input.social || existing.social,
        occupation: input.occupation || existing.occupation,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return asParent({ ...existing, name: input.name || existing.name } as ProfileRow);
  }

  const origin = await siteOrigin();
  const redirectTo = `${origin}/${input.locale === "bg" ? "bg" : "en"}/auth/confirm`;
  const metadata = { role: "parent", name: input.name, must_set_password: true };
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: metadata });
  let userId = data.user?.id;
  if (error || !userId) {
    userId = await findUserId(email);
    if (!userId) throw new Error(error?.message || "Could not invite this parent.");
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, { user_metadata: metadata });
    if (updateError) throw new Error(updateError.message);
    const supabase = await createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (resetError) throw new Error(resetError.message);
  }

  const { data: created, error: insertError } = await admin
    .from("profiles")
    .insert({
      id: userId,
      role: "parent",
      name: input.name || email,
      email,
      phone: input.phone,
      social: input.social,
      occupation: input.occupation,
      locale: input.locale === "bg" ? "bg" : "en",
      public_code: await mintPublicCode(),
    })
    .select("*")
    .single();
  if (insertError) throw new Error(insertError.message);
  return asParent(created as ProfileRow);
}

import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { ensureProfile } from "./accounts";
import { readStudentSession, type Role } from "./db";
import { createClient } from "./supabase/server";

export const STUDENT_COOKIE = "dl_student";

export type Session = {
  id: string;
  role: Role;
  user_id: string;
  created_at: string;
  expires_at: string;
};

function missingConfig(error: unknown) {
  return error instanceof Error && error.message.includes("are not set");
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const studentId = jar.get(STUDENT_COOKIE)?.value;
  if (studentId) {
    try {
      const row = await readStudentSession(studentId);
      if (row) {
        return { id: row.id, role: "student", user_id: row.client_id, created_at: "", expires_at: row.expires_at };
      }
    } catch (error) {
      if (!missingConfig(error)) throw error;
    }
  }

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    const profile = await ensureProfile(data.user);
    if (!profile || (profile.role !== "teacher" && profile.role !== "parent")) return null;
    return {
      id: data.user.id,
      role: profile.role,
      user_id: profile.id,
      created_at: profile.created_at ?? "",
      expires_at: "",
    };
  } catch (error) {
    if (missingConfig(error)) return null;
    throw error;
  }
}

export async function passwordStillNeeded() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return Boolean(data.user?.user_metadata?.must_set_password);
  } catch (error) {
    if (missingConfig(error)) return false;
    throw error;
  }
}

export async function requireSession(role: Role): Promise<Session> {
  const session = await getSession();
  const locale = await getLocale();
  if (!session) {
    redirect({ href: "/login", locale });
    throw new Error("Redirect failed");
  }
  if (session.role !== role) {
    redirect({ href: homeFor(session.role), locale });
    throw new Error("Redirect failed");
  }
  return session;
}

export function homeFor(role: Role) {
  if (role === "teacher") return "/today";
  if (role === "parent") return "/family";
  return "/my";
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
  secure: process.env.NODE_ENV === "production",
};

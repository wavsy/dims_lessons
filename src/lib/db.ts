import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";
import { summarize, type Stats } from "./stats";

export type Role = "teacher" | "parent" | "student";

export type Teacher = {
  id: string;
  name: string;
  email: string;
  phone: string;
  currency: string;
  locale: string;
  public_code: string;
};

export type Parent = {
  id: string;
  name: string;
  email: string;
  phone: string;
  social: string;
  occupation: string;
  locale: string;
  public_code: string;
};

export type Client = {
  id: string;
  teacher_id: string;
  name: string;
  kind: string;
  subject_default: string;
  platform_default: string;
  location_default: string;
  price_cents: number;
  billing_mode: string;
  school: string;
  grade: string;
  interests: string;
  ambitions: string;
  status: string;
  public_code: string;
  portrait: string;
  pays_self: number;
  pin_set: boolean;
  created_at: string;
};

export type ClientCard = Client & { stats: Stats };

export type Lesson = {
  id: string;
  client_id: string;
  occurred_on: string;
  subject: string;
  platform: string;
  location: string;
  materials: string;
  homework: string;
  duration_hours: number;
  created_at: string;
};

export type Payment = {
  id: string;
  client_id: string;
  paid_on: string;
  amount_cents: number;
  lessons_added: number;
  hours_added: number;
  created_at: string;
};

export type Registration = {
  id: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  parent_social: string;
  parent_occupation: string;
  child_name: string;
  school: string;
  grade: string;
  interests: string;
  ambitions: string;
  subject: string;
  portrait: string;
  pays_self: number;
  status: string;
  created_at: string;
};

export type FeedbackNote = {
  id: string;
  parent_id: string;
  client_id: string | null;
  lesson_id: string | null;
  body: string;
  created_at: string;
  archived: number;
  parent_name: string;
  client_name: string | null;
  lesson_on: string | null;
  lesson_subject: string | null;
};

export type FeedbackRequest = {
  id: string;
  parent_id: string;
  client_id: string | null;
  teacher_id: string;
  open_question: string;
  status: string;
  pace: number | null;
  following_score: number | null;
  homework_score: number | null;
  overall: number | null;
  open_answer: string;
  created_at: string;
  answered_at: string | null;
  archived: number;
  parent_name?: string;
  client_name?: string | null;
};

export type ParentRequest = {
  id: string;
  client_id: string;
  name: string;
  email: string;
  status: string;
  created_at: string;
  client_name: string;
};

export type StudentView = {
  client: { id: string; name: string; public_code: string; teacher_id: string };
  lessons: Lesson[];
  teacher: Teacher | null;
};

type ProfileRow = {
  id: string;
  role: "teacher" | "parent";
  name: string;
  email: string;
  phone: string;
  social: string;
  occupation: string;
  currency: string;
  locale: string;
  public_code: string | null;
  created_at: string;
};

type ClientRow = Omit<Client, "pays_self" | "pin_set" | "public_code"> & {
  public_code: string | null;
  pays_self: boolean;
};

type AccessError = "unknownCode" | "emailTaken" | "required";

const noteSelect =
  "id, parent_id, client_id, lesson_id, body, created_at, archived, parent:profiles!feedback_notes_parent_id_fkey(name), client:clients(name), lesson:lessons!feedback_notes_lesson_id_fkey(occurred_on, subject)";

const requestSelect =
  "id, parent_id, client_id, teacher_id, open_question, status, pace, following_score, homework_score, overall, open_answer, created_at, answered_at, archived, parent:profiles!feedback_requests_parent_id_fkey(name), client:clients(name)";

function raise(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export function accessError(error: { message: string } | null): AccessError | null {
  if (!error) return null;
  if (error.message.includes("unknown_code")) return "unknownCode";
  if (error.message.includes("email_taken")) return "emailTaken";
  if (error.message.includes("invalid")) return "required";
  return null;
}

function oneRel<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function asTeacher(row: ProfileRow): Teacher {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? "",
    currency: row.currency || "EUR",
    locale: row.locale || "en",
    public_code: row.public_code ?? "",
  };
}

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

function asClient(row: ClientRow, pinSet = false): Client {
  return {
    ...row,
    public_code: row.public_code ?? "",
    price_cents: Number(row.price_cents),
    pays_self: row.pays_self ? 1 : 0,
    pin_set: pinSet,
  };
}

function asLesson(row: Lesson): Lesson {
  return { ...row, duration_hours: Number(row.duration_hours) || 1 };
}

function asPayment(row: Payment): Payment {
  return {
    ...row,
    amount_cents: Number(row.amount_cents),
    lessons_added: Number(row.lessons_added),
    hours_added: Number(row.hours_added) || 0,
  };
}

async function userDb() {
  return createClient();
}

export async function mintPublicCode() {
  const admin = createAdminClient();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    if (code === "000000") continue;
    const [{ count: profiles }, { count: clients }] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("public_code", code),
      admin.from("clients").select("id", { count: "exact", head: true }).eq("public_code", code),
    ]);
    if (!profiles && !clients) return code;
  }
  throw new Error("Could not mint a code");
}

async function hasPin(clientId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("student_pins").select("client_id").eq("client_id", clientId).maybeSingle();
  raise(error);
  return Boolean(data);
}

async function withStats(clients: Client[]): Promise<ClientCard[]> {
  if (!clients.length) return [];
  const db = await userDb();
  const ids = clients.map((client) => client.id);
  const [{ data: lessons, error: lessonError }, { data: payments, error: paymentError }] = await Promise.all([
    db.from("lessons").select("client_id, duration_hours").in("client_id", ids),
    db.from("payments").select("client_id, amount_cents, lessons_added, hours_added").in("client_id", ids),
  ]);
  raise(lessonError);
  raise(paymentError);
  return clients.map((client) => {
    const ownLessons = (lessons ?? []).filter((row) => row.client_id === client.id);
    const ownPayments = (payments ?? []).filter((row) => row.client_id === client.id);
    return {
      ...client,
      stats: summarize(
        client.billing_mode,
        client.price_cents,
        ownLessons.length,
        ownPayments.reduce((sum, row) => sum + Number(row.amount_cents || 0), 0),
        ownPayments.reduce((sum, row) => sum + Number(row.lessons_added || 0), 0),
        ownLessons.reduce((sum, row) => sum + Number(row.duration_hours || 0), 0),
        ownPayments.reduce((sum, row) => sum + Number(row.hours_added || 0), 0),
      ),
    };
  });
}

export async function getProfileRow(id: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("profiles").select("*").eq("id", id).maybeSingle();
  raise(error);
  return (data as ProfileRow | null) ?? undefined;
}

export async function getTeacher() {
  const db = await userDb();
  const { data, error } = await db.from("profiles").select("*").eq("role", "teacher").limit(1);
  raise(error);
  const row = (data?.[0] ?? null) as ProfileRow | null;
  return row ? asTeacher(row) : undefined;
}

export async function getTeacherById(id: string) {
  const db = await userDb();
  const { data, error } = await db.from("profiles").select("*").eq("id", id).eq("role", "teacher").maybeSingle();
  raise(error);
  return data ? asTeacher(data as ProfileRow) : undefined;
}

export async function getTeacherByEmail(email: string) {
  const db = await userDb();
  const { data, error } = await db.from("profiles").select("*").eq("role", "teacher").eq("email", email.trim().toLowerCase()).maybeSingle();
  raise(error);
  return data ? asTeacher(data as ProfileRow) : undefined;
}

export async function updateTeacher(id: string, input: Pick<Teacher, "name" | "email" | "phone" | "currency">) {
  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.updateUserById(id, {
    email: input.email,
    email_confirm: true,
  });
  if (authError) throw new Error(authError.message);
  const db = await userDb();
  const { error } = await db
    .from("profiles")
    .update({ name: input.name, email: input.email, phone: input.phone, currency: input.currency })
    .eq("id", id);
  raise(error);
}

export async function updateTeacherLocale(id: string, locale: string) {
  const db = await userDb();
  const { error } = await db.from("profiles").update({ locale }).eq("id", id);
  raise(error);
}

export async function getParentById(id: string) {
  const db = await userDb();
  const { data, error } = await db.from("profiles").select("*").eq("id", id).eq("role", "parent").maybeSingle();
  raise(error);
  return data ? asParent(data as ProfileRow) : undefined;
}

export async function getParentByCode(code: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("profiles").select("*").eq("role", "parent").eq("public_code", code).maybeSingle();
  raise(error);
  return data ? asParent(data as ProfileRow) : undefined;
}

export async function updateParentLocale(id: string, locale: string) {
  const db = await userDb();
  const { error } = await db.from("profiles").update({ locale }).eq("id", id);
  raise(error);
}

export async function emailTaken(email: string, except?: { role: "teacher" | "parent"; id: string }) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("profiles").select("id").eq("email", email.trim().toLowerCase()).maybeSingle();
  raise(error);
  if (!data) return false;
  return !(except && except.id === data.id);
}

export async function linkParent(clientId: string, parentId: string) {
  const db = await userDb();
  const { error } = await db.from("client_parents").upsert(
    { client_id: clientId, parent_id: parentId },
    { onConflict: "client_id,parent_id", ignoreDuplicates: true },
  );
  raise(error);
}

export async function unlinkParent(clientId: string, parentId: string) {
  const db = await userDb();
  const { error } = await db.from("client_parents").delete().eq("client_id", clientId).eq("parent_id", parentId);
  raise(error);
}

export async function parentLinkedTo(parentId: string, clientId: string) {
  const db = await userDb();
  const { data, error } = await db.from("client_parents").select("client_id").eq("parent_id", parentId).eq("client_id", clientId).maybeSingle();
  raise(error);
  return Boolean(data);
}

export async function listClients(teacherId: string, status: "active" | "archived" = "active") {
  const db = await userDb();
  const { data, error } = await db.from("clients").select("*").eq("teacher_id", teacherId).eq("status", status).order("name");
  raise(error);
  return withStats((data ?? []).map((row) => asClient(row as ClientRow)));
}

export async function setClientStatus(id: string, status: "active" | "archived") {
  const db = await userDb();
  const { error } = await db.from("clients").update({ status }).eq("id", id);
  raise(error);
}

export async function deleteClient(id: string) {
  const db = await userDb();
  const { error } = await db.from("clients").delete().eq("id", id);
  raise(error);
}

export async function getClient(id: string) {
  const db = await userDb();
  const { data, error } = await db.from("clients").select("*").eq("id", id).maybeSingle();
  raise(error);
  if (!data) return undefined;
  const [card] = await withStats([asClient(data as ClientRow, await hasPin(id))]);
  return card;
}

export async function insertClient(input: {
  teacherId: string;
  name: string;
  kind: string;
  subject: string;
  platform: string;
  location: string;
  priceCents: number;
  billingMode: string;
  school: string;
  grade: string;
  interests: string;
  ambitions: string;
  portrait?: string;
  paysSelf?: boolean;
}) {
  const db = await userDb();
  const { data, error } = await db
    .from("clients")
    .insert({
      teacher_id: input.teacherId,
      name: input.name,
      kind: input.kind,
      subject_default: input.subject,
      platform_default: input.platform,
      location_default: input.location,
      price_cents: input.priceCents,
      billing_mode: input.billingMode,
      school: input.school,
      grade: input.grade,
      interests: input.interests,
      ambitions: input.ambitions,
      status: "active",
      public_code: await mintPublicCode(),
      portrait: input.portrait === "boy" ? "boy" : "girl",
      pays_self: Boolean(input.paysSelf),
    })
    .select("id")
    .single();
  raise(error);
  if (!data) throw new Error("Could not save the student.");
  return data.id as string;
}

export async function setClientDeal(id: string, priceCents: number, billingMode: string) {
  const db = await userDb();
  const { error } = await db.from("clients").update({ price_cents: priceCents, billing_mode: billingMode }).eq("id", id);
  raise(error);
}

export async function updateClient(
  id: string,
  input: {
    name: string;
    kind: string;
    subject: string;
    platform: string;
    location: string;
    priceCents: number;
    billingMode: string;
    school: string;
    grade: string;
    interests: string;
    ambitions: string;
    portrait: string;
  },
) {
  const db = await userDb();
  const { error } = await db
    .from("clients")
    .update({
      name: input.name,
      kind: input.kind,
      subject_default: input.subject,
      platform_default: input.platform,
      location_default: input.location,
      price_cents: input.priceCents,
      billing_mode: input.billingMode,
      school: input.school,
      grade: input.grade,
      interests: input.interests,
      ambitions: input.ambitions,
      portrait: input.portrait === "boy" ? "boy" : "girl",
    })
    .eq("id", id);
  raise(error);
}

export async function markPaysForSelf(clientId: string) {
  const db = await userDb();
  const { error } = await db.from("clients").update({ pays_self: true }).eq("id", clientId);
  raise(error);
}

export async function setStudentPin(clientId: string, pin: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  const admin = createAdminClient();
  const { error } = await admin.from("student_pins").upsert({ client_id: clientId, pin_hash: hash, pin_salt: salt });
  raise(error);
}

export async function clearStudentPin(clientId: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("student_pins").delete().eq("client_id", clientId);
  raise(error);
}

export async function matchStudent(name: string, pin: string) {
  const wanted = name.trim().toLowerCase();
  if (!wanted || !/^\d{4,6}$/.test(pin)) return undefined;
  const admin = createAdminClient();
  const { data: clients, error } = await admin.from("clients").select("id, name").eq("status", "active");
  raise(error);
  const ids = (clients ?? []).filter((client) => String(client.name).trim().toLowerCase() === wanted).map((client) => client.id as string);
  if (!ids.length) return undefined;
  const { data: pins, error: pinError } = await admin.from("student_pins").select("client_id, pin_hash, pin_salt").in("client_id", ids);
  raise(pinError);
  const matches = (pins ?? []).filter((row) => {
    const next = scryptSync(pin, row.pin_salt, 32);
    const prev = Buffer.from(row.pin_hash, "hex");
    if (next.length !== prev.length) return false;
    return timingSafeEqual(next, prev);
  });
  return matches.length === 1 ? { id: matches[0].client_id as string } : undefined;
}

export async function createStudentSession(clientId: string) {
  const admin = createAdminClient();
  const id = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await admin.from("student_sessions").insert({ id, client_id: clientId, expires_at: expiresAt });
  raise(error);
  return { id, expires_at: expiresAt };
}

export async function readStudentSession(id: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("student_sessions").select("id, client_id, expires_at").eq("id", id).maybeSingle();
  raise(error);
  if (!data) return undefined;
  if (data.expires_at <= new Date().toISOString()) {
    await admin.from("student_sessions").delete().eq("id", id);
    return undefined;
  }
  return data as { id: string; client_id: string; expires_at: string };
}

export async function deleteStudentSession(id: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("student_sessions").delete().eq("id", id);
  raise(error);
}

export async function getStudentView(clientId: string): Promise<StudentView | undefined> {
  const admin = createAdminClient();
  const { data: client, error } = await admin
    .from("clients")
    .select("id, teacher_id, name, public_code, status")
    .eq("id", clientId)
    .eq("status", "active")
    .maybeSingle();
  raise(error);
  if (!client) return undefined;
  const [{ data: lessons, error: lessonError }, { data: teacher, error: teacherError }] = await Promise.all([
    admin
      .from("lessons")
      .select("id, client_id, occurred_on, subject, platform, location, materials, homework, duration_hours, created_at")
      .eq("client_id", clientId)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
    admin.from("profiles").select("id, name, email, phone, currency, locale, public_code, role, social, occupation, created_at").eq("id", client.teacher_id).maybeSingle(),
  ]);
  raise(lessonError);
  raise(teacherError);
  return {
    client: {
      id: client.id as string,
      name: client.name as string,
      public_code: (client.public_code as string | null) ?? "",
      teacher_id: client.teacher_id as string,
    },
    lessons: ((lessons ?? []) as Lesson[]).map(asLesson),
    teacher: teacher ? asTeacher(teacher as ProfileRow) : null,
  };
}

export async function listParentsOfClient(clientId: string) {
  const db = await userDb();
  const { data, error } = await db.from("client_parents").select("profiles(*)").eq("client_id", clientId);
  raise(error);
  return (data ?? [])
    .map((row) => oneRel(row.profiles as ProfileRow | ProfileRow[] | null))
    .filter((row): row is ProfileRow => Boolean(row))
    .map(asParent)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listClientsOfParent(parentId: string) {
  const db = await userDb();
  const { data, error } = await db.from("client_parents").select("clients(*)").eq("parent_id", parentId);
  raise(error);
  const clients = (data ?? [])
    .map((row) => oneRel(row.clients as ClientRow | ClientRow[] | null))
    .filter((row): row is ClientRow => Boolean(row && row.status === "active"))
    .map((row) => asClient(row))
    .sort((a, b) => a.name.localeCompare(b.name));
  return withStats(clients);
}

export async function insertLesson(input: {
  clientId: string;
  occurredOn: string;
  subject: string;
  platform: string;
  location: string;
  materials: string;
  homework: string;
  durationHours?: number;
}) {
  const db = await userDb();
  const hours = input.durationHours && input.durationHours > 0 ? input.durationHours : 1;
  const { error } = await db.from("lessons").insert({
    client_id: input.clientId,
    occurred_on: input.occurredOn,
    subject: input.subject,
    platform: input.platform,
    location: input.location,
    materials: input.materials,
    homework: input.homework,
    duration_hours: hours,
  });
  raise(error);
}

export async function listLessons(clientId: string) {
  const db = await userDb();
  const { data, error } = await db
    .from("lessons")
    .select("*")
    .eq("client_id", clientId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  raise(error);
  return ((data ?? []) as Lesson[]).map(asLesson);
}

export async function getLesson(id: string) {
  const db = await userDb();
  const { data, error } = await db.from("lessons").select("*").eq("id", id).maybeSingle();
  raise(error);
  return data ? asLesson(data as Lesson) : undefined;
}

export async function deleteLesson(id: string) {
  const db = await userDb();
  const { error } = await db.from("lessons").delete().eq("id", id);
  raise(error);
}

export async function updateLesson(
  id: string,
  input: {
    occurredOn: string;
    subject: string;
    platform: string;
    location: string;
    materials: string;
    homework: string;
    durationHours: number;
  },
) {
  const db = await userDb();
  const { error } = await db
    .from("lessons")
    .update({
      occurred_on: input.occurredOn,
      subject: input.subject,
      platform: input.platform,
      location: input.location,
      materials: input.materials,
      homework: input.homework,
      duration_hours: input.durationHours,
    })
    .eq("id", id);
  raise(error);
}

export async function insertPayment(input: {
  clientId: string;
  paidOn: string;
  amountCents: number;
  lessonsAdded: number;
  hoursAdded?: number;
}) {
  const db = await userDb();
  const { error } = await db.from("payments").insert({
    client_id: input.clientId,
    paid_on: input.paidOn,
    amount_cents: input.amountCents,
    lessons_added: input.lessonsAdded,
    hours_added: input.hoursAdded ?? 0,
  });
  raise(error);
}

export async function listPayments(clientId: string) {
  const db = await userDb();
  const { data, error } = await db
    .from("payments")
    .select("*")
    .eq("client_id", clientId)
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });
  raise(error);
  return ((data ?? []) as Payment[]).map(asPayment);
}

export type ParentPayment = Payment & { client_name: string };

export async function listPaymentsForParent(parentId: string) {
  const db = await userDb();
  const { data: links, error } = await db.from("client_parents").select("client_id, clients(name, status)").eq("parent_id", parentId);
  raise(error);
  const names = new Map<string, string>();
  for (const link of links ?? []) {
    const client = oneRel(link.clients as { name: string; status: string } | { name: string; status: string }[] | null);
    if (client && client.status === "active") names.set(link.client_id as string, client.name);
  }
  const ids = [...names.keys()];
  if (!ids.length) return [];
  const { data, error: paymentError } = await db
    .from("payments")
    .select("*")
    .in("client_id", ids)
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });
  raise(paymentError);
  return ((data ?? []) as Payment[]).map((row) => ({ ...asPayment(row), client_name: names.get(row.client_id) ?? "" }));
}

export async function getPayment(id: string) {
  const db = await userDb();
  const { data, error } = await db.from("payments").select("*").eq("id", id).maybeSingle();
  raise(error);
  return data ? asPayment(data as Payment) : undefined;
}

export async function deletePayment(id: string) {
  const db = await userDb();
  const { error } = await db.from("payments").delete().eq("id", id);
  raise(error);
}

export async function insertRegistration(code: string, input: Omit<Registration, "id" | "status" | "created_at">) {
  const db = await userDb();
  const { error } = await db.rpc("submit_registration", {
    p_code: code,
    p_parent_name: input.parent_name,
    p_parent_email: input.parent_email,
    p_parent_phone: input.parent_phone,
    p_parent_social: input.parent_social,
    p_parent_occupation: input.parent_occupation,
    p_child_name: input.child_name,
    p_school: input.school,
    p_grade: input.grade,
    p_interests: input.interests,
    p_ambitions: input.ambitions,
    p_subject: input.subject,
    p_portrait: input.portrait,
    p_pays_self: Boolean(input.pays_self),
  });
  const known = accessError(error);
  if (known) return known;
  raise(error);
  return null;
}

function asRegistration(row: Omit<Registration, "pays_self"> & { pays_self: boolean }): Registration {
  return { ...row, pays_self: row.pays_self ? 1 : 0 };
}

export async function listPendingRegistrations() {
  const db = await userDb();
  const { data, error } = await db.from("registrations").select("*").eq("status", "pending").order("created_at", { ascending: true });
  raise(error);
  return (data ?? []).map((row) => asRegistration(row as Omit<Registration, "pays_self"> & { pays_self: boolean }));
}

export async function getRegistration(id: string) {
  const db = await userDb();
  const { data, error } = await db.from("registrations").select("*").eq("id", id).maybeSingle();
  raise(error);
  return data ? asRegistration(data as Omit<Registration, "pays_self"> & { pays_self: boolean }) : undefined;
}

export async function setRegistrationStatus(id: string, status: "accepted" | "declined") {
  const db = await userDb();
  const { error } = await db.from("registrations").update({ status }).eq("id", id);
  raise(error);
}

export async function pendingRegistrationCount() {
  const db = await userDb();
  const { count, error } = await db.from("registrations").select("id", { count: "exact", head: true }).eq("status", "pending");
  raise(error);
  return count ?? 0;
}

export async function requestParentLink(input: { code: string; name: string; email: string }) {
  const db = await userDb();
  const { error } = await db.rpc("request_parent_link", {
    p_code: input.code,
    p_name: input.name,
    p_email: input.email,
  });
  const known = accessError(error);
  if (known) return known;
  raise(error);
  return null;
}

export async function listPendingParentRequests() {
  const db = await userDb();
  const { data, error } = await db
    .from("parent_requests")
    .select("id, client_id, name, email, status, created_at, clients(name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  raise(error);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    client_id: row.client_id as string,
    name: row.name as string,
    email: row.email as string,
    status: row.status as string,
    created_at: row.created_at as string,
    client_name: oneRel(row.clients as { name: string } | { name: string }[] | null)?.name ?? "",
  }));
}

export async function getParentRequest(id: string) {
  const db = await userDb();
  const { data, error } = await db.from("parent_requests").select("id, client_id, name, email, status, created_at, clients(name)").eq("id", id).maybeSingle();
  raise(error);
  if (!data) return undefined;
  return {
    id: data.id as string,
    client_id: data.client_id as string,
    name: data.name as string,
    email: data.email as string,
    status: data.status as string,
    created_at: data.created_at as string,
    client_name: oneRel(data.clients as { name: string } | { name: string }[] | null)?.name ?? "",
  };
}

export async function setParentRequestStatus(id: string, status: "accepted" | "declined") {
  const db = await userDb();
  const { error } = await db.from("parent_requests").update({ status }).eq("id", id);
  raise(error);
}

export async function pendingParentRequestCount() {
  const db = await userDb();
  const { count, error } = await db.from("parent_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
  raise(error);
  return count ?? 0;
}

type NoteJoined = {
  id: string;
  parent_id: string;
  client_id: string | null;
  lesson_id: string | null;
  body: string;
  created_at: string;
  archived: boolean;
  parent: { name: string } | { name: string }[] | null;
  client: { name: string } | { name: string }[] | null;
  lesson: { occurred_on: string; subject: string } | { occurred_on: string; subject: string }[] | null;
};

function asNote(row: NoteJoined): FeedbackNote {
  const lesson = oneRel(row.lesson);
  return {
    id: row.id,
    parent_id: row.parent_id,
    client_id: row.client_id,
    lesson_id: row.lesson_id,
    body: row.body,
    created_at: row.created_at,
    archived: row.archived ? 1 : 0,
    parent_name: oneRel(row.parent)?.name ?? "",
    client_name: oneRel(row.client)?.name ?? null,
    lesson_on: lesson?.occurred_on ?? null,
    lesson_subject: lesson?.subject ?? null,
  };
}

type RequestJoined = {
  id: string;
  parent_id: string;
  client_id: string | null;
  teacher_id: string;
  open_question: string;
  status: string;
  pace: number | null;
  following_score: number | null;
  homework_score: number | null;
  overall: number | null;
  open_answer: string;
  created_at: string;
  answered_at: string | null;
  archived: boolean;
  parent: { name: string } | { name: string }[] | null;
  client: { name: string } | { name: string }[] | null;
};

function asRequest(row: RequestJoined): FeedbackRequest {
  return {
    id: row.id,
    parent_id: row.parent_id,
    client_id: row.client_id,
    teacher_id: row.teacher_id,
    open_question: row.open_question,
    status: row.status,
    pace: row.pace,
    following_score: row.following_score,
    homework_score: row.homework_score,
    overall: row.overall,
    open_answer: row.open_answer,
    created_at: row.created_at,
    answered_at: row.answered_at,
    archived: row.archived ? 1 : 0,
    parent_name: oneRel(row.parent)?.name ?? "",
    client_name: oneRel(row.client)?.name ?? null,
  };
}

export async function insertFeedbackNote(parentId: string, clientId: string | null, body: string, lessonId: string | null = null) {
  const db = await userDb();
  const { error } = await db.from("feedback_notes").insert({
    parent_id: parentId,
    client_id: clientId,
    lesson_id: lessonId,
    body,
  });
  raise(error);
}

export async function listFeedbackNotes() {
  const db = await userDb();
  const { data, error } = await db.from("feedback_notes").select(noteSelect).order("created_at", { ascending: false });
  raise(error);
  return ((data ?? []) as NoteJoined[]).map(asNote);
}

export async function listNotesForParent(parentId: string) {
  const db = await userDb();
  const { data, error } = await db.from("feedback_notes").select(noteSelect).eq("parent_id", parentId).order("created_at", { ascending: false });
  raise(error);
  return ((data ?? []) as NoteJoined[]).map(asNote);
}

export async function listNotesForClient(clientId: string) {
  const db = await userDb();
  const { data: links, error: linkError } = await db.from("client_parents").select("parent_id").eq("client_id", clientId);
  raise(linkError);
  const parentIds = (links ?? []).map((row) => row.parent_id as string);
  const { data: aboutClient, error } = await db.from("feedback_notes").select(noteSelect).eq("client_id", clientId).order("created_at", { ascending: false });
  raise(error);
  let general: NoteJoined[] = [];
  if (parentIds.length) {
    const { data, error: generalError } = await db
      .from("feedback_notes")
      .select(noteSelect)
      .is("client_id", null)
      .in("parent_id", parentIds)
      .order("created_at", { ascending: false });
    raise(generalError);
    general = (data ?? []) as NoteJoined[];
  }
  const seen = new Set<string>();
  return [...((aboutClient ?? []) as NoteJoined[]), ...general]
    .filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(asNote);
}

export async function insertFeedbackRequest(input: { parentId: string; clientId: string; teacherId: string; openQuestion: string }) {
  const db = await userDb();
  const { error } = await db.from("feedback_requests").insert({
    parent_id: input.parentId,
    client_id: input.clientId,
    teacher_id: input.teacherId,
    open_question: input.openQuestion,
    status: "open",
    open_answer: "",
  });
  raise(error);
}

export async function listFeedbackRequests() {
  const db = await userDb();
  const { data, error } = await db.from("feedback_requests").select(requestSelect).order("created_at", { ascending: false });
  raise(error);
  return ((data ?? []) as RequestJoined[]).map(asRequest);
}

export async function listRequestsForParent(parentId: string) {
  const db = await userDb();
  const { data, error } = await db.from("feedback_requests").select(requestSelect).eq("parent_id", parentId).order("created_at", { ascending: false });
  raise(error);
  return ((data ?? []) as RequestJoined[]).map(asRequest);
}

export async function getFeedbackRequest(id: string) {
  const db = await userDb();
  const { data, error } = await db.from("feedback_requests").select("*").eq("id", id).maybeSingle();
  raise(error);
  if (!data) return undefined;
  return {
    ...(data as FeedbackRequest),
    archived: data.archived ? 1 : 0,
  } as FeedbackRequest;
}

export async function answerFeedbackRequest(
  id: string,
  input: { pace: number; following: number; homework: number; overall: number; openAnswer: string },
) {
  const db = await userDb();
  const { error } = await db
    .from("feedback_requests")
    .update({
      status: "answered",
      pace: input.pace,
      following_score: input.following,
      homework_score: input.homework,
      overall: input.overall,
      open_answer: input.openAnswer,
      answered_at: new Date().toISOString(),
    })
    .eq("id", id);
  raise(error);
}

export async function setFeedbackArchived(kind: "request" | "note", id: string, archived: boolean) {
  const db = await userDb();
  const table = kind === "request" ? "feedback_requests" : "feedback_notes";
  const { error } = await db.from(table).update({ archived }).eq("id", id);
  raise(error);
}

export async function openRequestCount() {
  const db = await userDb();
  const { count, error } = await db
    .from("feedback_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "open")
    .eq("archived", false);
  raise(error);
  return count ?? 0;
}

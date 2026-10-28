"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { inviteParent } from "./accounts";
import { cookieOptions, getSession, homeFor, passwordStillNeeded, STUDENT_COOKIE } from "./auth";
import { BILLING_MODES, isOneOf, KINDS, LOCATIONS, PLATFORMS, SUBJECTS } from "./constants";
import {
  answerFeedbackRequest,
  clearStudentPin,
  createStudentSession,
  deleteClient,
  deleteLesson,
  deletePayment,
  deleteStudentSession,
  emailTaken,
  getClient,
  getFeedbackRequest,
  getLesson,
  getParentByCode,
  getParentRequest,
  getPayment,
  getRegistration,
  getTeacherByEmail,
  insertClient,
  insertFeedbackNote,
  insertFeedbackRequest,
  insertLesson,
  insertPayment,
  insertRegistration,
  linkParent,
  markPaysForSelf,
  matchStudent,
  parentLinkedTo,
  requestParentLink,
  setClientDeal,
  setClientStatus,
  setFeedbackArchived,
  setParentRequestStatus,
  setRegistrationStatus,
  setStudentPin,
  unlinkParent,
  updateClient,
  updateLesson,
  updateParentLocale,
  updateTeacher,
  updateTeacherLocale,
} from "./db";
import { isEmail, parseCount, parseHours, parseMoney, parsePackHours, todayISO } from "./format";
import { createClient } from "./supabase/server";

function refresh() {
  revalidatePath("/en", "layout");
  revalidatePath("/bg", "layout");
}

async function go(href: string, query?: Record<string, string>): Promise<never> {
  const current = await getLocale();
  if (query) redirect({ href: { pathname: href, query }, locale: current });
  else redirect({ href, locale: current });
  throw new Error("Redirect failed");
}

function field(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function must<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Missing value");
  return value;
}

async function requireTeacher() {
  const session = await getSession();
  if (!session || session.role !== "teacher") await go("/login");
  return must(session);
}

async function requireParent() {
  const session = await getSession();
  if (!session || session.role !== "parent") await go("/login");
  return must(session);
}

async function clearStudentCookie() {
  const jar = await cookies();
  const student = jar.get(STUDENT_COOKIE)?.value;
  if (student) await deleteStudentSession(student);
  jar.delete(STUDENT_COOKIE);
}

function choices(form: FormData) {
  const subject = field(form, "subject");
  const platform = field(form, "platform");
  const location = field(form, "location");
  const kind = field(form, "kind") || "student";
  const billing = field(form, "billing") || "per_lesson";
  if (
    !isOneOf(SUBJECTS, subject) ||
    !isOneOf(PLATFORMS, platform) ||
    !isOneOf(LOCATIONS, location) ||
    !isOneOf(KINDS, kind) ||
    !isOneOf(BILLING_MODES, billing)
  ) {
    return null;
  }
  return { subject, platform, location, kind, billing };
}

export async function signInWithPassword(form: FormData) {
  const email = field(form, "email").toLowerCase();
  const password = field(form, "password");
  const current = await getLocale();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect({ href: { pathname: "/login", query: { error: "invalid" } }, locale: current });
    throw new Error("Redirect failed");
  }
  await clearStudentCookie();
  const session = await getSession();
  if (!session || session.role === "student") {
    await supabase.auth.signOut();
    redirect({ href: { pathname: "/login", query: { error: "invalid" } }, locale: current });
    throw new Error("Redirect failed");
  }
  if (session.role === "parent" && (await passwordStillNeeded())) {
    redirect({ href: "/account/password", locale: current });
    throw new Error("Redirect failed");
  }
  redirect({ href: homeFor(session.role), locale: current });
}

export async function signInStudent(form: FormData) {
  const current = await getLocale();
  const match = await matchStudent(field(form, "name"), field(form, "pin"));
  if (!match) {
    redirect({ href: { pathname: "/login", query: { error: "student" } }, locale: current });
    throw new Error("Redirect failed");
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  const session = await createStudentSession(match.id);
  const jar = await cookies();
  jar.set(STUDENT_COOKIE, session.id, cookieOptions);
  redirect({ href: "/my", locale: current });
}

export async function choosePassword(form: FormData) {
  const password = field(form, "password");
  const current = await getLocale();
  if (password.length < 8) await go("/account/password", { error: "short" });
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) await go("/login");
  const { error } = await supabase.auth.updateUser({ password, data: { must_set_password: false } });
  if (error) await go("/account/password", { error: "required" });
  const session = await getSession();
  redirect({ href: session ? homeFor(session.role) : "/login", locale: current });
}

export async function signOutAction() {
  const jar = await cookies();
  const student = jar.get(STUDENT_COOKIE)?.value;
  if (student) await deleteStudentSession(student);
  jar.delete(STUDENT_COOKIE);
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // A student session has no Supabase user.
  }
  const current = await getLocale();
  redirect({ href: "/", locale: current });
}

export async function rememberLocale(next: string) {
  if (next !== "en" && next !== "bg") return;
  const session = await getSession();
  if (!session) return;
  if (session.role === "teacher") await updateTeacherLocale(session.user_id, next);
  if (session.role === "parent") await updateParentLocale(session.user_id, next);
}

export async function submitRegistration(form: FormData) {
  const paysSelf = field(form, "paysSelf") === "1";
  const code = field(form, "teacherCode").replace(/\D/g, "");
  const childName = field(form, "childName");
  const email = field(form, "email").toLowerCase();
  const parentName = paysSelf ? childName : field(form, "parentName");
  const subject = field(form, "subject") || "math";
  const back = { code, pays: paysSelf ? "1" : "0" };
  if (!parentName || !childName || !isEmail(email) || !isOneOf(SUBJECTS, subject)) {
    await go("/register", { error: "required", ...back });
  }
  const result = await insertRegistration(code, {
    parent_name: parentName,
    parent_email: email,
    parent_phone: field(form, "phone"),
    parent_social: field(form, "social"),
    parent_occupation: field(form, "occupation"),
    child_name: childName,
    school: field(form, "school"),
    grade: field(form, "grade"),
    interests: field(form, "interests"),
    ambitions: field(form, "ambitions"),
    subject,
    portrait: field(form, "portrait") === "boy" ? "boy" : "girl",
    pays_self: paysSelf ? 1 : 0,
  });
  if (result) await go("/register", { error: result, ...back });
  refresh();
  await go("/register", { sent: "1" });
}

export async function requestParentJoin(form: FormData) {
  const code = field(form, "code").replace(/\D/g, "");
  const name = field(form, "name");
  const email = field(form, "email").toLowerCase();
  if (!name || !isEmail(email) || !/^\d{6}$/.test(code)) await go("/join", { error: "required", code });
  const result = await requestParentLink({ code, name, email });
  if (result) await go("/join", { error: result, code });
  refresh();
  await go("/join", { sent: "1" });
}

async function connectParent(input: {
  name: string;
  email: string;
  phone: string;
  social: string;
  occupation: string;
}) {
  try {
    return await inviteParent({ ...input, locale: await getLocale() });
  } catch (error) {
    if (error instanceof Error && error.message.includes("email_taken")) return null;
    throw error;
  }
}

export async function createClientAction(form: FormData) {
  const session = await requireTeacher();
  const name = field(form, "name");
  const picked = choices(form);
  const price = parseMoney(field(form, "price"));
  const amount = parseMoney(field(form, "amountNow"));
  if (!name || !picked || price === null || amount === null) {
    await go("/clients/new", { error: "required" });
  }
  const choice = must(picked);
  const priceCents = must(price);
  const amountCents = must(amount);
  let lessonsAdded = 0;
  let hoursAdded = 0;
  if (choice.billing === "per_hour") {
    const hours = parsePackHours(field(form, "packSize"));
    if (hours === null) await go("/clients/new", { error: "required" });
    hoursAdded = must(hours);
  } else {
    const pack = parseCount(field(form, "packSize"));
    if (pack === null) await go("/clients/new", { error: "required" });
    lessonsAdded = must(pack);
  }

  const parentEmail = field(form, "parentEmail").toLowerCase();
  const parentName = field(form, "parentName");
  if (parentEmail && (!isEmail(parentEmail) || !parentName)) {
    await go("/clients/new", { error: "required" });
  }
  if (parentEmail && (await getTeacherByEmail(parentEmail))) {
    await go("/clients/new", { error: "emailTaken" });
  }

  let parentId = "";
  if (parentEmail) {
    const parent = await connectParent({
      name: parentName,
      email: parentEmail,
      phone: field(form, "parentPhone"),
      social: field(form, "parentSocial"),
      occupation: field(form, "parentOccupation"),
    });
    if (!parent) await go("/clients/new", { error: "emailTaken" });
    parentId = must(parent).id;
  }

  const id = await insertClient({
    teacherId: session.user_id,
    name,
    kind: choice.kind,
    subject: choice.subject,
    platform: choice.platform,
    location: choice.location,
    priceCents,
    billingMode: choice.billing,
    school: field(form, "school"),
    grade: field(form, "grade"),
    interests: field(form, "interests"),
    ambitions: field(form, "ambitions"),
    portrait: field(form, "portrait") === "boy" ? "boy" : "girl",
  });

  if (amountCents > 0 || lessonsAdded > 0 || hoursAdded > 0) {
    await insertPayment({
      clientId: id,
      paidOn: todayISO(),
      amountCents,
      lessonsAdded,
      hoursAdded,
    });
  }

  if (parentId) await linkParent(id, parentId);

  refresh();
  await go(`/clients/${id}`);
}

async function ownedClient(clientId: string) {
  const session = await requireTeacher();
  const client = await getClient(clientId);
  if (!client || client.teacher_id !== session.user_id) await go("/today");
  return must(client);
}

export async function logQuickLesson(
  clientId: string,
  input: { hours: number; platform: string; location: string; materials: string; homework: string },
) {
  const client = await ownedClient(clientId);
  const hours = input.hours;
  if (!Number.isFinite(hours) || hours <= 0 || hours > 12) return;
  const platform = !input.platform ? "" : isOneOf(PLATFORMS, input.platform) ? input.platform : client.platform_default;
  const location = !input.location ? "" : isOneOf(LOCATIONS, input.location) ? input.location : client.location_default;
  await insertLesson({
    clientId: client.id,
    occurredOn: todayISO(),
    subject: client.subject_default,
    platform,
    location,
    materials: input.materials.trim().slice(0, 2000),
    homework: input.homework.trim().slice(0, 2000),
    durationHours: Math.round(hours * 10) / 10,
  });
  refresh();
}

export async function logDetailedLesson(form: FormData) {
  const client = await ownedClient(field(form, "clientId"));
  const picked = choices(form);
  const date = field(form, "date") || todayISO();
  const hours = parseHours(field(form, "duration") || "1");
  if (!picked || !/^\d{4}-\d{2}-\d{2}$/.test(date) || hours === null) {
    await go(`/clients/${client.id}`, { error: "required" });
  }
  const choice = must(picked);
  await insertLesson({
    clientId: client.id,
    occurredOn: date,
    subject: choice.subject,
    platform: choice.platform,
    location: choice.location,
    materials: field(form, "materials"),
    homework: field(form, "homework"),
    durationHours: must(hours),
  });
  refresh();
  await go(`/clients/${client.id}`, { panel: "lessons" });
}

export async function updateLessonAction(form: FormData) {
  const found = await getLesson(field(form, "lessonId"));
  if (!found) await go("/today");
  const lesson = must(found);
  const client = await ownedClient(lesson.client_id);
  const picked = choices(form);
  const date = field(form, "date");
  const hours = parseHours(field(form, "duration") || "1");
  if (!picked || !/^\d{4}-\d{2}-\d{2}$/.test(date) || hours === null) {
    await go(`/clients/${client.id}`, { error: "required", panel: "lessons" });
  }
  const choice = must(picked);
  await updateLesson(lesson.id, {
    occurredOn: date,
    subject: choice.subject,
    platform: choice.platform,
    location: choice.location,
    materials: field(form, "materials").slice(0, 2000),
    homework: field(form, "homework").slice(0, 2000),
    durationHours: must(hours),
  });
  refresh();
  await go(`/clients/${client.id}`, { panel: "lessons", saved: "1" });
}

export async function removeLesson(form: FormData) {
  const found = await getLesson(field(form, "lessonId"));
  if (!found) await go("/today");
  const lesson = must(found);
  await ownedClient(lesson.client_id);
  await deleteLesson(lesson.id);
  refresh();
  await go(`/clients/${lesson.client_id}`);
}

export async function noteDeal(clientId: string, billing: string, priceCents: number) {
  const client = await ownedClient(clientId);
  if (billing !== "per_lesson" && billing !== "per_hour") return;
  if (!Number.isInteger(priceCents) || priceCents <= 0 || priceCents > 100_000_00) return;
  if (client.price_cents === priceCents && client.billing_mode === billing) return;
  await setClientDeal(client.id, priceCents, billing);
  refresh();
}

export async function addPayment(form: FormData) {
  const client = await ownedClient(field(form, "clientId"));
  const amount = parseMoney(field(form, "amount"));
  const date = field(form, "date") || todayISO();
  if (amount === null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    await go(`/clients/${client.id}`, { error: "invalidAmount" });
  }
  const cents = must(amount);
  const billed = field(form, "billing");
  const mode = billed === "per_hour" || billed === "per_lesson" || billed === "prepaid" ? billed : client.billing_mode;
  let lessonsAdded = 0;
  let hoursAdded = 0;
  if (mode === "per_hour") {
    const hours = parsePackHours(field(form, "hoursAdded"));
    if (hours === null) await go(`/clients/${client.id}`, { error: "invalidAmount" });
    hoursAdded = must(hours);
  } else {
    const added = parseCount(field(form, "lessonsAdded"));
    if (added === null) await go(`/clients/${client.id}`, { error: "invalidAmount" });
    lessonsAdded = must(added);
  }
  if (cents === 0 && lessonsAdded === 0 && hoursAdded === 0) {
    await go(`/clients/${client.id}`, { error: "invalidAmount" });
  }
  const price = parseMoney(field(form, "price"));
  if ((mode === "per_lesson" || mode === "per_hour") && price != null && price > 0) {
    if (price !== client.price_cents || mode !== client.billing_mode) await setClientDeal(client.id, price, mode);
  }
  await insertPayment({
    clientId: client.id,
    paidOn: date,
    amountCents: cents,
    lessonsAdded,
    hoursAdded,
  });
  refresh();
  await go(`/clients/${client.id}`, { panel: "payments", paid: "1" });
}

export async function removePayment(form: FormData) {
  const found = await getPayment(field(form, "paymentId"));
  if (!found) await go("/today");
  const payment = must(found);
  await ownedClient(payment.client_id);
  await deletePayment(payment.id);
  refresh();
  await go(`/clients/${payment.client_id}`);
}

export async function saveProfile(form: FormData) {
  const client = await ownedClient(field(form, "clientId"));
  const name = field(form, "name");
  const picked = choices(form);
  const price = parseMoney(field(form, "price"));
  if (!name || !picked || price === null) await go(`/clients/${client.id}`, { error: "required", edit: "profile" });
  const choice = must(picked);
  await updateClient(client.id, {
    name,
    kind: choice.kind,
    subject: choice.subject,
    platform: choice.platform,
    location: choice.location,
    priceCents: must(price),
    billingMode: choice.billing,
    school: field(form, "school"),
    grade: field(form, "grade"),
    interests: field(form, "interests"),
    ambitions: field(form, "ambitions"),
    portrait: field(form, "portrait") === "boy" ? "boy" : "girl",
  });
  refresh();
  await go(`/clients/${client.id}`, { saved: "1" });
}

export async function archiveStudent(form: FormData) {
  const client = await ownedClient(field(form, "clientId"));
  await setClientStatus(client.id, "archived");
  refresh();
  await go("/today", { view: "archive" });
}

export async function restoreStudent(form: FormData) {
  const client = await ownedClient(field(form, "clientId"));
  await setClientStatus(client.id, "active");
  refresh();
  await go("/today");
}

export async function removeStudent(form: FormData) {
  const client = await ownedClient(field(form, "clientId"));
  await deleteClient(client.id);
  refresh();
  await go("/today");
}

export async function savePin(form: FormData) {
  const client = await ownedClient(field(form, "clientId"));
  if (form.get("clearPin") === "on") {
    await clearStudentPin(client.id);
  } else {
    const pin = field(form, "pin");
    if (pin) {
      if (!/^\d{4,6}$/.test(pin)) await go(`/clients/${client.id}`, { error: "invalidPin", panel: "profile" });
      await setStudentPin(client.id, pin);
    }
  }
  refresh();
  await go(`/clients/${client.id}`, { panel: "profile", saved: "1" });
}

export async function linkParentAction(form: FormData) {
  const client = await ownedClient(field(form, "clientId"));
  const email = field(form, "parentEmail").toLowerCase();
  const name = field(form, "parentName");
  if (!name || !isEmail(email)) await go(`/clients/${client.id}`, { error: "required" });
  const parent = await connectParent({
    name,
    email,
    phone: field(form, "parentPhone"),
    social: field(form, "parentSocial"),
    occupation: field(form, "parentOccupation"),
  });
  if (!parent) await go(`/clients/${client.id}`, { error: "emailTaken" });
  await linkParent(client.id, must(parent).id);
  refresh();
  await go(`/clients/${client.id}`);
}

export async function linkParentByCode(form: FormData) {
  const client = await ownedClient(field(form, "clientId"));
  const code = field(form, "code").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) await go(`/clients/${client.id}`, { error: "unknownCode" });
  if (code === client.public_code) {
    await markPaysForSelf(client.id);
    refresh();
    await go(`/clients/${client.id}`, { saved: "1" });
  }
  const parent = await getParentByCode(code);
  if (!parent) await go(`/clients/${client.id}`, { error: "unknownCode" });
  await linkParent(client.id, must(parent).id);
  refresh();
  await go(`/clients/${client.id}`, { saved: "1" });
}

export async function unlinkParentAction(form: FormData) {
  const client = await ownedClient(field(form, "clientId"));
  const parentId = field(form, "parentId");
  if (parentId && (await parentLinkedTo(parentId, client.id))) await unlinkParent(client.id, parentId);
  refresh();
  await go(`/clients/${client.id}`, { panel: "parents" });
}

export async function markSelfPayer(form: FormData) {
  const client = await ownedClient(field(form, "clientId"));
  await markPaysForSelf(client.id);
  refresh();
  await go(`/clients/${client.id}`, { saved: "1" });
}

export async function acceptRegistration(form: FormData) {
  const session = await requireTeacher();
  const found = await getRegistration(field(form, "id"));
  if (!found || found.status !== "pending") await go("/registrations");
  const registration = must(found);
  if (await getTeacherByEmail(registration.parent_email)) await go("/registrations", { error: "emailTaken" });

  const parent = await connectParent({
    name: registration.pays_self ? registration.child_name : registration.parent_name,
    email: registration.parent_email,
    phone: registration.parent_phone,
    social: registration.parent_social,
    occupation: registration.parent_occupation,
  });
  if (!parent) await go("/registrations", { error: "emailTaken" });
  const clientId = await insertClient({
    teacherId: session.user_id,
    name: registration.child_name,
    kind: "student",
    subject: isOneOf(SUBJECTS, registration.subject) ? registration.subject : "math",
    platform: "paper",
    location: "in_person",
    priceCents: 0,
    billingMode: "per_lesson",
    school: registration.school,
    grade: registration.grade,
    interests: registration.interests,
    ambitions: registration.ambitions,
    portrait: registration.portrait === "boy" ? "boy" : "girl",
    paysSelf: Boolean(registration.pays_self),
  });
  await linkParent(clientId, must(parent).id);
  await setRegistrationStatus(registration.id, "accepted");
  refresh();
  await go(`/clients/${clientId}`);
}

export async function declineRegistration(form: FormData) {
  await requireTeacher();
  const registration = await getRegistration(field(form, "id"));
  if (registration && registration.status === "pending") await setRegistrationStatus(registration.id, "declined");
  refresh();
  await go("/registrations");
}

export async function acceptParentRequest(form: FormData) {
  await requireTeacher();
  const found = await getParentRequest(field(form, "id"));
  if (!found || found.status !== "pending") await go("/registrations");
  const request = must(found);
  const client = await ownedClient(request.client_id);
  const parent = await connectParent({
    name: request.name,
    email: request.email,
    phone: "",
    social: "",
    occupation: "",
  });
  if (!parent) await go("/registrations", { error: "emailTaken" });
  await linkParent(client.id, must(parent).id);
  await setParentRequestStatus(request.id, "accepted");
  refresh();
  await go(`/clients/${client.id}`);
}

export async function declineParentRequest(form: FormData) {
  await requireTeacher();
  const found = await getParentRequest(field(form, "id"));
  if (found && found.status === "pending") {
    await ownedClient(found.client_id);
    await setParentRequestStatus(found.id, "declined");
  }
  refresh();
  await go("/registrations");
}

export async function archiveFeedback(form: FormData) {
  await requireTeacher();
  const kind = field(form, "kind") === "note" ? "note" : "request";
  const id = field(form, "id");
  if (!id) await go("/feedback");
  await setFeedbackArchived(kind, id, field(form, "archived") !== "0");
  refresh();
  const back = field(form, "back");
  if (back.startsWith("/clients/")) {
    const clientId = back.slice("/clients/".length).split("/")[0] ?? "";
    if (clientId) {
      await ownedClient(clientId);
      await go(`/clients/${clientId}`, { panel: "feedback" });
    }
  }
  await go("/feedback");
}

export async function saveSettings(form: FormData) {
  const session = await requireTeacher();
  const name = field(form, "name");
  const email = field(form, "email").toLowerCase();
  const phone = field(form, "phone");
  const currency = field(form, "currency") === "BGN" ? "BGN" : "EUR";
  if (!name || !isEmail(email)) await go("/settings", { error: "required" });
  if (await emailTaken(email, { role: "teacher", id: session.user_id })) {
    await go("/settings", { error: "emailTaken" });
  }
  await updateTeacher(session.user_id, { name, email, phone, currency });
  refresh();
  await go("/settings", { saved: "1" });
}

export async function sendFeedbackRequest(form: FormData) {
  const session = await requireTeacher();
  const client = await ownedClient(field(form, "clientId"));
  const parentId = field(form, "parentId");
  if (!(await parentLinkedTo(parentId, client.id))) await go(`/clients/${client.id}`, { error: "required" });
  await insertFeedbackRequest({
    parentId,
    clientId: client.id,
    teacherId: session.user_id,
    openQuestion: field(form, "question") || "What should I change?",
  });
  refresh();
  await go(`/clients/${client.id}`, { panel: "feedback", saved: "1" });
}

export async function addFeedbackNote(form: FormData) {
  const session = await requireParent();
  const body = field(form, "body");
  const clientId = field(form, "clientId");
  if (!body) await go("/family/feedback", { error: "required" });
  if (clientId && !(await parentLinkedTo(session.user_id, clientId))) await go("/family/feedback");
  await insertFeedbackNote(session.user_id, clientId || null, body);
  refresh();
  await go("/family/feedback", { saved: "1" });
}

export async function addLessonFeedback(form: FormData) {
  const session = await requireParent();
  const clientId = field(form, "clientId");
  const lessonId = field(form, "lessonId");
  const body = field(form, "body");
  const back = clientId ? `/family/${clientId}` : "/family";
  if (!body || !clientId || !lessonId) await go(back, { error: "required" });
  if (!(await parentLinkedTo(session.user_id, clientId))) await go("/family");
  const lesson = await getLesson(lessonId);
  if (!lesson || lesson.client_id !== clientId) await go(back);
  await insertFeedbackNote(session.user_id, clientId, body, must(lesson).id);
  refresh();
  await go(back, { saved: "1" });
}

export async function answerRequest(form: FormData) {
  const session = await requireParent();
  const found = await getFeedbackRequest(field(form, "requestId"));
  if (!found || found.parent_id !== session.user_id || found.status !== "open") {
    await go("/family/feedback");
  }
  const request = must(found);
  const pace = Number(field(form, "pace"));
  const following = Number(field(form, "following"));
  const homework = Number(field(form, "homework"));
  const overall = Number(field(form, "overall"));
  const scores = [pace, following, homework, overall];
  if (scores.some((score) => !Number.isInteger(score) || score < 1 || score > 5)) {
    await go("/family/feedback", { error: "required" });
  }
  await answerFeedbackRequest(request.id, {
    pace,
    following,
    homework,
    overall,
    openAnswer: field(form, "openAnswer"),
  });
  refresh();
  await go("/family/feedback", { saved: "1" });
}

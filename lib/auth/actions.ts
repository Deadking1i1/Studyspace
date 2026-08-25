"use server";

import { and, eq, gt, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { userProfiles, userSettings, users } from "@/db/schema";
import { deleteUserAccount, ensureAccountRecords, normalizeEmail } from "@/lib/account";
import { env } from "@/lib/env";
import { verifyCsrfToken } from "@/lib/auth/csrf";
import { enforceRateLimit, parseRateLimit, RateLimitError } from "@/lib/auth/rate-limit";
import { requestIdentifier } from "@/lib/auth/request";
import { addHours, createToken, hashToken } from "@/lib/auth/tokens";
import { createSession, currentUser, destroySession, revokeAllUserSessions, revokeOwnedSession } from "@/lib/auth/session";
import { developmentLink, isValidAccountEmail, sendEmailChangeEmail, sendPasswordResetEmail, sendVerificationEmail } from "@/lib/auth/email";
import { hashPassword, passwordStrengthErrors, verifyPassword } from "@/lib/auth/password";
import { logSecurityEvent } from "@/lib/auth/security-events";
import { normalizeTheme, type ThemeActionState } from "@/lib/themes";
import { canRegisterForBeta } from "@/lib/beta-access";

function asString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function redirectWith(path: string, type: "error" | "success", message: string): never {
  redirect(`${path}?${type}=${encodeURIComponent(message)}`);
}

function developmentMessage(prefix: string, path: string, token: string) {
  const link = developmentLink(path, token);
  return link ? `${prefix} Development link: ${link}` : prefix;
}

async function requireCsrf(formData: FormData, redirectPath: string) {
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirectWith(redirectPath, "error", "Security check failed. Please try again.");
  }
}

async function requireRateLimit(action: string, identifier: string, configuredLimit: string, redirectPath: string) {
  const parsed = parseRateLimit(configuredLimit, 5, 60);
  try {
    await enforceRateLimit({ action, identifier, ...parsed });
  } catch (error) {
    if (error instanceof RateLimitError) {
      redirectWith(redirectPath, "error", `Too many requests. Try again in ${error.retryAfterSeconds} seconds.`);
    }
    throw error;
  }
}

export async function registerAction(formData: FormData) {
  await requireCsrf(formData, "/register");
  const username = asString(formData, "username").slice(0, 128);
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirm_password") || "");
  await requireRateLimit("auth.register", await requestIdentifier(email), env.AUTH_REGISTER_RATE_LIMIT, "/register");
  if (!canRegisterForBeta(email)) redirectWith("/register", "error", "Study Space is currently invitation-only. Use an invited email address.");

  if (!username || !email || !password) redirectWith("/register", "error", "Please fill in all registration fields.");
  if (!isValidAccountEmail(email)) redirectWith("/register", "error", "Enter a valid email address.");
  if (password !== confirmPassword) redirectWith("/register", "error", "Password confirmation does not match.");
  const strengthErrors = passwordStrengthErrors(password);
  if (strengthErrors.length) redirectWith("/register", "error", strengthErrors[0]);

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.email, email), eq(users.username, username)))
    .limit(1);
  if (existing) redirectWith("/register", "error", "A user with that email or username already exists.");

  const verificationToken = createToken();
  const [created] = await db
    .insert(users)
    .values({
      username,
      email,
      passwordHash: hashPassword(password),
      emailVerificationTokenHash: hashToken(verificationToken),
      emailVerificationSentAt: new Date(),
      emailVerified: false,
      createdAt: new Date(),
    })
    .returning();
  await ensureAccountRecords(created);
  await logSecurityEvent(created.id, "account.registered", {});
  await destroySession();
  await createSession(created.id);
  try {
    await sendVerificationEmail(created.email, verificationToken);
  } catch {
    await logSecurityEvent(created.id, "email.delivery_failed", { purpose: "verification" });
    if (env.NODE_ENV === "production") redirectWith("/", "error", "Account created, but the verification email could not be sent. Try again from Settings.");
  }
  redirectWith("/", "success", developmentMessage("Registration successful. Check your email to verify your account.", "/verify-email", verificationToken));
}

export async function loginAction(formData: FormData) {
  await requireCsrf(formData, "/login");
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");
  await requireRateLimit("auth.login", await requestIdentifier(email), env.AUTH_LOGIN_RATE_LIMIT, "/login");
  if (!email || !password) redirectWith("/login", "error", "Please enter both email and password.");
  if (!isValidAccountEmail(email)) redirectWith("/login", "error", "Invalid email or password.");
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    await logSecurityEvent(user?.id ?? null, "auth.login_failed", { email_provided: Boolean(email) });
    redirectWith("/login", "error", "Invalid email or password.");
  }

  await ensureAccountRecords(user);
  await logSecurityEvent(user.id, "auth.login_success", {});
  await destroySession();
  await createSession(user.id);
  redirect("/");
}

export async function logoutAction(formData: FormData) {
  await requireCsrf(formData, "/settings");
  const user = await currentUser();
  if (user) await logSecurityEvent(user.id, "auth.logout", {});
  await destroySession();
  redirectWith("/login", "success", "You have been signed out.");
}

export async function requestPasswordResetAction(formData: FormData) {
  await requireCsrf(formData, "/forgot-password");
  const email = normalizeEmail(formData.get("email"));
  await requireRateLimit("password.reset", await requestIdentifier(email), env.AUTH_PASSWORD_RESET_RATE_LIMIT, "/forgot-password");
  const [user] = isValidAccountEmail(email)
    ? await db.select().from(users).where(eq(users.email, email)).limit(1)
    : [];
  let message = "If that email exists, a password-reset email has been sent.";

  if (user) {
    const token = createToken();
    await db
      .update(users)
      .set({ passwordResetTokenHash: hashToken(token), passwordResetSentAt: new Date() })
      .where(eq(users.id, user.id));
    await logSecurityEvent(user.id, "password.reset_requested", {});
    try {
      await sendPasswordResetEmail(user.email, token);
    } catch {
      await logSecurityEvent(user.id, "email.delivery_failed", { purpose: "password_reset" });
    }
    message = developmentMessage(message, "/reset-password", token);
  } else {
    await logSecurityEvent(null, "password.reset_requested_unknown", { email_provided: Boolean(email) });
  }

  redirectWith("/forgot-password", "success", message);
}

export async function resetPasswordAction(token: string, formData: FormData) {
  await requireCsrf(formData, `/reset-password/${encodeURIComponent(token)}`);
  await requireRateLimit("password.reset", await requestIdentifier(token), env.AUTH_PASSWORD_RESET_RATE_LIMIT, "/forgot-password");
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirm_password") || "");
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.passwordResetTokenHash, hashToken(token)))
    .limit(1);
  if (!user) redirectWith("/forgot-password", "error", "Password reset link is invalid.");
  if (!user.passwordResetSentAt || user.passwordResetSentAt <= addHours(new Date(), -2)) {
    await db.update(users).set({ passwordResetTokenHash: null, passwordResetSentAt: null }).where(eq(users.id, user.id));
    await logSecurityEvent(user.id, "password.reset_failed", { reason: "expired" });
    redirectWith("/forgot-password", "error", "Password reset link has expired.");
  }
  if (password !== confirmPassword) {
    await logSecurityEvent(user.id, "password.reset_failed", { reason: "confirmation" });
    redirectWith(`/reset-password/${encodeURIComponent(token)}`, "error", "Password confirmation does not match.");
  }
  const strengthErrors = passwordStrengthErrors(password);
  if (strengthErrors.length) {
    await logSecurityEvent(user.id, "password.reset_failed", { reason: "strength" });
    redirectWith(`/reset-password/${encodeURIComponent(token)}`, "error", strengthErrors[0]);
  }

  const [updated] = await db
    .update(users)
    .set({ passwordHash: hashPassword(password), passwordResetTokenHash: null, passwordResetSentAt: null })
    .where(and(
      eq(users.id, user.id),
      eq(users.passwordResetTokenHash, hashToken(token)),
      gt(users.passwordResetSentAt, addHours(new Date(), -2)),
    ))
    .returning();
  if (!updated) redirectWith("/forgot-password", "error", "Password reset link is invalid or has already been used.");
  await revokeAllUserSessions(user.id);
  await logSecurityEvent(user.id, "password.reset_completed", {});
  await destroySession();
  redirectWith("/login", "success", "Password updated. Please sign in.");
}

export async function verifyEmailAction(token: string, formData: FormData) {
  await requireCsrf(formData, `/verify-email/${encodeURIComponent(token)}`);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.emailVerificationTokenHash, hashToken(token)))
    .limit(1);
  if (!user) redirectWith("/login", "error", "Email verification link is invalid.");
  if (!user.emailVerificationSentAt || user.emailVerificationSentAt <= addHours(new Date(), -48)) {
    await logSecurityEvent(user.id, "email.verify_failed", { reason: "expired" });
    redirectWith("/login", "error", "Email verification link has expired. Request a new one from settings.");
  }

  const [updated] = await db
    .update(users)
    .set({ emailVerified: true, emailVerificationTokenHash: null, emailVerificationSentAt: null })
    .where(and(
      eq(users.id, user.id),
      eq(users.emailVerificationTokenHash, hashToken(token)),
      gt(users.emailVerificationSentAt, addHours(new Date(), -48)),
    ))
    .returning();
  if (!updated) redirectWith("/login", "error", "Email verification link is invalid or has already been used.");
  await logSecurityEvent(user.id, "email.verified", {});
  redirectWith("/", "success", "Email verified successfully.");
}

export async function resendVerificationAction(formData: FormData) {
  await requireCsrf(formData, "/settings");
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.emailVerified) redirectWith("/settings", "success", "Email is already verified.");
  const token = createToken();
  await db
    .update(users)
    .set({ emailVerified: false, emailVerificationTokenHash: hashToken(token), emailVerificationSentAt: new Date() })
    .where(eq(users.id, user.id));
  await logSecurityEvent(user.id, "email.verification_requested", {});
  try {
    await sendVerificationEmail(user.email, token);
  } catch {
    await logSecurityEvent(user.id, "email.delivery_failed", { purpose: "verification" });
    if (env.NODE_ENV === "production") redirectWith("/settings", "error", "Verification email could not be sent. Please try again later.");
  }
  redirectWith("/settings", "success", developmentMessage("Verification email sent.", "/verify-email", token));
}

export async function saveSettingsAction(formData: FormData) {
  await requireCsrf(formData, "/settings");
  const user = await currentUser();
  if (!user) redirect("/login");
  const displayName = asString(formData, "display_name").slice(0, 128) || user.username;
  const course = asString(formData, "course").slice(0, 128) || null;
  const bio = asString(formData, "bio").slice(0, 2000) || null;
  const timezone = asString(formData, "timezone").slice(0, 64) || "UTC";
  const language = asString(formData, "language").slice(0, 16) || "en";
  let theme = asString(formData, "theme").slice(0, 32) || "rain";
  if (!["rain", "cyan", "ocean", "forest", "aurora", "purple", "light", "high-contrast"].includes(theme)) theme = "rain";
  let profileVisibility = asString(formData, "profile_visibility") || "private";
  if (!["private", "classmates", "public"].includes(profileVisibility)) profileVisibility = "private";

  await ensureAccountRecords(user);
  await db
    .update(userProfiles)
    .set({
      displayName,
      course,
      bio,
      institution: asString(formData, "institution").slice(0, 255) || null,
      educationLevel: asString(formData, "education_level").slice(0, 128) || null,
      fieldOfStudy: asString(formData, "field_of_study").slice(0, 128) || null,
      country: asString(formData, "country").slice(0, 128) || null,
      profileVisibility,
      showEmail: formData.get("show_email") === "on",
      showAcademicProfile: formData.get("show_academic_profile") === "on",
      updatedAt: new Date(),
    })
    .where(eq(userProfiles.userId, user.id));
  await db
    .update(userSettings)
    .set({
      timezone,
      language,
      theme,
      reducedMotion: formData.get("reduced_motion") === "on",
      highContrast: formData.get("high_contrast") === "on",
      emailNotifications: formData.get("email_notifications") === "on",
      studyReminders: formData.get("study_reminders") === "on",
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, user.id));
  await db.update(users).set({ course, bio }).where(eq(users.id, user.id));
  await logSecurityEvent(user.id, "settings.updated", {});
  revalidatePath("/settings");
  redirectWith("/settings", "success", "Settings saved.");
}

export async function saveThemeAction(
  previousState: ThemeActionState,
  formData: FormData,
): Promise<ThemeActionState> {
  await requireCsrf(formData, "/settings");
  const user = await currentUser();
  if (!user) redirect("/login");
  const requestedTheme = asString(formData, "theme");
  const theme = normalizeTheme(requestedTheme);

  if (requestedTheme !== theme) {
    return { message: "That theme is not available.", status: "error", theme: previousState.theme };
  }

  await ensureAccountRecords(user);
  await db
    .update(userSettings)
    .set({ theme, updatedAt: new Date() })
    .where(eq(userSettings.userId, user.id));
  await logSecurityEvent(user.id, "settings.theme_updated", { theme });
  revalidatePath("/", "layout");
  return { message: "Saved", status: "saved", theme };
}

export async function changePasswordAction(formData: FormData) {
  await requireCsrf(formData, "/settings");
  const user = await currentUser();
  if (!user) redirect("/login");
  const currentPassword = String(formData.get("current_password") || "");
  const password = String(formData.get("new_password") || formData.get("password") || "");
  const confirmPassword = String(formData.get("confirm_password") || "");
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    await logSecurityEvent(user.id, "password.change_failed", { reason: "current_password" });
    redirectWith("/settings", "error", "Current password is incorrect.");
  }
  if (password !== confirmPassword) {
    await logSecurityEvent(user.id, "password.change_failed", { reason: "confirmation" });
    redirectWith("/settings", "error", "New password confirmation does not match.");
  }
  const strengthErrors = passwordStrengthErrors(password);
  if (strengthErrors.length) {
    await logSecurityEvent(user.id, "password.change_failed", { reason: "strength" });
    redirectWith("/settings", "error", strengthErrors[0]);
  }
  await db.update(users).set({ passwordHash: hashPassword(password) }).where(eq(users.id, user.id));
  await revokeAllUserSessions(user.id);
  await logSecurityEvent(user.id, "password.changed", {});
  await createSession(user.id);
  redirectWith("/settings", "success", "Password changed. Other sessions were signed out.");
}

export async function requestEmailChangeAction(formData: FormData) {
  await requireCsrf(formData, "/settings");
  const user = await currentUser();
  if (!user) redirect("/login");
  const pendingEmail = normalizeEmail(formData.get("new_email") || formData.get("pending_email"));
  const password = String(formData.get("password") || "");
  if (!pendingEmail) redirectWith("/settings", "error", "New email is required.");
  if (!isValidAccountEmail(pendingEmail)) redirectWith("/settings", "error", "Enter a valid email address.");
  if (!verifyPassword(password, user.passwordHash)) {
    await logSecurityEvent(user.id, "email.change_failed", { reason: "password" });
    redirectWith("/settings", "error", "Password confirmation failed.");
  }
  if (pendingEmail === user.email) redirectWith("/settings", "error", "That email is already on your account.");
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, pendingEmail)).limit(1);
  if (existing && existing.id !== user.id) {
    await logSecurityEvent(user.id, "email.change_failed", { reason: "duplicate" });
    redirectWith("/settings", "error", "That email is already in use.");
  }
  const token = createToken();
  await db
    .update(users)
    .set({ pendingEmail, pendingEmailTokenHash: hashToken(token), pendingEmailSentAt: new Date() })
    .where(eq(users.id, user.id));
  await logSecurityEvent(user.id, "email.change_requested", {});
  try {
    await sendEmailChangeEmail(pendingEmail, token);
  } catch {
    await logSecurityEvent(user.id, "email.delivery_failed", { purpose: "email_change" });
    if (env.NODE_ENV === "production") redirectWith("/settings", "error", "Confirmation email could not be sent. Please try again later.");
  }
  redirectWith("/settings", "success", developmentMessage("Confirmation email sent to the new address.", "/settings/confirm-email-change", token));
}

export async function confirmEmailChangeAction(token: string, formData: FormData) {
  await requireCsrf(formData, `/settings/confirm-email-change/${encodeURIComponent(token)}`);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.pendingEmailTokenHash, hashToken(token)))
    .limit(1);
  const newEmail = user?.pendingEmail;
  if (!newEmail) redirectWith("/settings", "error", "That email-change link is invalid or expired.");
  if (!user.pendingEmailSentAt || user.pendingEmailSentAt <= addHours(new Date(), -24)) {
    await db
      .update(users)
      .set({ pendingEmail: null, pendingEmailTokenHash: null, pendingEmailSentAt: null })
      .where(eq(users.id, user.id));
    await logSecurityEvent(user.id, "email.change_failed", { reason: "expired" });
    redirectWith("/settings", "error", "Email change link has expired.");
  }
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, newEmail)).limit(1);
  if (existing && existing.id !== user.id) {
    await logSecurityEvent(user.id, "email.change_failed", { reason: "duplicate_on_confirm" });
    redirectWith("/settings", "error", "That email is already in use.");
  }
  const oldEmail = user.email;
  let updated: { id: number } | undefined;
  try {
    [updated] = await db
      .update(users)
      .set({
        email: newEmail,
        emailVerified: true,
        pendingEmail: null,
        pendingEmailTokenHash: null,
        pendingEmailSentAt: null,
        emailVerificationTokenHash: null,
        emailVerificationSentAt: null,
      })
      .where(and(
        eq(users.id, user.id),
        eq(users.pendingEmailTokenHash, hashToken(token)),
        gt(users.pendingEmailSentAt, addHours(new Date(), -24)),
      ))
      .returning();
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      await logSecurityEvent(user.id, "email.change_failed", { reason: "duplicate_on_confirm" });
      redirectWith("/settings", "error", "That email is already in use.");
    }
    throw error;
  }
  if (!updated) redirectWith("/settings", "error", "That email-change link is invalid or has already been used.");
  await logSecurityEvent(user.id, "email.changed", { old_email: oldEmail });
  await revokeAllUserSessions(user.id);
  await destroySession();
  redirectWith("/login", "success", "Email changed successfully. Please sign in again.");
}

export async function deleteAccountAction(formData: FormData) {
  await requireCsrf(formData, "/settings");
  const user = await currentUser();
  if (!user) redirect("/login");
  if (asString(formData, "confirmation") !== "DELETE" && asString(formData, "confirm") !== "DELETE") {
    await logSecurityEvent(user.id, "account.delete_failed", { reason: "confirmation" });
    redirectWith("/settings", "error", "Type DELETE to confirm account deletion.");
  }
  if (!verifyPassword(String(formData.get("password") || ""), user.passwordHash)) {
    await logSecurityEvent(user.id, "account.delete_failed", { reason: "password" });
    redirectWith("/settings", "error", "Password confirmation failed.");
  }
  await logSecurityEvent(user.id, "account.deleted", {});
  await destroySession();
  await deleteUserAccount(user.id);
  redirectWith("/register", "success", "Your account and Study Space data have been deleted.");
}

export async function revokeSessionAction(formData: FormData) {
  await requireCsrf(formData, "/settings");
  const user = await currentUser();
  if (!user) redirect("/login");
  const sessionId = Number(formData.get("session_id"));
  if (!Number.isSafeInteger(sessionId) || sessionId <= 0) redirectWith("/settings", "error", "Invalid session.");
  const revoked = await revokeOwnedSession(user.id, sessionId);
  if (!revoked) redirectWith("/settings", "error", "That session is no longer active.");
  await logSecurityEvent(user.id, "session.revoked", { session_id: sessionId });
  redirectWith("/settings", "success", "Session signed out.");
}

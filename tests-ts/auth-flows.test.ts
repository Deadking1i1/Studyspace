import { describe, expect, it } from "vitest";
import { addHours, createToken, hashToken } from "@/lib/auth/tokens";
import { hashPassword, verifyPassword, passwordStrengthErrors } from "@/lib/auth/password";

type TestUser = {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  emailVerificationTokenHash: string | null;
  emailVerificationSentAt: Date | null;
  pendingEmail: string | null;
  pendingEmailTokenHash: string | null;
  pendingEmailSentAt: Date | null;
  passwordResetTokenHash: string | null;
  passwordResetSentAt: Date | null;
  deleted: boolean;
};

class AuthHarness {
  users = new Map<number, TestUser>();
  sessions = new Map<string, { userId: number; expiresAt: Date; revokedAt: Date | null }>();
  events: string[] = [];
  nextId = 1;

  register(username: string, emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();
    if (!username || !email || !password) throw new Error("Please fill in all registration fields.");
    const errors = passwordStrengthErrors(password);
    if (errors.length) throw new Error(errors[0]);
    if ([...this.users.values()].some((user) => user.email === email || user.username === username)) {
      throw new Error("A user with that email or username already exists.");
    }
    const token = createToken();
    const user: TestUser = {
      id: this.nextId++,
      username,
      email,
      passwordHash: hashPassword(password),
      emailVerified: false,
      emailVerificationTokenHash: hashToken(token),
      emailVerificationSentAt: new Date(),
      pendingEmail: null,
      pendingEmailTokenHash: null,
      pendingEmailSentAt: null,
      passwordResetTokenHash: null,
      passwordResetSentAt: null,
      deleted: false,
    };
    this.users.set(user.id, user);
    this.events.push("account.registered");
    return { user, token };
  }

  login(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();
    const user = [...this.users.values()].find((item) => item.email === email && !item.deleted);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      this.events.push("auth.login_failed");
      throw new Error("Invalid email or password.");
    }
    const session = createToken();
    this.sessions.set(session, { userId: user.id, expiresAt: addHours(new Date(), 24 * 7), revokedAt: null });
    this.events.push("auth.login_success");
    return session;
  }

  logout(session: string) {
    const record = this.sessions.get(session);
    if (record) record.revokedAt = new Date();
    this.events.push("auth.logout");
  }

  requireUser(session: string) {
    const record = this.sessions.get(session);
    if (!record || record.revokedAt || record.expiresAt <= new Date()) throw new Error("Authentication required.");
    const user = this.users.get(record.userId);
    if (!user || user.deleted) throw new Error("Authentication required.");
    return user;
  }

  verifyEmail(token: string) {
    const user = [...this.users.values()].find((item) => item.emailVerificationTokenHash === hashToken(token));
    if (!user) throw new Error("Email verification link is invalid.");
    if (!user.emailVerificationSentAt || user.emailVerificationSentAt <= addHours(new Date(), -48)) {
      this.events.push("email.verify_failed");
      throw new Error("Email verification link has expired.");
    }
    user.emailVerified = true;
    user.emailVerificationTokenHash = null;
    user.emailVerificationSentAt = null;
    this.events.push("email.verified");
  }

  requestPasswordReset(emailInput: string) {
    const email = emailInput.trim().toLowerCase();
    const user = [...this.users.values()].find((item) => item.email === email && !item.deleted);
    if (!user) {
      this.events.push("password.reset_requested_unknown");
      return null;
    }
    const token = createToken();
    user.passwordResetTokenHash = hashToken(token);
    user.passwordResetSentAt = new Date();
    this.events.push("password.reset_requested");
    return token;
  }

  resetPassword(token: string, password: string, confirmPassword: string) {
    const user = [...this.users.values()].find((item) => item.passwordResetTokenHash === hashToken(token));
    if (!user) throw new Error("Password reset link is invalid.");
    if (!user.passwordResetSentAt || user.passwordResetSentAt <= addHours(new Date(), -2)) {
      this.events.push("password.reset_failed");
      throw new Error("Password reset link has expired.");
    }
    if (password !== confirmPassword) {
      this.events.push("password.reset_failed");
      throw new Error("Password confirmation does not match.");
    }
    const errors = passwordStrengthErrors(password);
    if (errors.length) {
      this.events.push("password.reset_failed");
      throw new Error(errors[0]);
    }
    user.passwordHash = hashPassword(password);
    user.passwordResetTokenHash = null;
    user.passwordResetSentAt = null;
    this.events.push("password.reset_completed");
  }

  changePassword(session: string, currentPassword: string, newPassword: string, confirmPassword: string) {
    const user = this.requireUser(session);
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      this.events.push("password.change_failed");
      throw new Error("Current password is incorrect.");
    }
    if (newPassword !== confirmPassword) {
      this.events.push("password.change_failed");
      throw new Error("New password confirmation does not match.");
    }
    user.passwordHash = hashPassword(newPassword);
    this.events.push("password.changed");
  }

  requestEmailChange(session: string, newEmailInput: string, password: string) {
    const user = this.requireUser(session);
    const newEmail = newEmailInput.trim().toLowerCase();
    if (!verifyPassword(password, user.passwordHash)) {
      this.events.push("email.change_failed");
      throw new Error("Password confirmation failed.");
    }
    if ([...this.users.values()].some((item) => item.id !== user.id && item.email === newEmail)) {
      this.events.push("email.change_failed");
      throw new Error("That email is already in use.");
    }
    const token = createToken();
    user.pendingEmail = newEmail;
    user.pendingEmailTokenHash = hashToken(token);
    user.pendingEmailSentAt = new Date();
    this.events.push("email.change_requested");
    return token;
  }

  confirmEmailChange(token: string) {
    const user = [...this.users.values()].find((item) => item.pendingEmailTokenHash === hashToken(token));
    if (!user?.pendingEmail) throw new Error("Email change link is invalid.");
    user.email = user.pendingEmail;
    user.emailVerified = true;
    user.pendingEmail = null;
    user.pendingEmailTokenHash = null;
    user.pendingEmailSentAt = null;
    this.events.push("email.changed");
  }

  deleteAccount(session: string, password: string, confirmation: string) {
    const user = this.requireUser(session);
    if (confirmation !== "DELETE") {
      this.events.push("account.delete_failed");
      throw new Error("Type DELETE to confirm account deletion.");
    }
    if (!verifyPassword(password, user.passwordHash)) {
      this.events.push("account.delete_failed");
      throw new Error("Password confirmation failed.");
    }
    user.deleted = true;
    this.events.push("account.deleted");
  }
}

describe("authentication parity flows", () => {
  it("covers registration, duplicate registration, login, logout and protected access", () => {
    const auth = new AuthHarness();
    auth.register("student", " Student@Example.com ", "StrongPass123!");
    expect(() => auth.register("student2", "student@example.com", "StrongPass123!")).toThrow(/already exists/);
    const session = auth.login("STUDENT@example.com", "StrongPass123!");
    expect(auth.requireUser(session).email).toBe("student@example.com");
    expect(() => auth.login("student@example.com", "wrong")).toThrow(/Invalid/);
    auth.logout(session);
    expect(() => auth.requireUser(session)).toThrow(/Authentication required/);
  });

  it("rejects expired sessions", () => {
    const auth = new AuthHarness();
    const { user } = auth.register("student", "student@example.com", "StrongPass123!");
    auth.sessions.set("expired", { userId: user.id, expiresAt: addHours(new Date(), -1), revokedAt: null });
    expect(() => auth.requireUser("expired")).toThrow(/Authentication required/);
  });

  it("handles email verification and password reset", () => {
    const auth = new AuthHarness();
    const { user, token } = auth.register("student", "student@example.com", "StrongPass123!");
    auth.verifyEmail(token);
    expect(user.emailVerified).toBe(true);
    const resetToken = auth.requestPasswordReset("student@example.com");
    expect(resetToken).toBeTruthy();
    auth.resetPassword(resetToken!, "NewStrongPass123!", "NewStrongPass123!");
    expect(verifyPassword("NewStrongPass123!", user.passwordHash)).toBe(true);
    expect(user.passwordResetTokenHash).toBeNull();
  });

  it("logs reset and change failures for security review", () => {
    const auth = new AuthHarness();
    auth.register("student", "student@example.com", "StrongPass123!");
    const session = auth.login("student@example.com", "StrongPass123!");
    expect(() => auth.changePassword(session, "wrong", "NewStrongPass123!", "NewStrongPass123!")).toThrow(/incorrect/);
    const resetToken = auth.requestPasswordReset("student@example.com")!;
    expect(() => auth.resetPassword(resetToken, "NewStrongPass123!", "Mismatch123!")).toThrow(/confirmation/);
    expect(auth.events).toContain("password.change_failed");
    expect(auth.events).toContain("password.reset_failed");
  });

  it("handles email change and account deletion permissions", () => {
    const auth = new AuthHarness();
    auth.register("student", "student@example.com", "StrongPass123!");
    auth.register("peer", "peer@example.com", "StrongPass123!");
    const session = auth.login("student@example.com", "StrongPass123!");
    expect(() => auth.requestEmailChange(session, "peer@example.com", "StrongPass123!")).toThrow(/already in use/);
    const token = auth.requestEmailChange(session, "new@example.com", "StrongPass123!");
    auth.confirmEmailChange(token);
    expect(auth.requireUser(session).email).toBe("new@example.com");
    expect(() => auth.deleteAccount(session, "wrong", "DELETE")).toThrow(/Password confirmation failed/);
    auth.deleteAccount(session, "StrongPass123!", "DELETE");
    expect(() => auth.requireUser(session)).toThrow(/Authentication required/);
  });
});

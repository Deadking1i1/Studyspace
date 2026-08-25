import { NextResponse, type NextRequest } from "next/server";
import { CSRF_COOKIE, SESSION_COOKIE } from "@/lib/auth/constants";
import { assertProductionEnvironment } from "@/lib/env";

const csrfPagePrefixes = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/settings",
  "/notes",
  "/materials",
  "/tasks",
  "/calendar",
  "/timer",
  "/flashcards",
  "/notifications",
  "/community",
  "/groups",
  "/feed",
  "/integrations/spotify",
  "/spotify",
  "/assistant",
];
const protectedPagePrefixes = [
  "/settings",
  "/profile",
  "/notes",
  "/materials",
  "/tasks",
  "/calendar",
  "/timer",
  "/flashcards",
  "/notifications",
  "/achievements",
  "/community",
  "/groups",
  "/feed",
  "/spotify",
  "/integrations/spotify",
  "/assistant",
  "/dashboard",
  "/hub",
  "/notes_hub",
];
const protectedApiPrefixes = ["/api/account", "/api/settings"];

function csrfToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function proxy(request: NextRequest) {
  assertProductionEnvironment();
  const pathname = request.nextUrl.pathname;
  const needsDashboardAuth = pathname === "/";
  const needsPageAuth = protectedPagePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const needsApiAuth = protectedApiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if ((needsDashboardAuth || needsPageAuth || needsApiAuth) && !hasSessionCookie) {
    if (needsApiAuth) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const needsCsrf =
    request.method === "GET" &&
    (needsDashboardAuth ||
      needsPageAuth ||
      csrfPagePrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      ));
  if (needsCsrf && !request.cookies.get(CSRF_COOKIE)?.value) {
    const response = NextResponse.redirect(request.url);
    response.cookies.set(CSRF_COOKIE, csrfToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/",
    "/register",
    "/forgot-password",
    "/reset-password/:path*",
    "/verify-email/:path*",
    "/settings/:path*",
    "/profile/:path*",
    "/notes/:path*",
    "/materials/:path*",
    "/tasks/:path*",
    "/calendar/:path*",
    "/timer/:path*",
    "/flashcards/:path*",
    "/notifications/:path*",
    "/achievements/:path*",
    "/community/:path*",
    "/groups/:path*",
    "/feed/:path*",
    "/spotify/:path*",
    "/integrations/spotify/:path*",
    "/assistant/:path*",
    "/dashboard/:path*",
    "/hub/:path*",
    "/notes_hub/:path*",
    "/api/integrations/spotify/:path*",
    "/api/account/:path*",
    "/api/settings/:path*",
  ],
};

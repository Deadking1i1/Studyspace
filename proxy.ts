import { NextResponse, type NextRequest } from "next/server";
import { CSRF_COOKIE, SESSION_COOKIE } from "@/lib/auth/constants";

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
];
const protectedApiPrefixes = ["/api/account"];

function csrfToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const needsPageAuth = protectedPagePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const needsApiAuth = protectedApiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if ((needsPageAuth || needsApiAuth) && !hasSessionCookie) {
    if (needsApiAuth) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const needsCsrf = request.method === "GET" && csrfPagePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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
    "/api/integrations/spotify/:path*",
    "/api/account/:path*",
  ],
};

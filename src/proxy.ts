import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasAcceptedLegalConsent, legalConsentPath } from "@/lib/legal-consent";
import { isLocal } from "@/lib/mode";

// Next 16: this file is `proxy.ts` (formerly `middleware.ts`). Refreshes the
// Supabase session on every request and guards protected routes.
export async function proxy(request: NextRequest) {
  // Local mode has no auth or billing: everything is public and single-user.
  if (isLocal()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser, auth bugs hide here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users hitting protected routes to /login.
  // Public paths: landing (/), /login, legal pages, and /auth/* routes.
  // /admin is gated by its own secret (see lib/admin-auth.ts), independent of
  // the Supabase user session.
  const { pathname } = request.nextUrl;
  const isPublicPath =
    pathname === "/" ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/opengraph-image") ||
    pathname.startsWith("/twitter-image") ||
    pathname.startsWith("/api/landing/") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/credits") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/refund") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/admin");

  // Logged-in users don't need the login page,  send them into the app
  // (legal-consent gate below still applies once they hit a protected route).
  if (user && pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  if (
    user &&
    !(await hasAcceptedLegalConsent(supabase, user.id)) &&
    !isPublicPath
  ) {
    const nextPath = `${pathname}${request.nextUrl.search}`;
    return NextResponse.redirect(
      new URL(legalConsentPath(nextPath), request.url),
    );
  }

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except static assets, image optimization, and crawl metadata.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap\\.xml|robots\\.txt|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

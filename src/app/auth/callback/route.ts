import { NextResponse, type NextRequest } from "next/server";
import {
  hasAcceptedLegalConsent,
  legalConsentPath,
  normalizeNextPath,
  shouldEnforceLegalOnPath,
} from "@/lib/legal-consent";
import { trackProductEvent } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";

function toMs(value?: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function isFirstAuthSession(user: { created_at?: string; last_sign_in_at?: string | null }) {
  const createdAt = toMs(user.created_at);
  const lastSignInAt = toMs(user.last_sign_in_at);
  if (!createdAt) return false;
  if (!lastSignInAt) return true;
  // Supabase updates last_sign_in_at on each login; on first login it's near created_at.
  return Math.abs(lastSignInAt - createdAt) <= 5 * 60 * 1000;
}

// Handles the OAuth (PKCE) redirect: ?code=...
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = normalizeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && !next.startsWith("/auth/reset")) {
        const provider = String(user.app_metadata?.provider ?? "oauth");
        const firstSession = isFirstAuthSession(user);

        if (firstSession) {
          void trackProductEvent({
            event: "signup_completed",
            distinctId: user.id,
            insertId: `signup:${user.id}`,
            properties: {
              method: provider,
              has_user_id: true,
            },
          });

          void trackProductEvent({
            event: "funnel_signup_completed",
            distinctId: user.id,
            insertId: `funnel:signup:${user.id}`,
            properties: {
              method: provider,
            },
          });
        }

        void trackProductEvent({
          event: "login_completed",
          distinctId: user.id,
          properties: {
            method: provider,
            next,
          },
        });
      }

      if (shouldEnforceLegalOnPath(next)) {
        if (user && !(await hasAcceptedLegalConsent(supabase, user.id))) {
          return NextResponse.redirect(new URL(legalConsentPath(next), request.url));
        }
      }
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=Sign-in%20failed", request.url),
  );
}

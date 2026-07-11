import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  hasAcceptedLegalConsent,
  legalConsentPath,
  normalizeNextPath,
  shouldEnforceLegalOnPath,
} from "@/lib/legal-consent";
import { createClient } from "@/lib/supabase/server";

// Handles the link Supabase emails on signup: ?token_hash=...&type=email
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = normalizeNextPath(searchParams.get("next"));

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (shouldEnforceLegalOnPath(next)) {
        if (user && !(await hasAcceptedLegalConsent(supabase, user.id))) {
          return NextResponse.redirect(new URL(legalConsentPath(next), request.url));
        }
      }
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=Email%20verification%20failed", request.url),
  );
}

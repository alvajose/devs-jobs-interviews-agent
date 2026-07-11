"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  hasAcceptedLegalConsent,
  legalConsentPath,
  normalizeNextPath,
} from "@/lib/legal-consent";
import { trackProductEvent } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstileToken } from "@/lib/turnstile";

function hasAcceptedLegal(formData: FormData) {
  return formData.get("acceptLegal") === "yes";
}

async function appOrigin(): Promise<string> {
  const headerOrigin = (await headers()).get("origin");
  if (headerOrigin) return headerOrigin;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  return "http://localhost:3000";
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: String(formData.get("password")),
  });

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=Sign-in%20failed");

  void trackProductEvent({
    event: "login_completed",
    distinctId: user.id,
    properties: {
      method: "password",
      email,
    },
  });

  if (!(await hasAcceptedLegalConsent(supabase, user.id))) {
    redirect(legalConsentPath("/app"));
  }

  revalidatePath("/", "layout");
  redirect("/app");
}

export async function signup(formData: FormData) {
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip")?.trim() ||
    undefined;
  const captchaError = await verifyTurnstileToken(
    String(formData.get("cf-turnstile-response") ?? ""),
    ip,
  );
  if (captchaError) {
    redirect(`/login?error=${encodeURIComponent(captchaError)}`);
  }

  const supabase = await createClient();

  const origin = await appOrigin();
  const email = String(formData.get("email"));

  const { data, error } = await supabase.auth.signUp({
    email,
    password: String(formData.get("password")),
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);

  void trackProductEvent({
    event: "signup_completed",
    distinctId: data.user?.id ?? email.toLowerCase(),
    insertId: data.user?.id ? `signup:${data.user.id}` : undefined,
    properties: {
      method: "password",
      has_user_id: Boolean(data.user?.id),
    },
  });

  if (data.user?.id) {
    void trackProductEvent({
      event: "funnel_signup_completed",
      distinctId: data.user.id,
      insertId: `funnel:signup:${data.user.id}`,
      properties: {
        method: "password",
      },
    });
  }

  // With email confirmation on, the user must verify before the session is active.
  redirect("/login?message=Check%20your%20email%20to%20confirm%20your%20account");
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = await appOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect(data.url);
}

export async function acceptLegalConsent(formData: FormData) {
  const next = normalizeNextPath(String(formData.get("next") ?? "/app"));
  if (!hasAcceptedLegal(formData)) {
    redirect(
      `/auth/legal-consent?next=${encodeURIComponent(next)}&error=You%20must%20accept%20the%20Terms%20and%20Privacy%20Policy%20to%20continue`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?error=Please%20sign%20in%20again");
  }

  const { error } = await supabase.rpc("accept_legal_consent");
  if (error) {
    redirect(
      `/auth/legal-consent?next=${encodeURIComponent(next)}&error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect("/auth/forgot?error=Please%20enter%20your%20email");
  }

  const supabase = await createClient();
  const origin = await appOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset`,
  });

  if (error) {
    redirect(`/auth/forgot?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/auth/forgot?message=Check%20your%20email%20for%20a%20reset%20link");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (password.length < 8) {
    redirect("/auth/reset?error=Password%20must%20be%20at%20least%208%20characters");
  }
  if (password !== passwordConfirm) {
    redirect("/auth/reset?error=Passwords%20do%20not%20match");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      "/auth/forgot?error=Your%20reset%20link%20has%20expired.%20Please%20request%20a%20new%20one.",
    );
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/auth/reset?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login?message=Password%20updated.%20Please%20log%20in.");
}

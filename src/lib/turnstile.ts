import "server-only";

type TurnstileVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

/** Returns null when verification passes; otherwise an error message for the user. */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  ip?: string,
): Promise<string | null> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return null;

  if (!token?.trim()) {
    return "Please complete the CAPTCHA.";
  }

  const body = new URLSearchParams({
    secret,
    response: token.trim(),
    ...(ip ? { remoteip: ip } : {}),
  });

  let payload: TurnstileVerifyResponse;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    payload = (await res.json()) as TurnstileVerifyResponse;
  } catch {
    return "CAPTCHA verification failed. Please try again.";
  }

  if (payload.success) return null;
  return "CAPTCHA verification failed. Please try again.";
}

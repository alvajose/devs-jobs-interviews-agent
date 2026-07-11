/** Public Turnstile config for client components (no server-only import). */
export function turnstileSiteKey(): string | null {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return key || null;
}

export function turnstileEnabled(): boolean {
  return Boolean(turnstileSiteKey());
}

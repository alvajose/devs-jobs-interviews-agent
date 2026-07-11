// App runtime mode. "local" = OSS single-user (SQLite, no login, no billing).
// "hosted" = the deployed product (Supabase auth + Stripe credits).
//
// Prefer NEXT_PUBLIC_APP_MODE so client components and the server agree.
// APP_MODE remains a server-only alias for older .env files.
export type AppMode = "local" | "hosted";

export function appMode(): AppMode {
  const explicit = process.env.NEXT_PUBLIC_APP_MODE ?? process.env.APP_MODE;
  if (explicit === "local" || explicit === "hosted") return explicit;
  // No explicit mode: a configured Supabase URL means this is the hosted deploy;
  // a fresh clone without it runs fully local.
  return process.env.NEXT_PUBLIC_SUPABASE_URL ? "hosted" : "local";
}

export const isLocal = () => appMode() === "local";
export const isHosted = () => appMode() === "hosted";

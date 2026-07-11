import { describe, it, expect, vi } from "vitest";
import { checkEnv, validateEnv } from "@/lib/env";

const CORE_OK = {
  NEXT_PUBLIC_SUPABASE_URL: "x",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "x",
  SUPABASE_SERVICE_ROLE_KEY: "x",
  GEMINI_API_KEY: "x",
};

describe("checkEnv", () => {
  it("passes in dev when core is set", () => {
    expect(checkEnv({ ...CORE_OK, NODE_ENV: "development" }).hardMissing).toEqual([]);
  });

  it("reports all core vars as hard-missing when empty (hosted)", () => {
    expect(checkEnv({ APP_MODE: "hosted", NODE_ENV: "development" }).hardMissing).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "GEMINI_API_KEY",
    ]);
  });

  it("local mode never hard-fails, only warns on a missing LLM key", () => {
    expect(checkEnv({ APP_MODE: "local" }).hardMissing).toEqual([]);
    expect(checkEnv({ APP_MODE: "local" }).warn).toContain("GEMINI_API_KEY");
    expect(checkEnv({ APP_MODE: "local", GEMINI_API_KEY: "x" }).warn).toEqual([]);
    expect(checkEnv({ NEXT_PUBLIC_APP_MODE: "local", GEMINI_API_KEY: "x" }).warn).toEqual([]);
  });

  it("prefers NEXT_PUBLIC_APP_MODE over APP_MODE when both are set", () => {
    expect(
      checkEnv({
        ...CORE_OK,
        NEXT_PUBLIC_APP_MODE: "local",
        APP_MODE: "hosted",
      }).hardMissing,
    ).toEqual([]);
  });

  it("infers local mode when no Supabase URL and no explicit mode", () => {
    expect(checkEnv({ NODE_ENV: "development" }).hardMissing).toEqual([]);
  });

  it("escalates prod-required vars to hard-missing in production", () => {
    expect(checkEnv({ ...CORE_OK, NODE_ENV: "production" }).hardMissing).toContain(
      "ADMIN_SECRET_HASH",
    );
  });

  it("only warns on prod-required vars in dev", () => {
    expect(checkEnv({ ...CORE_OK, NODE_ENV: "development" }).warn).toContain("ADMIN_SECRET_HASH");
  });

  it("requires LLM_API_KEY (not GEMINI_API_KEY) for the compatible provider", () => {
    expect(checkEnv({ ...CORE_OK, LLM_PROVIDER: "compatible" }).hardMissing).toContain(
      "LLM_API_KEY",
    );
  });

  it("accepts either Sentry DSN", () => {
    const report = checkEnv({ ...CORE_OK, NEXT_PUBLIC_SENTRY_DSN: "x" });
    expect(report.warn.some((w) => w.startsWith("SENTRY_DSN"))).toBe(false);
  });
});

describe("validateEnv", () => {
  it("throws listing the missing core vars", () => {
    expect(() => validateEnv({ APP_MODE: "hosted", NODE_ENV: "development" })).toThrow(/Missing required/);
  });

  it("does not throw when core is set, but warns on the rest", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => validateEnv({ ...CORE_OK, NODE_ENV: "development" })).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

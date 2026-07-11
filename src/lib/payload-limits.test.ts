import { describe, it, expect } from "vitest";
import {
  MAX_CHAT_MESSAGES,
  MAX_MESSAGE_TEXT_CHARS,
  MAX_PROFILE_FIELD_CHARS,
  MAX_ROADMAP_TARGET_CHARS,
  validateChatPayload,
  validateProfileField,
  validateRoadmapPayload,
} from "@/lib/payload-limits";

describe("validateChatPayload", () => {
  it("rejects an empty chat", () => {
    expect(validateChatPayload([]).ok).toBe(false);
  });

  it("accepts a minimal chat", () => {
    expect(validateChatPayload([{ role: "user", text: "hi" }]).ok).toBe(true);
  });

  it("rejects too many messages", () => {
    const tooMany = Array.from({ length: MAX_CHAT_MESSAGES + 1 }, () => ({ role: "user", text: "x" }));
    expect(validateChatPayload(tooMany).ok).toBe(false);
  });

  it("rejects an over-long message", () => {
    expect(
      validateChatPayload([{ role: "user", text: "x".repeat(MAX_MESSAGE_TEXT_CHARS + 1) }]).ok,
    ).toBe(false);
  });

  it("rejects an invalid role", () => {
    expect(validateChatPayload([{ role: "admin", text: "hi" }]).ok).toBe(false);
  });

  it("rejects a non-object message", () => {
    expect(validateChatPayload(["nope"]).ok).toBe(false);
  });

  it("rejects when the combined payload is too large", () => {
    // 11 messages of max size stay under the per-message and count limits, but blow the total.
    const big = Array.from({ length: 11 }, () => ({
      role: "user",
      text: "x".repeat(MAX_MESSAGE_TEXT_CHARS),
    }));
    const result = validateChatPayload(big);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("payload_too_large");
  });
});

describe("validateRoadmapPayload", () => {
  it("accepts a short target", () => {
    expect(validateRoadmapPayload("ab").ok).toBe(true);
  });

  it("rejects a tiny target", () => {
    expect(validateRoadmapPayload("a").ok).toBe(false);
  });

  it("rejects a non-string target", () => {
    expect(validateRoadmapPayload(42).ok).toBe(false);
  });

  it("rejects an over-long target", () => {
    const result = validateRoadmapPayload("x".repeat(MAX_ROADMAP_TARGET_CHARS + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("payload_too_large");
  });
});

describe("validateProfileField", () => {
  it("passes null/empty values", () => {
    expect(validateProfileField(null, "Role")).toBeNull();
    expect(validateProfileField("", "Role")).toBeNull();
  });

  it("passes a short value", () => {
    expect(validateProfileField("Backend Engineer", "Role")).toBeNull();
  });

  it("rejects an over-long value with a labeled message", () => {
    const err = validateProfileField("x".repeat(MAX_PROFILE_FIELD_CHARS + 1), "Role");
    expect(err).toMatch(/^Role exceeds/);
  });
});

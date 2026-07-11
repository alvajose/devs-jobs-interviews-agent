import { describe, it, expect } from "vitest";
import {
  extractJson,
  isProviderCapacityResponse,
  LlmCapacityError,
  isLlmCapacityError,
} from "@/lib/llm";

describe("extractJson", () => {
  it("parses a plain object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it("parses fenced json", () => {
    expect(extractJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });
  it("parses a bare fence", () => {
    expect(extractJson('```\n{"a":3}\n```')).toEqual({ a: 3 });
  });
  it("parses prose-wrapped json", () => {
    expect(extractJson('Sure! Here:\n{"a":4}\nHope it helps.')).toEqual({ a: 4 });
  });
  it("parses an array", () => {
    expect(extractJson("[1,2,3]")).toEqual([1, 2, 3]);
  });
  it("throws when there is no json", () => {
    expect(() => extractJson("no json at all")).toThrow();
  });
});

describe("isProviderCapacityResponse", () => {
  it("treats 429 and 402 as capacity", () => {
    expect(isProviderCapacityResponse(429, "")).toBe(true);
    expect(isProviderCapacityResponse(402, "")).toBe(true);
  });
  it("treats 503 with quota wording as capacity", () => {
    expect(isProviderCapacityResponse(503, "usage limit exceeded")).toBe(true);
  });
  it("does not treat generic 500/503 as capacity", () => {
    expect(isProviderCapacityResponse(500, "internal error")).toBe(false);
    expect(isProviderCapacityResponse(503, "upstream unavailable")).toBe(false);
  });
});

describe("LlmCapacityError", () => {
  it("is detected by isLlmCapacityError", () => {
    const err = new LlmCapacityError(429, "rate limit");
    expect(isLlmCapacityError(err)).toBe(true);
    expect(isLlmCapacityError(new Error("nope"))).toBe(false);
    expect(err.retryAfterSec).toBe(60);
  });
});

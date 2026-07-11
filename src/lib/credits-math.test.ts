import { describe, it, expect } from "vitest";
import {
  TOKENS_PER_CREDIT,
  additionalCreditsAfterReserve,
  addUsage,
  buildReason,
  creditsFor,
  normalizeQuestionForReason,
} from "@/lib/credits-math";

describe("creditsFor", () => {
  it("charges a minimum of 1 credit", () => {
    expect(creditsFor({ inputMiss: 0, inputHit: 0, output: 0 })).toBe(1);
  });
  it("stays at 1 under 1k billable tokens", () => {
    expect(creditsFor({ inputMiss: 500, inputHit: 9000, output: 400 })).toBe(1);
  });
  it("is 1 at exactly 1k billable", () => {
    expect(creditsFor({ inputMiss: TOKENS_PER_CREDIT, inputHit: 0, output: 0 })).toBe(1);
  });
  it("rounds up billable tokens", () => {
    expect(creditsFor({ inputMiss: TOKENS_PER_CREDIT + 1, inputHit: 0, output: 0 })).toBe(2);
  });
});

describe("addUsage", () => {
  it("sums each field", () => {
    expect(
      addUsage(
        { inputMiss: 100, inputHit: 10, output: 50 },
        { inputMiss: 200, inputHit: 20, output: 30 },
      ),
    ).toEqual({ inputMiss: 300, inputHit: 30, output: 80 });
  });
});

describe("normalizeQuestionForReason", () => {
  it("returns undefined for empty or whitespace input", () => {
    expect(normalizeQuestionForReason(undefined)).toBeUndefined();
    expect(normalizeQuestionForReason("   ")).toBeUndefined();
  });
  it("collapses internal whitespace", () => {
    expect(normalizeQuestionForReason("React   senior\n role")).toBe("React senior role");
  });
  it("truncates very long questions with an ellipsis", () => {
    const out = normalizeQuestionForReason("x".repeat(300))!;
    expect(out.length).toBe(220);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("buildReason", () => {
  it("encodes full context", () => {
    expect(
      buildReason({ kind: "roadmap", question: "React senior", conversationId: "abc" }),
    ).toBe("llm:chat=abc&q=React+senior&kind=roadmap");
  });
  it("falls back to 'llm' with no context", () => {
    expect(buildReason()).toBe("llm");
  });
  it("falls back to 'llm' when every field is empty", () => {
    expect(buildReason({ conversationId: "  ", question: "", kind: undefined })).toBe("llm");
  });
});

describe("additionalCreditsAfterReserve", () => {
  it("needs no extra charge for small usage after a hold", () => {
    expect(additionalCreditsAfterReserve({ inputMiss: 500, inputHit: 0, output: 0 }, 1)).toBe(0);
  });
  it("charges the remainder for large usage after a hold", () => {
    expect(additionalCreditsAfterReserve({ inputMiss: 2500, inputHit: 0, output: 0 }, 1)).toBe(2);
  });
});

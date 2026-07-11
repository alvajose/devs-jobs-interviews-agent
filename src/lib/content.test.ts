import { describe, it, expect } from "vitest";
import { monthsSince, parseTopicMarkdown, detectBankLanguage } from "@/lib/content";

const MD = `---
stack: laravel
id: t-1
title: Topic One
area: Backend
priority: high
resourceUrl: https://example.com
resourceLabel: Docs
---

## Summary
A summary line.

## Concepts

### Concept A
Detail of A.
\`\`\`php
echo "hi";
\`\`\`

### Concept B
Detail of B.

## Interview Questions

### How do you X?
By doing Y.
`;

describe("parseTopicMarkdown", () => {
  const mod = parseTopicMarkdown(MD);

  it("parses frontmatter fields", () => {
    expect(mod.id).toBe("t-1");
    expect(mod.stack).toBe("laravel");
    expect(mod.priority).toBe("high");
    expect(mod.summary).toBe("A summary line.");
    expect(mod.source).toBe("curated");
  });

  it("parses concepts, extracting the example from a fence", () => {
    expect(mod.concepts.length).toBe(2);
    expect(mod.concepts[0].name).toBe("Concept A");
    expect(mod.concepts[0].example).toBe('echo "hi";');
    expect(mod.concepts[0].detail).toBe("Detail of A.");
  });

  it("parses interview questions", () => {
    expect(mod.questions.length).toBe(1);
    expect(mod.questions[0].question).toBe("How do you X?");
    expect(mod.questions[0].answer).toBe("By doing Y.");
  });

  it("parses the resource", () => {
    expect(mod.resource).toEqual({ label: "Docs", url: "https://example.com" });
  });
});

describe("monthsSince", () => {
  const REF = new Date("2026-07-15T00:00:00Z");

  it("is 0 for the same month", () => {
    expect(monthsSince("2026-07", REF)).toBe(0);
  });
  it("counts a full year", () => {
    expect(monthsSince("2025-07", REF)).toBe(12);
  });
  it("counts six months", () => {
    expect(monthsSince("2026-01", REF)).toBe(6);
  });
  it("returns null for missing or invalid input", () => {
    expect(monthsSince(undefined, REF)).toBeNull();
    expect(monthsSince("2026-13", REF)).toBeNull();
    expect(monthsSince("nope", REF)).toBeNull();
  });
});

describe("detectBankLanguage", () => {
  it("detects Spanish banks", () => {
    expect(
      detectBankLanguage([
        { question: "¿Cuándo usás eventos y listeners?" },
        { question: "¿Cómo se ejecutan listeners de forma asíncrona?" },
      ]),
    ).toBe("es");
  });

  it("detects English banks", () => {
    expect(
      detectBankLanguage([
        { question: "When to use a Class Component over a Function Component?" },
        { question: "What are React Hooks?" },
      ]),
    ).toBe("en");
  });
});

describe("filterStacksByBankLanguage", () => {
  it("keeps laravel for Spanish and drops it for English", async () => {
    const { filterStacksByBankLanguage } = await import("@/lib/content");
    expect(filterStacksByBankLanguage(["laravel"], "es")).toEqual(["laravel"]);
    expect(filterStacksByBankLanguage(["laravel"], "en")).toEqual([]);
  });

  it("keeps react for English", async () => {
    const { filterStacksByBankLanguage } = await import("@/lib/content");
    expect(filterStacksByBankLanguage(["react"], "en")).toEqual(["react"]);
    expect(filterStacksByBankLanguage(["react"], "es")).toEqual([]);
  });
});

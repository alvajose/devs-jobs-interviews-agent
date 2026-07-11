/** Client-safe language heuristics for mixed ES/EN interview content. */

export function textLooksSpanish(text: string): boolean {
  return (
    /¿/.test(text) ||
    /\b(qué|cuál|cuáles|cómo|cuándo|dónde|por qué|para qué)\b/i.test(text)
  );
}

/** True when a majority of question prompts look Spanish. */
export function questionsLookSpanish(
  questions: { question: string }[] | undefined,
): boolean {
  if (!questions?.length) return false;
  const hits = questions.filter((q) => textLooksSpanish(q.question)).length;
  return hits >= Math.ceil(questions.length / 2);
}

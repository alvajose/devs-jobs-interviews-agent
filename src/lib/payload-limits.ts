import type { ChatMsg } from "./types";

/** Max messages in a chat request (conversation history sent to the LLM). */
export const MAX_CHAT_MESSAGES = 40;
/** Max characters in a single message text field. */
export const MAX_MESSAGE_TEXT_CHARS = 8_000;
/** Max total serialized payload size for chat (text + embedded roadmaps). */
export const MAX_CHAT_TOTAL_CHARS = 80_000;
/** Max characters for roadmap target / role string. */
export const MAX_ROADMAP_TARGET_CHARS = 500;
/** Max characters for optional profile fields in roadmap requests. */
export const MAX_PROFILE_FIELD_CHARS = 200;

export type PayloadLimitError = {
  ok: false;
  error: string;
  code: "validation" | "payload_too_large";
};

export type PayloadLimitOk = { ok: true };

function messageCharWeight(msg: ChatMsg): number {
  let n = msg.text?.length ?? 0;
  if (msg.roadmap) {
    try {
      n += JSON.stringify(msg.roadmap).length;
    } catch {
      n += MAX_MESSAGE_TEXT_CHARS;
    }
  }
  return n;
}

export function validateChatPayload(
  messages: unknown,
): PayloadLimitOk | PayloadLimitError {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: "No conversation provided.", code: "validation" };
  }
  if (messages.length > MAX_CHAT_MESSAGES) {
    return {
      ok: false,
      error: `Too many messages (max ${MAX_CHAT_MESSAGES}).`,
      code: "payload_too_large",
    };
  }

  let totalChars = 0;
  for (const raw of messages) {
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: "Invalid message shape.", code: "validation" };
    }
    const msg = raw as ChatMsg;
    if (msg.role !== "user" && msg.role !== "assistant") {
      return { ok: false, error: "Invalid message role.", code: "validation" };
    }
    if (msg.text != null && typeof msg.text !== "string") {
      return { ok: false, error: "Invalid message text.", code: "validation" };
    }
    if ((msg.text?.length ?? 0) > MAX_MESSAGE_TEXT_CHARS) {
      return {
        ok: false,
        error: `A message exceeds ${MAX_MESSAGE_TEXT_CHARS} characters.`,
        code: "payload_too_large",
      };
    }
    totalChars += messageCharWeight(msg);
    if (totalChars > MAX_CHAT_TOTAL_CHARS) {
      return {
        ok: false,
        error: "Conversation payload is too large.",
        code: "payload_too_large",
      };
    }
  }

  return { ok: true };
}

export function validateRoadmapPayload(target: unknown): PayloadLimitOk | PayloadLimitError {
  if (typeof target !== "string" || target.trim().length < 2) {
    return {
      ok: false,
      error: "Tell me which role or stack to prepare for.",
      code: "validation",
    };
  }
  if (target.length > MAX_ROADMAP_TARGET_CHARS) {
    return {
      ok: false,
      error: `Target text exceeds ${MAX_ROADMAP_TARGET_CHARS} characters.`,
      code: "payload_too_large",
    };
  }
  return { ok: true };
}

export function validateProfileField(value: unknown, label: string): string | null {
  if (value == null || value === "") return null;
  const s = String(value);
  if (s.length > MAX_PROFILE_FIELD_CHARS) {
    return `${label} exceeds ${MAX_PROFILE_FIELD_CHARS} characters.`;
  }
  return null;
}

import "server-only";
import { logWarn } from "@/lib/observability";

type ProductEvent = {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
  insertId?: string;
};

function analyticsApiKey() {
  return process.env.POSTHOG_API_KEY?.trim();
}

function analyticsHost() {
  return (process.env.POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
}

export async function trackProductEvent(input: ProductEvent): Promise<void> {
  const apiKey = analyticsApiKey();
  if (!apiKey) return;

  const payload = {
    api_key: apiKey,
    event: input.event,
    distinct_id: input.distinctId,
    properties: {
      ...input.properties,
      ...(input.insertId ? { $insert_id: input.insertId } : {}),
      $lib: "interviews-agent-server",
    },
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(`${analyticsHost()}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      logWarn("analytics.capture_failed", {
        event: input.event,
        status: response.status,
      });
    }
  } catch (error) {
    logWarn("analytics.capture_exception", {
      event: input.event,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

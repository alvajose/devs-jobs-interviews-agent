import { getSessionUser } from "@/lib/session";
import { conversationStore, type UpsertInput } from "@/lib/store";
import { getRequestId, jsonWithRequestId } from "@/lib/observability";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const respond = (payload: unknown, status = 200) =>
    jsonWithRequestId(requestId, payload, { status });

  const user = await getSessionUser();
  if (!user) return respond({ error: "Sign in to continue." }, 401);

  try {
    const conversations = await conversationStore().list(user.id);
    return respond({ conversations });
  } catch (e) {
    return respond({ error: (e as Error).message }, 500);
  }
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const respond = (payload: unknown, status = 200) =>
    jsonWithRequestId(requestId, payload, { status });

  const user = await getSessionUser();
  if (!user) return respond({ error: "Sign in to continue." }, 401);

  let body: Partial<UpsertInput>;
  try {
    body = await req.json();
  } catch {
    return respond({ error: "Invalid JSON body" }, 400);
  }

  try {
    const conversation = await conversationStore().upsert(user.id, {
      id: body.id ?? null,
      title: String(body.title ?? "New roadmap"),
      profile: body.profile ?? {},
      messages: Array.isArray(body.messages) ? body.messages : [],
    });
    return respond({ conversation });
  } catch (e) {
    return respond({ error: (e as Error).message }, 500);
  }
}

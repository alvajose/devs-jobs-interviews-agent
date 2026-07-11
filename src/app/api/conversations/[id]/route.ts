import { getSessionUser } from "@/lib/session";
import { conversationStore } from "@/lib/store";
import { getRequestId, jsonWithRequestId } from "@/lib/observability";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const requestId = getRequestId(req);
  const respond = (payload: unknown, status = 200) =>
    jsonWithRequestId(requestId, payload, { status });

  const user = await getSessionUser();
  if (!user) return respond({ error: "Sign in to continue." }, 401);

  try {
    const conversation = await conversationStore().get(user.id, id);
    if (!conversation) return respond({ error: "Not found" }, 404);
    return respond({ conversation });
  } catch (e) {
    return respond({ error: (e as Error).message }, 500);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const requestId = getRequestId(req);
  const respond = (payload: unknown, status = 200) =>
    jsonWithRequestId(requestId, payload, { status });

  const user = await getSessionUser();
  if (!user) return respond({ error: "Sign in to continue." }, 401);

  try {
    await conversationStore().remove(user.id, id);
    return respond({ ok: true });
  } catch (e) {
    return respond({ error: (e as Error).message }, 500);
  }
}

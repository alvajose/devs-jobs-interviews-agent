"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { trackProductEvent } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";

export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Sign%20in%20to%20delete%20your%20account");
  }
  const userId = user.id;

  const { error } = await supabase.rpc("delete_account");
  if (error) {
    console.error("delete_account RPC failed:", error.message);
    redirect("/login?error=Could%20not%20delete%20account.%20Please%20contact%20support.");
  }

  void trackProductEvent({
    event: "account_deleted",
    distinctId: userId,
    insertId: `account-deleted:${userId}`,
    properties: {
      source: "self_service",
    },
  });

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login?message=Your%20account%20was%20deleted");
}

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, sessionCookie, verifySecret } from "@/lib/admin-auth";

export async function adminLogin(formData: FormData) {
  const secret = String(formData.get("secret") ?? "");

  if (!verifySecret(secret)) {
    redirect("/admin?error=Invalid+secret");
  }

  const { name, value, options } = sessionCookie();
  (await cookies()).set(name, value, options);
  redirect("/admin");
}

export async function adminLogout() {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
  redirect("/admin");
}

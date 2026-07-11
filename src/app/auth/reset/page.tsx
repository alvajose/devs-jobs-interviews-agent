import Link from "next/link";
import { updatePassword } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Reset link required</CardTitle>
            <CardDescription>
              This page only works from a valid password reset email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Request a new reset link and open it from your email.
            </p>
            <Link href="/auth/forgot" className="inline-flex">
              <Button>Request new link</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>
            Your password must be at least 8 characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updatePassword} className="flex flex-col gap-3">
            <Input
              name="password"
              type="password"
              placeholder="New password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <Input
              name="passwordConfirm"
              type="password"
              placeholder="Confirm new password"
              autoComplete="new-password"
              minLength={8}
              required
            />

            {error && <p className="text-sm text-destructive">{error}</p>}
            {message && (
              <p className="text-sm text-muted-foreground">{message}</p>
            )}

            <Button type="submit">Update password</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

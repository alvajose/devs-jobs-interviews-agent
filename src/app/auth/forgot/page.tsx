import Link from "next/link";
import { requestPasswordReset } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={requestPasswordReset} className="flex flex-col gap-3">
            <Input
              name="email"
              type="email"
              placeholder="Email"
              autoComplete="email"
              required
            />

            {error && <p className="text-sm text-destructive">{error}</p>}
            {message && (
              <p className="text-sm text-muted-foreground">{message}</p>
            )}

            <Button type="submit">Send reset link</Button>
            <Link
              href="/login"
              className="text-center text-xs text-muted-foreground hover:underline"
            >
              Back to sign in
            </Link>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

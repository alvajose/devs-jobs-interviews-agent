import Link from "next/link";
import { redirect } from "next/navigation";
import { acceptLegalConsent } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  hasAcceptedLegalConsent,
  normalizeNextPath,
} from "@/lib/legal-consent";
import { createClient } from "@/lib/supabase/server";

export default async function LegalConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const nextPath = normalizeNextPath(next);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Please%20sign%20in%20to%20continue");
  }
  if (await hasAcceptedLegalConsent(supabase, user.id)) {
    redirect(nextPath);
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accept terms to continue</CardTitle>
          <CardDescription>
            We need your consent once per account before you can use Interviews Agent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={acceptLegalConsent} className="flex flex-col gap-3">
            <input type="hidden" name="next" value={nextPath} />

            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                id="acceptLegal"
                name="acceptLegal"
                type="checkbox"
                value="yes"
                className="mt-0.5 rounded border-input bg-background"
                required
              />
              <span>
                I accept the{" "}
                <Link href="/terms" className="text-primary hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit">Continue</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

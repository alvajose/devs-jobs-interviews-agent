"use client";

import { useCallback, useState } from "react";
import { login, signup, signInWithGoogle } from "./actions";
import { TurnstileWidget } from "@/components/turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { turnstileEnabled } from "@/lib/turnstile-public";
import Link from "next/link";

type Props = {
  error?: string;
  message?: string;
};

export function LoginForm({ error, message }: Props) {
  const captchaRequired = turnstileEnabled();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const handleToken = useCallback((token: string | null) => {
    setTurnstileToken(token);
  }, []);

  return (
    <form className="flex flex-col gap-3">
      <Input
        name="email"
        type="email"
        placeholder="Email"
        autoComplete="email"
        required
      />
      <Input
        name="password"
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        required
      />
      <div className="text-right">
        <Link
          href="/auth/forgot"
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          Forgot password?
        </Link>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      {captchaRequired && (
        <>
          <input type="hidden" name="cf-turnstile-response" value={turnstileToken ?? ""} />
          <TurnstileWidget onToken={handleToken} />
        </>
      )}

      <div className="flex gap-2">
        <Button type="submit" formAction={login} className="flex-1">
          Log in
        </Button>
        <Button
          type="submit"
          formAction={signup}
          variant="outline"
          className="flex-1"
          disabled={captchaRequired && !turnstileToken}
        >
          Sign up
        </Button>
      </div>

      <div className="my-2 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="submit"
        formAction={signInWithGoogle}
        formNoValidate
        variant="outline"
        className="w-full gap-2"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
          />
          <path
            fill="#FBBC05"
            d="M5.85 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.67-2.84Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.44 14.97.5 12 .5A11 11 0 0 0 2.18 7.06l3.67 2.84C6.71 6.68 9.14 4.75 12 4.75Z"
          />
        </svg>
        Continue with Google
      </Button>
    </form>
  );
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { deleteAccount } from "@/app/profile/actions";
import { SHOW_PRICING_AND_REFUNDS } from "@/lib/billing-ui";
import { isLocal } from "@/lib/mode";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ProfileData = {
  email?: string;
  credits: { total: number; free: number; paid: number };
  usage: {
    spentTotal: number;
    spentThisMonth: number;
    calls: number;
    conversations: number;
  };
  recent: {
    delta: number;
    reason: string;
    created_at: string;
    chat_id?: string | null;
    chat_title?: string | null;
    question?: string | null;
    kind?: "chat" | "roadmap" | null;
  }[];
};

const REASON_LABELS: Record<string, string> = {
  llm: "AI usage",
  purchase: "Purchase",
  "signup-bonus": "Welcome bonus",
};

function truncate(text: string, max = 140): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function usageKindLabel(kind?: "chat" | "roadmap" | null): string {
  if (kind === "roadmap") return "Roadmap generation";
  if (kind === "chat") return "Chat follow-up";
  return "AI request";
}

function formatActivityDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function confirmAccountDeletion(event: FormEvent<HTMLFormElement>) {
  if (
    !window.confirm(
      "Delete account permanently? This will remove your chats, credits, and history.",
    )
  ) {
    event.preventDefault();
  }
}

export default function ProfilePage() {
  // Local mode has no account,  bounce back home.
  const router = useRouter();
  useEffect(() => {
    if (isLocal()) router.replace("/");
  }, [router]);

  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/profile");
      if (res.ok) setData(await res.json());
      else
        setError(
          res.status === 401
            ? "Sign in to see your profile."
            : "Couldn't load your profile.",
        );
    })();
  }, []);

  if (error || !data) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">{error ?? "Loading…"}</p>
      </main>
    );
  }

  const stats = [
    { label: "Credits used", value: data.usage.spentTotal },
    { label: "Used this month", value: data.usage.spentThisMonth },
    { label: "AI interactions", value: data.usage.calls },
    { label: "Roadmaps & chats", value: data.usage.conversations },
  ];

  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-4 py-10">
      <div className="w-full max-w-3xl">
        <Link
          href="/app"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          ← Back to app
        </Link>
      </div>

      <div className="w-full max-w-3xl space-y-6">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold">Profile</h1>
          {data.email && (
            <p className="text-sm text-muted-foreground">{data.email}</p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              Credit balance
              {SHOW_PRICING_AND_REFUNDS && (
                <Link
                  href="/credits"
                  className={buttonVariants({ variant: "default", size: "sm" })}
                >
                  Buy more
                </Link>
              )}
            </CardTitle>
            <CardDescription>
              {SHOW_PRICING_AND_REFUNDS
                ? "Free credits reset monthly; purchased credits never expire."
                : "Free credits while we\u2019re in testing. No purchase needed."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-8">
            <div>
              <div className="text-4xl font-bold">{data.credits.total}</div>
              <div className="text-sm text-muted-foreground">
                credits available
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              <div>{data.credits.free} free this month</div>
              {SHOW_PRICING_AND_REFUNDS && (
                <div>{data.credits.paid} purchased</div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-sm text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.recent.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-4 py-2.5 text-sm"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {REASON_LABELS[r.reason] ?? r.reason}
                        </span>
                        {r.reason === "llm" && (
                          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            {usageKindLabel(r.kind)}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatActivityDate(r.created_at)}
                        </span>
                      </p>
                      {r.reason === "llm" && (
                        <>
                          <p className="truncate text-xs text-muted-foreground">
                            Chat:{" "}
                            <span className="font-medium text-foreground/90">
                              {r.chat_title || "Deleted or unsaved chat"}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Question:{" "}
                            {r.question
                              ? truncate(r.question)
                              : "No question details available"}
                          </p>
                        </>
                      )}
                    </div>
                    <span
                      className={`shrink-0 ${r.delta < 0 ? "text-muted-foreground" : "font-medium text-foreground"}`}
                    >
                      {r.delta > 0 ? `+${r.delta}` : r.delta}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Export your data or permanently delete your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              href="/api/account/export"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Export my data (JSON)
            </a>
            <form action={deleteAccount} onSubmit={confirmAccountDeletion}>
              <button
                type="submit"
                className={buttonVariants({
                  variant: "destructive",
                  size: "sm",
                })}
              >
                Delete account
              </button>
            </form>
            <p className="text-xs text-muted-foreground">
              Account deletion is irreversible and removes all profile, chat,
              and credit records.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

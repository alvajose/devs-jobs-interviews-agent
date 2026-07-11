"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins } from "lucide-react";

// Compact always-visible credit counter (icon + number). Clickable -> /credits to top up.
// Fetches once on mount; it won't tick down live as you spend within a session, it
// refreshes on navigation/reload. Wire a refresh callback into send() if live updates matter.
export function CreditsBadge() {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/credits/balance")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setTotal(d.total))
      .catch(() => {});
  }, []);

  if (total === null) return null;

  return (
    <Link
      href="/credits"
      title="Credits, click to buy more"
      className="flex shrink-0 items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
    >
      <Coins className="size-3" />
      {total}
    </Link>
  );
}

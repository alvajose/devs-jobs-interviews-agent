"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { User, CreditCard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signout } from "@/app/login/actions";
import { SHOW_PRICING_AND_REFUNDS } from "@/lib/billing-ui";
import { isLocal } from "@/lib/mode";

// Profile dropdown that replaces the bare logout button: account links first, log out last.
export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside the menu.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const itemClass =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] hover:bg-muted";

  // Local mode has no account, billing, or logout,  nothing to show here.
  if (isLocal()) return null;

  return (
    <div ref={ref} className="relative ml-auto">
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => setOpen((o) => !o)}
        aria-label="Profile menu"
        aria-expanded={open}
      >
        <User className="size-4" />
      </Button>

      {open && (
        <div className="absolute right-0 z-40 mt-1 w-52 rounded-lg border border-border bg-card p-1 shadow-lg">
          <Link
            href="/profile"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            <User className="size-4" /> Profile
          </Link>
          <Link
            href="/credits"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            <CreditCard className="size-4" /> Credits
          </Link>
          <div className="my-1 h-px bg-border" />
          <Link
            href="/terms?from=app"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            Terms of Service
          </Link>
          <Link
            href="/privacy?from=app"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            Privacy Policy
          </Link>
          {SHOW_PRICING_AND_REFUNDS && (
            <Link
              href="/refund?from=app"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              Refund Policy
            </Link>
          )}
          <div className="my-1 h-px bg-border" />
          <button className={itemClass} onClick={() => signout()}>
            <LogOut className="size-4" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

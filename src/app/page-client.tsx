"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  ChatMsg,
  Profile,
  Roadmap,
  RoadmapModule,
  StudyPlan,
} from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Plus,
  ArrowUp,
  Route,
  CalendarDays,
  ExternalLink,
  History,
  Search,
  RefreshCw,
  MessageSquare,
  BookOpen,
  Briefcase,
  PenLine,
  Mic,
  Menu,
  X,
  Library,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { ProfileMenu } from "@/components/profile-menu";
import { CreditsBadge } from "@/components/credits-badge";
import { SHOW_PRICING_AND_REFUNDS } from "@/lib/billing-ui";
import { questionsLookSpanish, textLooksSpanish } from "@/lib/content-language";
import { Dialog } from "@base-ui/react/dialog";
import {
  deriveTitle,
  deleteConversation,
  getConversation,
  listConversations,
  upsertConversation,
  type ConversationMeta,
} from "@/lib/conversations";
import type { LandingSampleRoadmap } from "@/lib/landing-sample";

const DEFAULT_PROFILE: Profile = {
  role: "",
  seniority: "Mid",
  targetCompany: "",
  weeks: 4,
  hoursPerWeek: 8,
  language: "es",
};

const LANGUAGE_STORAGE_KEY = "interviews-agent.language";

function readStoredLanguage(): Profile["language"] | null {
  try {
    const v = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return v === "en" || v === "es" ? v : null;
  } catch {
    return null;
  }
}

function writeStoredLanguage(language: Profile["language"]) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    /* private mode / quota */
  }
}

const ONBOARDING_CHIPS = [
  {
    label: "Frontend Engineer",
    target: "React + TypeScript frontend interviews",
    role: "Frontend Engineer",
    seniority: "Mid" as const,
  },
  {
    label: "Backend Python",
    target: "Python backend with FastAPI and SQL",
    role: "Backend Engineer",
    seniority: "Mid" as const,
  },
  {
    label: "Laravel Senior",
    target: "Senior Laravel + PHP backend interviews",
    role: "Backend Engineer",
    seniority: "Senior" as const,
  },
] as const;

const PRIORITY: Record<string, { badge: string; dot: string }> = {
  high: {
    badge: "border-red-500/30 bg-red-500/10 text-red-400",
    dot: "bg-red-400",
  },
  medium: {
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    dot: "bg-amber-400",
  },
  low: {
    badge: "border-border bg-muted text-muted-foreground",
    dot: "bg-zinc-400",
  },
};

const SECTIONS = [
  { id: "plan", label: "Study Plan", icon: BookOpen, soon: false },
  { id: "offers", label: "Job Offers", icon: Briefcase, soon: true },
  { id: "written", label: "Written Q&A", icon: PenLine, soon: true },
  { id: "oral", label: "Oral Q&A", icon: Mic, soon: true },
];

const BANK_PAGE_SIZE = 25;

const LANDING_NAV = [
  { href: "#how-it-works", sectionId: "how-it-works", label: "How it works" },
  { href: "#sample", sectionId: "sample", label: "Sample roadmap" },
  { href: "#pricing", sectionId: "pricing", label: "Pricing" },
  { href: "#faq", sectionId: "faq", label: "FAQ" },
] as const;

const LANDING_BULLETS = [
  "Personalized roadmap in under 60 seconds",
  "Real interview-question banks linked by stack",
  "Follow-up coaching chat while you study",
] as const;

const LANDING_HOW_IT_WORKS = [
  {
    title: "Share your target",
    description:
      "Tell us your role, seniority, target company, and available weekly hours.",
  },
  {
    title: "Get a structured plan",
    description:
      "Receive a roadmap grouped by priorities with daily tasks and curated resources.",
  },
  {
    title: "Iterate with coaching",
    description:
      "Ask follow-up questions, edit your roadmap, and keep progress in one place.",
  },
] as const;

const LANDING_PACKAGES = [
  {
    name: "Try it",
    price: "$2",
    credits: "150 credits",
    description: "Generate a couple of roadmaps and test follow-up coaching.",
    badge: null,
  },
  {
    name: "Job hunt",
    price: "$10",
    credits: "900 credits",
    description:
      "Best value for active interview prep across multiple applications.",
    badge: "Most popular",
  },
  {
    name: "All in",
    price: "$18",
    credits: "1800 credits",
    description:
      "Highest credit rate for intensive prep and deeper iterations.",
    badge: null,
  },
] as const;

const LANDING_FAQ = [
  {
    q: "What do I actually get?",
    a: "You describe your target role and stack, and get a roadmap grouped by priority, each module has the concepts to study and real interview questions with answers, plus a day-by-day plan sized to your available weeks and hours.",
  },
  {
    q: "How does pricing work?",
    a: "One-time credit packs, no subscription. Generating a roadmap or asking a follow-up spends credits based on length. Paid credits never expire, and you get a batch of free credits every month.",
  },
  {
    q: "Are the interview questions real?",
    a: "Yes. Question banks are curated per stack from public interview-prep sources, and coding-practice drills link out to established problem sets like Grind75 and the Tech Interview Handbook.",
  },
  {
    q: "Can I change the plan after it's generated?",
    a: "Yes. The coaching chat lets you ask follow-ups and edit the roadmap, add or drop a technology, re-scope the weeks, and your changes are kept for next time.",
  },
  {
    q: "Do I need an account, and is my progress saved?",
    a: "Sign up with email or Google. Your roadmaps and conversations are saved to your account, so you can pick up where you left off from any device.",
  },
] as const;

const LANDING_HIGHLIGHT_MS = 1000;

export default function LandingPageClient({
  sampleRoadmap,
}: {
  sampleRoadmap: LandingSampleRoadmap | null;
}) {
  const [sampleExpanded, setSampleExpanded] = useState(false);
  const [highlightedSection, setHighlightedSection] = useState<string | null>(
    null,
  );
  const sampleWeeks = sampleRoadmap?.weeks ?? [];
  const heroPreview = sampleWeeks
    .slice(0, 3)
    .map((week) => `${week.phase}: ${week.focus}`);
  const visibleRoadmap = sampleExpanded ? sampleWeeks : sampleWeeks.slice(0, 2);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(
    () => () => {
      clearTimeout(highlightTimeoutRef.current);
    },
    [],
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main-content"
        className="absolute left-2 top-2 z-50 rounded-md border bg-background px-3 py-2 text-sm font-medium text-foreground opacity-0 shadow-sm focus:opacity-100"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-dashed bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary text-xs text-primary-foreground">
              IA
            </span>
            Interviews Agent
          </Link>

          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex items-center gap-5 text-sm text-muted-foreground">
              {LANDING_NAV.filter(
                (item) =>
                  SHOW_PRICING_AND_REFUNDS || item.sectionId !== "pricing",
              ).map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="hover:text-foreground hover:underline"
                    onClick={() => {
                      clearTimeout(highlightTimeoutRef.current);
                      setHighlightedSection(item.sectionId);
                      highlightTimeoutRef.current = setTimeout(() => {
                        setHighlightedSection((current) =>
                          current === item.sectionId ? null : current,
                        );
                      }, LANDING_HIGHLIGHT_MS);
                    }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Log in
            </Link>
            <Link href="/login" className={buttonVariants({ size: "sm" })}>
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-14 pt-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Interview prep platform
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              A serious roadmap for your next role, not vague AI fluff.
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              Interviews Agent turns your target role into a practical study
              plan with curated topics, interview-question banks, and coaching
              follow-ups.
            </p>

            <ul className="space-y-2 text-sm text-muted-foreground">
              {LANDING_BULLETS.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-1 size-2 rounded-full bg-primary"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-3">
              <Link href="/login" className={buttonVariants({ size: "lg" })}>
                Create free account
              </Link>
              <Link
                href="/app"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                Open app
              </Link>
            </div>
          </div>

          <aside className="rounded-xl border bg-secondary p-5 shadow-subtle sm:p-6">
            <h2 className="text-lg font-semibold">
              What your first week looks like
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Example plan from {sampleRoadmap?.track ?? "the sample roadmap"} (
              {sampleWeeks.length || "—"} weeks).
            </p>
            <ol className="mt-4 space-y-3">
              {heroPreview.map((item, index) => (
                <li
                  key={item}
                  className="rounded-lg border bg-background px-4 py-3 text-sm"
                >
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                    Step {index + 1}
                  </p>
                  <p>{item}</p>
                </li>
              ))}
            </ol>
          </aside>
        </section>

        <section
          id="how-it-works"
          className={`scroll-mt-24 mx-auto w-full max-w-6xl rounded-xl px-4 pb-14 transition-colors duration-700 sm:px-6 ${
            highlightedSection === "how-it-works"
              ? "bg-primary/[0.07]"
              : "bg-transparent"
          }`}
        >
          <h2 className="text-2xl font-semibold tracking-tight">
            How it works
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Keep your prep workflow simple: define the target, get a plan,
            iterate fast.
          </p>
          <ul className="mt-5 grid gap-4 md:grid-cols-3">
            {LANDING_HOW_IT_WORKS.map((item, index) => (
              <li
                key={item.title}
                className="rounded-xl border bg-card p-5 shadow-subtle"
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  {`0${index + 1}`}
                </p>
                <h3 className="text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.description}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section
          id="sample"
          className="scroll-mt-24 mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6"
        >
          <div
            className={`rounded-2xl px-6 py-4 transition-colors duration-700 sm:px-10 sm:py-6 ${
              highlightedSection === "sample"
                ? "bg-primary/[0.07]"
                : "bg-transparent"
            }`}
          >
            <div className="rounded-xl border bg-card shadow-subtle">
              <div className="rounded-t-xl border-b bg-card px-6 py-4 sm:px-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {sampleRoadmap?.title ?? "Sample roadmap preview"}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                      {sampleRoadmap?.subtitle ??
                        "Roadmap preview from curated markdown content."}
                    </p>
                  </div>
                  {sampleWeeks.length > 2 && (
                    <button
                      type="button"
                      aria-expanded={sampleExpanded}
                      aria-controls="sample-roadmap-content"
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                        className: "shrink-0",
                      })}
                      onClick={() => setSampleExpanded((v) => !v)}
                    >
                      {sampleExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              </div>

              <div
                id="sample-roadmap-content"
                className="space-y-4 px-6 py-5 sm:px-8"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {sampleRoadmap?.track ?? "Sample track"} ·{" "}
                  {sampleWeeks.length} weeks
                </p>
                {sampleWeeks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sample roadmap content is unavailable. Check{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">
                      content/general/landing-sample-react-node.md
                    </code>
                    .
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {visibleRoadmap.map((week) => (
                      <li
                        key={week.phase}
                        className="rounded-lg border bg-secondary p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                            {week.phase}
                          </p>
                          <h3 className="text-sm font-semibold">
                            {week.focus}
                          </h3>
                        </div>

                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Key topics
                            </p>
                            <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                              {week.topics.map((topic) => (
                                <li
                                  key={topic}
                                  className="flex items-start gap-2"
                                >
                                  <span
                                    aria-hidden="true"
                                    className="mt-1 size-1.5 rounded-full bg-primary"
                                  />
                                  <span>{topic}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Deliverable
                              </p>
                              <p className="text-muted-foreground">
                                {week.deliverable}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Interview checkpoint
                              </p>
                              <p className="text-muted-foreground">
                                {week.interview}
                              </p>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {sampleWeeks.length > 2 && !sampleExpanded && (
                  <p className="text-sm text-muted-foreground">
                    Showing {visibleRoadmap.length} of {sampleWeeks.length}{" "}
                    weeks. Use&nbsp;
                    <span className="font-medium text-foreground">
                      Show more
                    </span>
                    &nbsp;to see the complete roadmap.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {SHOW_PRICING_AND_REFUNDS && (
          <section
            id="pricing"
            className={`scroll-mt-24 mx-auto w-full max-w-6xl rounded-xl px-4 pb-14 transition-colors duration-700 sm:px-6 ${
              highlightedSection === "pricing"
                ? "bg-primary/[0.07]"
                : "bg-transparent"
            }`}
          >
            <h2 className="text-2xl font-semibold tracking-tight">Pricing</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Start small, then scale as your prep intensity grows.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {LANDING_PACKAGES.map((pkg) => (
                <article
                  key={pkg.name}
                  className={`rounded-xl border bg-card p-5 shadow-subtle ${pkg.badge ? "ring-1 ring-primary/40" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold">{pkg.name}</h3>
                    {pkg.badge && (
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        {pkg.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-3xl font-semibold">{pkg.price}</p>
                  <p className="text-sm text-primary">{pkg.credits}</p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {pkg.description}
                  </p>
                  <Link
                    href="/login"
                    className={buttonVariants({
                      size: "sm",
                      variant: pkg.badge ? "default" : "outline",
                      className: "mt-4 w-full",
                    })}
                  >
                    Get started
                  </Link>
                </article>
              ))}
            </div>
          </section>
        )}

        <section
          id="faq"
          className={`scroll-mt-24 mx-auto w-full max-w-6xl rounded-xl px-4 pb-16 transition-colors duration-700 sm:px-6 ${
            highlightedSection === "faq"
              ? "bg-primary/[0.07]"
              : "bg-transparent"
          }`}
        >
          <h2 className="text-2xl font-semibold tracking-tight">FAQ</h2>
          <div className="mt-5 space-y-3">
            {LANDING_FAQ.filter(
              (item) =>
                SHOW_PRICING_AND_REFUNDS || item.q !== "How does pricing work?",
            ).map((item) => (
              <details key={item.q} className="rounded-lg border bg-card p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  {item.q}
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-dashed">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm text-muted-foreground sm:px-6">
          <span>Interviews Agent by Carinaex</span>
          <nav aria-label="Legal">
            <ul className="flex items-center gap-4">
              <li>
                <Link
                  href="/terms"
                  className="hover:text-foreground hover:underline"
                >
                  Terms
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-foreground hover:underline"
                >
                  Privacy
                </Link>
              </li>
              {SHOW_PRICING_AND_REFUNDS && (
                <li>
                  <Link
                    href="/refund"
                    className="hover:text-foreground hover:underline"
                  >
                    Refund
                  </Link>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function AppWorkspacePage() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [greeting, setGreeting] = useState("Welcome back");
  const [convos, setConvos] = useState<ConversationMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    const h = new Date().getHours();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only clock; kept in an effect to avoid an SSR hydration mismatch on the greeting.
    setGreeting(
      h < 12 ? "Good morning" : h < 19 ? "Good afternoon" : "Good evening",
    );
    const storedLang = readStoredLanguage();
    if (storedLang) {
      setProfile((p) =>
        p.language === storedLang ? p : { ...p, language: storedLang },
      );
    }
    (async () => {
      try {
        const list = await listConversations();
        setConvos(list);
      } catch {
        /* not logged in or table missing, start empty */
      }
    })();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Upsert the conversation. Returns the (possibly new) id so callers can chain
  // saves within one send() without waiting for setActiveId to flush.
  async function save(
    id: string | null,
    p: Profile,
    m: ChatMsg[],
  ): Promise<string | null> {
    if (m.length === 0) return id; // don't create empty conversations
    const saved = await upsertConversation({
      id,
      title: deriveTitle(m, p),
      profile: p,
      messages: m,
    });
    if (id !== saved.id) setActiveId(saved.id);
    setConvos((cs) => [saved, ...cs.filter((c) => c.id !== saved.id)]);
    return saved.id;
  }

  function updateProfile<K extends keyof Profile>(key: K, value: Profile[K]) {
    const next = { ...profile, [key]: value };
    setProfile(next);
    if (key === "language") {
      writeStoredLanguage(value as Profile["language"]);
    }
    // Only persist profile edits for an existing conversation; debounce keystrokes.
    if (activeId) {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => save(activeId, next, messages), 600);
    }
  }

  function applyOnboardingChip(chip: (typeof ONBOARDING_CHIPS)[number]) {
    const next = {
      ...profile,
      role: chip.role,
      seniority: chip.seniority,
    };
    setProfile(next);
    setInput(chip.target);
  }

  async function openConvo(id: string) {
    try {
      const c = await getConversation(id);
      const nextProfile = { ...DEFAULT_PROFILE, ...c.profile };
      setProfile(nextProfile);
      if (nextProfile.language === "en" || nextProfile.language === "es") {
        writeStoredLanguage(nextProfile.language);
      }
      setMessages(c.messages ?? []);
      setActiveId(c.id);
      setPlanOpen((c.messages ?? []).some((m) => m.roadmap));
      setMenuOpen(false);
      setHistoryOpen(false);
    } catch {
      /* deleted or inaccessible */
    }
  }

  async function removeConvo(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await deleteConversation(id);
    setConvos((cs) => cs.filter((c) => c.id !== id));
    if (activeId === id) newChat();
  }

  const filteredConvos = convos.filter((c) =>
    c.title.toLowerCase().includes(historyQuery.trim().toLowerCase()),
  );

  const hasRoadmap = messages.some((m) => m.role === "assistant" && m.roadmap);
  const latestRoadmap: Roadmap | undefined = [...messages]
    .reverse()
    .find((m) => m.roadmap)?.roadmap;
  const latestPlan: StudyPlan | undefined = latestRoadmap?.plan;

  // Apply an assistant reply. On an EDIT (reply has a roadmap and one already existed), update the
  // plan IN PLACE and append a TEXT report, so the plan changes, the user's message stays visible,
  // and the "what changed" reply is a normal message instead of a second giant roadmap block.
  function applyReply(
    base: ChatMsg[],
    reply: ChatMsg,
    hadRoadmap: boolean,
  ): ChatMsg[] {
    if (reply.roadmap && hadRoadmap) {
      let idx = -1;
      for (let i = base.length - 1; i >= 0; i--) {
        if (base[i].roadmap) {
          idx = i;
          break;
        }
      }
      const updated =
        idx >= 0
          ? base.map((m, k) =>
              k === idx ? { ...m, roadmap: reply.roadmap } : m,
            )
          : base;
      return [
        ...updated,
        { role: "assistant", text: reply.text || "Updated your plan." },
      ];
    }
    return [...base, reply];
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const withUser: ChatMsg[] = [...messages, { role: "user", text }];
    setMessages(withUser);
    setInput("");
    setLoading(true);

    // Save the user message first; this creates the row on the first send.
    const id = await save(activeId, profile, withUser);

    try {
      const reply = hasRoadmap
        ? await callChat(withUser, id)
        : await callRoadmap(text, id);
      const next = applyReply(withUser, reply, hasRoadmap);
      setMessages(next);
      await save(id, profile, next);
      // Only jump to the plan view on the FIRST roadmap; edits stay in the thread.
      if (reply.roadmap && !hasRoadmap) setPlanOpen(true);
    } catch (e) {
      const next: ChatMsg[] = [
        ...withUser,
        { role: "assistant", text: (e as Error).message, error: true },
      ];
      setMessages(next);
      await save(id, profile, next);
    } finally {
      setLoading(false);
    }
  }

  // Retry the last turn: drop a failed/stuck assistant reply and re-run the last user message.
  async function retry() {
    if (loading) return;
    let cut = messages.length;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        cut = i + 1;
        break;
      }
    }
    const history = messages.slice(0, cut);
    if (history.length === 0) return;
    const hadRoadmap = history.some((m) => m.role === "assistant" && m.roadmap);
    setMessages(history);
    setLoading(true);
    try {
      const lastUser =
        [...history].reverse().find((m) => m.role === "user")?.text ?? "";
      const reply = hadRoadmap
        ? await callChat(history, activeId)
        : await callRoadmap(lastUser, activeId);
      const next = applyReply(history, reply, hadRoadmap);
      setMessages(next);
      await save(activeId, profile, next);
      if (reply.roadmap && !hadRoadmap) setPlanOpen(true);
    } catch (e) {
      setMessages([
        ...history,
        { role: "assistant", text: (e as Error).message, error: true },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function callRoadmap(
    target: string,
    conversationId: string | null,
  ): Promise<ChatMsg> {
    const res = await fetch("/api/roadmap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, target, conversationId }),
    });
    const data = await res.json();
    return res.ok
      ? { role: "assistant", roadmap: data }
      : {
          role: "assistant",
          text: data.error || "Something went wrong.",
          error: true,
        };
  }

  async function callChat(
    history: ChatMsg[],
    conversationId: string | null,
  ): Promise<ChatMsg> {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, messages: history, conversationId }),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        role: "assistant",
        text: data.error || "Something went wrong.",
        error: true,
      };
    }
    // An edit returns the updated roadmap + a short summary of what changed; a question is text.
    return data.roadmap
      ? { role: "assistant", roadmap: data.roadmap, text: data.reply }
      : { role: "assistant", text: data.reply };
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function newChat() {
    setMessages([]);
    setActiveId(null);
    setPlanOpen(false);
    setMenuOpen(false);
    // Keep the preferred language across new roadmaps; reset the rest of the form.
    const language = readStoredLanguage() ?? profile.language;
    setProfile({ ...DEFAULT_PROFILE, language });
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-[0.9rem]">
      {menuOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* ===== LEFT: structure ===== */}
      <aside
        className={`${menuOpen ? "flex" : "hidden"} fixed inset-y-0 left-0 z-30 w-60 flex-col border-r border-dashed bg-sidebar text-sidebar-foreground lg:static lg:z-auto lg:flex`}
      >
        <div className="flex items-center gap-2 px-4 py-3.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
            IA
          </span>
          <div className="leading-tight">
            <p className="text-[13px] font-medium tracking-tight">
              Interviews Agent
            </p>
            <p className="text-[10px] text-muted-foreground">by Carinaex</p>
          </div>
          <ProfileMenu />
        </div>

        <div className="px-3">
          <Button
            onClick={newChat}
            variant="outline"
            className="w-full justify-start gap-2 rounded-full font-normal shadow-subtle"
          >
            <Plus className="size-4" /> New roadmap
          </Button>
        </div>

        <nav className="mt-3 space-y-0.5 px-3">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              disabled={s.soon}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                s.id === "plan"
                  ? "bg-primary/10 font-medium text-primary"
                  : s.soon
                    ? "cursor-not-allowed text-muted-foreground/50"
                    : "text-foreground/75 hover:bg-quaternary"
              }`}
            >
              <s.icon className="size-4" />
              {s.label}
              {s.soon && (
                <Badge variant="secondary" className="ml-auto text-[9px]">
                  Soon
                </Badge>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-4 flex-1 space-y-2.5 overflow-y-auto border-t border-dashed px-4 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Prep profile
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground/70">
              What you&apos;re targeting, used as context for everything.
            </p>
          </div>
          <Field label="Target role">
            <Input
              value={profile.role}
              placeholder="Frontend Engineer"
              onChange={(e) => updateProfile("role", e.target.value)}
            />
          </Field>
          <Field label="Seniority">
            <Select
              value={profile.seniority}
              onValueChange={(v) =>
                updateProfile("seniority", v ?? profile.seniority)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Junior", "Mid", "Senior", "Staff"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Target company" soon>
            <Input value="" placeholder="Google" disabled readOnly />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Weeks">
              <Input
                type="number"
                min={1}
                max={12}
                value={profile.weeks}
                onChange={(e) => updateProfile("weeks", Number(e.target.value))}
              />
            </Field>
            <Field label="Hrs/week">
              <Input
                type="number"
                min={1}
                max={60}
                value={profile.hoursPerWeek}
                onChange={(e) =>
                  updateProfile("hoursPerWeek", Number(e.target.value))
                }
              />
            </Field>
          </div>
          <Field label="Language">
            <Select
              value={profile.language}
              onValueChange={(v) =>
                updateProfile("language", (v ?? "es") as Profile["language"])
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="flex items-center gap-2 border-t border-dashed p-3">
          <button
            onClick={() => {
              setHistoryQuery("");
              setHistoryOpen(true);
            }}
            className="flex flex-1 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-foreground/75 transition-colors hover:bg-quaternary"
          >
            <History className="size-4" />
            Past plans &amp; chats
          </button>
          <CreditsBadge />
        </div>
      </aside>

      {/* ===== CENTER + RIGHT (floating panels) ===== */}
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-hidden p-1.5">
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-secondary shadow-subtle">
          <header className="flex h-11 shrink-0 items-center gap-2 border-b border-dashed px-3">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Menu"
            >
              <Menu className="size-4" />
            </Button>
            <span className="text-[13px] font-medium">Study Modules</span>
            {latestPlan && !planOpen && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-7 gap-1.5 rounded-full text-xs"
                onClick={() => setPlanOpen(true)}
              >
                <CalendarDays className="size-3.5" /> View plan
              </Button>
            )}
          </header>

          <div className="flex-1 overflow-y-auto px-3 py-5 [scrollbar-gutter:stable_both-edges]">
            <div className="mx-auto max-w-2xl">
              {messages.length === 0 ? (
                <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
                  <h1 className="greeting-gradient text-[32px] font-semibold tracking-tight">
                    {greeting}
                  </h1>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Drop the stack you&apos;re targeting (e.g. React, Laravel)
                    and I&apos;ll build your full interview-prep roadmap,
                    everything to study, summarized right here.
                  </p>
                  <div className="flex max-w-lg flex-wrap justify-center gap-2">
                    {ONBOARDING_CHIPS.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => applyOnboardingChip(chip)}
                        disabled={loading}
                        className="rounded-full border border-hard/60 bg-background px-3 py-1.5 text-xs text-foreground/85 transition-colors hover:bg-quaternary disabled:opacity-50"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground/80">
                    Pick a starting point or type your stack below.
                  </p>
                </div>
              ) : (
                <div className="space-y-7">
                  {messages.map((m, i) =>
                    m.role === "user" ? (
                      <UserMessage key={i} text={m.text ?? ""} />
                    ) : m.roadmap ? (
                      <div key={i} className="space-y-7">
                        {m.text && (
                          <AssistantBlock icon={MessageSquare} label="Updated">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">
                              {m.text}
                            </p>
                          </AssistantBlock>
                        )}
                        <AssistantBlock icon={Route} label="Roadmap">
                          <RoadmapView
                            roadmap={m.roadmap}
                            language={profile.language}
                            onOpenPlan={() => setPlanOpen(true)}
                          />
                        </AssistantBlock>
                      </div>
                    ) : (
                      <AssistantBlock
                        key={i}
                        icon={MessageSquare}
                        label={m.error ? "Error" : "Answer"}
                      >
                        <p
                          className={
                            m.error
                              ? "text-sm text-destructive"
                              : "whitespace-pre-wrap text-sm leading-relaxed"
                          }
                        >
                          <Linkify text={m.text ?? ""} />
                        </p>
                        {m.error && i === messages.length - 1 && (
                          <button
                            onClick={retry}
                            disabled={loading}
                            className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                          >
                            <RefreshCw className="size-3.5" /> Retry
                          </button>
                        )}
                      </AssistantBlock>
                    ),
                  )}
                  {loading && (
                    <AssistantBlock icon={MessageSquare} label="Thinking">
                      <div className="flex items-center gap-1.5 py-0.5">
                        <span className="dot" />
                        <span className="dot" />
                        <span className="dot" />
                      </div>
                    </AssistantBlock>
                  )}
                </div>
              )}
              {hasRoadmap && latestRoadmap?.bankStacks?.length ? (
                <div className="mt-7 space-y-2">
                  {latestRoadmap.bankStacks.map((stack) => (
                    <BankSection
                      key={stack}
                      stack={stack}
                      language={profile.language}
                    />
                  ))}
                </div>
              ) : null}
              <div ref={endRef} />
            </div>
          </div>

          {/* llmchat-style input */}
          <div className="px-3 pb-3">
            <div className="mx-auto max-w-2xl rounded-xl border border-hard/60 bg-background shadow-subtle">
              <textarea
                className="max-h-40 min-h-[52px] w-full resize-none bg-transparent px-3.5 pt-3 text-sm outline-none placeholder:text-muted-foreground/60"
                value={input}
                placeholder={
                  hasRoadmap
                    ? "Ask a follow-up, learn a topic, or tweak the plan…"
                    : "Your main stack or extra context…  (e.g. React, Laravel)"
                }
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
              />
              <div className="flex items-center justify-between border-t border-dashed px-2.5 py-2">
                <span className="text-[11px] text-muted-foreground">
                  Enter to send · Shift+Enter for newline
                </span>
                <Button
                  onClick={send}
                  disabled={loading || !input.trim()}
                  size="icon"
                  className="size-8 rounded-lg"
                  aria-label="Send"
                >
                  <ArrowUp className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </main>

        {/* ===== RIGHT: phased plan ===== */}
        {planOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
            onClick={() => setPlanOpen(false)}
          />
        )}
        <aside
          className={`${planOpen ? "flex" : "hidden"} fixed inset-y-1.5 right-1.5 z-30 w-[calc(100%-1rem)] max-w-md flex-col overflow-hidden rounded-lg border bg-secondary shadow-subtle lg:static lg:inset-auto lg:z-auto lg:w-[24rem] lg:max-w-none`}
        >
          <header className="flex h-11 shrink-0 items-center gap-2 border-b border-dashed px-3">
            <CalendarDays className="size-4 text-primary" />
            <h2 className="text-[13px] font-medium">Study plan</h2>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto size-7"
              onClick={() => setPlanOpen(false)}
              aria-label="Close"
            >
              <X className="size-4" />
            </Button>
          </header>
          <div className="flex-1 overflow-y-auto p-4">
            {latestPlan ? (
              <PlanView
                plan={latestPlan}
                modules={latestRoadmap?.modules ?? []}
                onNavigate={() => {
                  if (typeof window !== "undefined" && window.innerWidth < 1024)
                    setPlanOpen(false);
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No plan yet. Tell me your target role in the chat to generate
                one.
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* ===== History popup ===== */}
      <Dialog.Root open={historyOpen} onOpenChange={setHistoryOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[70vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-secondary shadow-lg transition-all data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <header className="flex items-center gap-2 border-b border-dashed px-4 py-3">
              <History className="size-4 text-primary" />
              <Dialog.Title className="text-sm font-medium">
                Past plans &amp; chats
              </Dialog.Title>
              <Dialog.Close
                className="ml-auto rounded-md p-1 text-muted-foreground transition-colors hover:bg-quaternary hover:text-foreground"
                aria-label="Close"
              >
                <X className="size-4" />
              </Dialog.Close>
            </header>
            <div className="border-b border-dashed p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                  placeholder="Search plans &amp; chats…"
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {convos.length === 0 ? (
                <p className="px-2 py-6 text-center text-[13px] text-muted-foreground">
                  No saved plans yet. Generate a roadmap and it&apos;ll show up
                  here.
                </p>
              ) : filteredConvos.length === 0 ? (
                <p className="px-2 py-6 text-center text-[13px] text-muted-foreground">
                  No matches.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {filteredConvos.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => openConvo(c.id)}
                        className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                          c.id === activeId
                            ? "bg-primary/10 font-medium text-primary"
                            : "hover:bg-quaternary"
                        }`}
                      >
                        <MessageSquare className="size-4 shrink-0" />
                        <span className="truncate">{c.title}</span>
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="Delete chat"
                          onClick={(e) => removeConvo(c.id, e)}
                          className="ml-auto shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        >
                          <Trash2 className="size-4" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

// Renders [label](url) as a clickable link; only http(s) URLs become anchors
// (anything else stays plain text, a javascript: URL would be an XSS vector).
const MD_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

function Linkify({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  // matchAll keeps its own iteration state, no shared mutable lastIndex on MD_LINK.
  for (const m of text.matchAll(MD_LINK)) {
    const index = m.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    parts.push(
      <a
        key={index}
        href={m[2]}
        target="_blank"
        rel="noreferrer"
        className="text-primary hover:underline"
      >
        {m[1]}
      </a>,
    );
    last = index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function Field({
  label,
  soon = false,
  children,
}: {
  label: string;
  soon?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`flex flex-col gap-1 text-[11px] ${soon ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
        {label}
        {soon && (
          <Badge variant="secondary" className="text-[9px]">
            Soon
          </Badge>
        )}
      </span>
      {children}
    </label>
  );
}

function UserMessage({ text }: { text: string }) {
  const preview = text.length > 320 ? text.slice(0, 320).trimEnd() + "…" : text;
  return (
    <div className="rise flex justify-end">
      <div className="max-w-[80%] whitespace-pre-wrap rounded-lg bg-tertiary px-3.5 py-2 text-sm leading-relaxed">
        {preview}
      </div>
    </div>
  );
}

function AssistantBlock({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rise">
      <div className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      {children}
    </div>
  );
}
function ConceptContent({
  concept,
}: {
  concept: RoadmapModule["concepts"][number];
}) {
  const details = concept.details?.length
    ? concept.details
    : [concept.detail].filter(Boolean);
  const examples = concept.examples?.length
    ? concept.examples
    : concept.example
      ? [{ code: concept.example }]
      : [];

  return (
    <div className="space-y-3 text-[13px] leading-relaxed text-muted-foreground">
      {details.map((detail, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {detail}
        </p>
      ))}

      {examples.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Examples
          </p>
          {examples.map((example, i) => (
            <div key={i}>
              {example.label && (
                <p className="mb-1 text-[12px] font-medium text-foreground/80">
                  {example.label}
                </p>
              )}
              {example.text && (
                <p className="whitespace-pre-wrap">{example.text}</p>
              )}
              {example.code && (
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted px-2.5 py-2 font-mono text-[12px] text-foreground/80">
                  {example.code}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

      {concept.sources?.length ? (
        <div className="border-t border-dashed pt-2 text-[11px]">
          <span className="mr-1 font-medium text-muted-foreground">
            Sources:
          </span>
          {concept.sources.map((source, i) => (
            <span key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                {source.label}
              </a>
              {i < concept.sources!.length - 1 ? " · " : ""}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ModuleCard({
  m,
  language,
}: {
  m: RoadmapModule;
  language: Profile["language"];
}) {
  const p = PRIORITY[m.priority] ?? PRIORITY.low;
  // Old roadmaps may still carry Spanish bank/curated text after switching to English.
  const hideBankQs =
    language === "en" &&
    Boolean(m.questionsSource) &&
    questionsLookSpanish(m.questions);
  const hideCuratedBody =
    language === "en" &&
    m.source === "curated" &&
    (textLooksSpanish(m.title) ||
      textLooksSpanish(m.summary ?? "") ||
      questionsLookSpanish(m.questions));
  const questions = hideBankQs || hideCuratedBody ? [] : m.questions;
  const questionsSource =
    hideBankQs || hideCuratedBody ? undefined : m.questionsSource;
  const concepts = hideCuratedBody ? [] : m.concepts;
  const summary = hideCuratedBody ? undefined : m.summary;

  return (
    <li
      id={`module-${m.id}`}
      className="scroll-mt-4 rounded-lg border bg-background/60 p-3.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{m.title}</span>
        <Badge variant="outline" className={`gap-1.5 text-[10px] ${p.badge}`}>
          <span className={`size-1.5 rounded-full ${p.dot}`} /> {m.priority}
        </Badge>
        {m.source === "curated" && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-medium text-primary"
            title="Curated content from our knowledge base"
          >
            <BookOpen className="size-3" /> curated
          </span>
        )}
        {m.recommendedExtra && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
            title="Recommended complement outside your main stack"
          >
            <Plus className="size-3" /> extra recommendation
          </span>
        )}
      </div>
      {summary && (
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          {summary}
        </p>
      )}

      {concepts && concepts.length > 0 && (
        <div className="mt-3">
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Concepts
          </p>
          <Accordion multiple className="w-full">
            {concepts.map((c, i) => (
              <AccordionItem key={i} value={`c-${i}`} className="border-dashed">
                <AccordionTrigger className="py-2 text-[13px] font-medium hover:no-underline">
                  {c.name}
                </AccordionTrigger>
                <AccordionContent>
                  <ConceptContent concept={c} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {questions && questions.length > 0 && (
        <div className="mt-3">
          <p className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Interview questions
            {questionsSource && (
              <span
                className="inline-flex items-center gap-1 normal-case text-primary"
                title="Real questions from a public source"
              >
                <Library className="size-3" /> real
              </span>
            )}
          </p>
          <Accordion multiple className="w-full">
            {questions.map((q, i) => (
              <AccordionItem key={i} value={`q-${i}`} className="border-dashed">
                <AccordionTrigger className="py-2 text-left text-[13px] font-medium hover:no-underline">
                  {q.question}
                </AccordionTrigger>
                <AccordionContent className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
                  {q.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          {questionsSource && (
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Source:{" "}
              <a
                href={questionsSource.url}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                {questionsSource.repo}
              </a>{" "}
              · {questionsSource.license}
              {questionsSource.copyright
                ? ` · ${questionsSource.copyright}`
                : null}
            </p>
          )}
        </div>
      )}

      {(hideBankQs || hideCuratedBody) && (
        <p className="mt-2 text-[12px] text-muted-foreground">
          Spanish source content hidden for English. Generate a new roadmap to
          get English content for this module.
        </p>
      )}

      {m.exercises && m.exercises.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Practice problems, do these first
          </p>
          <ul className="space-y-1">
            {m.exercises.map((ex, i) => (
              <li key={i}>
                <a
                  href={ex.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5 shrink-0" />
                  {i + 1}. {ex.title}
                  {ex.difficulty && (
                    <span className="text-[10px] text-muted-foreground">
                      · {ex.difficulty}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {m.resource && (
        <a
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          href={m.resource.url}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink className="size-3.5" /> {m.resource.label}
        </a>
      )}
    </li>
  );
}

function RoadmapView({
  roadmap,
  language,
  onOpenPlan,
}: {
  roadmap: Roadmap;
  language: Profile["language"];
  onOpenPlan: () => void;
}) {
  // Group modules by area, preserving order.
  const areas: { area: string; modules: RoadmapModule[] }[] = [];
  for (const m of roadmap.modules) {
    let g = areas.find((a) => a.area === m.area);
    if (!g) {
      g = { area: m.area, modules: [] };
      areas.push(g);
    }
    g.modules.push(m);
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {roadmap.overview}
      </p>

      {areas.map((group) => (
        <section key={group.area} className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.area}
          </h3>
          <ul className="space-y-2">
            {group.modules.map((m) => (
              <ModuleCard key={m.id} m={m} language={language} />
            ))}
          </ul>
        </section>
      ))}

      <button
        onClick={onOpenPlan}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <CalendarDays className="size-3.5" /> View the phased study plan →
      </button>
    </div>
  );
}

function BankSection({
  stack,
  language,
}: {
  stack: string;
  language: Profile["language"];
}) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [bank, setBank] = useState<{
    source: { repo: string; url: string; license: string; copyright: string };
    questions: { question: string; answer: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  // Old roadmaps may still list Spanish banks while the profile is English,  probe once
  // and hide the whole panel if the bank language does not match.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/bank?stack=${encodeURIComponent(stack)}&lang=${encodeURIComponent(language)}`,
        );
        if (cancelled) return;
        if (!r.ok) {
          setHidden(true);
          return;
        }
        setBank(await r.json());
        setHidden(false);
      } catch {
        if (!cancelled) setHidden(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stack, language]);

  async function toggle() {
    if (!open && !bank && !hidden) {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/bank?stack=${encodeURIComponent(stack)}&lang=${encodeURIComponent(language)}`,
        );
        if (r.ok) setBank(await r.json());
        else setHidden(true);
      } finally {
        setLoading(false);
      }
    }
    setOpen((o) => !o);
  }

  if (hidden) return null;

  const matched = bank
    ? bank.questions.filter((x) =>
        x.question.toLowerCase().includes(q.toLowerCase()),
      )
    : [];
  const pageCount = Math.max(1, Math.ceil(matched.length / BANK_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * BANK_PAGE_SIZE;
  const shown = matched.slice(start, start + BANK_PAGE_SIZE);

  return (
    <div className="rise">
      <button
        onClick={toggle}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed bg-card px-3 py-2.5 text-sm font-medium transition-colors hover:bg-quaternary"
      >
        <Library className="size-4 text-primary" />
        <span className="capitalize">{stack}</span>, Real interview questions
        {bank ? ` (${bank.questions.length})` : ""}
        <span className="ml-auto text-[11px] font-normal text-muted-foreground">
          from a public source
        </span>
        <ChevronDown
          className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-2 rounded-lg border bg-card p-3">
          {loading && (
            <div className="flex items-center gap-1.5 py-1">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          )}
          {bank && (
            <>
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search questions…"
                className="mb-2"
              />
              <Accordion multiple className="w-full">
                {shown.map((it, i) => (
                  <AccordionItem
                    key={i}
                    value={`b-${i}`}
                    className="border-dashed"
                  >
                    <AccordionTrigger className="py-2 text-left text-[13px] font-medium hover:no-underline">
                      {it.question}
                    </AccordionTrigger>
                    <AccordionContent className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
                      {it.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              {matched.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed pt-2">
                  <p className="mr-auto text-[11px] text-muted-foreground">
                    Showing {start + 1}-
                    {Math.min(start + shown.length, matched.length)} of{" "}
                    {matched.length}
                    {q ? " matching" : ""} questions
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-full text-xs"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-[11px] text-muted-foreground">
                    Page {currentPage} of {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-full text-xs"
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
              {q && matched.length === 0 && (
                <p className="py-2 text-[13px] text-muted-foreground">
                  No questions match “{q}”.
                </p>
              )}
              <p className="mt-3 border-t border-dashed pt-2 text-[11px] text-muted-foreground">
                Source:{" "}
                <a
                  href={bank.source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {bank.source.repo}
                </a>{" "}
                · {bank.source.license} · {bank.source.copyright}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PlanView({
  plan,
  modules,
  onNavigate,
}: {
  plan: StudyPlan;
  modules: RoadmapModule[];
  onNavigate?: () => void;
}) {
  const titleById = new Map(modules.map((m) => [m.id, m.title]));
  return (
    <div>
      <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
        {plan.summary}
      </p>
      <ol className="relative space-y-2 border-l border-dashed pl-5">
        {(plan.days ?? []).map((d) => (
          <li
            key={d.day}
            className="relative rounded-lg border bg-background/60 p-3"
          >
            <span className="absolute -left-[26px] top-3.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground ring-4 ring-secondary">
              {d.day}
            </span>
            <div className="text-sm font-medium">{d.focus}</div>
            <ul className="mt-1 ml-4 list-disc space-y-0.5 text-[13px] text-muted-foreground">
              {(d.tasks ?? []).map((task, i) => (
                <li key={i}>{task}</li>
              ))}
            </ul>
            {(d.topicIds?.length ?? 0) > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(d.topicIds ?? []).map((id) => (
                  <a
                    key={id}
                    href={`#module-${id}`}
                    onClick={onNavigate}
                    className={`rounded-md px-2 py-0.5 text-[11px] transition-colors ${
                      titleById.has(id)
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {titleById.get(id) ?? id}
                  </a>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

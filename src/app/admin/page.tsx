import { cookies } from "next/headers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ADMIN_COOKIE, isValidSession } from "@/lib/admin-auth";
import { loadKnowledgeBase, type StackKnowledge } from "@/lib/content";
import type { Concept, InterviewQA } from "@/lib/types";
import { adminLogin, adminLogout } from "./actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = (await cookies()).get(ADMIN_COOKIE)?.value;

  if (!isValidSession(session)) {
    const { error } = await searchParams;
    return <AdminLogin error={error} />;
  }

  const knowledge = loadKnowledgeBase();
  return <AdminDashboard knowledge={knowledge} />;
}

function AdminLogin({ error }: { error?: string }) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Admin access</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3">
            <Input
              name="secret"
              type="password"
              placeholder="Secret"
              autoComplete="off"
              required
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" formAction={adminLogin}>
              Enter
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function AdminDashboard({ knowledge }: { knowledge: StackKnowledge[] }) {
  const totals = knowledge.reduce(
    (acc, s) => ({
      stacks: acc.stacks + 1,
      modules: acc.modules + s.totals.modules,
      concepts: acc.concepts + s.totals.concepts,
      questions: acc.questions + s.totals.questions,
    }),
    { stacks: 0, modules: 0, concepts: 0, questions: 0 },
  );

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Knowledge base</h1>
          <p className="text-sm text-muted-foreground">
            {totals.stacks} stacks · {totals.modules} modules · {totals.concepts} concepts ·{" "}
            {totals.questions} questions
          </p>
        </div>
        <form>
          <Button type="submit" formAction={adminLogout} variant="outline" size="sm">
            Log out
          </Button>
        </form>
      </header>

      <div className="flex flex-col gap-2">
        {knowledge.map((s) => (
          <StackSection key={s.stack} data={s} />
        ))}
      </div>
    </main>
  );
}

function StackSection({ data }: { data: StackKnowledge }) {
  return (
    <details className="rounded-lg border border-border bg-card">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 font-medium">
        <span className="font-mono">{data.stack}</span>
        <span className="text-sm text-muted-foreground">
          {data.totals.modules} modules · {data.totals.concepts} concepts · {data.totals.questions}{" "}
          questions
        </span>
        {data.bank && (
          <Badge variant="secondary" className="ml-auto">
            bank: {data.bank.count} Qs
          </Badge>
        )}
      </summary>

      <div className="flex flex-col gap-2 border-t border-border p-3">
        {data.modules.map((m) => (
          <details key={m.id} className="rounded-md border border-border/60">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="font-medium">{m.title}</span>
              <span className="text-xs text-muted-foreground">{m.area}</span>
              <Badge variant="outline" className="ml-auto text-xs">
                {m.priority}
              </Badge>
            </summary>

            <div className="space-y-4 border-t border-border/60 px-3 py-3 text-sm">
              {m.summary && <p className="italic text-muted-foreground">{m.summary}</p>}

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Concepts ({m.concepts.length})
                </h3>
                {m.concepts.map((c, i) => (
                  <ConceptView key={i} concept={c} />
                ))}
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Interview questions ({m.questions.length})
                </h3>
                {m.questions.map((q, i) => (
                  <QuestionView key={i} qa={q} />
                ))}
              </section>
            </div>
          </details>
        ))}
      </div>
    </details>
  );
}

function ConceptView({ concept }: { concept: Concept }) {
  const details = concept.details?.length ? concept.details : [concept.detail];
  const examples = concept.examples?.length
    ? concept.examples
    : concept.example
      ? [{ code: concept.example }]
      : [];

  return (
    <div className="rounded-md bg-muted/40 p-3">
      <p className="font-medium">{concept.name}</p>
      {details.filter(Boolean).map((d, i) => (
        <p key={i} className="mt-1 text-muted-foreground">
          {d}
        </p>
      ))}

      {examples.map((ex, i) => (
        <div key={i} className="mt-2">
          {ex.label && <p className="text-xs text-muted-foreground">{ex.label}</p>}
          {ex.code ? (
            <pre className="mt-1 overflow-x-auto rounded bg-background p-2 text-xs">
              <code>{ex.code}</code>
            </pre>
          ) : (
            ex.text && <p className="text-muted-foreground">{ex.text}</p>
          )}
        </div>
      ))}

      {concept.sources?.length ? (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {concept.sources.map((src, i) => (
            <li key={i}>
              <a
                href={src.url}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2"
              >
                {src.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function QuestionView({ qa }: { qa: InterviewQA }) {
  return (
    <div className="rounded-md border border-border/60 p-2">
      <p className="font-medium">{qa.question}</p>
      <p className="mt-1 text-muted-foreground">{qa.answer}</p>
    </div>
  );
}

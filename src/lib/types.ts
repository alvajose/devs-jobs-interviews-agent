export type Language = "es" | "en";

export interface Profile {
  role: string;
  seniority: string;
  targetCompany?: string;
  weeks: number;
  hoursPerWeek: number;
  language: Language;
}

export type Priority = "high" | "medium" | "low";

export interface StudyDay {
  day: number;
  focus: string;
  topicIds: string[];
  tasks: string[];
}

export interface StudyPlan {
  weeks: number;
  summary: string;
  days: StudyDay[];
}

/** A source-backed example attached to a concept. */
export interface ConceptExample {
  label?: string;
  language?: string;
  code?: string;
  text?: string;
}

/** A source reference for curated concept material. */
export interface SourceRef {
  label: string;
  url: string;
}

/** A concept taught in-app: source-backed details + multiple examples when curated. */
export interface Concept {
  name: string;
  /** Backward-compatible summary/detail. */
  detail: string;
  /** Backward-compatible first example snippet. Optional. */
  example?: string;
  /** Source-backed detail blocks shown before examples. */
  details?: string[];
  /** Multiple examples/snippets drawn from curated source material. */
  examples?: ConceptExample[];
  /** References used by this concept. */
  sources?: SourceRef[];
}

/** A realistic interview question + how to answer it. */
export interface InterviewQA {
  /** A practical/experience/scenario question a real interviewer asks. */
  question: string;
  /** Concise model answer or talking points the candidate can deliver. */
  answer: string;
}

/** A single learning module in a role-based interview-prep roadmap. */
export interface RoadmapModule {
  id: string;
  title: string;
  /** Grouping area, e.g. "Backend", "Frontend", "System Design". */
  area: string;
  /** Optional detected stack for this module (e.g. laravel, python, javascript). */
  stack?: string;
  priority: Priority;
  /** One-line orientation for the module. */
  summary: string;
  /** Background knowledge taught in-app, with examples. */
  concepts: Concept[];
  /** Likely interview questions for this module + concise answers. */
  questions: InterviewQA[];
  /** Optional "go deeper" link to official documentation. Content above is primary. */
  resource?: { label: string; url: string } | null;
  /** "curated" = served from our knowledge base; "generated" = produced by the LLM. */
  source?: "curated" | "generated";
  /** True when this module is outside the requested stack and shown as a complement. */
  recommendedExtra?: boolean;
  /** Set when `questions` were routed from an ingested public bank (real, attributed). */
  questionsSource?: { repo: string; url: string; license: string; copyright: string };
  /** Recommended coding-practice problems with direct links (coding-practice module only). */
  exercises?: { title: string; url: string; difficulty?: string }[];
}

/** A global, role-based roadmap that prepares for ALL interviews of that role. */
export interface Roadmap {
  role: string;
  overview: string;
  modules: RoadmapModule[];
  /** Time-phased schedule over the candidate's weeks/hours, referencing the modules. */
  plan: StudyPlan;
  /** Stacks (with an ingested question bank) relevant to this roadmap, for per-stack banks. */
  bankStacks?: string[];
}

export interface ChatMsg {
  role: "user" | "assistant";
  /** Free-text content (user question, or assistant clarification/error). */
  text?: string;
  /** Role-based roadmap (Study Plan section). */
  roadmap?: Roadmap;
  /** Marks an assistant message as an error (rendered differently). */
  error?: boolean;
}

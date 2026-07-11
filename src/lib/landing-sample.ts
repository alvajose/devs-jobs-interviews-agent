import fs from "node:fs";
import path from "node:path";

export interface LandingSampleWeek {
  phase: string;
  focus: string;
  topics: string[];
  deliverable: string;
  interview: string;
}

export interface LandingSampleRoadmap {
  title: string;
  subtitle: string;
  track: string;
  weeks: LandingSampleWeek[];
}

const SAMPLE_FILE = path.join(
  process.cwd(),
  "content",
  "general",
  "landing-sample-react-node.md",
);

function parseFrontmatter(raw: string): { fm: Record<string, string>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw };
  const fm: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { fm, body: m[2] };
}

function splitSections(text: string, level: number): Array<{ heading: string; content: string }> {
  const marker = `${"#".repeat(level)} `;
  const out: Array<{ heading: string; content: string }> = [];
  let heading: string | null = null;
  const buf: string[] = [];

  const flush = () => {
    if (heading !== null) out.push({ heading, content: buf.join("\n").trim() });
    buf.length = 0;
  };

  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith(marker) && !line.slice(level + 1).startsWith("#")) {
      flush();
      heading = line.slice(marker.length).trim();
      continue;
    }
    if (heading !== null) buf.push(line);
  }
  flush();
  return out;
}

function subSectionMap(text: string, level: number): Record<string, string> {
  const map: Record<string, string> = {};
  for (const section of splitSections(text, level)) {
    map[section.heading] = section.content;
  }
  return map;
}

function parseList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);
}

export function loadLandingSampleRoadmap(): LandingSampleRoadmap | null {
  if (!fs.existsSync(SAMPLE_FILE)) return null;
  const raw = fs.readFileSync(SAMPLE_FILE, "utf8");
  const { fm, body } = parseFrontmatter(raw);

  const weeks = splitSections(body, 2).map(({ heading, content }) => {
    const parts = subSectionMap(content, 3);
    return {
      phase: heading,
      focus: (parts.Focus ?? "").trim(),
      topics: parseList(parts["Key topics"] ?? ""),
      deliverable: (parts.Deliverable ?? "").trim(),
      interview: (parts["Interview checkpoint"] ?? "").trim(),
    };
  });

  if (!weeks.length) return null;

  return {
    title: fm.title || "Sample roadmap preview",
    subtitle: fm.subtitle || "Roadmap preview from curated markdown content.",
    track: fm.track || "React.js + Node.js",
    weeks,
  };
}

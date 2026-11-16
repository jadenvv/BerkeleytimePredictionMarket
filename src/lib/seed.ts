import { initialQuantities } from "./lmsr";
import type { Category, MarketEvent, Outcome, PricePoint } from "./types";

/**
 * Seed markets for local development. Once contracts exist these come from
 * the MarketFactory's events / an indexer instead.
 *
 * Everything here is deterministic (fixed anchor time + seeded PRNG) so the
 * server render and the client hydrate to identical markup.
 */

export const SEED_NOW = Date.UTC(2026, 10, 16, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function prng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Random walk in logit space that ends exactly at `end`. */
function history(key: string, end: number, days: number): PricePoint[] {
  const rand = prng(hash(key));
  const stepsPerDay = 2;
  const n = days * stepsPerDay;
  const pts: PricePoint[] = [];
  let x = logit(end);
  for (let i = 0; i <= n; i++) {
    pts.push({ t: SEED_NOW - i * (DAY / stepsPerDay), p: sigmoid(x) });
    x += (rand() - 0.5) * 0.12 + (rand() < 0.03 ? (rand() - 0.5) * 0.6 : 0);
    x = Math.max(-4.2, Math.min(4.2, x));
  }
  return pts.reverse();
}

function outcome(
  eventId: string,
  id: string,
  label: string,
  p: number,
  volume: number,
  days: number,
  b = 400,
): Outcome {
  return {
    id,
    label,
    ...initialQuantities(p, b),
    b,
    volume,
    history: history(`${eventId}:${id}`, p, days),
  };
}

interface SeedSpec {
  id: string;
  title: string;
  subtitle?: string;
  category: Category;
  course?: string;
  closesInDays: number;
  ageDays: number;
  rules: string;
  outcomes: [id: string, label: string, p: number, volume: number][];
}

const SOURCE = "Berkeleytime grade distributions & enrollment data";

const SPECS: SeedSpec[] = [
  {
    id: "cs61a-fa26-avg-gpa",
    title: "CS 61A Fall 2026 average GPA?",
    category: "Grades",
    course: "COMPSCI 61A",
    closesInDays: 45,
    ageDays: 60,
    rules:
      "Resolves to the bracket containing the course-wide average GPA for COMPSCI 61A, Fall 2026, as first published on Berkeleytime's grade distribution page. Brackets are inclusive of the lower bound.",
    outcomes: [
      ["lt30", "Below 3.00", 0.08, 41_200],
      ["30-32", "3.00 – 3.19", 0.29, 88_950],
      ["32-34", "3.20 – 3.39", 0.47, 132_400],
      ["gte34", "3.40 or higher", 0.16, 39_800],
    ],
  },
  {
    id: "cs61b-sp27-enrollment",
    title: "Will CS 61B Spring 2027 enrollment exceed 1,500?",
    category: "Enrollment",
    course: "COMPSCI 61B",
    closesInDays: 72,
    ageDays: 30,
    rules:
      "Resolves YES if Berkeleytime's enrollment tracker shows more than 1,500 enrolled students (all lecture sections combined) for COMPSCI 61B, Spring 2027, at the end of the add/drop deadline.",
    outcomes: [["yes", "Yes", 0.62, 204_300]],
  },
  {
    id: "longest-waitlist-sp27",
    title: "Longest waitlist on the first day of Spring 2027 classes?",
    category: "Waitlists",
    closesInDays: 64,
    ageDays: 21,
    rules:
      "Resolves to the course with the largest waitlist count on Berkeleytime at 12:00 PT on the first day of instruction, Spring 2027. Ties resolve to the course listed first.",
    outcomes: [
      ["cs61a", "COMPSCI 61A", 0.21, 51_900],
      ["data8", "DATA C8", 0.34, 73_100],
      ["cs70", "COMPSCI 70", 0.18, 33_600],
      ["econ1", "ECON 1", 0.15, 27_400],
      ["ugba10", "UGBA 10", 0.12, 19_250],
    ],
  },
  {
    id: "math1a-fa26-a-rate",
    title: "Will more than 35% of MATH 1A students get an A this fall?",
    category: "Grades",
    course: "MATH 1A",
    closesInDays: 45,
    ageDays: 40,
    rules:
      "Resolves YES if the combined share of A+, A and A- grades for MATH 1A, Fall 2026, on Berkeleytime exceeds 35.0% of letter-graded students.",
    outcomes: [["yes", "Yes", 0.38, 66_700]],
  },
  {
    id: "cs70-fa26-avg",
    title: "Will CS 70's Fall 2026 average land at B or higher?",
    category: "Grades",
    course: "COMPSCI 70",
    closesInDays: 45,
    ageDays: 50,
    rules:
      "Resolves YES if Berkeleytime reports an average grade of B (3.00 GPA) or higher for COMPSCI 70, Fall 2026.",
    outcomes: [["yes", "Yes", 0.55, 97_850]],
  },
  {
    id: "data8-phase1-cap",
    title: "Will Data 8 fill up during Phase 1 for Spring 2027?",
    category: "Enrollment",
    course: "DATA C8",
    closesInDays: 20,
    ageDays: 14,
    rules:
      "Resolves YES if DATA C8 reaches its enrollment capacity before Phase 2 opens for Spring 2027, per Berkeleytime's enrollment history chart.",
    outcomes: [["yes", "Yes", 0.81, 58_200]],
  },
  {
    id: "chem1a-fa26-below-29",
    title: "Will CHEM 1A's Fall 2026 average fall below 2.90?",
    category: "Grades",
    course: "CHEM 1A",
    closesInDays: 45,
    ageDays: 35,
    rules:
      "Resolves YES if Berkeleytime reports an average GPA below 2.90 for CHEM 1A, Fall 2026.",
    outcomes: [["yes", "Yes", 0.44, 31_500]],
  },
  {
    id: "cs189-sp27-instructor",
    title: "Who will teach CS 189 in Spring 2027?",
    category: "Instructors",
    course: "COMPSCI 189",
    closesInDays: 50,
    ageDays: 25,
    rules:
      "Resolves to the instructor of record for the first lecture section of COMPSCI 189, Spring 2027, as listed on Berkeleytime at the start of instruction. Multiple instructors resolve to whoever is listed first.",
    outcomes: [
      ["a", "Instructor A", 0.41, 22_100],
      ["b", "Instructor B", 0.33, 18_700],
      ["c", "Instructor C", 0.17, 9_800],
      ["other", "Someone else", 0.09, 4_300],
    ],
  },
  {
    id: "ugba10-waitlist-200",
    title: "Will the UGBA 10 waitlist top 200 students?",
    category: "Waitlists",
    course: "UGBA 10",
    closesInDays: 64,
    ageDays: 18,
    rules:
      "Resolves YES if Berkeleytime shows a UGBA 10 waitlist above 200 at any point between Phase 1 and the add/drop deadline for Spring 2027.",
    outcomes: [["yes", "Yes", 0.27, 14_900]],
  },
  {
    id: "highest-gpa-dept-fa26",
    title: "Which large department will post the highest average GPA in Fall 2026?",
    subtitle: "Departments with 2,000+ graded enrollments",
    category: "Campus",
    closesInDays: 45,
    ageDays: 55,
    rules:
      "Resolves to the department (among those with at least 2,000 letter-graded enrollments in Fall 2026) with the highest enrollment-weighted average GPA on Berkeleytime.",
    outcomes: [
      ["eecs", "EECS", 0.22, 26_000],
      ["ugba", "Haas (UGBA)", 0.39, 41_300],
      ["ls", "L&S Breadth", 0.23, 21_800],
      ["stat", "Statistics", 0.16, 12_600],
    ],
  },
  {
    id: "econ1-fa26-b-plus",
    title: "Will ECON 1's Fall 2026 average be a B+ or better?",
    category: "Grades",
    course: "ECON 1",
    closesInDays: 45,
    ageDays: 28,
    rules:
      "Resolves YES if Berkeleytime reports an average grade of B+ (3.30 GPA) or higher for ECON 1, Fall 2026.",
    outcomes: [["yes", "Yes", 0.19, 17_300]],
  },
  {
    id: "physics7a-fa26-avg",
    title: "PHYSICS 7A Fall 2026 average GPA?",
    category: "Grades",
    course: "PHYSICS 7A",
    closesInDays: 45,
    ageDays: 33,
    rules:
      "Resolves to the bracket containing the average GPA for PHYSICS 7A, Fall 2026, as published on Berkeleytime.",
    outcomes: [
      ["lt27", "Below 2.70", 0.24, 8_900],
      ["27-30", "2.70 – 2.99", 0.51, 16_400],
      ["gte30", "3.00 or higher", 0.25, 7_700],
    ],
  },
];

/** Placeholder creator address for seeded markets. */
const SEED_CREATOR = "0x000000000000000000000000000000000000bEa7" as const;

export function seedEvents(): MarketEvent[] {
  return SPECS.map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    category: s.category,
    course: s.course,
    closesAt: SEED_NOW + s.closesInDays * DAY,
    resolvesAt: SEED_NOW + (s.closesInDays + 14) * DAY,
    rules: s.rules,
    source: SOURCE,
    creator: SEED_CREATOR,
    createdAt: SEED_NOW - s.ageDays * DAY,
    status: "open",
    outcomes: s.outcomes.map(([id, label, p, vol]) =>
      outcome(s.id, id, label, p, vol, s.ageDays),
    ),
  }));
}

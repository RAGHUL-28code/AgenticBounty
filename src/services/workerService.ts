export type DemoStage =
  "idle" | "creating" | "open" | "verifying" | "verified" | "processing" | "preview-complete";

export type WorkerActivity = {
  id: string;
  message: string;
  timestamp: string;
};

export type WorkerSubmission = {
  solution: string;
  explanation: string;
  githubUrl: string;
};

export type WorkerDemoState = {
  stage: DemoStage;
  claimed: boolean;
  completed: boolean;
  submission: WorkerSubmission;
  activity: WorkerActivity[];
};

export type WorkerProfile = {
  id: string;
  name: string;
  role: string;
  verified: boolean;
  skills: string[];
  completedBounties: number;
  successRate: number;
  reputation: number;
  totalEarned: number;
};

export type DemoBounty = {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: "Easy" | "Medium" | "Hard";
  reward: number;
  requiredSkills: string[];
  testCount: number;
  acceptanceCriteria: string[];
  claimable: boolean;
};

export type MatchResult = {
  score: number;
  level: "Excellent" | "Strong" | "Good" | "Developing";
  reasons: string[];
};

export const WORKER_STORAGE_KEY = "agenticbounty-worker-demo-v1";

export const DEMO_WORKER: WorkerProfile = {
  id: "worker-raghul",
  name: "Raghul",
  role: "Verified Developer",
  verified: true,
  skills: ["TypeScript", "Python", "C++", "Internationalization"],
  completedBounties: 12,
  successRate: 91,
  reputation: 87,
  totalEarned: 53,
};

export const DEMO_BOUNTIES = [
  {
    id: "international-email-validation",
    title: "Fix international email validation",
    description:
      "The current validator rejects valid international email addresses. Agent Alpha has exhausted its attempts and needs a human-reviewed solution.",
    category: "Internationalization",
    difficulty: "Medium",
    reward: 10,
    requiredSkills: ["TypeScript", "Internationalization"],
    testCount: 4,
    acceptanceCriteria: [
      "Accept standard email addresses",
      "Accept internationalized domain names",
      "Reject malformed addresses",
      "Pass all four deterministic checks",
    ],
    claimable: true,
  },
  {
    id: "transit-stop-names",
    title: "Normalize public transit stop names",
    description: "Improve consistency in public transit stop names across imported datasets.",
    category: "Data quality",
    difficulty: "Easy",
    reward: 18,
    requiredSkills: ["Python", "Data quality"],
    testCount: 6,
    acceptanceCriteria: ["Normalize whitespace", "Preserve meaningful punctuation"],
    claimable: false,
  },
  {
    id: "datepicker-keyboard-focus",
    title: "Improve keyboard focus in date picker",
    description: "Make date selection predictable and accessible for keyboard-only users.",
    category: "Accessibility",
    difficulty: "Hard",
    reward: 25,
    requiredSkills: ["TypeScript", "Accessibility"],
    testCount: 9,
    acceptanceCriteria: ["Support arrow-key navigation", "Keep focus visible"],
    claimable: false,
  },
] satisfies [DemoBounty, ...DemoBounty[]];

export const INITIAL_WORKER_SUBMISSION: WorkerSubmission = {
  solution: `export function isValidInternationalEmail(email: string) {
  const at = email.lastIndexOf("@");
  if (at < 1 || email.indexOf("@") !== at) return false;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.includes("..") || local.startsWith(".")) return false;

  const asciiDomain = new URL(\`http://\${domain}\`).hostname;
  return asciiDomain.includes(".") && !asciiDomain.includes("..");
}`,
  explanation: "",
  githubUrl: "",
};

export function createInitialWorkerDemoState(): WorkerDemoState {
  return {
    stage: "idle",
    claimed: false,
    completed: false,
    submission: { ...INITIAL_WORKER_SUBMISSION },
    activity: [],
  };
}

export function calculateMatchScore(worker: WorkerProfile, bounty: DemoBounty): MatchResult {
  const workerSkills = new Set(worker.skills.map(normalizeSkill));
  const matchedSkills = bounty.requiredSkills.filter((skill) =>
    workerSkills.has(normalizeSkill(skill)),
  );
  const skillPoints =
    bounty.requiredSkills.length === 0
      ? 0
      : (matchedSkills.length / bounty.requiredSkills.length) * 35;
  const categoryMatches = workerSkills.has(normalizeSkill(bounty.category));
  const experiencePoints = Math.min(worker.completedBounties / 10, 1) * 15;
  const score = Math.round(
    skillPoints +
      (categoryMatches ? 20 : 0) +
      experiencePoints +
      worker.successRate * 0.15 +
      worker.reputation * 0.1,
  );
  const reasons = [
    matchedSkills.length > 0
      ? `Strong ${matchedSkills.join(" and ")} experience`
      : "Build experience in the required skills",
    categoryMatches
      ? `Relevant ${bounty.category.toLowerCase()} skills`
      : `Opportunity to grow in ${bounty.category.toLowerCase()}`,
    worker.completedBounties > 0
      ? `Completed ${worker.completedBounties} similar tasks`
      : "Build your task history",
    `High verification success rate (${worker.successRate}%)`,
  ];

  return {
    score,
    level: score >= 90 ? "Excellent" : score >= 75 ? "Strong" : score >= 60 ? "Good" : "Developing",
    reasons,
  };
}

export function loadWorkerDemoState(): WorkerDemoState | null {
  try {
    const stored = window.localStorage.getItem(WORKER_STORAGE_KEY);
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);
    if (!isWorkerDemoState(parsed)) {
      console.warn("Ignoring invalid AgenticBounty worker demo state.");
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("Could not load AgenticBounty worker demo state.", error);
    return null;
  }
}

export function saveWorkerDemoState(state: WorkerDemoState): void {
  try {
    window.localStorage.setItem(WORKER_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Could not save AgenticBounty worker demo state.", error);
  }
}

function isWorkerDemoState(value: unknown): value is WorkerDemoState {
  if (typeof value !== "object" || value === null) return false;

  const state = value as Partial<WorkerDemoState>;
  return (
    typeof state.stage === "string" &&
    isDemoStage(state.stage) &&
    typeof state.claimed === "boolean" &&
    typeof state.completed === "boolean" &&
    typeof state.submission === "object" &&
    state.submission !== null &&
    typeof state.submission.solution === "string" &&
    typeof state.submission.explanation === "string" &&
    typeof state.submission.githubUrl === "string" &&
    Array.isArray(state.activity) &&
    state.activity.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.id === "string" &&
        typeof entry.message === "string" &&
        typeof entry.timestamp === "string",
    )
  );
}

function isDemoStage(value: string): value is DemoStage {
  return (
    value === "idle" ||
    value === "creating" ||
    value === "open" ||
    value === "verifying" ||
    value === "verified" ||
    value === "processing" ||
    value === "preview-complete"
  );
}

function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase();
}

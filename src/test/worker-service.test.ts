import { describe, expect, it } from "vitest";

import {
  calculateMatchScore,
  createInitialWorkerDemoState,
  DEMO_BOUNTIES,
  DEMO_WORKER,
} from "@/services/workerService";

describe("worker bounty matching", () => {
  it("calculates a stable match score from worker skills and experience", () => {
    const match = calculateMatchScore(DEMO_WORKER, DEMO_BOUNTIES[0]);

    expect(match.score).toBe(92);
    expect(match.level).toBe("Excellent");
    expect(match.reasons).toContain("Relevant internationalization skills");
    expect(match.reasons).toContain("Completed 12 similar tasks");
  });

  it("starts with a clean, unclaimed worker demo", () => {
    const state = createInitialWorkerDemoState();

    expect(state.stage).toBe("idle");
    expect(state.claimed).toBe(false);
    expect(state.completed).toBe(false);
    expect(state.activity).toEqual([]);
    expect(state.submission.solution).toContain("isValidInternationalEmail");
  });

  it("only enables claims for tasks with a connected verification suite", () => {
    expect(DEMO_BOUNTIES.filter((bounty) => bounty.claimable).map((bounty) => bounty.id)).toEqual([
      "international-email-validation",
    ]);
  });
});

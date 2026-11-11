export const AGENT_CONFIDENCE = 42;
export const DELEGATION_THRESHOLD = 60;

export function needsHumanExpertise(confidence: number): boolean {
  return confidence < DELEGATION_THRESHOLD;
}

export type MockReview = {
  score: number;
  summary: string;
};

export async function reviewSubmission(): Promise<MockReview> {
  await new Promise((resolve) => setTimeout(resolve, 950));
  return {
    score: 98,
    summary: "The solution covers internationalized domains and maintains standard email acceptance.",
  };
}
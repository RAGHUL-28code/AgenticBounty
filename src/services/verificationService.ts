export type VerificationTest = {
  name: string;
  input: string;
  expected: boolean;
};

export type VerificationResult = VerificationTest & {
  passed: boolean;
};

export function validateSubmissionFormat(solution: string): VerificationResult {
  const trimmedSolution = solution.trim();
  const hasExpectedValidator =
    /(?:export\s+)?function\s+isValidInternationalEmail\s*\(/.test(trimmedSolution);
  const braces = trimmedSolution.match(/[{}]/g) ?? [];
  let braceDepth = 0;
  let hasBalancedBraces = true;

  for (const brace of braces) {
    braceDepth += brace === "{" ? 1 : -1;
    if (braceDepth < 0) {
      hasBalancedBraces = false;
      break;
    }
  }

  const passed =
    trimmedSolution.length > 0 &&
    hasExpectedValidator &&
    hasBalancedBraces &&
    braceDepth === 0;

  return {
    name: "Required validator is present and code structure is complete",
    input: solution,
    expected: true,
    passed,
  };
}

export const emailVerificationCases: VerificationTest[] = [
  { name: "Standard email accepted", input: "agent.alpha+task@example.com", expected: true },
  { name: "International domain accepted", input: "joão@bücher.example", expected: true },
  { name: "Invalid email rejected", input: "not-an-email", expected: false },
  { name: "Edge case validation passed", input: "worker@-invalid.example", expected: false },
];

export function isValidInternationalEmail(value: string): boolean {
  const email = value.trim();
  const atIndex = email.lastIndexOf("@");

  if (
    atIndex <= 0 ||
    email.indexOf("@") !== atIndex ||
    email.length > 254 ||
    /\s/.test(email)
  ) {
    return false;
  }

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  if (
    localPart.length > 64 ||
    !/^[\p{L}\p{N}!#$%&'*+/=?^_`{|}~.-]+$/u.test(localPart) ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..")
  ) {
    return false;
  }

  try {
    const asciiDomain = new URL(`http://${domain}`).hostname;
    const labels = asciiDomain.split(".");

    return (
      asciiDomain.length <= 253 &&
      labels.length >= 2 &&
      labels.every(
        (label) =>
          label.length >= 1 &&
          label.length <= 63 &&
          /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label),
      ) &&
      /^[a-z\d-]+$/i.test(labels[labels.length - 1] ?? "")
    );
  } catch {
    return false;
  }
}

export function runDeterministicTests(): VerificationResult[] {
  return emailVerificationCases.map((test) => ({
    ...test,
    passed: isValidInternationalEmail(test.input) === test.expected,
  }));
}
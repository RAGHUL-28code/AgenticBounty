import { describe, expect, it } from "vitest";

import {
  emailVerificationCases,
  isValidInternationalEmail,
  runDeterministicTests,
  validateSubmissionFormat,
} from "@/services/verificationService";

describe("international email verification", () => {
  it("accepts standard email addresses", () => {
    expect(isValidInternationalEmail("agent.alpha+task@example.com")).toBe(true);
  });

  it("accepts international email addresses and IDN domains", () => {
    expect(isValidInternationalEmail("joão@bücher.example")).toBe(true);
  });

  it("rejects addresses without an at sign", () => {
    expect(isValidInternationalEmail("not-an-email")).toBe(false);
  });

  it("rejects domain labels that start with a hyphen", () => {
    expect(isValidInternationalEmail("worker@-invalid.example")).toBe(false);
  });

  it("runs the four promised bounty checks against real validation logic", () => {
    const results = runDeterministicTests();

    expect(emailVerificationCases).toHaveLength(4);
    expect(results.every((result) => result.passed)).toBe(true);
    expect(results.map(({ name }) => name)).toEqual([
      "Standard email accepted",
      "International domain accepted",
      "Invalid email rejected",
      "Edge case validation passed",
    ]);
  });

  it("accepts a complete submission containing the required validator", () => {
    expect(validateSubmissionFormat("export function isValidInternationalEmail() {}").passed).toBe(
      true,
    );
  });

  it("rejects a missing validator or incomplete function body", () => {
    expect(validateSubmissionFormat("export function anotherFunction() {}").passed).toBe(false);
    expect(validateSubmissionFormat("export function isValidInternationalEmail() {").passed).toBe(
      false,
    );
    expect(validateSubmissionFormat("").passed).toBe(false);
  });
});
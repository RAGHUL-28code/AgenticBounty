import { describe, expect, it } from "vitest";

import { previewPayPalHandoff } from "@/services/paypalService";

describe("payment release preview", () => {
  it("never creates a transaction or moves real funds", async () => {
    const preview = await previewPayPalHandoff(10);

    expect(preview.status).toBe("demo-complete");
    expect(preview.amount).toBe(10);
    expect(preview.transactionCreated).toBe(false);
    expect(preview.message).toContain("did not create a transaction");
    expect(preview.message).toContain("move money");
  });
});

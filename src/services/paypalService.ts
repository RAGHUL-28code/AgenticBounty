export type PaymentPreview = {
  status: "demo-complete";
  amount: number;
  transactionCreated: false;
  message: string;
};

/** Safe presentation-only placeholder; does not connect to PayPal or move money. */
export async function previewPayPalHandoff(amount: number): Promise<PaymentPreview> {
  await new Promise((resolve) => setTimeout(resolve, 1_050));

  return {
    status: "demo-complete",
    amount,
    transactionCreated: false,
    message:
      "PayPal is not connected. This preview did not create a transaction, reserve funds, or move money.",
  };
}
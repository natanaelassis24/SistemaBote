export type PixPaymentResponse = {
  ok: boolean;
  id?: string | number;
  status?: string;
  amount?: number;
  ticket_url?: string | null;
  qr_code?: string | null;
  qr_code_base64?: string | null;
  date_of_expiration?: string | null;
  error?: string;
  details?: unknown;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export async function createPixPayment(planId: string, email: string) {
  const response = await fetch(`${API_BASE_URL}/payments/pix`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId, email })
  });

  const data = (await response.json()) as PixPaymentResponse;
  if (!response.ok || !data.ok) {
    const details = data.details as { message?: string; error?: string } | undefined;
    const message =
      details?.message ??
      details?.error ??
      data.error ??
      "mp_payment_failed";
    throw new Error(message);
  }

  return data;
}

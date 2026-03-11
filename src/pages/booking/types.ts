import { formatCurrency } from "@/src/lib/utils";

// ────────────────────────────────────────
// Shared types for the booking wizard
// ────────────────────────────────────────

export interface BookableService {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  category: string;
  priceType?: string;
  depositRequired?: boolean;
  depositAmount?: number;
}

export type Step = "service" | "datetime" | "auth" | "pet" | "confirm" | "done";

export type PublicScheduleDay = {
  isClosed: boolean;
  availableSlots: number;
};

export type BookingResult = {
  status?: string;
  message?: string;
  depositRequired?: number;
};

export const hasDeposit = (service: Pick<BookableService, "depositRequired" | "depositAmount">) =>
  Boolean(service.depositRequired && (service.depositAmount ?? 0) > 0);

export const formatServicePrice = (service: Pick<BookableService, "price" | "priceType">) =>
  service.priceType === "from" ? `From ${formatCurrency(service.price)}` : formatCurrency(service.price);

// ────────────────────────────────────────
// Public API helper
// ────────────────────────────────────────
export async function publicFetch(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  headers.set('X-Requested-With', 'XMLHttpRequest');

  const res = await fetch(url, { ...options, headers, credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || "Request failed");
  }
  return res.json();
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined, options: Intl.NumberFormatOptions = {}) {
  const value = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  const defaultFractionDigits = Number.isInteger(value) ? 0 : 2;

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: options.minimumFractionDigits ?? defaultFractionDigits,
    maximumFractionDigits: options.maximumFractionDigits ?? defaultFractionDigits,
  }).format(value);
}

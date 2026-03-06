import { toast } from "sonner";

/**
 * Standardised error handler for frontend API calls.
 *
 * Usage:
 *   try { … } catch (err) { handleError(err, "Failed to save customer"); }
 *
 * - Shows a toast with a user-friendly message
 * - Logs details to console for debugging
 * - Supports API errors with `details` payload
 */
export function handleError(err: unknown, fallbackMessage = "Something went wrong") {
  const error = err instanceof Error ? err : new Error(String(err));
  const apiDetails = (error as any).details;

  // Use the API error message if available, otherwise fall back
  const userMessage = apiDetails?.error || error.message || fallbackMessage;

  toast.error(userMessage);

  if (process.env.NODE_ENV !== "production") {
    console.error(`[PetSpa] ${fallbackMessage}:`, error);
    if (apiDetails) {
      console.error("[PetSpa] API details:", apiDetails);
    }
  }
}

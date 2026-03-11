import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Dog } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { FieldError } from "@/src/components/ui/field-error";
import { api } from "@/src/lib/api";
import { validatePasswordStrength } from "@/src/lib/passwordValidation";
import { useFormValidation, required } from "@/src/lib/useFormValidation";

type ResetPasswordForm = {
  newPassword: string;
  confirmPassword: string;
};

export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const { errors, validate, clearError } = useFormValidation<ResetPasswordForm>({
    newPassword: (value) => required("New password")(value) || validatePasswordStrength(value),
    confirmPassword: (value, data) => {
      const missing = required("Confirm password")(value);
      if (missing) return missing;
      if (value !== data.newPassword) return "Passwords do not match";
      return null;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is missing a token. Please request a new email.");
      return;
    }

    if (!validate({ newPassword, confirmPassword })) {
      return;
    }

    setIsLoading(true);
    try {
      await api.confirmPasswordReset(token, newPassword);
      setIsComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset your password right now.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sky px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute top-[-120px] right-[-80px] h-[400px] w-[400px] rounded-full bg-white/10" />
      <div className="absolute bottom-[-100px] left-[-60px] h-[300px] w-[300px] rounded-full bg-white/10" />

      <div className="relative w-full max-w-md space-y-8 rounded-2xl bg-white p-10 shadow-xl">
        <div className="flex flex-col items-center justify-center">
          <div className="rounded-2xl bg-accent p-3 shadow-lg">
            <Dog className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-6 text-center font-heading text-3xl font-bold tracking-tight text-purple">
            Reset password
          </h1>
          <p className="mt-2 text-center text-sm text-slate-500">
            Choose a new password for your <span className="font-accent text-lg text-brand-600">Smarter Dog</span>{" "}
            account.
          </p>
        </div>

        {isComplete ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-brand-50 px-4 py-4 text-center text-sm font-medium text-brand-700">
              Your password has been updated. You can sign in straight away.
            </div>
            <Button className="w-full font-bold shadow-md" onClick={() => navigate("/login?reset=success")}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="new-password">
                  New password
                </label>
                <Input
                  id="new-password"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Create a stronger password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    clearError("newPassword");
                  }}
                  aria-invalid={!!errors.newPassword}
                />
                <FieldError message={errors.newPassword} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="confirm-password">
                  Confirm password
                </label>
                <Input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    clearError("confirmPassword");
                  }}
                  aria-invalid={!!errors.confirmPassword}
                />
                <FieldError message={errors.confirmPassword} />
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Passwords must be at least 8 characters and include uppercase, lowercase, and a number.
            </div>

            {error && (
              <div className="rounded-xl bg-coral-light px-3 py-2 text-center text-sm font-medium text-coral">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <Button type="submit" className="w-full font-bold shadow-md" disabled={isLoading}>
                {isLoading ? "Updating password..." : "Update password"}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => navigate("/login")}>
                Back to sign in
              </Button>
            </div>
          </form>
        )}

        <p className="text-center font-accent text-sm text-slate-400">Come scruffy. Leave gorgeous.</p>
      </div>
    </div>
  );
}

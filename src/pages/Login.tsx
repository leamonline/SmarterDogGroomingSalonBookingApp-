import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { FieldError } from "@/src/components/ui/field-error";
import { useAuth } from "@/src/lib/AuthContext";
import { api } from "@/src/lib/api";
import { useFormValidation, email as emailRule, required } from "@/src/lib/useFormValidation";
import { Dog } from "lucide-react";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPanel, setShowForgotPanel] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState("");
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState("");
  const [isRequestingReset, setIsRequestingReset] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "success";

  const { errors, validate, clearError } = useFormValidation<{ email: string; password: string }>({
    email: emailRule,
    password: required("Password"),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate({ email, password })) return;
    setIsLoading(true);
    setError("");

    try {
      const data = await api.login({ email, password });
      login(data.token ?? "", data.user, data.passwordChangeRequired);
      if (data.passwordChangeRequired) {
        navigate("/settings");
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    const emailValidationError = emailRule(email);
    if (emailValidationError) {
      setForgotPasswordError(emailValidationError);
      setForgotPasswordMessage("");
      return;
    }

    setForgotPasswordError("");
    setForgotPasswordMessage("");
    setIsRequestingReset(true);

    try {
      const response = await api.requestPasswordReset(email);
      setForgotPasswordMessage(response.message || "If an account with that email exists, a reset link has been sent.");
    } catch (err) {
      setForgotPasswordError(err instanceof Error ? err.message : "Unable to send reset link right now.");
    } finally {
      setIsRequestingReset(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-sky px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background circles */}
      <div className="absolute top-[-120px] right-[-80px] h-[400px] w-[400px] rounded-full bg-white/10" />
      <div className="absolute bottom-[-100px] left-[-60px] h-[300px] w-[300px] rounded-full bg-white/10" />

      <div className="relative w-full max-w-md space-y-8 bg-white p-10 rounded-2xl shadow-xl">
        <div className="flex flex-col items-center justify-center">
          <div className="rounded-2xl bg-accent p-3 shadow-lg">
            <Dog className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-center font-heading text-3xl font-bold tracking-tight text-purple">Welcome back</h2>
          <p className="mt-2 text-center text-sm text-slate-500">
            Sign in to <span className="font-accent text-lg text-brand-600">Smarter Dog</span>
          </p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {resetSuccess && (
            <div className="text-sm text-brand-700 font-medium text-center bg-brand-50 px-3 py-2 rounded-xl">
              Password updated. Sign in with your new password.
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block" htmlFor="email-address">
                Email
              </label>
              <Input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@smarterdog.co.uk"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError("email");
                }}
                aria-invalid={!!errors.email}
              />
              <FieldError message={errors.email} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-slate-700" htmlFor="password">
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 underline underline-offset-2"
                  onClick={() => {
                    setShowForgotPanel((current) => !current);
                    setForgotPasswordError("");
                    setForgotPasswordMessage("");
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError("password");
                }}
                aria-invalid={!!errors.password}
              />
              <FieldError message={errors.password} />
            </div>
          </div>

          {showForgotPanel && (
            <div className="space-y-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-4">
              <p className="text-sm text-slate-700">
                Enter your account email above and we&apos;ll send you a password reset link.
              </p>
              {forgotPasswordMessage && (
                <div className="text-sm text-brand-700 font-medium rounded-xl bg-white/80 px-3 py-2">
                  {forgotPasswordMessage}
                </div>
              )}
              {forgotPasswordError && (
                <div className="text-sm text-coral font-medium rounded-xl bg-white/80 px-3 py-2">
                  {forgotPasswordError}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleRequestPasswordReset}
                disabled={isRequestingReset}
              >
                {isRequestingReset ? "Sending reset link..." : "Send reset link"}
              </Button>
            </div>
          )}

          {error && (
            <div className="text-sm text-coral font-medium text-center bg-coral-light px-3 py-2 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <Button type="submit" className="w-full font-bold shadow-md" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </div>
        </form>

        <p className="text-center font-accent text-sm text-slate-400">Come scruffy. Leave gorgeous.</p>
      </div>
    </div>
  );
}

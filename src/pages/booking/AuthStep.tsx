import React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

interface AuthStepProps {
  isRegister: boolean;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  onEmailChange: (val: string) => void;
  onPasswordChange: (val: string) => void;
  onFirstNameChange: (val: string) => void;
  onLastNameChange: (val: string) => void;
  onPhoneChange: (val: string) => void;
  onToggleRegister: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}

export function AuthStep({
  isRegister, email, password, firstName, lastName, phone,
  onEmailChange, onPasswordChange, onFirstNameChange, onLastNameChange, onPhoneChange,
  onToggleRegister, onSubmit, onBack,
}: AuthStepProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-purple">
          {isRegister ? "Create an Account" : "Sign In to Book"}
        </h2>
        <Button size="sm" variant="outline" onClick={onBack}><ArrowLeft className="h-3.5 w-3.5 mr-1" /> Services</Button>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        {isRegister ? "Create an account to manage your bookings." : "Sign in with your existing account."}
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        {isRegister && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">First Name *</label>
              <Input value={firstName} onChange={e => onFirstNameChange(e.target.value)} autoComplete="given-name" required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Last Name</label>
              <Input value={lastName} onChange={e => onLastNameChange(e.target.value)} autoComplete="family-name" />
            </div>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Email *</label>
          <Input type="email" value={email} onChange={e => onEmailChange(e.target.value)} autoComplete="email" required />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Password *</label>
          <Input type="password" value={password} onChange={e => onPasswordChange(e.target.value)} autoComplete={isRegister ? "new-password" : "current-password"} required />
          {isRegister && (
            <p className="text-xs text-slate-500">Use at least one uppercase letter, one lowercase letter, and one number.</p>
          )}
        </div>
        {isRegister && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Phone</label>
            <Input type="tel" value={phone} onChange={e => onPhoneChange(e.target.value)} autoComplete="tel" />
          </div>
        )}
        <Button type="submit" className="w-full">{isRegister ? "Create Account" : "Sign In"}</Button>
        <p className="text-center text-sm text-slate-500">
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <button type="button" onClick={onToggleRegister} className="text-brand-600 font-medium underline">
            {isRegister ? "Sign in" : "Register"}
          </button>
        </p>
      </form>
    </div>
  );
}

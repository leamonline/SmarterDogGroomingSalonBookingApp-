import { useState, useCallback } from 'react';

export type ValidationRules<T> = Partial<Record<keyof T, (value: any, data: Partial<T>) => string | null>>;

/**
 * Lightweight form-validation hook.
 *
 * Usage:
 *   const { errors, validate, fieldError, clearError } = useFormValidation<MyForm>(rules);
 *   // In onChange:  clearError('name');
 *   // On submit:    if (!validate(formData)) return;
 *   // In JSX:       {fieldError('name')}
 */
export function useFormValidation<T extends Record<string, any>>(rules: ValidationRules<T>) {
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  /** Validate all fields, returns true if valid. */
  const validate = useCallback(
    (data: Partial<T>): boolean => {
      const next: Partial<Record<keyof T, string>> = {};
      for (const [field, rule] of Object.entries(rules)) {
        if (typeof rule !== 'function') continue;
        const msg = rule((data as any)[field], data);
        if (msg) next[field as keyof T] = msg;
      }
      setErrors(next);
      return Object.keys(next).length === 0;
    },
    [rules],
  );

  /** Clear a single field error (call on change). */
  const clearError = useCallback((field: keyof T) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  }, []);

  /** Clear all errors (call on modal open/reset). */
  const clearAll = useCallback(() => setErrors({}), []);

  /** Render helper — returns a small red message or null. */
  const fieldError = useCallback(
    (field: keyof T) => {
      const msg = errors[field];
      if (!msg) return null;
      return (
        // We return a plain object with the error string — the component renders it.
        msg
      );
    },
    [errors],
  );

  return { errors, validate, clearError, clearAll, fieldError } as const;
}

// ── Common validators ────────────────────────────────────
export const required = (label: string) => (v: any) =>
  !v || (typeof v === 'string' && !v.trim()) ? `${label} is required` : null;

export const email = (v: any) => {
  if (!v || typeof v !== 'string' || !v.trim()) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address';
  return null;
};

export const phone = (v: any) => {
  if (!v || typeof v !== 'string' || !v.trim()) return 'Phone is required';
  // Strip formatting and check at least 7 digits remain
  const digits = v.replace(/\D/g, '');
  if (digits.length < 7) return 'Enter a valid phone number';
  return null;
};

export const positiveNumber = (label: string) => (v: any) => {
  const n = Number(v);
  if (isNaN(n) || n < 0) return `${label} must be a positive number`;
  return null;
};

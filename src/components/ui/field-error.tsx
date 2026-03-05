import React from 'react';

interface FieldErrorProps {
  message?: string | null;
}

/** Tiny inline error label for form fields. */
export function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p className="text-xs text-coral mt-1" role="alert">
      {message}
    </p>
  );
}

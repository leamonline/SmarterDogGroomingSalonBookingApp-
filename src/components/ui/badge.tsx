import * as React from "react";
import { cn } from "@/src/lib/utils";

const Badge = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "secondary" | "destructive" | "outline" }
>(({ className, variant = "default", ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2",
        {
          "border-transparent bg-brand-600 text-white hover:bg-brand-700": variant === "default",
          "border-transparent bg-brand-50 text-brand-700 hover:bg-brand-100": variant === "secondary",
          "border-transparent bg-coral text-white hover:bg-coral/80": variant === "destructive",
          "text-brand-700 border-brand-200": variant === "outline",
        },
        className,
      )}
      {...props}
    />
  );
});
Badge.displayName = "Badge";

export { Badge };

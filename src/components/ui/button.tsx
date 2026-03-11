import * as React from "react";
import { cn } from "@/src/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-semibold font-heading ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-brand-600 text-white hover:bg-brand-700 shadow-sm": variant === "default",
            "bg-coral text-white hover:bg-coral/90 shadow-sm": variant === "destructive",
            "border border-brand-200 bg-white hover:bg-brand-50 text-brand-700": variant === "outline",
            "bg-brand-50 text-brand-700 hover:bg-brand-100": variant === "secondary",
            "hover:bg-brand-50 hover:text-brand-700": variant === "ghost",
            "text-brand-600 underline-offset-4 hover:underline": variant === "link",
            "h-10 px-5 py-2": size === "default",
            "h-9 rounded-full px-4": size === "sm",
            "h-11 rounded-full px-8": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };

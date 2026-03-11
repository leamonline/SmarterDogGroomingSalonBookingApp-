import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/src/lib/utils";
import { ChevronDown } from "lucide-react";

const selectVariants = cva(
  "flex w-full appearance-none border bg-white text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: {
        sm: "h-8 px-2.5 py-1 text-xs rounded-lg",
        md: "h-10 px-3 py-2 text-sm rounded-xl",
        lg: "h-12 px-4 py-3 text-base rounded-xl",
      },
      variant: {
        default: "border-brand-200",
        ghost: "border-transparent bg-transparent",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "default",
    },
  },
);

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">, VariantProps<typeof selectVariants> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, size, variant, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select ref={ref} className={cn(selectVariants({ size, variant }), "pr-8", className)} {...props}>
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    );
  },
);
Select.displayName = "Select";

export { Select, selectVariants };

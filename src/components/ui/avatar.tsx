import * as React from "react"
import { cn } from "@/src/lib/utils"

const Avatar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { src?: string; alt?: string; fallback?: string }
>(({ className, src, alt, fallback, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100",
      className
    )}
    {...props}
  >
    {src ? (
      <img
        src={src}
        alt={alt}
        className="aspect-square h-full w-full object-cover"
      />
    ) : (
      <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 text-slate-500 font-medium">
        {fallback}
      </div>
    )}
  </div>
))
Avatar.displayName = "Avatar"

export { Avatar }

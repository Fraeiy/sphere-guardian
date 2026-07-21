import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-[var(--primary-bright)] to-[var(--primary-deep)] text-[#1a1205] shadow-[0_1px_0_rgba(255,240,200,0.35)_inset,0_8px_24px_-8px_rgba(232,163,23,0.55)] hover:brightness-110",
        secondary:
          "bg-white/[0.04] text-[var(--foreground)] border border-[var(--border-strong)] hover:bg-[rgba(232,163,23,0.08)] hover:border-[var(--primary)]/35",
        ghost: "hover:bg-[rgba(232,163,23,0.08)] text-[var(--muted-strong)] hover:text-[var(--foreground)]",
        danger:
          "bg-gradient-to-b from-[var(--crimson)] to-[var(--crimson-deep)] text-white shadow-[0_8px_24px_-8px_rgba(201,58,42,0.55)] hover:brightness-110",
      },
      size: {
        default: "h-10 px-4 py-2 min-h-[40px]",
        sm: "h-9 rounded-lg px-3 text-xs min-h-[36px]",
        lg: "h-12 rounded-xl px-6 min-h-[48px]",
        icon: "h-10 w-10 min-h-[40px] min-w-[40px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

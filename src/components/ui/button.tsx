import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-ember text-zinc-950 hover:bg-ember-glow",
        ghost: "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900",
        outline:
          "border border-zinc-700 bg-transparent text-zinc-200 hover:border-ember hover:text-ember-glow",
        kill: "border border-zinc-700 text-zinc-400 hover:border-red-800 hover:text-red-400",
        quiet: "text-zinc-500 hover:text-zinc-200",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs tracking-wide",
        lg: "h-12 px-6 text-sm tracking-[0.18em]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

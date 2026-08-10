import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/25",
  {
    variants: {
      variant: {
        default: "bg-emerald-800 text-white shadow-sm hover:bg-emerald-900",
        outline: "border border-stone-300 bg-white text-stone-800 hover:border-emerald-700 hover:text-emerald-800",
        ghost: "text-stone-600 hover:bg-stone-100 hover:text-stone-950",
      },
      size: { default: "h-11 px-5", sm: "h-9 px-3 text-xs", lg: "h-13 px-7 text-base", icon: "size-10" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({ className, variant, size, asChild, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

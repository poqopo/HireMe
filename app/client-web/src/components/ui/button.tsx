import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#465CFF]/25",
  {
    variants: {
      variant: {
        default: "bg-[#465CFF] text-white shadow-none hover:bg-[#354AE6]",
        outline: "border border-[#D8D4CC] bg-white text-[#161616] hover:border-[#465CFF] hover:text-[#465CFF]",
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

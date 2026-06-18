import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(49,130,246,0.35)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "h-14 border border-transparent bg-gradient-to-r from-[#3182f6] to-[#2272eb] px-7 text-white shadow-[0_18px_40px_rgba(49,130,246,0.22)] hover:-translate-y-0.5 hover:shadow-[0_22px_46px_rgba(49,130,246,0.26)] active:translate-y-0 active:shadow-[0_12px_24px_rgba(49,130,246,0.18)]",
        secondary:
          "h-14 border border-[rgba(49,130,246,0.28)] bg-[rgba(255,255,255,0.78)] px-7 text-[#3182f6] shadow-[0_16px_32px_rgba(15,52,96,0.08)] backdrop-blur-md hover:-translate-y-0.5 hover:bg-[#f6faff] hover:shadow-[0_20px_38px_rgba(15,52,96,0.1)] active:translate-y-0",
        ghost: "h-12 border border-transparent bg-transparent px-5 text-[#6b7684] hover:bg-[#f6faff] hover:text-[#4e5968]",
        dark: "h-14 border border-white/12 bg-[#1c1e54] px-7 text-white shadow-[0_18px_40px_rgba(8,27,61,0.26)] hover:-translate-y-0.5 hover:bg-[#13285a] active:translate-y-0",
      },
      size: {
        default: "h-14 px-7",
        sm: "h-12 px-4 text-sm",
        lg: "h-14 px-7 text-base",
        icon: "size-12 px-0",
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
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex items-center rounded-full bg-[#ECE9E2] px-2.5 py-1 text-[11px] font-semibold text-[#161616]", className)} {...props} />;
}

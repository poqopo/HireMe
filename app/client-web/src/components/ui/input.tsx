import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("h-12 w-full rounded-md border border-[#D8D4CC] bg-white px-4 text-sm outline-none transition placeholder:text-[#9A968F] focus:border-[#465CFF] focus:ring-3 focus:ring-[#465CFF]/10", className)} {...props} />;
}

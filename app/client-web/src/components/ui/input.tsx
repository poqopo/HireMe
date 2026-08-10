import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-sm outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-3 focus:ring-emerald-700/10", className)} {...props} />;
}

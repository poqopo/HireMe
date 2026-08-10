import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("min-h-32 w-full resize-y rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-3 focus:ring-emerald-700/10", className)} {...props} />;
}

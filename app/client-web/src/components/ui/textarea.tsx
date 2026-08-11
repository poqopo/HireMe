import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("min-h-32 w-full resize-y rounded-md border border-[#D8D4CC] bg-white px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-[#9A968F] focus:border-[#465CFF] focus:ring-3 focus:ring-[#465CFF]/10", className)} {...props} />;
}

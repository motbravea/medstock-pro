import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combine class names with conditional logic and Tailwind conflict resolution.
 * Usage: cn("px-4 py-2", isPrimary && "bg-teal-700", className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

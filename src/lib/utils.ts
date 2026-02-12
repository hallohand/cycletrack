import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Timezone-safe ISO date string (YYYY-MM-DD) from a Date object.
 *  Unlike toISOString().split('T')[0], this uses LOCAL time,
 *  so it won't jump to the next day after 23:00 CET. */
export function toLocalISO(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

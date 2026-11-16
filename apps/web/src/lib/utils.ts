import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatInTimeZone } from "date-fns-tz";
import { id as localeId } from "date-fns/locale";
import { TIMEZONE, formatRupiah } from "@dineout/shared";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export { formatRupiah, TIMEZONE };

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatInTimeZone(new Date(iso), TIMEZONE, "d MMM yyyy, HH.mm", { locale: localeId });
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatInTimeZone(new Date(iso), TIMEZONE, "d MMM, HH.mm", { locale: localeId });
}

export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatInTimeZone(new Date(iso), TIMEZONE, "d MMM yyyy", { locale: localeId });
}

/** Untuk input datetime-local, dalam zona Asia/Jakarta. */
export function toJakartaInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return formatInTimeZone(new Date(iso), TIMEZONE, "yyyy-MM-dd'T'HH:mm");
}

export function nowJakartaInput(): string {
  return formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm");
}

export function fromJakartaInput(value: string): string {
  // datetime-local tidak membawa zona; perlakukan sebagai waktu Asia/Jakarta.
  return new Date(`${value}:00+07:00`).toISOString();
}

export interface CountdownParts {
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  label: string;
  shortLabel: string;
}

export function countdown(target: string, now = Date.now()): CountdownParts {
  const diff = new Date(target).getTime() - now;
  if (Number.isNaN(diff) || diff <= 0) {
    return {
      expired: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      label: "Berakhir",
      shortLabel: "Berakhir",
    };
  }
  const seconds = Math.floor(diff / 1000);
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const parts = [
    days > 0 ? `${days} hari` : null,
    `${String(hours).padStart(2, "0")} jam`,
    `${String(minutes).padStart(2, "0")} mnt`,
    days === 0 ? `${String(rest).padStart(2, "0")} dtk` : null,
  ].filter(Boolean);
  const shortLabel =
    days > 0 ? `${days}h ${hours}j` : `${hours}j ${String(minutes).padStart(2, "0")}m`;
  return {
    expired: false,
    days,
    hours,
    minutes,
    seconds: rest,
    label: parts.join(" "),
    shortLabel,
  };
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Google Maps";
  }
}

export function pluralPeople(count: number): string {
  return `${count} orang`;
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

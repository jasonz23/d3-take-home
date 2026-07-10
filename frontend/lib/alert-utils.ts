import type { AlertSeverity, AlertStatus } from "@/lib/types";

export const severityLabels: Record<AlertSeverity, string> = {
  Low: "Low",
  Medium: "Medium",
  High: "High",
  Critical: "Critical",
};

export const statusLabels: Record<AlertStatus, string> = {
  New: "New",
  InProgress: "In Progress",
  Escalated: "Escalated",
  Resolved: "Resolved",
  FalsePositive: "False Positive",
};

export const statusShortcutMap: Record<string, AlertStatus> = {
  "1": "New",
  "2": "InProgress",
  "3": "Escalated",
  "4": "Resolved",
  "5": "FalsePositive",
};

export const statusShortcuts: Array<{
  key: string;
  label: string;
  status: AlertStatus;
}> = [
  { key: "1", label: "New", status: "New" },
  { key: "2", label: "In Progress", status: "InProgress" },
  { key: "3", label: "Escalated", status: "Escalated" },
  { key: "4", label: "Resolved", status: "Resolved" },
  { key: "5", label: "False Positive", status: "FalsePositive" },
];

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatLongDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function formatExactDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function formatRelativeDateTime(value: string): string {
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 1000 * 60 * 60 * 24 * 365],
    ["month", 1000 * 60 * 60 * 24 * 30],
    ["day", 1000 * 60 * 60 * 24],
    ["hour", 1000 * 60 * 60],
    ["minute", 1000 * 60],
  ];

  for (const [unit, unitMs] of units) {
    if (absMs >= unitMs) {
      return rtf.format(Math.round(diffMs / unitMs), unit);
    }
  }

  return "just now";
}

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

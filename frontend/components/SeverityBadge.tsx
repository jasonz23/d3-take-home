import { AlertTriangle } from "lucide-react";
import { cx, severityLabels } from "@/lib/alert-utils";
import type { AlertSeverity } from "@/lib/types";

const severityClassName: Record<AlertSeverity, string> = {
  Critical: "border-[#ff4d8d]/40 bg-[#35101e] text-[#ff8db8]",
  High: "border-[#ff9f43]/40 bg-[#321d0d] text-[#ffc078]",
  Medium: "border-[#facc15]/40 bg-[#2e2608] text-[#fde68a]",
  Low: "border-[#22c55e]/40 bg-[#0d2a19] text-[#86efac]",
};

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1 rounded-md border px-2 text-xs font-semibold",
        severityClassName[severity],
      )}
    >
      {severity === "Critical" ? <AlertTriangle className="size-3" /> : null}
      {severityLabels[severity]}
    </span>
  );
}

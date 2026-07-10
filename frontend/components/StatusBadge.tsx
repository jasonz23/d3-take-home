import type { ComponentType } from "react";
import { CheckCircle2, Clock3, Flag, ShieldQuestion, XCircle } from "lucide-react";
import { cx, statusLabels } from "@/lib/alert-utils";
import type { AlertStatus } from "@/lib/types";

const statusClassName: Record<AlertStatus, string> = {
  New: "border-[#7c2dff]/50 bg-[#1b0d2c] text-[#d8b4fe]",
  InProgress: "border-[#a855f7]/50 bg-[#25103b] text-[#e9d5ff]",
  Escalated: "border-[#ff4d8d]/40 bg-[#35101e] text-[#ff8db8]",
  Resolved: "border-[#22c55e]/40 bg-[#0d2a19] text-[#86efac]",
  FalsePositive: "border-[#6f5b84] bg-[#14101b] text-[#c5b8d3]",
};

const statusIcon: Record<AlertStatus, ComponentType<{ className?: string }>> = {
  New: Clock3,
  InProgress: ShieldQuestion,
  Escalated: Flag,
  Resolved: CheckCircle2,
  FalsePositive: XCircle,
};

export function StatusBadge({ status }: { status: AlertStatus }) {
  const Icon = statusIcon[status];

  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1 rounded-md border px-2 text-xs font-semibold",
        statusClassName[status],
      )}
    >
      <Icon className="size-3" />
      {statusLabels[status]}
    </span>
  );
}

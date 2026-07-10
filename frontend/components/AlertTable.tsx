"use client";

import { useEffect } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, PanelRightOpen } from "lucide-react";
import {
  cx,
  formatExactDateTime,
  formatRelativeDateTime,
} from "@/lib/alert-utils";
import type { Alert, AlertSortKey, AlertSortTerm } from "@/lib/types";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusBadge } from "@/components/StatusBadge";

type AlertTableProps = {
  alerts: Alert[];
  selectedAlertId: string | null;
  sorts: AlertSortTerm[];
  onSort: (sortBy: AlertSortKey) => void;
  onSelect: (id: string, openDrawer?: boolean) => void;
};

const columns: Array<{ key: AlertSortKey; label: string; className?: string }> = [
  { key: "id", label: "ID", className: "w-28" },
  { key: "title", label: "Title", className: "min-w-[280px]" },
  { key: "severity", label: "Severity", className: "w-32" },
  { key: "status", label: "Status", className: "w-40" },
  { key: "source", label: "Source", className: "w-48" },
  { key: "createdAt", label: "Created", className: "w-36" },
  { key: "assignee", label: "Assignee", className: "w-40" },
];

export function AlertTable({
  alerts,
  selectedAlertId,
  sorts,
  onSort,
  onSelect,
}: AlertTableProps) {
  useEffect(() => {
    if (!selectedAlertId) {
      return;
    }

    document
      .querySelector(`[data-alert-row="${selectedAlertId}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedAlertId]);

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#050208]">
      <table
        aria-label="Security alerts"
        className="min-w-[1120px] border-separate border-spacing-0 text-left text-sm"
      >
        <thead className="sticky top-0 z-10 bg-[#0b0611] text-xs uppercase text-[#8f7aa8] shadow-[inset_0_-1px_0_#2d1647]">
          <tr>
            {columns.map((column) => {
              const sortIndex = sorts.findIndex(
                (sort) => sort.key === column.key,
              );
              const sort = sortIndex >= 0 ? sorts[sortIndex] : null;
              const priority = sortIndex + 1;

              return (
                <th
                  key={column.key}
                  className={cx("px-4 py-3", column.className)}
                >
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    className="inline-flex items-center gap-1.5 rounded-sm font-semibold tracking-normal text-[#a89ab9] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a855f7]"
                    aria-label={buildSortLabel(column.label, sort, priority)}
                    title="Click to cycle ascending, descending, and unsorted. Additional columns keep multi-sort order."
                  >
                    {column.label}
                    {sort ? (
                      <>
                        {sort.direction === "asc" ? (
                          <ArrowUp className="size-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="size-3.5" aria-hidden="true" />
                        )}
                        <span
                          className="inline-flex min-w-6 items-center justify-center rounded-sm border border-[#5f11ff]/70 bg-[#160b22] px-1 text-[10px] normal-case leading-4 text-white"
                          aria-label={`Sort priority ${priority}`}
                        >
                          {formatSortPriority(priority)}
                        </span>
                      </>
                    ) : (
                      <ArrowUpDown
                        className="size-3.5 text-[#6f5b84]"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </th>
              );
            })}
            <th className="w-12 px-4 py-3">
              <span className="sr-only">Open alert</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert, index) => {
            const selected = selectedAlertId === alert.id;
            const focusable = selected || (!selectedAlertId && index === 0);

            return (
              <tr
                key={alert.id}
                data-alert-row={alert.id}
                tabIndex={focusable ? 0 : -1}
                aria-selected={selected}
                onFocus={() => onSelect(alert.id)}
                onClick={() => onSelect(alert.id, true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(alert.id, true);
                    return;
                  }

                  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
                    return;
                  }

                  event.preventDefault();

                  const delta = event.key === "ArrowDown" ? 1 : -1;
                  const nextIndex = Math.min(
                    alerts.length - 1,
                    Math.max(0, index + delta),
                  );
                  const nextAlert = alerts[nextIndex];
                  onSelect(nextAlert.id);
                  window.requestAnimationFrame(() => {
                    document
                      .querySelector<HTMLElement>(
                        `[data-alert-row="${nextAlert.id}"]`,
                      )
                      ?.focus();
                  });
                }}
                className={cx(
                  "cursor-pointer border-b border-[#160b22] bg-[#050208] transition hover:bg-[#10081a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#a855f7]",
                  selected && "bg-[#150a22] shadow-[inset_3px_0_0_#8b35ff]",
                )}
              >
                <td className="whitespace-nowrap border-b border-[#160b22] px-4 py-3 font-mono text-xs font-medium text-[#b36cff]">
                  {alert.id}
                </td>
                <td className="border-b border-[#160b22] px-4 py-3">
                  <div className="line-clamp-2 font-medium text-white">
                    {alert.title}
                  </div>
                </td>
                <td className="whitespace-nowrap border-b border-[#160b22] px-4 py-3">
                  <SeverityBadge severity={alert.severity} />
                </td>
                <td className="whitespace-nowrap border-b border-[#160b22] px-4 py-3">
                  <StatusBadge status={alert.status} />
                </td>
                <td className="whitespace-nowrap border-b border-[#160b22] px-4 py-3 text-[#ded5f5]">
                  {alert.source}
                </td>
                <td
                  className="whitespace-nowrap border-b border-[#160b22] px-4 py-3 text-[#a89ab9]"
                  title={formatExactDateTime(alert.createdAt)}
                >
                  <time dateTime={alert.createdAt}>
                    {formatRelativeDateTime(alert.createdAt)}
                  </time>
                </td>
                <td className="whitespace-nowrap border-b border-[#160b22] px-4 py-3 text-[#ded5f5]">
                  {alert.assignee ?? "Unassigned"}
                </td>
                <td className="border-b border-[#160b22] px-4 py-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(alert.id, true);
                    }}
                    className="inline-flex size-8 items-center justify-center rounded-md text-[#8f7aa8] transition hover:bg-[#1b0d2c] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a855f7]"
                    aria-label={`Open alert details for ${alert.id}`}
                  >
                    <PanelRightOpen className="size-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function buildSortLabel(
  label: string,
  sort: AlertSortTerm | null,
  priority: number,
) {
  if (!sort) {
    return `Sort by ${label} ascending`;
  }

  const direction = sort.direction === "asc" ? "ascending" : "descending";
  const nextAction =
    sort.direction === "asc" ? "sort descending" : "remove sort";

  return `${label} sorted ${direction}, ${formatSortPriority(
    priority,
  )} priority. Click to ${nextAction}.`;
}

function formatSortPriority(priority: number) {
  if (priority % 100 >= 11 && priority % 100 <= 13) {
    return `${priority}th`;
  }

  switch (priority % 10) {
    case 1:
      return `${priority}st`;
    case 2:
      return `${priority}nd`;
    case 3:
      return `${priority}rd`;
    default:
      return `${priority}th`;
  }
}

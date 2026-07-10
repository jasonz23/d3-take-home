"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
} from "react";
import {
  Activity,
  CalendarClock,
  CircleDot,
  History,
  Loader2,
  Save,
  UserRound,
  UserX,
  X,
} from "lucide-react";
import {
  formatExactDateTime,
  formatDateTime,
  formatLongDateTime,
  statusLabels,
  statusShortcuts,
} from "@/lib/alert-utils";
import type { Alert, AlertStatus, AlertStatusEvent } from "@/lib/types";
import { statusOptions } from "@/lib/types";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusBadge } from "@/components/StatusBadge";

type AlertDetailDrawerProps = {
  open: boolean;
  alert: Alert | null;
  isLoading: boolean;
  isStatusUpdating: boolean;
  isAssigneeUpdating: boolean;
  conflictMessage: string | null;
  onClose: () => void;
  onStatusChange: (status: AlertStatus) => void;
  onAssigneeChange: (assignee: string | null) => void;
};

export function AlertDetailDrawer({
  open,
  alert,
  isLoading,
  isStatusUpdating,
  isAssigneeUpdating,
  conflictMessage,
  onClose,
  onStatusChange,
  onAssigneeChange,
}: AlertDetailDrawerProps) {
  const timeline = alert ? buildInvestigationTimeline(alert) : [];
  const drawerRef = useRef<HTMLElement | null>(null);
  const alertDraftId = alert?.id ?? null;
  const [assigneeDraftState, setAssigneeDraftState] = useState<{
    alertId: string | null;
    value: string;
  }>({
    alertId: null,
    value: "",
  });
  const assigneeDraft =
    assigneeDraftState.alertId === alertDraftId
      ? assigneeDraftState.value
      : alert?.assignee ?? "";
  const setAssigneeDraft = (value: string) => {
    setAssigneeDraftState({
      alertId: alertDraftId,
      value,
    });
  };
  const normalizedAssigneeDraft = assigneeDraft.trim();
  const isAssigneeDirty = alert
    ? (normalizedAssigneeDraft || null) !== alert.assignee
    : false;
  const isAnyUpdating = isStatusUpdating || isAssigneeUpdating;

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      drawerRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [open]);

  const trapFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const drawer = drawerRef.current;

    if (!drawer) {
      return;
    }

    const focusable = Array.from(
      drawer.querySelectorAll<HTMLElement>(
        [
          "a[href]",
          "button:not([disabled])",
          "select:not([disabled])",
          "textarea:not([disabled])",
          "input:not([disabled])",
          '[tabindex]:not([tabindex="-1"])',
        ].join(","),
      ),
    );

    if (focusable.length === 0) {
      event.preventDefault();
      drawer.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === drawer)) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <div
        className={
          open
            ? "fixed inset-0 z-30 bg-black/70 backdrop-blur-[1px] transition-opacity lg:hidden"
            : "pointer-events-none fixed inset-0 z-30 bg-transparent opacity-0 lg:hidden"
        }
        onClick={onClose}
      />

      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-detail-title"
        tabIndex={-1}
        onKeyDown={trapFocus}
        className={
          open
            ? "fixed bottom-0 left-0 right-0 z-40 flex max-h-[88vh] w-full translate-y-0 flex-col rounded-t-lg border-t border-[#3b1b5f] bg-[#050208] shadow-[0_24px_90px_rgba(0,0,0,0.85)] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#a855f7] sm:left-auto sm:top-0 sm:max-h-none sm:max-w-xl sm:translate-x-0 sm:rounded-none sm:border-l sm:border-t-0"
            : "fixed bottom-0 left-0 right-0 z-40 flex max-h-[88vh] w-full translate-y-full flex-col rounded-t-lg border-t border-[#3b1b5f] bg-[#050208] shadow-[0_24px_90px_rgba(0,0,0,0.85)] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#a855f7] sm:left-auto sm:top-0 sm:max-h-none sm:max-w-xl sm:translate-x-full sm:translate-y-0 sm:rounded-none sm:border-l sm:border-t-0"
        }
        aria-hidden={!open}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#241039] bg-[#08040d] px-5 py-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {alert ? <SeverityBadge severity={alert.severity} /> : null}
              {alert ? <StatusBadge status={alert.status} /> : null}
            </div>
            <h2
              id="alert-detail-title"
              className="text-lg font-semibold leading-6 text-white"
            >
              {alert?.title ?? "Alert detail"}
            </h2>
            {alert ? (
              <p className="mt-1 font-mono text-xs text-[#b36cff]">{alert.id}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-[#3b1b5f] bg-[#0d0715] text-[#a89ab9] transition hover:border-[#8b35ff] hover:bg-[#180c27] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a855f7]"
            aria-label="Close drawer"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-sm text-[#b8abc9]">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading alert details
            </div>
          ) : null}

          {!isLoading && alert ? (
            <div className="space-y-6">
              {conflictMessage ? (
                <div className="rounded-md border border-amber-400/40 bg-amber-950/45 px-3 py-2 text-sm text-amber-100">
                  {conflictMessage}
                </div>
              ) : null}

              <section>
                <label className="text-xs font-semibold uppercase text-[#8f7aa8]">
                  Status
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <select
                    aria-label="Change alert status"
                    value={alert.status}
                    disabled={isAnyUpdating}
                    onChange={(event) =>
                      onStatusChange(event.target.value as AlertStatus)
                    }
                    className="h-10 w-full rounded-md border border-[#2d1647] bg-[#0a0610] px-3 text-sm text-white transition focus:border-[#a855f7] focus:ring-2 focus:ring-[#7c2dff]/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a855f7] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>
                        {statusLabels[option]}
                      </option>
                    ))}
                  </select>
                  {isStatusUpdating ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-[#b36cff]" />
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {statusShortcuts.map((shortcut) => (
                    <button
                      type="button"
                      key={shortcut.key}
                      disabled={isAnyUpdating}
                      onClick={() => onStatusChange(shortcut.status)}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-[#3b1b5f] bg-[#12091d] px-2 text-xs text-[#ded5f5] transition hover:border-[#8b35ff] hover:bg-[#1b0d2c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a855f7] disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={`Set status to ${shortcut.label}`}
                    >
                      <span className="font-mono text-[11px] font-semibold text-[#b36cff]">
                        {shortcut.key}
                      </span>
                      {shortcut.label}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <label
                  htmlFor="alert-assignee"
                  className="text-xs font-semibold uppercase text-[#8f7aa8]"
                >
                  Assignee
                </label>
                <form
                  className="mt-2 flex flex-col gap-2 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();

                    if (!isAssigneeDirty || isAnyUpdating) {
                      return;
                    }

                    setAssigneeDraft(normalizedAssigneeDraft);
                    onAssigneeChange(normalizedAssigneeDraft || null);
                  }}
                >
                  <div className="relative min-w-0 flex-1">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8f7aa8]" />
                    <input
                      id="alert-assignee"
                      aria-label="Edit assignee"
                      value={assigneeDraft}
                      maxLength={200}
                      disabled={isAnyUpdating}
                      onChange={(event) => setAssigneeDraft(event.target.value)}
                      placeholder="Unassigned"
                      className="h-10 w-full rounded-md border border-[#2d1647] bg-[#0a0610] px-9 text-sm text-white transition placeholder:text-[#6f5b84] focus:border-[#a855f7] focus:ring-2 focus:ring-[#7c2dff]/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a855f7] disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    {isAssigneeUpdating ? (
                      <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-[#b36cff]" />
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isAnyUpdating || assigneeDraft.length === 0}
                      onClick={() => setAssigneeDraft("")}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#3b1b5f] bg-[#12091d] px-3 text-sm font-medium text-[#eee8ff] transition hover:border-[#8b35ff] hover:bg-[#1b0d2c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a855f7] disabled:cursor-not-allowed disabled:opacity-45"
                      aria-label="Clear assignee"
                    >
                      <UserX className="size-4" />
                      Clear
                    </button>
                    <button
                      type="submit"
                      disabled={!isAssigneeDirty || isAnyUpdating}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#5f11ff] px-4 text-sm font-semibold text-white shadow-[0_0_24px_rgba(95,17,255,0.25)] transition hover:bg-[#7c2dff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c084fc] disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      <Save className="size-4" />
                      Save
                    </button>
                  </div>
                </form>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <DetailItem icon={Activity} label="Source" value={alert.source} />
                <DetailItem
                  icon={CalendarClock}
                  label="Created"
                  value={formatLongDateTime(alert.createdAt)}
                />
                <DetailItem
                  icon={CalendarClock}
                  label="Updated"
                  value={formatLongDateTime(alert.updatedAt)}
                />
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <History className="size-4 text-[#b36cff]" />
                  Investigation Timeline
                </div>
                {timeline.length ? (
                  <ol className="relative space-y-4 pl-5 before:absolute before:left-1.5 before:top-1 before:h-[calc(100%-0.5rem)] before:w-px before:bg-[#3b1b5f]">
                    {timeline.map((event) => (
                      <li
                        key={event.id}
                        className="relative rounded-md border border-[#241039] bg-[#0a0610] px-3 py-3"
                      >
                        <CircleDot className="absolute -left-[1.08rem] top-3 size-3.5 fill-[#050208] text-[#a855f7]" />
                        <time
                          className="text-xs font-semibold text-[#8f7aa8]"
                          dateTime={event.at}
                          title={formatExactDateTime(event.at)}
                        >
                          {formatDateTime(event.at)}
                        </time>
                        <div className="mt-1 text-sm font-medium text-white">
                          {event.title}
                        </div>
                        {event.statusEvent ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                            <StatusBadge status={event.statusEvent.previousStatus} />
                            <span className="text-[#6f5b84]">to</span>
                            <StatusBadge status={event.statusEvent.newStatus} />
                          </div>
                        ) : null}
                        <p className="mt-2 text-xs text-[#8f7aa8]">{event.meta}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="rounded-md border border-dashed border-[#3b1b5f] bg-[#0a0610] px-3 py-6 text-center text-sm text-[#8f7aa8]">
                    No investigation events recorded yet.
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}

function buildInvestigationTimeline(alert: Alert): Array<{
  id: string;
  at: string;
  title: string;
  meta: string;
  statusEvent?: AlertStatusEvent;
}> {
  return [
    {
      id: `${alert.id}-created`,
      at: alert.createdAt,
      title: "Alert created",
      meta: `Created from ${alert.source}`,
    },
    ...(alert.statusHistory ?? []).map((statusEvent) => ({
      id: `${alert.id}-${statusEvent.changedAt}-${statusEvent.previousStatus}-${statusEvent.newStatus}`,
      at: statusEvent.changedAt,
      title: "Status changed",
      meta: `Changed by ${statusEvent.changedBy}`,
      statusEvent,
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-[#241039] bg-[#0a0610] px-3 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[#8f7aa8]">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 break-words text-sm text-[#eee8ff]">{value}</div>
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  RefreshCw,
  X,
} from "lucide-react";
import { AlertDetailDrawer } from "@/components/AlertDetailDrawer";
import { AlertFilters } from "@/components/AlertFilters";
import { AlertTable } from "@/components/AlertTable";
import {
  ApiError,
  getAlert,
  getAlerts,
  importAlerts,
  updateAlertAssignee,
  updateAlertStatus,
} from "@/lib/api";
import {
  statusLabels,
  statusShortcutMap,
  statusShortcuts,
} from "@/lib/alert-utils";
import type {
  Alert,
  AlertSeverity,
  AlertSortKey,
  AlertStatus,
  SortDirection,
} from "@/lib/types";
import { severityOptions, statusOptions } from "@/lib/types";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const pageSizeOptions = [10, 25, 50, 100] as const;

export default function Home() {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [initialFilters] = useState(readInitialFilters);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [detailAlert, setDetailAlert] = useState<Alert | null>(null);
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [search, setSearch] = useState(initialFilters.search);
  const debouncedSearch = useDebouncedValue(search, 250);
  const [severity, setSeverity] = useState<AlertSeverity | "All">(
    initialFilters.severity,
  );
  const [status, setStatus] = useState<AlertStatus | "All">(
    initialFilters.status,
  );
  const [source, setSource] = useState(initialFilters.source);
  const [sortBy, setSortBy] = useState<AlertSortKey | "">(
    initialFilters.sortBy,
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    initialFilters.sortDirection,
  );
  const [page, setPage] = useState(initialFilters.page);
  const [pageSize, setPageSize] = useState(initialFilters.pageSize);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [isAssigneeUpdating, setIsAssigneeUpdating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [resultMeta, setResultMeta] = useState({
    total: 0,
    filtered: 0,
    page: DEFAULT_PAGE,
    pageSize: DEFAULT_PAGE_SIZE,
    totalPages: 0,
    sources: [] as string[],
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    if (debouncedSearch.trim()) {
      params.set("search", debouncedSearch.trim());
    }

    if (severity !== "All") {
      params.set("severity", severity);
    }

    if (status !== "All") {
      params.set("status", status);
    }

    if (source !== "All") {
      params.set("source", source);
    }

    if (sortBy) {
      params.set("sortBy", sortBy);
      params.set("sortDirection", sortDirection);
    }

    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    const value = params.toString();
    return value ? `?${value}` : "";
  }, [debouncedSearch, page, pageSize, severity, sortBy, sortDirection, source, status]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    severity !== "All" ||
    status !== "All" ||
    source !== "All";

  const selectedSummary = useMemo(
    () => alerts.find((alert) => alert.id === selectedAlertId) ?? null,
    [alerts, selectedAlertId],
  );

  const selectedAlert =
    detailAlert && detailAlert.id === selectedAlertId
      ? detailAlert
      : selectedSummary;

  const loadAlerts = useCallback(async (nextQueryString = queryString) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getAlerts(nextQueryString);
      setAlerts(response.data);
      setResultMeta(response.meta);
      setSourceOptions(response.meta.sources);
      setPage((current) =>
        current === response.meta.page ? current : response.meta.page,
      );
      setSelectedAlertId((current) => {
        if (response.data.some((alert) => alert.id === current)) {
          return current;
        }

        return response.data[0]?.id ?? null;
      });

      if (response.data.length === 0) {
        setDrawerOpen(false);
        setDetailAlert(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load alerts");
    } finally {
      setIsLoading(false);
    }
  }, [queryString]);

  const loadDetail = useCallback(async (id: string) => {
    setIsDetailLoading(true);

    try {
      const response = await getAlert(id);
      setDetailAlert((current) => {
        if (current?.id === id && current.version > response.data.version) {
          return current;
        }

        return response.data;
      });
    } catch (err) {
      setConflictMessage(
        err instanceof Error ? err.message : "Unable to load alert details",
      );
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadAlerts();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadAlerts]);

  useEffect(() => {
    const nextUrl = `${window.location.pathname}${queryString}`;

    if (nextUrl !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [queryString]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToastMessage(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  useEffect(() => {
    if (!drawerOpen || !selectedAlertId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadDetail(selectedAlertId);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [drawerOpen, loadDetail, selectedAlertId]);

  const selectAlert = useCallback((id: string, openDrawer = false) => {
    setSelectedAlertId(id);
    setConflictMessage(null);

    if (openDrawer) {
      setDrawerOpen(true);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    window.setTimeout(() => {
      if (!selectedAlertId) {
        return;
      }

      document
        .querySelector<HTMLElement>(`[data-alert-row="${selectedAlertId}"]`)
        ?.focus();
    }, 0);
  }, [selectedAlertId]);

  const clearFilters = useCallback(() => {
    setSearch("");
    setSeverity("All");
    setStatus("All");
    setSource("All");
    setSortBy("");
    setSortDirection("desc");
    setPage(DEFAULT_PAGE);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(DEFAULT_PAGE);
  }, []);

  const handleSeverityChange = useCallback((value: AlertSeverity | "All") => {
    setSeverity(value);
    setPage(DEFAULT_PAGE);
  }, []);

  const handleStatusFilterChange = useCallback((value: AlertStatus | "All") => {
    setStatus(value);
    setPage(DEFAULT_PAGE);
  }, []);

  const handleSourceChange = useCallback((value: string) => {
    setSource(value);
    setPage(DEFAULT_PAGE);
  }, []);

  const handlePageSizeChange = useCallback((value: number) => {
    setPageSize(value);
    setPage(DEFAULT_PAGE);
  }, []);

  const handleImportFile = useCallback(
    async (file: File) => {
      setIsImporting(true);
      setError(null);
      setConflictMessage(null);
      setDrawerOpen(false);

      try {
        const response = await importAlerts(file);
        const message = `${response.message} The table has been refreshed from the database.`;
        setLiveMessage(message);
        setToastMessage(message);
        setSearch("");
        setSeverity("All");
        setStatus("All");
        setSource("All");
        setSortBy("");
        setSortDirection("desc");
        setPage(DEFAULT_PAGE);
        setSelectedAlertId(null);
        setDetailAlert(null);
        await loadAlerts(`?page=${DEFAULT_PAGE}&pageSize=${pageSize}`);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to import alerts";
        setError(message);
        setToastMessage(message);
      } finally {
        setIsImporting(false);
      }
    },
    [loadAlerts, pageSize],
  );

  const handleSort = useCallback(
    (key: AlertSortKey) => {
      if (sortBy === key) {
        setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
        setPage(DEFAULT_PAGE);
        return;
      }

      setSortBy(key);
      setSortDirection(
        key === "createdAt" || key === "updatedAt" ? "desc" : "asc",
      );
      setPage(DEFAULT_PAGE);
    },
    [sortBy],
  );

  const handleStatusChange = useCallback(
    async (nextStatus: AlertStatus) => {
      const target = selectedAlert;

      if (
        !target ||
        isStatusUpdating ||
        isAssigneeUpdating ||
        target.status === nextStatus
      ) {
        return;
      }

      setConflictMessage(null);
      setIsStatusUpdating(true);

      const previousAlerts = alerts;
      const previousDetail = detailAlert;
      const optimisticUpdatedAt = new Date().toISOString();
      const optimisticAlert: Alert = {
        ...target,
        status: nextStatus,
        updatedAt: optimisticUpdatedAt,
        version: target.version + 1,
      };

      setAlerts((current) =>
        current.map((alert) =>
          alert.id === target.id
            ? {
                ...alert,
                status: optimisticAlert.status,
                updatedAt: optimisticAlert.updatedAt,
                version: optimisticAlert.version,
              }
            : alert,
        ),
      );
      setDetailAlert((current) =>
        current?.id === target.id || target.id === selectedAlertId
          ? (() => {
              const base = current?.id === target.id ? current : target;

              return {
                ...base,
                status: optimisticAlert.status,
                updatedAt: optimisticAlert.updatedAt,
                version: optimisticAlert.version,
              };
            })()
          : current,
      );

      try {
        const response = await updateAlertStatus(
          target.id,
          nextStatus,
          target.version,
        );
        const updated = response.data;

        setAlerts((current) =>
          current.map((alert) => (alert.id === updated.id ? updated : alert)),
        );
        setDetailAlert(updated);
        const message = `Alert status updated to ${statusLabels[updated.status]}.`;
        setLiveMessage(message);
        setToastMessage(message);
      } catch (err) {
        setAlerts(previousAlerts);
        setDetailAlert(previousDetail);

        if (err instanceof ApiError && err.status === 409) {
          const message =
            "This alert changed elsewhere. The list has been refreshed; review the current version before updating again.";
          setConflictMessage(message);
          setToastMessage("Status update needs review because the alert changed.");
          await loadAlerts();

          if (drawerOpen) {
            await loadDetail(target.id);
          }
        } else {
          const message =
            err instanceof Error ? err.message : "Unable to update alert status";
          setError(message);
          setToastMessage(message);
        }
      } finally {
        setIsStatusUpdating(false);
      }
    },
    [
      alerts,
      detailAlert,
      drawerOpen,
      isAssigneeUpdating,
      isStatusUpdating,
      loadAlerts,
      loadDetail,
      selectedAlert,
      selectedAlertId,
    ],
  );

  const handleAssigneeChange = useCallback(
    async (nextAssignee: string | null) => {
      const target = selectedAlert;
      const normalizedAssignee = nextAssignee?.trim() || null;

      if (
        !target ||
        isStatusUpdating ||
        isAssigneeUpdating ||
        target.assignee === normalizedAssignee
      ) {
        return;
      }

      setConflictMessage(null);
      setIsAssigneeUpdating(true);

      const previousAlerts = alerts;
      const previousDetail = detailAlert;
      const optimisticUpdatedAt = new Date().toISOString();
      const optimisticAlert: Alert = {
        ...target,
        assignee: normalizedAssignee,
        updatedAt: optimisticUpdatedAt,
        version: target.version + 1,
      };

      setAlerts((current) =>
        current.map((alert) =>
          alert.id === target.id
            ? {
                ...alert,
                assignee: optimisticAlert.assignee,
                updatedAt: optimisticAlert.updatedAt,
                version: optimisticAlert.version,
              }
            : alert,
        ),
      );
      setDetailAlert((current) =>
        current?.id === target.id || target.id === selectedAlertId
          ? (() => {
              const base = current?.id === target.id ? current : target;

              return {
                ...base,
                assignee: optimisticAlert.assignee,
                updatedAt: optimisticAlert.updatedAt,
                version: optimisticAlert.version,
              };
            })()
          : current,
      );

      try {
        const response = await updateAlertAssignee(
          target.id,
          normalizedAssignee,
          target.version,
        );
        const updated = response.data;

        setAlerts((current) =>
          current.map((alert) => (alert.id === updated.id ? updated : alert)),
        );
        setDetailAlert(updated);
        const message = updated.assignee
          ? `Alert assigned to ${updated.assignee}.`
          : "Alert assignee cleared.";
        setLiveMessage(message);
        setToastMessage(message);
      } catch (err) {
        setAlerts(previousAlerts);
        setDetailAlert(previousDetail);

        if (err instanceof ApiError && err.status === 409) {
          const message =
            "This alert changed elsewhere. The list has been refreshed; review the current version before updating again.";
          setConflictMessage(message);
          setToastMessage("Assignee update needs review because the alert changed.");
          await loadAlerts();

          if (drawerOpen) {
            await loadDetail(target.id);
          }
        } else {
          const message =
            err instanceof Error
              ? err.message
              : "Unable to update alert assignee";
          setError(message);
          setToastMessage(message);
        }
      } finally {
        setIsAssigneeUpdating(false);
      }
    },
    [
      alerts,
      detailAlert,
      drawerOpen,
      isAssigneeUpdating,
      isStatusUpdating,
      loadAlerts,
      loadDetail,
      selectedAlert,
      selectedAlertId,
    ],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "SELECT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (event.key === "Escape") {
        if (shortcutHelpOpen) {
          setShortcutHelpOpen(false);
          return;
        }

        if (drawerOpen) {
          closeDrawer();
        }
        return;
      }

      if (isEditable) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        setShortcutHelpOpen(true);
        return;
      }

      if (event.key === "Enter" && selectedAlertId) {
        event.preventDefault();
        setDrawerOpen(true);
        return;
      }

      const normalizedKey = event.key.toLowerCase();

      if (normalizedKey === "j" || normalizedKey === "k") {
        event.preventDefault();

        if (alerts.length === 0) {
          return;
        }

        const currentIndex = Math.max(
          0,
          alerts.findIndex((alert) => alert.id === selectedAlertId),
        );
        const delta = normalizedKey === "j" ? 1 : -1;
        const nextIndex = Math.min(
          alerts.length - 1,
          Math.max(0, currentIndex + delta),
        );
        setSelectedAlertId(alerts[nextIndex].id);
        setConflictMessage(null);
        return;
      }

      const shortcutStatus = statusShortcutMap[event.key];
      if (shortcutStatus) {
        event.preventDefault();
        void handleStatusChange(shortcutStatus);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    alerts,
    closeDrawer,
    drawerOpen,
    handleStatusChange,
    selectedAlertId,
    shortcutHelpOpen,
  ]);

  return (
    <main className="flex min-h-screen flex-col bg-[#020104] text-white">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>
      <header className="border-b border-[#23103d] bg-black/95 px-4 py-4 text-white lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <Image
              src="/images/logo/d3-logo.svg"
              alt="D3"
              width={108}
              height={30}
              priority
              className="h-7 w-auto brightness-0 invert"
            />
            <div className="h-8 w-px bg-[#2d1647]" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#b36cff]">
                D3 Morpheus
              </p>
              <h1 className="text-xl font-semibold leading-6 text-white">
                Alert Triage Command
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-2 rounded-md border border-[#2d1647] bg-[#0a0610] px-3 py-2 text-sm text-[#ded5f5]">
              <span className="font-semibold text-white">
                {resultMeta.filtered.toLocaleString()}
              </span>{" "}
              of {resultMeta.total.toLocaleString()} alerts
            </div>
            <button
              type="button"
              onClick={() => setShortcutHelpOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#3b1b5f] bg-[#0d0715] px-3 text-sm font-medium text-[#eee8ff] transition hover:border-[#8b35ff] hover:bg-[#180c27] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a855f7]"
            >
              <Keyboard className="size-4" />
              Shortcuts
            </button>
            <Link
              href="/charts"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#3b1b5f] bg-[#0d0715] px-3 text-sm font-medium text-[#eee8ff] transition hover:border-[#8b35ff] hover:bg-[#180c27] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a855f7]"
            >
              <BarChart3 className="size-4" />
              Analytics
            </Link>
            <button
              type="button"
              onClick={() => void loadAlerts()}
              disabled={isLoading}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#5f11ff] px-4 text-sm font-semibold text-white shadow-[0_0_24px_rgba(95,17,255,0.35)] transition hover:bg-[#7c2dff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c084fc] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <RefreshCw
                className={isLoading ? "size-4 animate-spin" : "size-4"}
              />
              Reload
            </button>
          </div>
        </div>
      </header>

      <AlertFilters
        search={search}
        severity={severity}
        status={status}
        source={source}
        sources={sourceOptions}
        isLoading={isLoading}
        isImporting={isImporting}
        searchInputRef={searchInputRef}
        onSearchChange={handleSearchChange}
        onSeverityChange={handleSeverityChange}
        onStatusChange={handleStatusFilterChange}
        onSourceChange={handleSourceChange}
        onImportFile={(file) => void handleImportFile(file)}
        onRefresh={() => void loadAlerts()}
      />

      {error ? (
        <section className="border-b border-red-500/30 bg-red-950/50 px-4 py-3 text-sm text-red-100 lg:px-8">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4" />
            {error}
          </div>
        </section>
      ) : null}

      <section className="flex min-h-0 flex-1 flex-col">
        {isLoading && alerts.length === 0 ? (
          <AlertTableSkeleton />
        ) : null}

        {!isLoading && alerts.length === 0 ? (
          <div className="flex flex-1 items-center justify-center bg-[#050208] px-6 text-center">
            <div>
              <AlertCircle className="mx-auto mb-3 size-8 text-[#8b35ff]" />
              <h2 className="text-base font-semibold text-white">
                No alerts match the current view
              </h2>
              <p className="mt-1 text-sm text-[#b8abc9]">
                Try removing one or more filters.
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[#5f11ff] px-4 text-sm font-semibold text-white transition hover:bg-[#7c2dff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c084fc]"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {alerts.length > 0 ? (
          <>
            <AlertTable
              alerts={alerts}
              selectedAlertId={selectedAlertId}
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSort={handleSort}
              onSelect={selectAlert}
            />
            <PaginationControls
              page={resultMeta.page}
              pageSize={resultMeta.pageSize}
              totalPages={resultMeta.totalPages}
              filtered={resultMeta.filtered}
              isLoading={isLoading}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
            />
          </>
        ) : null}
      </section>

      <AlertDetailDrawer
        open={drawerOpen}
        alert={selectedAlert}
        isLoading={isDetailLoading}
        isStatusUpdating={isStatusUpdating}
        isAssigneeUpdating={isAssigneeUpdating}
        conflictMessage={conflictMessage}
        onClose={closeDrawer}
        onStatusChange={(nextStatus) => void handleStatusChange(nextStatus)}
        onAssigneeChange={(nextAssignee) =>
          void handleAssigneeChange(nextAssignee)
        }
      />

      {toastMessage ? (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-2 rounded-md border border-[#3b1b5f] bg-[#0d0715] px-4 py-3 text-sm text-[#eee8ff] shadow-[0_16px_50px_rgba(0,0,0,0.6)]"
        >
          <CheckCircle2 className="size-4 shrink-0 text-[#86efac]" />
          {toastMessage}
        </div>
      ) : null}

      {shortcutHelpOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-lg border border-[#3b1b5f] bg-[#08040d] shadow-[0_24px_80px_rgba(0,0,0,0.8)]">
            <header className="flex items-center justify-between border-b border-[#241039] px-5 py-4">
              <div className="flex items-center gap-2 text-base font-semibold">
                <Keyboard className="size-4 text-[#b36cff]" />
                Keyboard shortcuts
              </div>
              <button
                type="button"
                onClick={() => setShortcutHelpOpen(false)}
                className="inline-flex size-8 items-center justify-center rounded-md text-[#a89ab9] transition hover:bg-[#170c24] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a855f7]"
                aria-label="Close shortcut help"
              >
                <X className="size-4" />
              </button>
            </header>
            <div className="grid gap-2 p-5 text-sm">
              <ShortcutRow keys="/" action="Focus search" />
              <ShortcutRow keys="J" action="Select next alert" />
              <ShortcutRow keys="K" action="Select previous alert" />
              <ShortcutRow keys="Enter" action="Open selected alert" />
              <ShortcutRow keys="Escape" action="Close drawer" />
              <ShortcutRow keys="?" action="Show shortcut help" />
              {statusShortcuts.map((shortcut) => (
                <ShortcutRow
                  key={shortcut.key}
                  keys={shortcut.key}
                  action={`Set ${statusLabels[shortcut.status]}`}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

type InitialFilters = {
  search: string;
  severity: AlertSeverity | "All";
  status: AlertStatus | "All";
  source: string;
  sortBy: AlertSortKey | "";
  sortDirection: SortDirection;
  page: number;
  pageSize: number;
};

const defaultFilters: InitialFilters = {
  search: "",
  severity: "All",
  status: "All",
  source: "All",
  sortBy: "",
  sortDirection: "desc",
  page: DEFAULT_PAGE,
  pageSize: DEFAULT_PAGE_SIZE,
};

const sortKeys: AlertSortKey[] = [
  "id",
  "title",
  "severity",
  "status",
  "source",
  "createdAt",
  "assignee",
  "updatedAt",
];

function readInitialFilters(): InitialFilters {
  if (typeof window === "undefined") {
    return defaultFilters;
  }

  const params = new URLSearchParams(window.location.search);
  const severity = params.get("severity");
  const status = params.get("status");
  const sortBy = params.get("sortBy");
  const sortDirection = params.get("sortDirection");
  const page = parsePositiveInt(params.get("page"));
  const pageSize = parsePositiveInt(params.get("pageSize"));
  const normalizedPageSize =
    pageSize !== null &&
    pageSizeOptions.includes(pageSize as (typeof pageSizeOptions)[number])
      ? pageSize
      : defaultFilters.pageSize;

  return {
    search: params.get("search") ?? defaultFilters.search,
    severity: severityOptions.includes(severity as AlertSeverity)
      ? (severity as AlertSeverity)
      : defaultFilters.severity,
    status: statusOptions.includes(status as AlertStatus)
      ? (status as AlertStatus)
      : defaultFilters.status,
    source: params.get("source") || defaultFilters.source,
    sortBy: sortKeys.includes(sortBy as AlertSortKey)
      ? (sortBy as AlertSortKey)
      : defaultFilters.sortBy,
    sortDirection:
      sortDirection === "asc" || sortDirection === "desc"
        ? sortDirection
        : defaultFilters.sortDirection,
    page: page ?? defaultFilters.page,
    pageSize: normalizedPageSize,
  };
}

function parsePositiveInt(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function PaginationControls({
  page,
  pageSize,
  totalPages,
  filtered,
  isLoading,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  totalPages: number;
  filtered: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const start = filtered === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, filtered);
  const displayTotalPages = Math.max(totalPages, 1);
  const canGoPrevious = page > 1 && !isLoading;
  const canGoNext = page < totalPages && !isLoading;

  return (
    <footer className="flex flex-col gap-3 border-t border-[#23103d] bg-[#050208] px-4 py-3 text-sm text-[#b8abc9] md:flex-row md:items-center md:justify-between lg:px-8">
      <div aria-live="polite">
        Showing{" "}
        <span className="font-semibold text-white">
          {start.toLocaleString()}-{end.toLocaleString()}
        </span>{" "}
        of{" "}
        <span className="font-semibold text-white">
          {filtered.toLocaleString()}
        </span>{" "}
        filtered alerts
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span>Rows per page</span>
          <select
            aria-label="Rows per page"
            value={pageSize}
            disabled={isLoading}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-9 rounded-md border border-[#2d1647] bg-[#0a0610] px-2 text-sm text-white transition focus:border-[#a855f7] focus:ring-2 focus:ring-[#7c2dff]/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a855f7] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canGoPrevious}
            onClick={() => onPageChange(page - 1)}
            className="inline-flex size-9 items-center justify-center rounded-md border border-[#3b1b5f] bg-[#12091d] text-[#eee8ff] transition hover:border-[#8b35ff] hover:bg-[#1b0d2c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a855f7] disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-28 text-center">
            Page{" "}
            <span className="font-semibold text-white">
              {page.toLocaleString()}
            </span>{" "}
            of {displayTotalPages.toLocaleString()}
          </span>
          <button
            type="button"
            disabled={!canGoNext}
            onClick={() => onPageChange(page + 1)}
            className="inline-flex size-9 items-center justify-center rounded-md border border-[#3b1b5f] bg-[#12091d] text-[#eee8ff] transition hover:border-[#8b35ff] hover:bg-[#1b0d2c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a855f7] disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </footer>
  );
}

function AlertTableSkeleton() {
  const rows = Array.from({ length: 8 }, (_, index) => index);

  return (
    <div
      className="min-h-0 flex-1 overflow-hidden bg-[#050208]"
      aria-label="Loading alerts"
      aria-busy="true"
    >
      <div className="min-w-[1120px] animate-pulse">
        <div className="grid grid-cols-[112px_minmax(280px,1fr)_128px_160px_192px_144px_160px_64px] border-b border-[#2d1647] bg-[#0b0611] px-4 py-3 text-xs uppercase text-[#8f7aa8]">
          <div>ID</div>
          <div>Title</div>
          <div>Severity</div>
          <div>Status</div>
          <div>Source</div>
          <div>Created</div>
          <div>Assignee</div>
          <div />
        </div>
        {rows.map((row) => (
          <div
            key={row}
            className="grid grid-cols-[112px_minmax(280px,1fr)_128px_160px_192px_144px_160px_64px] items-center border-b border-[#160b22] px-4 py-4"
          >
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-4 w-4/5" />
            <SkeletonBlock className="h-6 w-20 rounded-md" />
            <SkeletonBlock className="h-6 w-24 rounded-md" />
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="h-4 w-20" />
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-8 w-8 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div
      className={`rounded bg-gradient-to-r from-[#170c24] via-[#2d1647] to-[#170c24] ${className}`}
    />
  );
}

function ShortcutRow({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-[#241039] bg-[#0d0715] px-3 py-2">
      <span className="text-[#ded5f5]">{action}</span>
      <kbd className="rounded border border-[#6d28d9] bg-[#1b0d2c] px-2 py-1 font-mono text-xs font-semibold text-[#f1e9ff]">
        {keys}
      </kbd>
    </div>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}

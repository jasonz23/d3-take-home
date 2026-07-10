"use client";

import type { RefObject } from "react";
import { RefreshCw, Search, Upload } from "lucide-react";
import { severityLabels, statusLabels } from "@/lib/alert-utils";
import {
  severityOptions,
  statusOptions,
  type AlertSeverity,
  type AlertStatus,
} from "@/lib/types";

type AlertFiltersProps = {
  search: string;
  severity: AlertSeverity | "All";
  status: AlertStatus | "All";
  source: string;
  sources: string[];
  isLoading: boolean;
  isImporting: boolean;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onSearchChange: (value: string) => void;
  onSeverityChange: (value: AlertSeverity | "All") => void;
  onStatusChange: (value: AlertStatus | "All") => void;
  onSourceChange: (value: string) => void;
  onImportFile: (file: File) => void;
  onRefresh: () => void;
};

export function AlertFilters({
  search,
  severity,
  status,
  source,
  sources,
  isLoading,
  isImporting,
  searchInputRef,
  onSearchChange,
  onSeverityChange,
  onStatusChange,
  onSourceChange,
  onImportFile,
  onRefresh,
}: AlertFiltersProps) {
  return (
    <section className="sticky top-0 z-20 border-b border-[#23103d] bg-[#050208] px-4 py-4 lg:px-8">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <label className="relative min-w-0 flex-1 xl:min-w-[34rem] 2xl:min-w-[46rem]">
          <span className="sr-only">Search alerts</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8f7aa8]" />
          <input
            aria-label="Search alerts"
            ref={searchInputRef}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search ID, title, source, assignee"
            className="h-11 w-full rounded-md border border-[#2d1647] bg-[#0a0610] pl-9 pr-3 text-sm text-white transition placeholder:text-[#7d6c91] focus:border-[#a855f7] focus:ring-2 focus:ring-[#7c2dff]/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a855f7]"
          />
        </label>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 md:grid-cols-[minmax(8.5rem,1fr)_minmax(8.5rem,1fr)_minmax(8.5rem,1fr)_2.75rem_2.75rem] xl:w-auto xl:shrink-0">
          <label className="min-w-0">
            <span className="sr-only">Severity</span>
            <select
              aria-label="Filter by severity"
              value={severity}
              onChange={(event) =>
                onSeverityChange(event.target.value as AlertSeverity | "All")
              }
              className="h-11 w-full rounded-md border border-[#2d1647] bg-[#0a0610] px-3 text-sm text-white transition focus:border-[#a855f7] focus:ring-2 focus:ring-[#7c2dff]/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a855f7]"
            >
              <option value="All">All severities</option>
              {severityOptions.map((option) => (
                <option key={option} value={option}>
                  {severityLabels[option]}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0">
            <span className="sr-only">Status</span>
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(event) =>
                onStatusChange(event.target.value as AlertStatus | "All")
              }
              className="h-11 w-full rounded-md border border-[#2d1647] bg-[#0a0610] px-3 text-sm text-white transition focus:border-[#a855f7] focus:ring-2 focus:ring-[#7c2dff]/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a855f7]"
            >
              <option value="All">All statuses</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {statusLabels[option]}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0">
            <span className="sr-only">Source</span>
            <select
              aria-label="Filter by source"
              value={source}
              onChange={(event) => onSourceChange(event.target.value)}
              className="h-11 w-full rounded-md border border-[#2d1647] bg-[#0a0610] px-3 text-sm text-white transition focus:border-[#a855f7] focus:ring-2 focus:ring-[#7c2dff]/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a855f7]"
            >
              <option value="All">All sources</option>
              {sources.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh alerts"
            aria-label="Refresh alerts"
            className="inline-flex size-11 items-center justify-center justify-self-start rounded-md border border-[#3b1b5f] bg-[#12091d] text-[#eee8ff] transition hover:border-[#8b35ff] hover:bg-[#1b0d2c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a855f7] disabled:cursor-not-allowed disabled:opacity-60 md:justify-self-auto"
          >
            <RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} />
          </button>

          <label
            aria-disabled={isImporting}
            title="Import alerts JSON"
            className="inline-flex size-11 cursor-pointer items-center justify-center justify-self-start rounded-md border border-[#3b1b5f] bg-[#5f11ff] text-white transition hover:bg-[#7c2dff] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#c084fc] aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-60 md:justify-self-auto"
          >
            <Upload className={isImporting ? "size-4 animate-pulse" : "size-4"} />
            <span className="sr-only">
              {isImporting ? "Importing alerts JSON" : "Import alerts JSON"}
            </span>
            <input
              aria-label="Import alerts JSON"
              type="file"
              accept="application/json,.json"
              disabled={isImporting}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";

                if (file) {
                  onImportFile(file);
                }
              }}
            />
          </label>
        </div>
      </div>
    </section>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { ChartConfiguration } from "chart.js";
import { ChartCanvas } from "@/components/ChartCanvas";
import { getAlertSummary } from "@/lib/api";
import { formatLongDateTime } from "@/lib/alert-utils";
import type { AlertCountBucket, AlertSummaryResponse } from "@/lib/types";

type SummaryData = AlertSummaryResponse["data"];

const chartColors = [
  "#8b35ff",
  "#22d3ee",
  "#f97316",
  "#ef4444",
  "#84cc16",
  "#facc15",
  "#ec4899",
  "#38bdf8",
];
const textColor = "#ded5f5";
const mutedTextColor = "#8f7aa8";
const gridColor = "rgba(143, 122, 168, 0.2)";

export default function ChartsPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getAlertSummary();
      setSummary(response.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load alert analytics",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSummary();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadSummary]);

  const statusConfig = useMemo(
    () =>
      makeDoughnutConfig(
        summary?.byStatus ?? [],
        "Alerts by status",
      ),
    [summary],
  );
  const severityConfig = useMemo(
    () =>
      makeBarConfig(summary?.bySeverity ?? [], "Severity", "Alerts"),
    [summary],
  );
  const sourceConfig = useMemo(
    () =>
      makeBarConfig(
        summary?.bySource ?? [],
        "Source",
        "Alerts",
        true,
      ),
    [summary],
  );
  const assigneeConfig = useMemo(
    () =>
      makeBarConfig(
        summary?.byAssignee ?? [],
        "Assignee",
        "Alerts",
        true,
      ),
    [summary],
  );
  const createdConfig = useMemo(
    () => makeLineConfig(summary?.createdByDay ?? []),
    [summary],
  );

  return (
    <main className="min-h-screen bg-[#020104] text-white">
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
              <p className="text-xs font-semibold uppercase text-[#b36cff]">
                D3 Morpheus
              </p>
              <h1 className="text-xl font-semibold leading-6 text-white">
                Alert Analytics
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#3b1b5f] bg-[#0d0715] px-3 text-sm font-medium text-[#eee8ff] transition hover:border-[#8b35ff] hover:bg-[#180c27] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a855f7]"
            >
              <ArrowLeft className="size-4" />
              Queue
            </Link>
            <button
              type="button"
              onClick={() => void loadSummary()}
              disabled={isLoading}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#5f11ff] px-4 text-sm font-semibold text-white shadow-[0_0_24px_rgba(95,17,255,0.35)] transition hover:bg-[#7c2dff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c084fc] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <RefreshCw
                className={isLoading ? "size-4 animate-spin" : "size-4"}
              />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <section className="px-4 py-5 lg:px-8">
        {error ? (
          <div className="mb-5 rounded-md border border-red-500/30 bg-red-950/50 px-4 py-3 text-sm text-red-100">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4" />
              {error}
            </div>
          </div>
        ) : null}

        {isLoading && !summary ? (
          <div className="flex h-96 items-center justify-center text-sm text-[#b8abc9]">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading alert analytics
          </div>
        ) : null}

        {!isLoading && summary?.total === 0 ? (
          <div className="flex h-96 items-center justify-center rounded-md border border-dashed border-[#3b1b5f] bg-[#050208] px-6 text-center">
            <div>
              <BarChart3 className="mx-auto mb-3 size-9 text-[#8b35ff]" />
              <h2 className="text-base font-semibold text-white">
                No alert data to chart
              </h2>
              <p className="mt-1 text-sm text-[#b8abc9]">
                Import alert JSON from the queue to populate analytics.
              </p>
            </div>
          </div>
        ) : null}

        {summary && summary.total > 0 ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Total alerts" value={summary.total} />
              <MetricCard label="Unresolved" value={summary.unresolved} />
              <MetricCard label="Critical" value={summary.critical} />
              <MetricCard label="Unassigned" value={summary.unassigned} />
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <ChartPanel
                title="Status Distribution"
                meta={`${summary.unresolved.toLocaleString()} unresolved alerts`}
              >
                <ChartCanvas
                  config={statusConfig}
                  ariaLabel="Status distribution chart"
                />
              </ChartPanel>

              <ChartPanel
                title="Severity Mix"
                meta={`${summary.critical.toLocaleString()} critical alerts`}
              >
                <ChartCanvas
                  config={severityConfig}
                  ariaLabel="Severity mix chart"
                />
              </ChartPanel>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <ChartPanel title="Top Sources" meta="Highest alert volume">
                <ChartCanvas
                  config={sourceConfig}
                  ariaLabel="Top sources chart"
                />
              </ChartPanel>

              <ChartPanel title="Assignee Workload" meta="Open ownership view">
                <ChartCanvas
                  config={assigneeConfig}
                  ariaLabel="Assignee workload chart"
                />
              </ChartPanel>
            </div>

            <ChartPanel
              title="Created Over Time"
              meta={
                summary.lastUpdatedAt
                  ? `Last updated ${formatLongDateTime(summary.lastUpdatedAt)}`
                  : "No updates recorded"
              }
              tall
            >
              <ChartCanvas
                config={createdConfig}
                ariaLabel="Created over time chart"
              />
            </ChartPanel>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[#241039] bg-[#0a0610] px-4 py-4">
      <div className="text-sm text-[#8f7aa8]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function ChartPanel({
  title,
  meta,
  tall = false,
  children,
}: {
  title: string;
  meta: string;
  tall?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-[#241039] bg-[#050208]">
      <header className="flex flex-col gap-1 border-b border-[#241039] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <p className="text-xs text-[#8f7aa8]">{meta}</p>
      </header>
      <div className={tall ? "h-[24rem] p-4" : "h-80 p-4"}>{children}</div>
    </section>
  );
}

function makeDoughnutConfig(
  buckets: AlertCountBucket[],
  label: string,
): ChartConfiguration<"doughnut"> {
  const labels = buckets.map((bucket) => formatBucketLabel(bucket.label));
  const values = buckets.map((bucket) => bucket.count);

  return {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          label,
          data: values,
          backgroundColor: chartColors,
          borderColor: "#050208",
          borderWidth: 2,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: textColor,
            padding: 16,
            usePointStyle: true,
          },
        },
        tooltip: tooltipOptions(),
      },
    },
  };
}

function makeBarConfig(
  buckets: AlertCountBucket[],
  label: string,
  axisLabel: string,
  horizontal = false,
): ChartConfiguration<"bar"> {
  return {
    type: "bar",
    data: {
      labels: buckets.map((bucket) => formatBucketLabel(bucket.label)),
      datasets: [
        {
          label: axisLabel,
          data: buckets.map((bucket) => bucket.count),
          backgroundColor: buckets.map(
            (_, index) => chartColors[index % chartColors.length],
          ),
          borderColor: "rgba(255, 255, 255, 0.08)",
          borderWidth: 1,
          borderRadius: 5,
          maxBarThickness: 34,
        },
      ],
    },
    options: {
      indexAxis: horizontal ? "y" : "x",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: tooltipOptions(),
      },
      scales: makeScales(label, axisLabel, horizontal),
    },
  };
}

function makeLineConfig(
  buckets: AlertCountBucket[],
): ChartConfiguration<"line"> {
  return {
    type: "line",
    data: {
      labels: buckets.map((bucket) => bucket.label),
      datasets: [
        {
          label: "Created alerts",
          data: buckets.map((bucket) => bucket.count),
          borderColor: "#22d3ee",
          backgroundColor: "rgba(34, 211, 238, 0.18)",
          borderWidth: 2,
          pointBackgroundColor: "#8b35ff",
          pointBorderColor: "#ffffff",
          pointRadius: 3,
          tension: 0.32,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: textColor,
            usePointStyle: true,
          },
        },
        tooltip: tooltipOptions(),
      },
      scales: makeScales("Created date", "Alerts"),
    },
  };
}

function makeScales(
  xTitle: string,
  yTitle: string,
  horizontal = false,
) {
  return {
    x: {
      grid: {
        color: gridColor,
      },
      ticks: {
        color: mutedTextColor,
      },
      title: {
        display: true,
        text: horizontal ? yTitle : xTitle,
        color: mutedTextColor,
      },
    },
    y: {
      beginAtZero: true,
      grid: {
        color: gridColor,
      },
      ticks: {
        color: mutedTextColor,
        precision: 0,
      },
      title: {
        display: true,
        text: horizontal ? xTitle : yTitle,
        color: mutedTextColor,
      },
    },
  };
}

function tooltipOptions() {
  return {
    backgroundColor: "#0d0715",
    borderColor: "#3b1b5f",
    borderWidth: 1,
    titleColor: "#ffffff",
    bodyColor: textColor,
    displayColors: true,
  };
}

function formatBucketLabel(value: string) {
  return value
    .replace("InProgress", "In Progress")
    .replace("FalsePositive", "False Positive");
}

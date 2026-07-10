"use client";

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import type { ChartConfiguration, ChartType } from "chart.js";

type ChartCanvasProps<TType extends ChartType> = {
  config: ChartConfiguration<TType>;
  ariaLabel: string;
  className?: string;
};

export function ChartCanvas<TType extends ChartType>({
  config,
  ariaLabel,
  className,
}: ChartCanvasProps<TType>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<TType> | null>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, config);

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [config]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={ariaLabel}
      className={className}
    >
      {ariaLabel}
    </canvas>
  );
}

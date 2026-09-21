import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  type Plugin,
} from "chart.js";
import type { ChartData, ChartOptions } from "chart.js";
import type { CountryStepRecord, SimulationResult } from "../simulation/types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export type WorldMetric =
  | "population"
  | "happiness"
  | "wealth"
  | "debt"
  | "gdp"
  | "inflation";

interface WorldTrendChartProps {
  result: SimulationResult | null;
  metric: WorldMetric;
  currentStep?: number;
}

const palette = [
  "#38bdf8", // Sky
  "#f59e0b", // Amber
  "#10b981", // Emerald
  "#ec4899", // Pink
  "#8b5cf6", // Purple
  "#f97316", // Orange
  "#64748b", // Slate
];

function metricValue(country: CountryStepRecord, metric: WorldMetric): number {
  if (metric === "population") return country.population;
  if (metric === "happiness") return country.happiness;
  if (metric === "wealth") return country.wealth;
  if (metric === "debt") return country.debt;
  if (metric === "gdp") return country.gdp;
  return Number((country.inflationRate * 100).toFixed(2));
}

function metricLabel(metric: WorldMetric): string {
  switch (metric) {
    case "population":
      return "Population";
    case "happiness":
      return "Happiness (%)";
    case "wealth":
      return "Treasury Wealth ($)";
    case "debt":
      return "Total Debt ($)";
    case "gdp":
      return "Output GDP ($)";
    case "inflation":
      return "Inflation Rate (%)";
  }
}

export function WorldTrendChart({ result, metric, currentStep }: WorldTrendChartProps) {
  const chartData = useMemo<ChartData<"line"> | null>(() => {
    if (!result || result.history.length === 0) return null;

    const labels = result.history.map((step) => `T+${step.step}`);
    const countries = result.finalState.countries;
    const recordsByStep = result.history.map(
      (step) => new Map(step.countries.map((country) => [country.countryId, country] as const))
    );

    return {
      labels,
      datasets: countries.map((country, index) => ({
        label: country.name,
        data: recordsByStep.map((records) => {
          const record = records.get(country.id);
          return record ? metricValue(record, metric) : null;
        }),
        borderColor: palette[index % palette.length],
        backgroundColor: palette[index % palette.length],
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 1.8,
        spanGaps: true,
      })),
    };
  }, [metric, result]);

  // Subtle vertical line plugin at currentStep
  const plugins = useMemo<Plugin<"line">[]>(() => {
    if (!currentStep) return [];
    return [
      {
        id: "currentStepLine",
        afterDraw(chart) {
          const { ctx, chartArea, scales } = chart;
          const xAxis = scales.x;
          if (!xAxis) return;
          const idx = Math.max(0, currentStep - 1);
          const xPixel = xAxis.getPixelForTick(idx);
          if (xPixel >= chartArea.left && xPixel <= chartArea.right) {
            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = "rgba(56, 189, 248, 0.75)";
            ctx.lineWidth = 1.5;
            ctx.moveTo(xPixel, chartArea.top);
            ctx.lineTo(xPixel, chartArea.bottom);
            ctx.stroke();

            // Small label at top
            ctx.fillStyle = "#38bdf8";
            ctx.font = "11px monospace";
            ctx.fillText(`T+${currentStep}`, xPixel + 4, chartArea.top + 12);
            ctx.restore();
          }
        },
      },
    ];
  }, [currentStep]);

  const options = useMemo<ChartOptions<"line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          position: "top",
          align: "end",
          labels: {
            color: "#94a3b8",
            boxWidth: 12,
            boxHeight: 12,
            usePointStyle: true,
            pointStyle: "circle",
            font: {
              family: "system-ui, sans-serif",
              size: 11.5,
            },
          },
        },
        tooltip: {
          mode: "index",
          intersect: false,
          backgroundColor: "#0f172a",
          borderColor: "#334155",
          borderWidth: 1,
          titleColor: "#f1f5f9",
          bodyColor: "#cbd5e1",
          bodyFont: { family: "monospace", size: 11.5 },
          titleFont: { size: 12, weight: "bold" },
          padding: 8,
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#64748b",
            font: { family: "monospace", size: 11 },
            maxTicksLimit: 12,
          },
          grid: { color: "rgba(30, 41, 59, 0.5)" },
        },
        y: {
          ticks: {
            color: "#64748b",
            font: { family: "monospace", size: 11 },
          },
          grid: { color: "rgba(30, 41, 59, 0.5)" },
          title: {
            display: true,
            text: metricLabel(metric),
            color: "#94a3b8",
            font: { size: 11.5, family: "system-ui, sans-serif" },
          },
        },
      },
    }),
    [metric]
  );

  if (!chartData) {
    return (
      <div className="chart-empty-state">
        <span>No historical data available. Run the simulation.</span>
      </div>
    );
  }

  return (
    <div className="chart-canvas-wrap">
      <Line data={chartData} options={options} plugins={plugins} />
    </div>
  );
}

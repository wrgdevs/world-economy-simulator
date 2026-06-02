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
} from "chart.js";
import type { ChartData, ChartOptions } from "chart.js";
import type { CountryStepRecord, SimulationResult } from "../simulation/types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export type WorldMetric = "population" | "happiness" | "wealth";

interface WorldTrendChartProps {
  result: SimulationResult | null;
  metric: WorldMetric;
}

const palette = [
  "#38bdf8",
  "#f97316",
  "#a78bfa",
  "#34d399",
  "#facc15",
  "#fb7185",
  "#60a5fa",
  "#22c55e",
];

function metricValue(country: CountryStepRecord, metric: WorldMetric): number {
  if (metric === "population") return country.population;
  if (metric === "happiness") return country.happiness;
  return country.wealth;
}

export function WorldTrendChart({ result, metric }: WorldTrendChartProps) {
  const chartData = useMemo<ChartData<"line"> | null>(() => {
    if (!result || result.history.length === 0) return null;

    const labels = result.history.map((step) => `Step ${step.step}`);
    const countries = result.finalState.countries;

    return {
      labels,
      datasets: countries.map((country, index) => ({
        label: country.name,
        data: result.history.map((step) => {
          const record = step.countries.find((entry) => entry.countryId === country.id);
          return record ? metricValue(record, metric) : null;
        }),
        borderColor: palette[index % palette.length],
        backgroundColor: palette[index % palette.length],
        tension: 0.28,
        pointRadius: 0,
        borderWidth: 2,
        spanGaps: true,
      })),
    };
  }, [metric, result]);

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
          labels: {
            color: "#e5e7eb",
          },
        },
        tooltip: {
          mode: "index",
          intersect: false,
        },
      },
      scales: {
        x: {
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(148, 163, 184, 0.12)" },
        },
        y: {
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(148, 163, 184, 0.12)" },
          title: {
            display: true,
            text: metric === "population" ? "Population" : metric === "happiness" ? "Happiness" : "Wealth",
            color: "#cbd5e1",
          },
        },
      },
    }),
    [metric]
  );

  if (!chartData) {
    return (
      <div className="card chart-card large">
        <h2>World trends</h2>
        <p className="muted">Run the simulation to see country comparisons.</p>
      </div>
    );
  }

  return (
    <div className="card chart-card large">
      <h2>World trends</h2>
      <div className="chart-panel">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
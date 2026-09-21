import { useState } from "react";
import { WorldTrendChart, type WorldMetric } from "./WorldTrendChart";
import type { SimulationResult } from "../simulation/types";

interface ComparisonMetricRow {
  label: string;
  a: number;
  b: number;
  format: (n: number) => string;
}

interface CountryComparisonItem {
  id: string;
  name: string;
  wealthA: number;
  wealthB: number;
  happinessA: number;
  happinessB: number;
  debtA: number;
  debtB: number;
  inflationA: number;
  inflationB: number;
  sufficiencyA: number;
  sufficiencyB: number;
  netTradeA: number;
  netTradeB: number;
  migrationA: number;
  migrationB: number;
}

interface CompareViewProps {
  resultA: SimulationResult | null;
  resultB: SimulationResult | null;
  comparisonRows: ComparisonMetricRow[];
  countryComparisonRows: CountryComparisonItem[];
  onSelectScenario: (key: "A" | "B") => void;
  onCopyToOther: () => void;
  onSwapScenarios: () => void;
}

function signedNumber(val: number, formatter: (n: number) => string): string {
  const sign = val > 0 ? "+" : "";
  return `${sign}${formatter(val)}`;
}

function deltaClass(val: number, invert = false): string {
  if (Math.abs(val) < 0.0001) return "delta neutral";
  const isPositive = val > 0;
  const isGood = invert ? !isPositive : isPositive;
  return isGood ? "delta good" : "delta bad";
}

export function CompareView({
  resultA,
  resultB,
  comparisonRows,
  countryComparisonRows,
  onSelectScenario,
  onCopyToOther,
  onSwapScenarios,
}: CompareViewProps) {
  const [metric, setMetric] = useState<WorldMetric>("wealth");

  return (
    <div className="compare-view">
      {/* Top Controls */}
      <div className="compare-header">
        <div className="compare-title-group">
          <span className="compare-title">Scenario Comparison</span>
        </div>

        <div className="compare-actions">
          <button
            type="button"
            className="btn-subtle"
            onClick={() => onSelectScenario("A")}
          >
            Edit Scenario A
          </button>
          <button
            type="button"
            className="btn-subtle"
            onClick={() => onSelectScenario("B")}
          >
            Edit Scenario B
          </button>
          <button type="button" className="btn-subtle" onClick={onCopyToOther}>
            Clone to Other
          </button>
          <button type="button" className="btn-subtle" onClick={onSwapScenarios} title="Swap Scenario A and B">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m16 3 4 4-4 4" />
              <path d="M20 7H4" />
              <path d="m8 21-4-4 4-4" />
              <path d="M4 17h16" />
            </svg>
            <span>Swap A / B</span>
          </button>
        </div>
      </div>

      {/* Dual Synchronized Trend Charts */}
      <div className="compare-charts-row">
        <div className="compare-chart-card">
          <div className="compare-chart-head">
            <span className="compare-scenario-tag a">SCENARIO A</span>
          </div>
          <div className="compare-chart-body">
            <WorldTrendChart result={resultA} metric={metric} />
          </div>
        </div>

        <div className="compare-chart-card">
          <div className="compare-chart-head">
            <span className="compare-scenario-tag b">SCENARIO B</span>
          </div>
          <div className="compare-chart-body">
            <WorldTrendChart result={resultB} metric={metric} />
          </div>
        </div>
      </div>

      {/* Metric Selector for charts */}
      <div className="compare-metric-selector">
        <span className="selector-label">Compare Metric:</span>
        {(["wealth", "gdp", "population", "happiness", "debt", "inflation"] as WorldMetric[]).map(
          (m) => (
            <button
              key={m}
              type="button"
              className={`metric-btn ${metric === m ? "active" : ""}`}
              onClick={() => setMetric(m)}
            >
              {m.toUpperCase()}
            </button>
          )
        )}
      </div>

      {/* Global Delta Table */}
      <div className="compare-table-card">
        <div className="table-card-head">
          <span className="table-card-title">Aggregate Deltas (B − A)</span>
        </div>

        <div className="table-scroll-wrap">
          <table className="analytical-table">
            <thead>
              <tr>
                <th>Macro Indicator</th>
                <th>Scenario A</th>
                <th>Scenario B</th>
                <th>Net Delta (B - A)</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => {
                const delta = row.b - row.a;
                const isDebtOrInflation =
                  row.label.toLowerCase().includes("debt") ||
                  row.label.toLowerCase().includes("inflation") ||
                  row.label.toLowerCase().includes("collapsed");

                return (
                  <tr key={row.label}>
                    <td className="row-label-cell">{row.label}</td>
                    <td className="mono-cell">{row.format(row.a)}</td>
                    <td className="mono-cell">{row.format(row.b)}</td>
                    <td className={`mono-cell ${deltaClass(delta, isDebtOrInflation)}`}>
                      {signedNumber(delta, row.format)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Country-by-Country Matrix */}
      {countryComparisonRows.length > 0 && (
        <div className="compare-table-card">
          <div className="table-card-head">
            <span className="table-card-title">Country Deltas</span>
          </div>

          <div className="table-scroll-wrap">
            <table className="analytical-table">
              <thead>
                <tr>
                  <th>Economy</th>
                  <th>Wealth A</th>
                  <th>Wealth B</th>
                  <th>Δ Wealth</th>
                  <th>Happiness A</th>
                  <th>Happiness B</th>
                  <th>Δ Happ</th>
                  <th>Debt A</th>
                  <th>Debt B</th>
                  <th>Δ Debt</th>
                  <th>Net Trade A</th>
                  <th>Net Trade B</th>
                  <th>Δ Trade</th>
                </tr>
              </thead>
              <tbody>
                {countryComparisonRows.map((c) => {
                  const dWealth = c.wealthB - c.wealthA;
                  const dHapp = c.happinessB - c.happinessA;
                  const dDebt = c.debtB - c.debtA;
                  const dTrade = c.netTradeB - c.netTradeA;

                  return (
                    <tr key={c.id}>
                      <td className="country-name-cell">{c.name}</td>
                      <td className="mono-cell">${c.wealthA.toFixed(0)}</td>
                      <td className="mono-cell">${c.wealthB.toFixed(0)}</td>
                      <td className={`mono-cell ${deltaClass(dWealth)}`}>
                        {signedNumber(dWealth, (n) => `$${n.toFixed(0)}`)}
                      </td>
                      <td className="mono-cell">{c.happinessA.toFixed(1)}%</td>
                      <td className="mono-cell">{c.happinessB.toFixed(1)}%</td>
                      <td className={`mono-cell ${deltaClass(dHapp)}`}>
                        {signedNumber(dHapp, (n) => `${n.toFixed(1)}%`)}
                      </td>
                      <td className="mono-cell">${c.debtA.toFixed(0)}</td>
                      <td className="mono-cell">${c.debtB.toFixed(0)}</td>
                      <td className={`mono-cell ${deltaClass(dDebt, true)}`}>
                        {signedNumber(dDebt, (n) => `$${n.toFixed(0)}`)}
                      </td>
                      <td className="mono-cell">${c.netTradeA.toFixed(1)}</td>
                      <td className="mono-cell">${c.netTradeB.toFixed(1)}</td>
                      <td className={`mono-cell ${deltaClass(dTrade)}`}>
                        {signedNumber(dTrade, (n) => `$${n.toFixed(1)}`)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

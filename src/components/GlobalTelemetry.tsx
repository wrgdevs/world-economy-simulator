import type { WorldStepRecord } from "../simulation/types";

interface GlobalTelemetryProps {
  currentStep: number;
  totalSteps: number;
  stepRecord: WorldStepRecord | null;
  activeStatus: string;
}

function money(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}k`;
  return `$${val.toFixed(0)}`;
}

export function GlobalTelemetry({
  currentStep,
  totalSteps,
  stepRecord,
  activeStatus,
}: GlobalTelemetryProps) {
  const countries = stepRecord?.countries ?? [];
  const population = countries.reduce((sum, c) => sum + c.population, 0);
  const wealth = countries.reduce((sum, c) => sum + c.wealth, 0);
  const debt = countries.reduce((sum, c) => sum + c.debt, 0);
  const happiness =
    countries.length > 0
      ? countries.reduce((sum, c) => sum + c.happiness, 0) / countries.length
      : 0;
  const inflation =
    countries.length > 0
      ? countries.reduce((sum, c) => sum + c.inflationRate, 0) / countries.length
      : 0;
  const tradeVolume = countries.reduce(
    (sum, c) =>
      sum +
      c.imports.food +
      c.imports.energy +
      c.imports.materials +
      c.exports.food +
      c.exports.energy +
      c.exports.materials,
    0
  );
  const collapsedCount = countries.filter((c) => c.status === "collapsed").length;
  const stressedCount = countries.filter((c) => c.status === "stressed").length;
  const activeEvents = stepRecord?.events.length ?? 0;

  return (
    <div className="telemetry-bar">
      <div className="telemetry-step">
        <span className="telemetry-label">Step</span>
        <span className="telemetry-val">
          <strong>{currentStep}</strong>
          <span className="telemetry-muted">/{totalSteps}</span>
        </span>
      </div>

      <div className="telemetry-divider" />

      <div className="telemetry-item">
        <span className="telemetry-label">Population</span>
        <span className="telemetry-val">{Math.round(population).toLocaleString()}</span>
      </div>

      <div className="telemetry-item">
        <span className="telemetry-label">World Wealth</span>
        <span className="telemetry-val">{money(wealth)}</span>
      </div>

      <div className="telemetry-item">
        <span className="telemetry-label">Debt</span>
        <span className={`telemetry-val ${debt > wealth * 0.8 ? "bad" : ""}`}>
          {money(debt)}
        </span>
      </div>

      <div className="telemetry-item">
        <span className="telemetry-label">Happiness</span>
        <span className={`telemetry-val ${happiness < 50 ? "warn" : "good"}`}>
          {happiness.toFixed(1)}
        </span>
      </div>

      <div className="telemetry-item">
        <span className="telemetry-label">Inflation</span>
        <span className={`telemetry-val ${inflation > 0.06 ? "bad" : "neutral"}`}>
          {(inflation * 100).toFixed(1)}%
        </span>
      </div>

      <div className="telemetry-item">
        <span className="telemetry-label">Trade Flow</span>
        <span className="telemetry-val">{tradeVolume.toFixed(1)}</span>
      </div>

      <div className="telemetry-divider" />

      <div className="telemetry-item">
        <span className="telemetry-label">State</span>
        <span
          className={`telemetry-pill ${
            activeStatus === "Stable"
              ? "good"
              : activeStatus === "Mixed"
              ? "neutral"
              : activeStatus === "Fragile"
              ? "warn"
              : "bad"
          }`}
        >
          {activeStatus}
        </span>
      </div>

      {(collapsedCount > 0 || stressedCount > 0) && (
        <div className="telemetry-item">
          <span className="telemetry-label">Stress</span>
          <span className="telemetry-val warn">
            {collapsedCount > 0 ? `${collapsedCount} collapsed` : `${stressedCount} stressed`}
          </span>
        </div>
      )}

      {activeEvents > 0 && (
        <div className="telemetry-item">
          <span className="telemetry-label">Shocks</span>
          <span className="telemetry-pill warn">{activeEvents} active</span>
        </div>
      )}
    </div>
  );
}

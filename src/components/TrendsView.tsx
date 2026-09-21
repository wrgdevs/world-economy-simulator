import { useState, useMemo } from "react";
import { WorldTrendChart, type WorldMetric } from "./WorldTrendChart";
import type { SimulationResult } from "../simulation/types";

interface TrendsViewProps {
  result: SimulationResult | null;
  currentStep: number;
  onJumpToStep: (step: number) => void;
  policySuggestions: string[];
}

function formatEventType(type: string): string {
  return type
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function TrendsView({
  result,
  currentStep,
  onJumpToStep,
  policySuggestions,
}: TrendsViewProps) {
  const [metric, setMetric] = useState<WorldMetric>("wealth");
  const [eventFilter, setEventFilter] = useState<string>("all");

  const allEvents = useMemo(() => {
    if (!result) return [];
    return result.history.flatMap((step) => step.events);
  }, [result]);

  const filteredEvents = useMemo(() => {
    if (eventFilter === "all") return allEvents;
    return allEvents.filter((ev) => ev.type === eventFilter);
  }, [allEvents, eventFilter]);

  const eventTypes = useMemo(() => {
    const types = new Set(allEvents.map((e) => e.type));
    return Array.from(types);
  }, [allEvents]);

  return (
    <div className="trends-view">
      {/* Chart Section */}
      <div className="trends-chart-card">
        <div className="trends-header">
          <div className="trends-title-group">
            <span className="trends-title">Economic Trends</span>
          </div>

          <div className="metric-pills">
            {(
              [
                "wealth",
                "gdp",
                "population",
                "happiness",
                "debt",
                "inflation",
              ] as WorldMetric[]
            ).map((m) => (
              <button
                key={m}
                type="button"
                className={`metric-btn ${metric === m ? "active" : ""}`}
                onClick={() => setMetric(m)}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="trends-chart-body">
          <WorldTrendChart
            result={result}
            metric={metric}
            currentStep={currentStep}
          />
        </div>
      </div>

      {/* Dual Panel: Shocks & Policy Advice */}
      <div className="trends-bottom-grid">
        {/* Shocks Log */}
        <div className="trends-subcard">
          <div className="subcard-header">
            <div className="subcard-title-group">
              <span className="subcard-title">Event Log</span>
              <span className="subcard-count">({filteredEvents.length})</span>
            </div>

            {eventTypes.length > 1 && (
              <select
                className="event-filter-select"
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
              >
                <option value="all">All Events</option>
                {eventTypes.map((t) => (
                  <option key={t} value={t}>
                    {formatEventType(t)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="shocks-table-wrap">
            <table className="analytical-table">
              <thead>
                <tr>
                  <th style={{ width: "50px" }}>Step</th>
                  <th style={{ width: "120px" }}>Type</th>
                  <th style={{ width: "130px" }}>Affected</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length > 0 ? (
                  filteredEvents.map((ev, i) => (
                    <tr
                      key={`${ev.step}-${ev.type}-${i}`}
                      className={ev.step === currentStep ? "active-row" : ""}
                      onClick={() => onJumpToStep(ev.step)}
                      style={{ cursor: "pointer" }}
                      title="Click to jump timeline to this step"
                    >
                      <td className="mono-cell">T+{ev.step}</td>
                      <td>
                        <span className="shock-type-tag">{formatEventType(ev.type)}</span>
                      </td>
                      <td className="country-tag-cell">
                        {ev.countryNames.length > 0
                          ? ev.countryNames.join(", ")
                          : "Global"}
                      </td>
                      <td className="desc-cell">{ev.description}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="muted-cell">
                      No events recorded for this selection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Policy Suggestions */}
        <div className="trends-subcard">
          <div className="subcard-header">
            <span className="subcard-title">Policy Insights</span>
          </div>

          <div className="policy-advice-list">
            {policySuggestions.map((suggestion, i) => (
              <div key={i} className="policy-advice-item">
                <span className="advice-bullet" aria-hidden="true" />
                <span className="advice-text">{suggestion}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

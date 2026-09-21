import { useState } from "react";
import type { EventRecord } from "../simulation/types";

interface TimelineBarProps {
  currentStep: number;
  totalSteps: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStepChange: (step: number) => void;
  onStepDelta: (delta: number) => void;
  eventsByStep: Map<number, EventRecord[]>;
}

export function TimelineBar({
  currentStep,
  totalSteps,
  isPlaying,
  onTogglePlay,
  onStepChange,
  onStepDelta,
  eventsByStep,
}: TimelineBarProps) {
  const [hoveredStepEvents, setHoveredStepEvents] = useState<{
    step: number;
    events: EventRecord[];
  } | null>(null);

  const eventSteps = Array.from(eventsByStep.keys()).sort((a, b) => a - b);

  return (
    <div className="timeline-bar">
      <div className="timeline-controls">
        <button
          type="button"
          className="timeline-btn icon-btn"
          title="Jump to Start"
          onClick={() => onStepChange(1)}
          disabled={currentStep <= 1}
          aria-label="Jump to start"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <rect x="1" y="2" width="2" height="12" rx="0.5" />
            <polygon points="14,2 6,8 14,14" />
          </svg>
        </button>

        <button
          type="button"
          className="timeline-btn icon-btn"
          title="Previous Step"
          onClick={() => onStepDelta(-1)}
          disabled={currentStep <= 1}
          aria-label="Previous step"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <polygon points="12,2 4,8 12,14" />
          </svg>
        </button>

        <button
          type="button"
          className={`timeline-btn play-btn ${isPlaying ? "playing" : ""}`}
          title={isPlaying ? "Pause Simulation" : "Play Simulation"}
          onClick={onTogglePlay}
        >
          {isPlaying ? (
            <>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <rect x="3" y="2" width="3.5" height="12" rx="0.5" />
                <rect x="9.5" y="2" width="3.5" height="12" rx="0.5" />
              </svg>
              <span>Pause</span>
            </>
          ) : (
            <>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <polygon points="4,2 13,8 4,14" />
              </svg>
              <span>Play</span>
            </>
          )}
        </button>

        <button
          type="button"
          className="timeline-btn icon-btn"
          title="Next Step"
          onClick={() => onStepDelta(1)}
          disabled={currentStep >= totalSteps}
          aria-label="Next step"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <polygon points="4,2 12,8 4,14" />
          </svg>
        </button>

        <button
          type="button"
          className="timeline-btn icon-btn"
          title="Jump to End"
          onClick={() => onStepChange(totalSteps)}
          disabled={currentStep >= totalSteps}
          aria-label="Jump to end"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <polygon points="2,2 10,8 2,14" />
            <rect x="13" y="2" width="2" height="12" rx="0.5" />
          </svg>
        </button>

        <div className="timeline-step-badge">
          <span className="step-tag">T+{currentStep}</span>
          <span className="step-max">/ {totalSteps}</span>
        </div>
      </div>

      <div className="timeline-track-wrap">
        <input
          type="range"
          min={1}
          max={Math.max(1, totalSteps)}
          step={1}
          value={currentStep}
          onChange={(e) => onStepChange(Number(e.target.value))}
          className="timeline-slider"
          aria-label="Simulation step timeline"
        />

        {/* Shock / Event markers along the track */}
        <div className="timeline-markers">
          {eventSteps.map((step) => {
            const pct = ((step - 1) / Math.max(1, totalSteps - 1)) * 100;
            const evs = eventsByStep.get(step) ?? [];
            const isCurrent = step === currentStep;

            return (
              <button
                key={step}
                type="button"
                className={`event-marker ${isCurrent ? "active" : ""}`}
                style={{ left: `${pct}%` }}
                onClick={() => onStepChange(step)}
                onMouseEnter={() => setHoveredStepEvents({ step, events: evs })}
                onMouseLeave={() => setHoveredStepEvents(null)}
                title={`Step ${step}: ${evs.map((e) => e.description).join("; ")}`}
              >
                <span className="marker-pip" />
              </button>
            );
          })}
        </div>

        {/* Hovered event tooltip */}
        {hoveredStepEvents && (
          <div
            className="timeline-tooltip"
            style={{
              left: `${
                ((hoveredStepEvents.step - 1) / Math.max(1, totalSteps - 1)) * 100
              }%`,
            }}
          >
            <div className="tooltip-step">Step {hoveredStepEvents.step} Shocks</div>
            {hoveredStepEvents.events.map((ev, i) => (
              <div key={i} className="tooltip-event">
                <span className="tooltip-event-dot" aria-hidden="true" />
                <span>{ev.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import type { CountryState, CountryStepRecord, ResourceKey, TradeRouteRecord, WorldStepRecord } from "../simulation/types";

interface WorldNetworkViewProps {
  countries: CountryState[];
  stepRecord: WorldStepRecord | null;
  selectedCountryId: string;
  onSelectCountry: (id: string) => void;
}

const RESOURCE_COLORS: Record<ResourceKey, string> = {
  food: "#eab308",
  energy: "#06b6d4",
  materials: "#a855f7",
};

const COUNTRY_COLORS = [
  "#38bdf8", // Auroria sky
  "#f59e0b", // Borealis amber
  "#10b981", // Cascadia emerald
  "#ec4899", // Pink
  "#8b5cf6", // Purple
  "#f97316", // Orange
];

export function WorldNetworkView({
  countries,
  stepRecord,
  selectedCountryId,
  onSelectCountry,
}: WorldNetworkViewProps) {
  const [hoveredRoute, setHoveredRoute] = useState<TradeRouteRecord | null>(null);

  // Map country ID to step record data
  const recordMap = useMemo(() => {
    const map = new Map<string, CountryStepRecord>();
    if (stepRecord) {
      for (const cr of stepRecord.countries) {
        map.set(cr.countryId, cr);
      }
    }
    return map;
  }, [stepRecord]);

  // Geometric positions for countries in SVG space
  const nodePositions = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>();
    const n = countries.length;
    if (n === 1) {
      pos.set(countries[0].id, { x: 440, y: 190 });
      return pos;
    }
    if (n === 2) {
      pos.set(countries[0].id, { x: 260, y: 190 });
      pos.set(countries[1].id, { x: 620, y: 190 });
      return pos;
    }
    if (n === 3) {
      pos.set(countries[0].id, { x: 440, y: 75 });
      pos.set(countries[1].id, { x: 670, y: 275 });
      pos.set(countries[2].id, { x: 210, y: 275 });
      return pos;
    }
    // For n >= 4, use an elliptical arrangement
    const cx = 440;
    const cy = 190;
    const rx = 310;
    const ry = 120;
    countries.forEach((country, idx) => {
      const angle = (2 * Math.PI * idx) / n - Math.PI / 2;
      pos.set(country.id, {
        x: Math.round(cx + rx * Math.cos(angle)),
        y: Math.round(cy + ry * Math.sin(angle)),
      });
    });
    return pos;
  }, [countries]);

  const routes = stepRecord?.routes ?? [];
  const events = stepRecord?.events ?? [];

  // Find active events for each country in this step
  const activeEventsByCountry = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!stepRecord) return map;
    for (const ev of stepRecord.events) {
      for (const cid of ev.countryIds) {
        const list = map.get(cid) ?? [];
        list.push(ev.description);
        map.set(cid, list);
      }
    }
    return map;
  }, [stepRecord]);

  return (
    <div className="network-container">
      <div className="network-header">
        <div className="network-title">
          <span className="network-dot" />
          <span>Trade Network</span>
          <span className="network-badge">
            {routes.length} Active {routes.length === 1 ? "Route" : "Routes"}
          </span>
        </div>

        <div className="network-legend">
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: RESOURCE_COLORS.food }} />
            Food
          </span>
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: RESOURCE_COLORS.energy }} />
            Energy
          </span>
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: RESOURCE_COLORS.materials }} />
            Materials
          </span>
        </div>
      </div>

      {/* Active Step Shocks Callout if any */}
      {events.length > 0 && (
        <div className="network-shock-ticker">
          <span className="ticker-badge">Shock</span>
          <div className="ticker-items">
            {events.map((e, idx) => (
              <span key={idx} className="ticker-text">
                {e.description}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="network-canvas-wrap">
        <svg
          viewBox="0 0 880 370"
          className="network-svg"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Arrow markers for each resource type */}
            {(["food", "energy", "materials"] as ResourceKey[]).map((res) => (
              <marker
                key={res}
                id={`arrow-${res}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill={RESOURCE_COLORS[res]} />
              </marker>
            ))}
          </defs>

          {/* Trade Route Vectors */}
          {routes.map((route, idx) => {
            const fromPos = nodePositions.get(route.fromCountryId);
            const toPos = nodePositions.get(route.toCountryId);
            if (!fromPos || !toPos) return null;

            const dx = toPos.x - fromPos.x;
            const dy = toPos.y - fromPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            const nx = -dy / dist;
            const ny = dx / dist;
            const curveOffset = (idx % 2 === 0 ? 32 : -32) * (1 + (idx % 3) * 0.18);

            const midX = (fromPos.x + toPos.x) / 2 + nx * curveOffset;
            const midY = (fromPos.y + toPos.y) / 2 + ny * curveOffset;

            const pathD = `M ${fromPos.x} ${fromPos.y} Q ${midX} ${midY} ${toPos.x} ${toPos.y}`;
            const strokeColor = RESOURCE_COLORS[route.resource] || "#38bdf8";
            const strokeW = Math.max(1.8, Math.min(5, 1.4 + route.delivered / 14));

            const isHovered =
              hoveredRoute?.fromCountryId === route.fromCountryId &&
              hoveredRoute?.toCountryId === route.toCountryId &&
              hoveredRoute?.resource === route.resource;

            const resourceName =
              route.resource.charAt(0).toUpperCase() + route.resource.slice(1);

            return (
              <g
                key={`${route.fromCountryId}-${route.toCountryId}-${route.resource}-${idx}`}
                className={`trade-corridor ${isHovered ? "hovered" : ""}`}
                onMouseEnter={() => setHoveredRoute(route)}
                onMouseLeave={() => setHoveredRoute(null)}
              >
                {/* Invisible wide hit area */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ cursor: "pointer" }}
                />

                {/* Visible animated line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isHovered ? strokeW + 2 : strokeW}
                  strokeDasharray="6,4"
                  className="flow-path"
                  markerEnd={`url(#arrow-${route.resource})`}
                />

                {/* Midpoint route pill */}
                <g transform={`translate(${midX}, ${midY})`}>
                  <rect
                    x="-42"
                    y="-10"
                    width="84"
                    height="20"
                    rx="3"
                    className="route-pill-bg"
                    fill="#0a0f1d"
                    stroke={strokeColor}
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="4.5"
                    textAnchor="middle"
                    className="route-pill-text"
                    fill="#e2e8f0"
                    fontSize="10.5"
                    fontFamily="monospace"
                  >
                    {route.delivered.toFixed(0)} {resourceName}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Country Nodes */}
          {countries.map((country, idx) => {
            const pos = nodePositions.get(country.id);
            if (!pos) return null;

            const isSelected = country.id === selectedCountryId;
            const live = recordMap.get(country.id);
            const status = live?.status ?? country.status ?? "active";
            const color = COUNTRY_COLORS[idx % COUNTRY_COLORS.length];
            const countryEvents = activeEventsByCountry.get(country.id) ?? [];

            const nodeW = 164;
            const nodeH = 88;
            const left = pos.x - nodeW / 2;
            const top = pos.y - nodeH / 2;

            const happiness = live?.happiness ?? country.happiness;
            const wealth = live?.wealth ?? country.wealth;
            const pop = live?.population ?? country.population;

            return (
              <g
                key={country.id}
                transform={`translate(${left}, ${top})`}
                className={`country-node ${isSelected ? "selected" : ""}`}
                onClick={() => onSelectCountry(country.id)}
                style={{ cursor: "pointer" }}
              >
                {/* Node Box */}
                <rect
                  width={nodeW}
                  height={nodeH}
                  rx="4"
                  className="node-box"
                  fill="#0c1322"
                  stroke={isSelected ? color : "#243247"}
                  strokeWidth={isSelected ? 2 : 1}
                />

                {/* Accent strip */}
                <rect
                  x="0"
                  y="0"
                  width={nodeW}
                  height="3"
                  rx="2"
                  fill={color}
                />

                {/* Country Name & Status */}
                <text
                  x="10"
                  y="22"
                  fill="#f1f5f9"
                  fontSize="13.5"
                  fontWeight="600"
                  fontFamily="system-ui, sans-serif"
                >
                  {country.name}
                </text>

                <rect
                  x={nodeW - 68}
                  y="10.5"
                  width="58"
                  height="17"
                  rx="3"
                  className={`status-tag-bg ${status}`}
                  fill={
                    status === "collapsed"
                      ? "rgba(239, 68, 68, 0.2)"
                      : status === "stressed"
                      ? "rgba(245, 158, 11, 0.2)"
                      : "rgba(34, 197, 94, 0.15)"
                  }
                  stroke={
                    status === "collapsed"
                      ? "#ef4444"
                      : status === "stressed"
                      ? "#f59e0b"
                      : "#22c55e"
                  }
                  strokeWidth="0.8"
                />
                <text
                  x={nodeW - 39}
                  y="23"
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="600"
                  fill={
                    status === "collapsed"
                      ? "#fca5a5"
                      : status === "stressed"
                      ? "#fcd34d"
                      : "#86efac"
                  }
                  fontFamily="monospace"
                  letterSpacing="0.05em"
                >
                  {status.toUpperCase()}
                </text>

                {/* Metrics */}
                <text
                  x="10"
                  y="42"
                  fill="#94a3b8"
                  fontSize="11.5"
                  fontFamily="monospace"
                >
                  Pop: {Math.round(pop).toLocaleString()}
                </text>

                <text
                  x="10"
                  y="58"
                  fill="#94a3b8"
                  fontSize="11.5"
                  fontFamily="monospace"
                >
                  Wealth: ${Math.round(wealth).toLocaleString()}
                </text>

                {/* Happiness meter */}
                <text
                  x="10"
                  y="74"
                  fill="#94a3b8"
                  fontSize="11"
                  fontFamily="monospace"
                >
                  Happiness: {happiness.toFixed(0)}%
                </text>

                <rect
                  x={nodeW - 55}
                  y="66"
                  width="45"
                  height="7"
                  rx="2"
                  fill="#1e293b"
                />
                <rect
                  x={nodeW - 55}
                  y="66"
                  width={Math.max(0, Math.min(45, (45 * happiness) / 100))}
                  height="7"
                  rx="2"
                  fill={happiness > 50 ? "#10b981" : "#f59e0b"}
                />

                {/* Event Alert Badge */}
                {countryEvents.length > 0 && (
                  <g transform={`translate(${nodeW - 14}, -6)`}>
                    <circle r="9" fill="#ef4444" stroke="#0a0e17" strokeWidth="2" />
                    <text
                      x="0"
                      y="3"
                      textAnchor="middle"
                      fill="#fff"
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      !
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Dynamic Route Inspector */}
      {hoveredRoute && (
        <div className="network-route-inspector">
          <span className="inspector-label">Route:</span>
          <span style={{ display: "inline-flex", alignContent: "center", alignItems: "center" }}>
            <strong>{hoveredRoute.fromCountryName}</strong>
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ margin: "0 0.35rem" }}
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
            <strong>{hoveredRoute.toCountryName}</strong>
          </span>
          <span
            className="inspector-tag"
            style={{ color: RESOURCE_COLORS[hoveredRoute.resource] }}
          >
            {hoveredRoute.resource.toUpperCase()}
          </span>
          <span>Shipped: <strong>{hoveredRoute.shipped.toFixed(1)}</strong></span>
          <span>Delivered: <strong>{hoveredRoute.delivered.toFixed(1)}</strong></span>
          <span>Efficiency: <strong>{(hoveredRoute.routeEfficiency * 100).toFixed(0)}%</strong></span>
          <span>Tariff: <strong>{(hoveredRoute.tariff * 100).toFixed(0)}%</strong></span>
        </div>
      )}
    </div>
  );
}

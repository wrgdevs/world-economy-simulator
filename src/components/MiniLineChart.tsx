interface MiniLineChartProps {
  title: string;
  data: number[];
  width?: number;
  height?: number;
  formatValue?: (n: number) => string;
}

export function MiniLineChart({
  title,
  data,
  width = 360,
  height = 140,
  formatValue = (n) => n.toFixed(1),
}: MiniLineChartProps) {
  if (data.length === 0) {
    return (
      <div className="card chart-card">
        <h3>{title}</h3>
        <p>No data yet.</p>
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="card chart-card">
      <div className="chart-header">
        <h3>{title}</h3>
        <span className="muted">
          {formatValue(min)} → {formatValue(max)}
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="chart">
        <polyline points={points} />
      </svg>
    </div>
  );
}
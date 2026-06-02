interface NumberControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  suffix?: string;
}

function clampInput(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function NumberControl({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix,
}: NumberControlProps) {
  return (
    <div className="control">
      <div className="control-top">
        <label>{label}</label>
        <span className="control-value">
          {value}
          {suffix ?? ""}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(clampInput(Number(e.target.value), min, max))}
      />

      <input
        className="control-number"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(clampInput(Number(e.target.value), min, max))}
      />
    </div>
  );
}
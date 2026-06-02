import { NumberControl } from "./NumberControl";
import type { ResourceKey } from "../simulation/types";

interface ResourceEditorProps {
  name: ResourceKey;
  amount: number;
  productionRate: number;
  consumptionRate: number;
  price: number;
  onChange: (
    field: "amount" | "productionRate" | "consumptionRate" | "price",
    value: number
  ) => void;
}

export function ResourceEditor({
  name,
  amount,
  productionRate,
  consumptionRate,
  price,
  onChange,
}: ResourceEditorProps) {
  return (
    <section className="card resource-card">
      <div className="section-head">
        <h3>{name.toUpperCase()}</h3>
        <p className="muted">Tune supply, demand, and market value.</p>
      </div>

      <NumberControl
        label="Starting amount"
        value={amount}
        min={0}
        max={10000}
        step={10}
        onChange={(value) => onChange("amount", value)}
      />

      <NumberControl
        label="Production / step"
        value={productionRate}
        min={0}
        max={500}
        step={1}
        onChange={(value) => onChange("productionRate", value)}
      />

      <NumberControl
        label="Consumption / 100 pop"
        value={consumptionRate}
        min={0}
        max={200}
        step={1}
        onChange={(value) => onChange("consumptionRate", value)}
      />

      <NumberControl
        label="Price"
        value={price}
        min={0}
        max={50}
        step={0.1}
        onChange={(value) => onChange("price", value)}
      />
    </section>
  );
}
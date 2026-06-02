import { NumberControl } from "./NumberControl";
import { RESOURCE_KEYS, SECTOR_KEYS } from "../simulation/types";
import type { CountryState, CountryStatus, ResourceKey, SectorKey } from "../simulation/types";

interface CountryEditorProps {
  country: CountryState;
  countries: CountryState[];
  runtimeStatus?: CountryStatus;
  onNameChange: (value: string) => void;
  onFieldChange: (
    field: "population" | "happiness" | "wealth" | "infrastructure" | "tradeOpenness",
    value: number
  ) => void;
  onPolicyChange: (
    field: "incomeTaxRate" | "publicSpending" | "productionInvestment" | "importSubsidyRate",
    value: number
  ) => void;
  onTradePolicyChange: (field: "importTariff" | "tradeBarrier", value: number) => void;
  onResourceChange: (
    resource: ResourceKey,
    field: "amount" | "productionRate" | "consumptionRate" | "price",
    value: number
  ) => void;
  onTogglePreferredPartner: (partnerId: string) => void;
  onLaborParticipationChange?: (value: number) => void;
  onLaborAllocationChange?: (field: SectorKey, value: number) => void;
  onAIPolicyChange?: (
    field: "enabled" | "responsiveness" | "targetHappiness" | "targetDebtRatio",
    value: number | boolean
  ) => void;
}

export function CountryEditor({
  country,
  countries,
  runtimeStatus,
  onNameChange,
  onFieldChange,
  onPolicyChange,
  onTradePolicyChange,
  onResourceChange,
  onTogglePreferredPartner,
  onLaborParticipationChange,
  onLaborAllocationChange,
  onAIPolicyChange,
}: CountryEditorProps) {
  const partnerCountries = countries.filter((c) => c.id !== country.id);
  const laborParticipation = country.laborParticipation ?? 0.64;
  const allocation = country.laborAllocation ?? {
    agriculture: 0.35,
    industry: 0.35,
    services: 0.3,
  };

  return (
    <section className="card">
      <div className="section-head">
        <h2>Selected country</h2>
        <p className="muted">Edit the country’s economy, policy, labor mix, and trade setup.</p>
        {runtimeStatus && (
          <span className={`runtime-status ${runtimeStatus}`}>Runtime status: {runtimeStatus}</span>
        )}
      </div>

      <div className="country-name-row">
        <label className="text-control">
          Country name
          <input
            type="text"
            value={country.name}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </label>
      </div>

      <div className="form-grid">
        <NumberControl
          label="Population"
          value={country.population}
          min={10}
          max={100000}
          step={10}
          onChange={(value) => onFieldChange("population", value)}
        />
        <NumberControl
          label="Happiness"
          value={country.happiness}
          min={0}
          max={100}
          step={1}
          onChange={(value) => onFieldChange("happiness", value)}
        />
        <NumberControl
          label="Wealth"
          value={country.wealth}
          min={0}
          max={100000}
          step={50}
          onChange={(value) => onFieldChange("wealth", value)}
        />
        <NumberControl
          label="Infrastructure"
          value={country.infrastructure}
          min={0.8}
          max={2.8}
          step={0.01}
          onChange={(value) => onFieldChange("infrastructure", value)}
        />
        <NumberControl
          label="Trade openness"
          value={country.tradeOpenness}
          min={0.5}
          max={1.5}
          step={0.05}
          onChange={(value) => onFieldChange("tradeOpenness", value)}
        />
        <NumberControl
          label="Import tariff"
          value={country.tradePolicy.importTariff}
          min={0}
          max={0.4}
          step={0.01}
          onChange={(value) => onTradePolicyChange("importTariff", value)}
        />
        <NumberControl
          label="Trade barrier"
          value={country.tradePolicy.tradeBarrier}
          min={0}
          max={0.4}
          step={0.01}
          onChange={(value) => onTradePolicyChange("tradeBarrier", value)}
        />
      </div>

      <div className="divider" />

      <div className="section-head">
        <h3>Labor and sectors</h3>
        <p className="muted">Labor allocation drives agriculture, industry, and services output.</p>
      </div>

      <div className="form-grid">
        {onLaborParticipationChange && (
          <NumberControl
            label="Labor participation"
            value={laborParticipation}
            min={0.3}
            max={0.92}
            step={0.01}
            onChange={onLaborParticipationChange}
          />
        )}

        {onLaborAllocationChange &&
          SECTOR_KEYS.map((sector) => (
            <NumberControl
              key={sector}
              label={`${sector[0].toUpperCase()}${sector.slice(1)} share`}
              value={allocation[sector]}
              min={0}
              max={1}
              step={0.01}
              onChange={(value) => onLaborAllocationChange(sector, value)}
            />
          ))}
      </div>

      <div className="divider" />

      <div className="section-head">
        <h3>Fiscal policy</h3>
        <p className="muted">Policies affect debt, inflation, and migration pressure too.</p>
      </div>

      <div className="form-grid">
        <NumberControl
          label="Income tax rate"
          value={country.policy.incomeTaxRate}
          min={0}
          max={0.5}
          step={0.01}
          onChange={(value) => onPolicyChange("incomeTaxRate", value)}
        />
        <NumberControl
          label="Public spending"
          value={country.policy.publicSpending}
          min={0}
          max={200}
          step={1}
          onChange={(value) => onPolicyChange("publicSpending", value)}
        />
        <NumberControl
          label="Production investment"
          value={country.policy.productionInvestment}
          min={0}
          max={200}
          step={1}
          onChange={(value) => onPolicyChange("productionInvestment", value)}
        />
        <NumberControl
          label="Import subsidy rate"
          value={country.policy.importSubsidyRate}
          min={0}
          max={0.5}
          step={0.01}
          onChange={(value) => onPolicyChange("importSubsidyRate", value)}
        />
      </div>

      <div className="divider" />

      <div className="section-head">
        <h3>AI policy</h3>
        <p className="muted">When enabled, the country automatically nudges policy toward its targets.</p>
      </div>

      {onAIPolicyChange && (
        <div className="form-grid">
          <label className="toggle toggle-block">
            <input
              type="checkbox"
              checked={country.aiPolicy.enabled}
              onChange={(e) => onAIPolicyChange("enabled", e.target.checked)}
            />
            Enable AI policy
          </label>

          <NumberControl
            label="Responsiveness"
            value={country.aiPolicy.responsiveness}
            min={0}
            max={1.5}
            step={0.05}
            onChange={(value) => onAIPolicyChange("responsiveness", value)}
          />
          <NumberControl
            label="Target happiness"
            value={country.aiPolicy.targetHappiness}
            min={0}
            max={100}
            step={1}
            onChange={(value) => onAIPolicyChange("targetHappiness", value)}
          />
          <NumberControl
            label="Target debt ratio"
            value={country.aiPolicy.targetDebtRatio}
            min={0}
            max={3}
            step={0.05}
            onChange={(value) => onAIPolicyChange("targetDebtRatio", value)}
          />
        </div>
      )}

      <div className="divider" />

      <div className="section-head">
        <h3>Preferred trade partners</h3>
        <p className="muted">Countries higher in the list are tried first when shortages appear.</p>
      </div>

      <div className="partner-summary">
        {country.tradePolicy.preferredPartners.length > 0 ? (
          country.tradePolicy.preferredPartners.map((partnerId, index) => {
            const partner = countries.find((c) => c.id === partnerId);
            if (!partner) return null;

            return (
              <span className="partner-pill" key={partnerId}>
                {index + 1}. {partner.name}
              </span>
            );
          })
        ) : (
          <span className="muted">No preferred partners yet.</span>
        )}
      </div>

      <div className="partner-grid">
        {partnerCountries.map((partner) => {
          const activeIndex = country.tradePolicy.preferredPartners.indexOf(partner.id);
          const active = activeIndex >= 0;

          return (
            <button
              key={partner.id}
              className={`partner-chip ${active ? "active" : ""}`}
              onClick={() => onTogglePreferredPartner(partner.id)}
            >
              <strong>{partner.name}</strong>
              <span>{active ? `Preferred #${activeIndex + 1}` : "Add as partner"}</span>
            </button>
          );
        })}
      </div>

      <div className="divider" />

      <div className="section-head">
        <h3>Resources</h3>
        <p className="muted">Production, consumption, and price still matter step to step.</p>
      </div>

      <div className="resource-grid">
        {RESOURCE_KEYS.map((key) => {
          const resource = country.resources[key];

          return (
            <div className="resource-card card nested" key={key}>
              <h3>{key.toUpperCase()}</h3>

              <NumberControl
                label="Starting amount"
                value={resource.amount}
                min={0}
                max={10000}
                step={10}
                onChange={(value) => onResourceChange(key, "amount", value)}
              />
              <NumberControl
                label="Production / step"
                value={resource.productionRate}
                min={0}
                max={500}
                step={1}
                onChange={(value) => onResourceChange(key, "productionRate", value)}
              />
              <NumberControl
                label="Consumption / 100 pop"
                value={resource.consumptionRate}
                min={0}
                max={200}
                step={1}
                onChange={(value) => onResourceChange(key, "consumptionRate", value)}
              />
              <NumberControl
                label="Price"
                value={resource.price}
                min={0}
                max={50}
                step={0.1}
                onChange={(value) => onResourceChange(key, "price", value)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
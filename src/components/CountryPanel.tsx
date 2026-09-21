import { useState } from "react";
import { NumberControl } from "./NumberControl";
import { RESOURCE_KEYS, SECTOR_KEYS } from "../simulation/types";
import type { CountryState, CountryStepRecord, ResourceKey, SectorKey } from "../simulation/types";

interface CountryPanelProps {
  country: CountryState;
  allCountries: CountryState[];
  currentRecord: CountryStepRecord | undefined;
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
  onLaborParticipationChange: (value: number) => void;
  onLaborAllocationChange: (field: SectorKey, value: number) => void;
  onAIPolicyChange: (
    field: "enabled" | "responsiveness" | "targetHappiness" | "targetDebtRatio",
    value: number | boolean
  ) => void;
  onAddCountry: () => void;
  onDuplicateCountry: () => void;
  onRemoveCountry: () => void;
  canRemove: boolean;
  initialTab?: CountryTabKey;
}

export type CountryTabKey = "policy" | "sectors" | "trade" | "resources" | "base";

export function CountryPanel({
  country,
  allCountries,
  currentRecord,
  onNameChange,
  onFieldChange,
  onPolicyChange,
  onTradePolicyChange,
  onResourceChange,
  onTogglePreferredPartner,
  onLaborParticipationChange,
  onLaborAllocationChange,
  onAIPolicyChange,
  onAddCountry,
  onDuplicateCountry,
  onRemoveCountry,
  canRemove,
  initialTab,
}: CountryPanelProps) {
  const [activeTab, setActiveTab] = useState<CountryTabKey>(initialTab ?? "policy");

  const partnerCountries = allCountries.filter((c) => c.id !== country.id);
  const laborParticipation = country.laborParticipation ?? 0.64;
  const allocation = country.laborAllocation ?? {
    agriculture: 0.35,
    industry: 0.35,
    services: 0.3,
  };

  const status = currentRecord?.status ?? country.status ?? "active";

  return (
    <div className="country-panel">
      {/* Country Header & Identification */}
      <div className="country-panel-header">
        <div className="country-title-group">
          <input
            type="text"
            className="country-name-input"
            value={country.name}
            onChange={(e) => onNameChange(e.target.value)}
            title="Edit country name"
          />
          <span className={`status-badge ${status}`}>{status.toUpperCase()}</span>
        </div>

        <div className="country-mgmt-btns">
          <button
            type="button"
            className="btn-subtle"
            onClick={onAddCountry}
            title="Add a new economy"
          >
            + Add
          </button>
          <button
            type="button"
            className="btn-subtle"
            onClick={onDuplicateCountry}
            title="Duplicate this economy"
          >
            Duplicate
          </button>
          <button
            type="button"
            className="btn-subtle danger"
            onClick={onRemoveCountry}
            disabled={!canRemove}
            title={canRemove ? "Remove this economy" : "Cannot remove last economy"}
          >
            Remove
          </button>
        </div>
      </div>

      {/* Step Runtime Telemetry Strip for Selected Country */}
      {currentRecord && (
        <div className="country-telemetry-grid">
          <div className="ctel-item">
            <span className="ctel-label">GDP Output</span>
            <span className="ctel-val">${Math.round(currentRecord.gdp).toLocaleString()}</span>
          </div>
          <div className="ctel-item">
            <span className="ctel-label">Treasury</span>
            <span className="ctel-val">${Math.round(currentRecord.wealth).toLocaleString()}</span>
          </div>
          <div className="ctel-item">
            <span className="ctel-label">Debt</span>
            <span
              className={`ctel-val ${
                currentRecord.debt > currentRecord.wealth ? "bad" : "neutral"
              }`}
            >
              ${Math.round(currentRecord.debt).toLocaleString()}
            </span>
          </div>
          <div className="ctel-item">
            <span className="ctel-label">Happiness</span>
            <span className="ctel-val">{currentRecord.happiness.toFixed(1)}%</span>
          </div>
          <div className="ctel-item">
            <span className="ctel-label">Net Trade</span>
            <span
              className={`ctel-val ${
                currentRecord.netTrade >= 0 ? "good" : "bad"
              }`}
            >
              {currentRecord.netTrade >= 0 ? "+" : "-"}${Math.abs(currentRecord.netTrade).toFixed(1)}
            </span>
          </div>
          <div className="ctel-item">
            <span className="ctel-label">Sufficiency</span>
            <span className="ctel-val">
              {(currentRecord.averageSufficiency * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      {/* Warnings & Diagnostics */}
      {currentRecord && currentRecord.warnings.length > 0 && (
        <div className="country-warnings-banner">
          {currentRecord.warnings.map((w, i) => (
            <span key={i} className="warning-chip">
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
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{w}</span>
            </span>
          ))}
        </div>
      )}

      {/* Navigation Subtabs */}
      <div className="panel-tab-bar">
        <button
          type="button"
          className={`panel-tab ${activeTab === "policy" ? "active" : ""}`}
          onClick={() => setActiveTab("policy")}
        >
          Policy
        </button>
        <button
          type="button"
          className={`panel-tab ${activeTab === "sectors" ? "active" : ""}`}
          onClick={() => setActiveTab("sectors")}
        >
          Sectors
        </button>
        <button
          type="button"
          className={`panel-tab ${activeTab === "trade" ? "active" : ""}`}
          onClick={() => setActiveTab("trade")}
        >
          Trade
        </button>
        <button
          type="button"
          className={`panel-tab ${activeTab === "resources" ? "active" : ""}`}
          onClick={() => setActiveTab("resources")}
        >
          Resources
        </button>
        <button
          type="button"
          className={`panel-tab ${activeTab === "base" ? "active" : ""}`}
          onClick={() => setActiveTab("base")}
        >
          Base
        </button>
      </div>

      {/* Tab 1: Fiscal Policy */}
      {activeTab === "policy" && (
        <div className="panel-tab-content">
          <div className="section-label">Fiscal Policy</div>
          <div className="control-grid">
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

          <div className="section-label" style={{ marginTop: "1rem" }}>
            Policy Autopilot
          </div>
          <div className="ai-policy-box">
            <label className="checkbox-toggle">
              <input
                type="checkbox"
                checked={country.aiPolicy.enabled}
                onChange={(e) => onAIPolicyChange("enabled", e.target.checked)}
              />
              <span>Enable Policy Autopilot</span>
            </label>

            {country.aiPolicy.enabled && (
              <div className="control-grid" style={{ marginTop: "0.75rem" }}>
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
          </div>
        </div>
      )}

      {/* Tab 2: Labor & Economic Sectors */}
      {activeTab === "sectors" && (
        <div className="panel-tab-content">
          <div className="section-label">Labor & Sectors</div>
          <NumberControl
            label="Labor participation"
            value={laborParticipation}
            min={0.3}
            max={0.92}
            step={0.01}
            onChange={onLaborParticipationChange}
          />

          <div className="sector-bar-visual" style={{ margin: "0.8rem 0" }}>
            <div
              className="sector-segment ag"
              style={{ width: `${allocation.agriculture * 100}%` }}
              title={`Agriculture: ${(allocation.agriculture * 100).toFixed(0)}%`}
            >
              Ag: {(allocation.agriculture * 100).toFixed(0)}%
            </div>
            <div
              className="sector-segment ind"
              style={{ width: `${allocation.industry * 100}%` }}
              title={`Industry: ${(allocation.industry * 100).toFixed(0)}%`}
            >
              Ind: {(allocation.industry * 100).toFixed(0)}%
            </div>
            <div
              className="sector-segment srv"
              style={{ width: `${allocation.services * 100}%` }}
              title={`Services: ${(allocation.services * 100).toFixed(0)}%`}
            >
              Srv: {(allocation.services * 100).toFixed(0)}%
            </div>
          </div>

          <div className="control-grid">
            {SECTOR_KEYS.map((sector) => (
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

          {currentRecord && (
            <div className="sector-outputs-summary">
              <div className="so-item">
                <span>Agriculture Output</span>
                <strong>{currentRecord.agricultureOutput.toFixed(1)}</strong>
              </div>
              <div className="so-item">
                <span>Industry Output</span>
                <strong>{currentRecord.industryOutput.toFixed(1)}</strong>
              </div>
              <div className="so-item">
                <span>Services Output</span>
                <strong>{currentRecord.servicesOutput.toFixed(1)}</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Trade & Diplomacy */}
      {activeTab === "trade" && (
        <div className="panel-tab-content">
          <div className="section-label">Trade Policy</div>
          <div className="control-grid">
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
            <NumberControl
              label="Trade openness"
              value={country.tradeOpenness}
              min={0.5}
              max={1.5}
              step={0.05}
              onChange={(value) => onFieldChange("tradeOpenness", value)}
            />
          </div>

          <div className="section-label" style={{ marginTop: "1rem" }}>
            Trade Partners
          </div>
          <p className="field-hint">
            Preferred partners are queried first during shortages.
          </p>
          <div className="partner-chip-grid">
            {partnerCountries.map((partner) => {
              const activeIndex = country.tradePolicy.preferredPartners.indexOf(partner.id);
              const isPreferred = activeIndex >= 0;

              return (
                <button
                  type="button"
                  key={partner.id}
                  className={`partner-btn ${isPreferred ? "active" : ""}`}
                  onClick={() => onTogglePreferredPartner(partner.id)}
                >
                  <span className="partner-btn-name">{partner.name}</span>
                  <span className="partner-btn-status">
                    {isPreferred ? `Priority #${activeIndex + 1}` : "+ Add Partner"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Resources */}
      {activeTab === "resources" && (
        <div className="panel-tab-content">
          <div className="section-label">Resources</div>
          <div className="resource-matrix">
            {RESOURCE_KEYS.map((key) => {
              const res = country.resources[key];
              const currentStock = currentRecord?.resourceAmounts[key];
              const shortage = currentRecord?.resourceShortages[key] ?? 0;

              return (
                <div key={key} className="resource-col-card">
                  <div className="rc-header">
                    <span className="rc-title">{key.toUpperCase()}</span>
                    {shortage > 0 && (
                      <span className="rc-shortage-tag">Deficit {shortage.toFixed(1)}</span>
                    )}
                  </div>

                  <NumberControl
                    label="Stock"
                    value={res.amount}
                    min={0}
                    max={10000}
                    step={20}
                    onChange={(v) => onResourceChange(key, "amount", v)}
                  />
                  <NumberControl
                    label="Prod / step"
                    value={res.productionRate}
                    min={0}
                    max={500}
                    step={1}
                    onChange={(v) => onResourceChange(key, "productionRate", v)}
                  />
                  <NumberControl
                    label="Cons / 100 pop"
                    value={res.consumptionRate}
                    min={0}
                    max={200}
                    step={1}
                    onChange={(v) => onResourceChange(key, "consumptionRate", v)}
                  />
                  <NumberControl
                    label="Base Price"
                    value={res.price}
                    min={0.5}
                    max={50}
                    step={0.1}
                    onChange={(v) => onResourceChange(key, "price", v)}
                  />

                  {currentStock !== undefined && (
                    <div className="rc-live-stock">
                      <span>Current Inventory:</span>
                      <strong>{currentStock.toFixed(1)}</strong>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 5: Base Country Parameters */}
      {activeTab === "base" && (
        <div className="panel-tab-content">
          <div className="section-label">Baseline Parameters</div>
          <div className="control-grid">
            <NumberControl
              label="Population"
              value={country.population}
              min={10}
              max={100000}
              step={50}
              onChange={(value) => onFieldChange("population", value)}
            />
            <NumberControl
              label="Base Happiness"
              value={country.happiness}
              min={0}
              max={100}
              step={1}
              onChange={(value) => onFieldChange("happiness", value)}
            />
            <NumberControl
              label="Initial Wealth"
              value={country.wealth}
              min={0}
              max={100000}
              step={100}
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
          </div>
        </div>
      )}
    </div>
  );
}

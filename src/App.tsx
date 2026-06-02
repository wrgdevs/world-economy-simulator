import { type ChangeEvent, useMemo, useRef, useState } from "react";
import "./styles.css";
import { CountryEditor } from "./components/CountryEditor";
import { NumberControl } from "./components/NumberControl";
import { WorldTrendChart, type WorldMetric } from "./components/WorldTrendChart";
import { createCountry, createDefaultConfig } from "./simulation/presets";
import { simulateEconomy } from "./simulation/engine";
import type {
  CountryState,
  CountryStepRecord,
  ResourceKey,
  SectorKey,
  SimulationConfig,
  SimulationResult,
} from "./simulation/types";

type ScenarioKey = "A" | "B";
type PolicyPresetKey = "balanced" | "freeTrade" | "protectionist" | "austerity" | "stimulus" | "crisis";

interface ScenarioSlot {
  config: SimulationConfig;
  selectedCountryId: string;
}

interface ScenarioSummary {
  population: number;
  wealth: number;
  happiness: number;
  infrastructure: number;
  debt: number;
  averageInflation: number;
  tradeVolume: number;
  countriesWithWarnings: number;
  totalWarnings: number;
  eventCount: number;
  migrationFlow: number;
  collapsedCountries: number;
  stressedCountries: number;
  topCountryByWealth: CountryStepRecord | null;
  worstCountryByHappiness: CountryStepRecord | null;
  mostDependentCountry: CountryStepRecord | null;
  finalCountries: CountryStepRecord[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function signedNumber(value: number, format: (n: number) => string): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${format(value)}`;
}

function cloneCountry(country: CountryState, id: string, name: string): CountryState {
  return {
    ...country,
    id,
    name,
    status: country.status ?? "active",
    debt: country.debt ?? 0,
    laborParticipation: country.laborParticipation ?? 0.64,
    laborAllocation: {
      agriculture: country.laborAllocation?.agriculture ?? 0.35,
      industry: country.laborAllocation?.industry ?? 0.35,
      services: country.laborAllocation?.services ?? 0.3,
    },
    tradePolicy: {
      importTariff: country.tradePolicy.importTariff,
      tradeBarrier: country.tradePolicy.tradeBarrier,
      preferredPartners: [...country.tradePolicy.preferredPartners],
    },
    policy: {
      incomeTaxRate: country.policy.incomeTaxRate,
      publicSpending: country.policy.publicSpending,
      productionInvestment: country.policy.productionInvestment,
      importSubsidyRate: country.policy.importSubsidyRate,
    },
    aiPolicy: {
      enabled: country.aiPolicy.enabled,
      responsiveness: country.aiPolicy.responsiveness,
      targetHappiness: country.aiPolicy.targetHappiness,
      targetDebtRatio: country.aiPolicy.targetDebtRatio,
    },
    resources: {
      food: { ...country.resources.food },
      energy: { ...country.resources.energy },
      materials: { ...country.resources.materials },
    },
  };
}

function cloneConfig(config: SimulationConfig): SimulationConfig {
  return {
    ...config,
    initialState: {
      countries: config.initialState.countries.map((country) =>
        cloneCountry(country, country.id, country.name)
      ),
    },
  };
}

function createScenarioSlot(seedOffset = 0): ScenarioSlot {
  const config = createDefaultConfig();
  return {
    config: {
      ...config,
      seed: config.seed + seedOffset,
    },
    selectedCountryId: config.initialState.countries[0].id,
  };
}

function formatEventType(type: string): string {
  return type
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeSectorAllocation(allocation: {
  agriculture: number;
  industry: number;
  services: number;
}) {
  const total = allocation.agriculture + allocation.industry + allocation.services;
  if (total <= 0) {
    return { agriculture: 0.35, industry: 0.35, services: 0.3 };
  }
  return {
    agriculture: allocation.agriculture / total,
    industry: allocation.industry / total,
    services: allocation.services / total,
  };
}

function summarizeResult(result: SimulationResult | null): ScenarioSummary | null {
  if (!result) return null;

  const finalStep = result.history[result.history.length - 1];
  if (!finalStep) return null;

  const finalCountries = finalStep.countries;
  const population = finalCountries.reduce((sum, c) => sum + c.population, 0);
  const wealth = finalCountries.reduce((sum, c) => sum + c.wealth, 0);
  const happiness =
    finalCountries.length > 0
      ? finalCountries.reduce((sum, c) => sum + c.happiness, 0) / finalCountries.length
      : 0;
  const infrastructure =
    finalCountries.length > 0
      ? finalCountries.reduce((sum, c) => sum + c.infrastructure, 0) / finalCountries.length
      : 0;
  const debt = finalCountries.reduce((sum, c) => sum + c.debt, 0);
  const averageInflation =
    finalCountries.length > 0
      ? finalCountries.reduce((sum, c) => sum + c.inflationRate, 0) / finalCountries.length
      : 0;
  const tradeVolume = finalCountries.reduce(
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
  const countriesWithWarnings = finalCountries.filter((c) => c.warnings.length > 0).length;
  const totalWarnings = finalCountries.reduce((sum, c) => sum + c.warnings.length, 0);
  const eventCount = result.history.reduce((sum, step) => sum + step.events.length, 0);
  const migrationFlow = finalCountries.reduce((sum, c) => sum + c.migrationIn + c.migrationOut, 0);
  const collapsedCountries = finalCountries.filter((c) => c.status === "collapsed").length;
  const stressedCountries = finalCountries.filter((c) => c.status === "stressed").length;

  const topCountryByWealth =
    [...finalCountries].sort((a, b) => b.wealth - a.wealth)[0] ?? null;
  const worstCountryByHappiness =
    [...finalCountries].sort((a, b) => a.happiness - b.happiness)[0] ?? null;
  const mostDependentCountry =
    [...finalCountries].sort((a, b) => b.dependencyShare - a.dependencyShare)[0] ?? null;

  return {
    population,
    wealth,
    happiness,
    infrastructure,
    debt,
    averageInflation,
    tradeVolume,
    countriesWithWarnings,
    totalWarnings,
    eventCount,
    migrationFlow,
    collapsedCountries,
    stressedCountries,
    topCountryByWealth,
    worstCountryByHappiness,
    mostDependentCountry,
    finalCountries,
  };
}

function computeScenarioScore(summary: ScenarioSummary): number {
  const wealthScore = clamp(summary.wealth / 12000, 0, 30);
  const happinessScore = clamp(summary.happiness * 0.35, 0, 35);
  const infrastructureScore = clamp(summary.infrastructure * 8, 0, 16);
  const sufficiencyScore = clamp(
    (summary.tradeVolume / Math.max(summary.population, 1)) * 0.12,
    0,
    10
  );
  const debtPenalty = clamp((summary.debt / Math.max(summary.wealth + 1, 1)) * 22, 0, 20);
  const inflationPenalty = clamp(summary.averageInflation * 260, 0, 16);
  const warningPenalty = clamp(summary.totalWarnings * 1.4, 0, 18);
  const collapsePenalty = summary.collapsedCountries * 12;

  return clamp(
    wealthScore +
      happinessScore +
      infrastructureScore +
      sufficiencyScore -
      debtPenalty -
      inflationPenalty -
      warningPenalty -
      collapsePenalty,
    0,
    100
  );
}

function buildPolicySuggestions(summary: ScenarioSummary | null): string[] {
  if (!summary) return [];

  const suggestions: string[] = [];

  if (summary.averageInflation > 0.08) {
    suggestions.push("Inflation is high. Try lower subsidies, lower event volatility, or stronger production investment.");
  }
  if (summary.debt > summary.wealth * 0.9) {
    suggestions.push("Debt is heavy relative to wealth. Reduce spending or use a lower target debt ratio for AI policy.");
  }
  if (summary.happiness < 55) {
    suggestions.push("Happiness is weak. Increase public spending, improve resource sufficiency, or reduce trade barriers.");
  }
  if (summary.tradeVolume < summary.population * 0.55) {
    suggestions.push("Trade volume is low. Lower friction, tariffs, or country-level barriers to make networks more active.");
  }
  if (summary.collapsedCountries > 0 || summary.stressedCountries > 0) {
    suggestions.push("Some countries are stressed or collapsed. Check resource shortages and excessive dependency on one partner.");
  }
  if (summary.mostDependentCountry && summary.mostDependentCountry.dependencyShare > 0.45) {
    suggestions.push(`${summary.mostDependentCountry.countryName} is highly dependent on ${summary.mostDependentCountry.dependencyPartnerName ?? "one partner"}. Add more preferred partners or boost domestic production.`);
  }

  if (suggestions.length === 0) {
    suggestions.push("This scenario looks stable. Try a crisis preset or higher event chance to stress-test it.");
  }

  return suggestions;
}

function scenarioStatus(score: number): string {
  if (score >= 75) return "Stable";
  if (score >= 50) return "Mixed";
  if (score >= 25) return "Fragile";
  return "Stressed";
}

function deltaClass(value: number): string {
  return value > 0 ? "delta up" : value < 0 ? "delta down" : "delta neutral";
}

export default function App() {
  const [scenarios, setScenarios] = useState<Record<ScenarioKey, ScenarioSlot>>(() => ({
    A: createScenarioSlot(0),
    B: createScenarioSlot(1337),
  }));
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>("A");
  const [metric, setMetric] = useState<WorldMetric>("population");
  const [countrySearch, setCountrySearch] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const activeSlot = scenarios[activeScenario];
  const otherScenario: ScenarioKey = activeScenario === "A" ? "B" : "A";
  const activeConfig = activeSlot.config;

  const results = useMemo(
    () => ({
      A: simulateEconomy(scenarios.A.config),
      B: simulateEconomy(scenarios.B.config),
    }),
    [scenarios.A.config, scenarios.B.config]
  );

  const summaryA = useMemo(() => summarizeResult(results.A), [results.A]);
  const summaryB = useMemo(() => summarizeResult(results.B), [results.B]);

  const activeResult = results[activeScenario];
  const activeSummary = activeScenario === "A" ? summaryA : summaryB;
  const comparisonSummary = activeScenario === "A" ? summaryB : summaryA;

  const activeScore = activeSummary ? computeScenarioScore(activeSummary) : 0;
  const activeStatus = activeSummary ? scenarioStatus(activeScore) : "—";
  const policySuggestions = useMemo(() => buildPolicySuggestions(activeSummary), [activeSummary]);

  const selectedCountry = useMemo(() => {
    const fallbackId = activeConfig.initialState.countries[0]?.id ?? "";
    const effectiveId = activeConfig.initialState.countries.some(
      (country) => country.id === activeSlot.selectedCountryId
    )
      ? activeSlot.selectedCountryId
      : fallbackId;

    return (
      activeConfig.initialState.countries.find((country) => country.id === effectiveId) ??
      activeConfig.initialState.countries[0]
    );
  }, [activeConfig.initialState.countries, activeSlot.selectedCountryId]);

  const effectiveSelectedCountryId = selectedCountry?.id ?? "";

  const visibleCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    const countries = activeConfig.initialState.countries;

    if (!query) return countries;

    return countries.filter(
      (country) =>
        country.name.toLowerCase().includes(query) ||
        country.id.toLowerCase().includes(query)
    );
  }, [activeConfig.initialState.countries, countrySearch]);

  const countryStatusById = useMemo(() => {
    const activeFinalCountries = activeSummary?.finalCountries ?? [];
    return new Map(activeFinalCountries.map((country) => [country.countryId, country.status] as const));
  }, [activeSummary]);

  const topRoutes = useMemo(() => {
    const routes = activeResult.history[activeResult.history.length - 1]?.routes ?? [];
    return [...routes].sort((a, b) => b.delivered - a.delivered).slice(0, 10);
  }, [activeResult]);

  const recentEvents = useMemo(() => {
    const events = activeResult.history.flatMap((step) => step.events);
    return events.slice(-10);
  }, [activeResult]);

  const recentInsights = useMemo(() => {
    const insights = activeResult.history.flatMap((step) => step.insights);
    return insights.slice(-12);
  }, [activeResult]);

  const countryComparisonRows = useMemo(() => {
    const aRows = summaryA?.finalCountries ?? [];
    const bMap = new Map((summaryB?.finalCountries ?? []).map((row) => [row.countryId, row]));

    return aRows.flatMap((a) => {
      const b = bMap.get(a.countryId);
      if (!b) return [];

      return [
        {
          id: a.countryId,
          name: a.countryName,
          wealthA: a.wealth,
          wealthB: b.wealth,
          happinessA: a.happiness,
          happinessB: b.happiness,
          debtA: a.debt,
          debtB: b.debt,
          inflationA: a.inflationRate,
          inflationB: b.inflationRate,
          sufficiencyA: a.averageSufficiency,
          sufficiencyB: b.averageSufficiency,
          netTradeA: a.netTrade,
          netTradeB: b.netTrade,
          migrationA: a.netMigration,
          migrationB: b.netMigration,
        },
      ];
    });
  }, [summaryA, summaryB]);

  const comparisonRows = [
    {
      label: "World population",
      a: summaryA?.population ?? 0,
      b: summaryB?.population ?? 0,
      format: (n: number) => Math.round(n).toLocaleString(),
    },
    {
      label: "Average happiness",
      a: summaryA?.happiness ?? 0,
      b: summaryB?.happiness ?? 0,
      format: (n: number) => n.toFixed(1),
    },
    {
      label: "World wealth",
      a: summaryA?.wealth ?? 0,
      b: summaryB?.wealth ?? 0,
      format: money,
    },
    {
      label: "Total debt",
      a: summaryA?.debt ?? 0,
      b: summaryB?.debt ?? 0,
      format: money,
    },
    {
      label: "Average inflation",
      a: summaryA?.averageInflation ?? 0,
      b: summaryB?.averageInflation ?? 0,
      format: pct,
    },
    {
      label: "Average infrastructure",
      a: summaryA?.infrastructure ?? 0,
      b: summaryB?.infrastructure ?? 0,
      format: (n: number) => n.toFixed(2),
    },
    {
      label: "Trade volume",
      a: summaryA?.tradeVolume ?? 0,
      b: summaryB?.tradeVolume ?? 0,
      format: (n: number) => n.toFixed(1),
    },
    {
      label: "Migration flow",
      a: summaryA?.migrationFlow ?? 0,
      b: summaryB?.migrationFlow ?? 0,
      format: (n: number) => Math.round(n).toLocaleString(),
    },
    {
      label: "Collapsed countries",
      a: summaryA?.collapsedCountries ?? 0,
      b: summaryB?.collapsedCountries ?? 0,
      format: (n: number) => Math.round(n).toString(),
    },
    {
      label: "Events",
      a: summaryA?.eventCount ?? 0,
      b: summaryB?.eventCount ?? 0,
      format: (n: number) => Math.round(n).toString(),
    },
  ];

  function updateScenarioConfig(
    key: ScenarioKey,
    updater: (prev: SimulationConfig) => SimulationConfig
  ) {
    setScenarios((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        config: updater(prev[key].config),
      },
    }));
  }

  function updateSelectedCountryId(key: ScenarioKey, id: string) {
    setScenarios((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        selectedCountryId: id,
      },
    }));
  }

  function updateActiveWorldNumberField(
    field:
      | "steps"
      | "taxRate"
      | "tradeFriction"
      | "eventChance"
      | "seed"
      | "migrationSensitivity"
      | "interestRate"
      | "priceFlexibility",
    value: number
  ) {
    updateScenarioConfig(activeScenario, (prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function updateActiveWorldToggle(field: "enableEvents", value: boolean) {
    updateScenarioConfig(activeScenario, (prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function updateActiveCountryField(
    field: "population" | "happiness" | "wealth" | "infrastructure" | "tradeOpenness",
    value: number
  ) {
    if (!selectedCountry) return;

    updateScenarioConfig(activeScenario, (prev) => ({
      ...prev,
      initialState: {
        ...prev.initialState,
        countries: prev.initialState.countries.map((country) =>
          country.id === selectedCountry.id ? { ...country, [field]: value } : country
        ),
      },
    }));
  }

  function updateActivePolicyField(
    field:
      | "incomeTaxRate"
      | "publicSpending"
      | "productionInvestment"
      | "importSubsidyRate",
    value: number
  ) {
    if (!selectedCountry) return;

    updateScenarioConfig(activeScenario, (prev) => ({
      ...prev,
      initialState: {
        ...prev.initialState,
        countries: prev.initialState.countries.map((country) =>
          country.id === selectedCountry.id
            ? {
                ...country,
                policy: {
                  ...country.policy,
                  [field]: value,
                },
              }
            : country
        ),
      },
    }));
  }

  function updateActiveTradePolicyField(
    field: "importTariff" | "tradeBarrier",
    value: number
  ) {
    if (!selectedCountry) return;

    updateScenarioConfig(activeScenario, (prev) => ({
      ...prev,
      initialState: {
        ...prev.initialState,
        countries: prev.initialState.countries.map((country) =>
          country.id === selectedCountry.id
            ? {
                ...country,
                tradePolicy: {
                  ...country.tradePolicy,
                  [field]: value,
                },
              }
            : country
        ),
      },
    }));
  }

  function updateActiveAIPolicy(
    field: "enabled" | "responsiveness" | "targetHappiness" | "targetDebtRatio",
    value: number | boolean
  ) {
    if (!selectedCountry) return;

    updateScenarioConfig(activeScenario, (prev) => ({
      ...prev,
      initialState: {
        ...prev.initialState,
        countries: prev.initialState.countries.map((country) =>
          country.id === selectedCountry.id
            ? {
                ...country,
                aiPolicy: {
                  ...country.aiPolicy,
                  [field]: value,
                },
              }
            : country
        ),
      },
    }));
  }

  function updateActiveName(value: string) {
    if (!selectedCountry) return;

    updateScenarioConfig(activeScenario, (prev) => ({
      ...prev,
      initialState: {
        ...prev.initialState,
        countries: prev.initialState.countries.map((country) =>
          country.id === selectedCountry.id ? { ...country, name: value } : country
        ),
      },
    }));
  }

  function updateActiveResource(
    resource: ResourceKey,
    field: "amount" | "productionRate" | "consumptionRate" | "price",
    value: number
  ) {
    if (!selectedCountry) return;

    updateScenarioConfig(activeScenario, (prev) => ({
      ...prev,
      initialState: {
        ...prev.initialState,
        countries: prev.initialState.countries.map((country) =>
          country.id === selectedCountry.id
            ? {
                ...country,
                resources: {
                  ...country.resources,
                  [resource]: {
                    ...country.resources[resource],
                    [field]: value,
                  },
                },
              }
            : country
        ),
      },
    }));
  }

  function updateActiveLaborParticipation(value: number) {
    if (!selectedCountry) return;

    updateScenarioConfig(activeScenario, (prev) => ({
      ...prev,
      initialState: {
        ...prev.initialState,
        countries: prev.initialState.countries.map((country) =>
          country.id === selectedCountry.id
            ? { ...country, laborParticipation: value }
            : country
        ),
      },
    }));
  }

  function updateActiveLaborAllocation(field: SectorKey, value: number) {
    if (!selectedCountry) return;

    updateScenarioConfig(activeScenario, (prev) => ({
      ...prev,
      initialState: {
        ...prev.initialState,
        countries: prev.initialState.countries.map((country) => {
          if (country.id !== selectedCountry.id) return country;

          const base = country.laborAllocation ?? {
            agriculture: 0.35,
            industry: 0.35,
            services: 0.3,
          };

          const next = normalizeSectorAllocation({
            ...base,
            [field]: value,
          });

          return {
            ...country,
            laborAllocation: next,
          };
        }),
      },
    }));
  }

  function togglePreferredPartner(partnerId: string) {
    if (!selectedCountry) return;

    updateScenarioConfig(activeScenario, (prev) => ({
      ...prev,
      initialState: {
        ...prev.initialState,
        countries: prev.initialState.countries.map((country) => {
          if (country.id !== selectedCountry.id) return country;

          const active = country.tradePolicy.preferredPartners.includes(partnerId);
          return {
            ...country,
            tradePolicy: {
              ...country.tradePolicy,
              preferredPartners: active
                ? country.tradePolicy.preferredPartners.filter((id) => id !== partnerId)
                : [...country.tradePolicy.preferredPartners, partnerId],
            },
          };
        }),
      },
    }));
  }

  function randomizeActiveSeed() {
    updateActiveWorldNumberField("seed", Math.floor(Math.random() * 1_000_000));
  }

  function resetBoth() {
    setScenarios({
      A: createScenarioSlot(0),
      B: createScenarioSlot(1337),
    });
    setActiveScenario("A");
    setCountrySearch("");
  }

  function copyScenario(source: ScenarioKey, target: ScenarioKey) {
    const sourceSlot = scenarios[source];
    setScenarios((prev) => ({
      ...prev,
      [target]: {
        config: cloneConfig(sourceSlot.config),
        selectedCountryId: sourceSlot.selectedCountryId,
      },
    }));
  }

  function swapScenarios() {
    setScenarios((prev) => ({
      A: {
        config: cloneConfig(prev.B.config),
        selectedCountryId: prev.B.selectedCountryId,
      },
      B: {
        config: cloneConfig(prev.A.config),
        selectedCountryId: prev.A.selectedCountryId,
      },
    }));
  }

  function saveToBrowser() {
    localStorage.setItem("world-economy-simulator-scenarios", JSON.stringify(scenarios));
    setSaveStatus("Saved current scenarios to this browser.");
  }

  function loadFromBrowser() {
    const raw = localStorage.getItem("world-economy-simulator-scenarios");
    if (!raw) {
      setSaveStatus("No saved scenario found in this browser.");
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Record<ScenarioKey, ScenarioSlot>;
      if (!parsed.A?.config || !parsed.B?.config) throw new Error("Invalid scenario file");
      setScenarios({ A: parsed.A, B: parsed.B });
      setActiveScenario("A");
      setSaveStatus("Loaded saved scenarios from this browser.");
    } catch {
      setSaveStatus("Saved scenario data could not be loaded.");
    }
  }

  function exportScenarios() {
    const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), scenarios }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "world-economy-scenarios.json";
    link.click();
    URL.revokeObjectURL(url);
    setSaveStatus("Exported scenarios as JSON.");
  }

  function importScenarios(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const next = parsed.scenarios ?? parsed;
        if (!next.A?.config || !next.B?.config) throw new Error("Invalid scenario file");
        setScenarios({ A: next.A, B: next.B });
        setActiveScenario("A");
        setSaveStatus(`Imported ${file.name}.`);
      } catch {
        setSaveStatus("Import failed. Choose a scenario JSON exported by this app.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function applyPolicyPreset(preset: PolicyPresetKey) {
    updateScenarioConfig(activeScenario, (prev) => {
      const countryPolicy = {
        balanced: { incomeTaxRate: 0.08, publicSpending: 28, productionInvestment: 20, importSubsidyRate: 0.06, importTariff: 0.08, tradeBarrier: 0.1 },
        freeTrade: { incomeTaxRate: 0.07, publicSpending: 26, productionInvestment: 22, importSubsidyRate: 0.09, importTariff: 0.02, tradeBarrier: 0.03 },
        protectionist: { incomeTaxRate: 0.11, publicSpending: 24, productionInvestment: 28, importSubsidyRate: 0.02, importTariff: 0.22, tradeBarrier: 0.24 },
        austerity: { incomeTaxRate: 0.14, publicSpending: 16, productionInvestment: 14, importSubsidyRate: 0.01, importTariff: 0.09, tradeBarrier: 0.12 },
        stimulus: { incomeTaxRate: 0.05, publicSpending: 42, productionInvestment: 34, importSubsidyRate: 0.12, importTariff: 0.04, tradeBarrier: 0.06 },
        crisis: { incomeTaxRate: 0.1, publicSpending: 18, productionInvestment: 10, importSubsidyRate: 0.01, importTariff: 0.2, tradeBarrier: 0.3 },
      }[preset];

      return {
        ...prev,
        eventChance: preset === "crisis" ? 0.42 : prev.eventChance,
        tradeFriction: preset === "freeTrade" ? 0.04 : preset === "crisis" ? 0.28 : prev.tradeFriction,
        priceFlexibility: preset === "crisis" ? 1.6 : prev.priceFlexibility,
        initialState: {
          ...prev.initialState,
          countries: prev.initialState.countries.map((country) => ({
            ...country,
            happiness: preset === "crisis" ? clamp(country.happiness - 8, 0, 100) : country.happiness,
            infrastructure: preset === "crisis" ? clamp(country.infrastructure * 0.86, 0.1, 5) : country.infrastructure,
            policy: {
              ...country.policy,
              incomeTaxRate: countryPolicy.incomeTaxRate,
              publicSpending: countryPolicy.publicSpending,
              productionInvestment: countryPolicy.productionInvestment,
              importSubsidyRate: countryPolicy.importSubsidyRate,
            },
            tradePolicy: {
              ...country.tradePolicy,
              importTariff: countryPolicy.importTariff,
              tradeBarrier: countryPolicy.tradeBarrier,
            },
          })),
        },
      };
    });
    setSaveStatus(`Applied ${preset} policy preset to Scenario ${activeScenario}.`);
  }

  function addCountry() {
    const id = crypto.randomUUID();
    const nextCountry = createCountry(id, `Country ${activeConfig.initialState.countries.length + 1}`);

    updateScenarioConfig(activeScenario, (prev) => ({
      ...prev,
      initialState: {
        ...prev.initialState,
        countries: [...prev.initialState.countries, nextCountry],
      },
    }));

    updateSelectedCountryId(activeScenario, id);
  }

  function duplicateSelectedCountry() {
    if (!selectedCountry) return;

    const id = crypto.randomUUID();
    const copy = cloneCountry(selectedCountry, id, `${selectedCountry.name} Copy`);

    updateScenarioConfig(activeScenario, (prev) => ({
      ...prev,
      initialState: {
        ...prev.initialState,
        countries: [...prev.initialState.countries, copy],
      },
    }));

    updateSelectedCountryId(activeScenario, id);
  }

  function removeSelectedCountry() {
    if (!selectedCountry || activeConfig.initialState.countries.length <= 1) return;

    const index = activeConfig.initialState.countries.findIndex(
      (country) => country.id === selectedCountry.id
    );

    const removedId = selectedCountry.id;

    const remaining = activeConfig.initialState.countries
      .filter((country) => country.id !== removedId)
      .map((country) => ({
        ...country,
        tradePolicy: {
          ...country.tradePolicy,
          preferredPartners: country.tradePolicy.preferredPartners.filter((id) => id !== removedId),
        },
      }));

    updateScenarioConfig(activeScenario, (prev) => ({
      ...prev,
      initialState: {
        ...prev.initialState,
        countries: remaining,
      },
    }));

    const nextSelected = remaining[index] ?? remaining[index - 1] ?? remaining[0];
    if (nextSelected) updateSelectedCountryId(activeScenario, nextSelected.id);
  }

  const activeSummaryCards = activeSummary
    ? [
        {
          label: "Stability",
          value: activeStatus,
          detail: `${activeScore.toFixed(0)} / 100`,
        },
        {
          label: "Top wealth",
          value: activeSummary.topCountryByWealth?.countryName ?? "—",
          detail: activeSummary.topCountryByWealth ? money(activeSummary.topCountryByWealth.wealth) : "—",
        },
        {
          label: "Lowest happiness",
          value: activeSummary.worstCountryByHappiness?.countryName ?? "—",
          detail: activeSummary.worstCountryByHappiness
            ? activeSummary.worstCountryByHappiness.happiness.toFixed(1)
            : "—",
        },
        {
          label: "Most dependent",
          value: activeSummary.mostDependentCountry?.countryName ?? "—",
          detail: activeSummary.mostDependentCountry
            ? `${activeSummary.mostDependentCountry.dependencyPartnerName ?? "—"} (${pct(
                activeSummary.mostDependentCountry.dependencyShare
              )})`
            : "—",
        },
      ]
    : [];

  const selectedRuntimeStatus = selectedCountry
    ? countryStatusById.get(selectedCountry.id) ?? "active"
    : undefined;

  return (
    <div className="app-shell">
      <header className="hero card hero-card">
        <div className="hero-copy">
          <span className="eyebrow">Macroeconomic command center</span>
          <h1><span className="gradient-text">Game Economy</span> Simulator</h1>
          <p className="muted">
            A world-scale economy sandbox with trade, policy, shocks, debt, migration, AI policy, and scenario comparison.
          </p>
          {activeSummary && (
            <div className="hero-metrics">
              <div className="score-orb" aria-label={`Scenario score ${activeScore.toFixed(0)} out of 100`}>
                <strong>{activeScore.toFixed(0)}</strong>
                <span>/100</span>
              </div>
              <div className="status-strip">
                <span className="status-chip">Scenario {activeScenario}</span>
                <span className="status-chip">{activeStatus}</span>
                <span className="status-chip">{activeSummary.finalCountries.length} countries</span>
                <span className="status-chip">{activeSummary.eventCount} events</span>
              </div>
            </div>
          )}
        </div>

        <div className="hero-actions">
          <button
            onClick={() => setActiveScenario("A")}
            className={activeScenario === "A" ? "secondary active" : "secondary"}
          >
            Edit Scenario A
          </button>
          <button
            onClick={() => setActiveScenario("B")}
            className={activeScenario === "B" ? "secondary active" : "secondary"}
          >
            Edit Scenario B
          </button>

          <button onClick={() => copyScenario(activeScenario, otherScenario)}>
            Copy to other
          </button>
          <button className="secondary" onClick={swapScenarios}>
            Swap scenarios
          </button>
          <button className="secondary" onClick={randomizeActiveSeed}>
            Randomize seed
          </button>
          <button className="secondary" onClick={resetBoth}>
            Reset both
          </button>
          <button className="secondary" onClick={saveToBrowser}>
            Save
          </button>
          <button className="secondary" onClick={loadFromBrowser}>
            Load
          </button>
          <button className="secondary" onClick={exportScenarios}>
            Export JSON
          </button>
          <button className="secondary" onClick={() => importInputRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={importInputRef}
            className="hidden-file-input"
            type="file"
            accept="application/json,.json"
            onChange={importScenarios}
          />
        </div>
      </header>

      <main className="dashboard">
        <aside className="sidebar">
          <section className="card">
            <div className="section-head">
              <h2>Active scenario</h2>
              <p className="muted">You are editing Scenario {activeScenario}.</p>
            </div>

            <div className="scenario-tabs">
              <button
                className={activeScenario === "A" ? "active" : ""}
                onClick={() => setActiveScenario("A")}
              >
                Scenario A
              </button>
              <button
                className={activeScenario === "B" ? "active" : ""}
                onClick={() => setActiveScenario("B")}
              >
                Scenario B
              </button>
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <h2>World settings</h2>
              <p className="muted">Shared rules and event settings.</p>
            </div>

            <NumberControl
              label="Steps"
              value={activeConfig.steps}
              min={1}
              max={200}
              step={1}
              onChange={(value) => updateActiveWorldNumberField("steps", value)}
            />

            <NumberControl
              label="Base tax rate"
              value={activeConfig.taxRate}
              min={0}
              max={1}
              step={0.01}
              onChange={(value) => updateActiveWorldNumberField("taxRate", value)}
            />

            <NumberControl
              label="Trade friction"
              value={activeConfig.tradeFriction}
              min={0}
              max={0.4}
              step={0.01}
              onChange={(value) => updateActiveWorldNumberField("tradeFriction", value)}
            />

            <div className="divider" />

            <label className="toggle toggle-block">
              <input
                type="checkbox"
                checked={activeConfig.enableEvents}
                onChange={(e) => updateActiveWorldToggle("enableEvents", e.target.checked)}
              />
              Enable events
            </label>

            <NumberControl
              label="Event chance"
              value={activeConfig.eventChance}
              min={0}
              max={0.5}
              step={0.01}
              onChange={(value) => updateActiveWorldNumberField("eventChance", value)}
            />

            <NumberControl
              label="Seed"
              value={activeConfig.seed}
              min={1}
              max={9999999}
              step={1}
              onChange={(value) => updateActiveWorldNumberField("seed", value)}
            />

            <NumberControl
              label="Migration sensitivity"
              value={activeConfig.migrationSensitivity}
              min={0}
              max={2}
              step={0.05}
              onChange={(value) => updateActiveWorldNumberField("migrationSensitivity", value)}
            />

            <NumberControl
              label="Interest rate"
              value={activeConfig.interestRate}
              min={0}
              max={0.1}
              step={0.005}
              onChange={(value) => updateActiveWorldNumberField("interestRate", value)}
            />

            <NumberControl
              label="Price flexibility"
              value={activeConfig.priceFlexibility}
              min={0.2}
              max={2}
              step={0.05}
              onChange={(value) => updateActiveWorldNumberField("priceFlexibility", value)}
            />
          </section>

          <section className="card">
            <div className="section-head">
              <h2>Policy presets</h2>
              <p className="muted">Apply quick world strategies to Scenario {activeScenario}.</p>
            </div>

            <div className="preset-grid">
              <button onClick={() => applyPolicyPreset("balanced")}>Balanced</button>
              <button onClick={() => applyPolicyPreset("freeTrade")}>Free trade</button>
              <button onClick={() => applyPolicyPreset("protectionist")}>Protectionist</button>
              <button onClick={() => applyPolicyPreset("austerity")}>Austerity</button>
              <button onClick={() => applyPolicyPreset("stimulus")}>Stimulus</button>
              <button onClick={() => applyPolicyPreset("crisis")}>Crisis test</button>
            </div>
            {saveStatus && <p className="save-status">{saveStatus}</p>}
          </section>

          <section className="card">
            <div className="section-head">
              <h2>Countries</h2>
              <p className="muted">Select one to edit its economy.</p>
            </div>

            <label className="country-search">
              <span className="muted">Search</span>
              <input
                type="text"
                value={countrySearch}
                placeholder="Filter countries"
                onChange={(e) => setCountrySearch(e.target.value)}
              />
            </label>

            <div className="inline-actions">
              <button onClick={addCountry}>Add country</button>
              <button className="secondary" onClick={duplicateSelectedCountry}>
                Duplicate
              </button>
              <button className="secondary" onClick={removeSelectedCountry}>
                Remove
              </button>
            </div>

            <div className="country-roster">
              {visibleCountries.length > 0 ? (
                visibleCountries.map((country) => {
                  const runtimeStatus = countryStatusById.get(country.id) ?? "active";
                  return (
                    <button
                      key={country.id}
                      className={`country-chip ${
                        effectiveSelectedCountryId === country.id ? "active" : ""
                      }`}
                      onClick={() => updateSelectedCountryId(activeScenario, country.id)}
                    >
                      <strong>{country.name}</strong>
                      <span>{country.population.toLocaleString()} people</span>
                      <span className={`status-inline ${runtimeStatus}`}>{runtimeStatus}</span>
                    </button>
                  );
                })
              ) : (
                <p className="muted">No countries match that search.</p>
              )}
            </div>
          </section>
        </aside>

        <section className="content">
          {selectedCountry && (
            <CountryEditor
              country={selectedCountry}
              countries={activeConfig.initialState.countries}
              runtimeStatus={selectedRuntimeStatus}
              onNameChange={updateActiveName}
              onFieldChange={updateActiveCountryField}
              onPolicyChange={updateActivePolicyField}
              onTradePolicyChange={updateActiveTradePolicyField}
              onResourceChange={updateActiveResource}
              onTogglePreferredPartner={togglePreferredPartner}
              onLaborParticipationChange={updateActiveLaborParticipation}
              onLaborAllocationChange={updateActiveLaborAllocation}
              onAIPolicyChange={updateActiveAIPolicy}
            />
          )}

          <section className="card">
            <div className="section-head">
              <h2>Overview</h2>
              <p className="muted">High-level health of the active scenario.</p>
            </div>

            <div className="summary-grid global-summary-grid">
              <div className="card stat-card nested">
                <span className="muted">World population</span>
                <strong>{activeSummary ? Math.round(activeSummary.population).toLocaleString() : "—"}</strong>
              </div>
              <div className="card stat-card nested">
                <span className="muted">Average happiness</span>
                <strong>{activeSummary ? activeSummary.happiness.toFixed(1) : "—"}</strong>
              </div>
              <div className="card stat-card nested">
                <span className="muted">World wealth</span>
                <strong>{activeSummary ? money(activeSummary.wealth) : "—"}</strong>
              </div>
              <div className="card stat-card nested">
                <span className="muted">Total debt</span>
                <strong>{activeSummary ? money(activeSummary.debt) : "—"}</strong>
              </div>
              <div className="card stat-card nested">
                <span className="muted">Average inflation</span>
                <strong>{activeSummary ? pct(activeSummary.averageInflation) : "—"}</strong>
              </div>
              <div className="card stat-card nested">
                <span className="muted">Trade volume</span>
                <strong>{activeSummary ? activeSummary.tradeVolume.toFixed(1) : "—"}</strong>
              </div>
              <div className="card stat-card nested">
                <span className="muted">Collapsed countries</span>
                <strong>{activeSummary ? activeSummary.collapsedCountries.toString() : "—"}</strong>
              </div>
              <div className="card stat-card nested">
                <span className="muted">Events</span>
                <strong>{activeSummary ? activeSummary.eventCount.toString() : "—"}</strong>
              </div>
            </div>

            <div className="insight-grid">
              {activeSummaryCards.map((card) => (
                <div className="card nested insight-card" key={card.label}>
                  <span className="muted">{card.label}</span>
                  <strong>{card.value}</strong>
                  <p>{card.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <h2>Insights</h2>
              <p className="muted">Auto-generated explanations from the latest run.</p>
            </div>

            {recentInsights.length > 0 ? (
              <div className="insight-feed">
                {recentInsights.map((insight, index) => (
                  <div
                    key={`${insight.step}-${insight.title}-${index}`}
                    className={`insight-item ${insight.severity}`}
                  >
                    <strong>
                      {insight.countryName ? `${insight.countryName}: ` : ""}
                      {insight.title}
                    </strong>
                    <p>{insight.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No insights yet. Run the simulation to generate them.</p>
            )}
          </section>


          <section className="card">
            <div className="section-head">
              <h2>Policy advisor</h2>
              <p className="muted">Actionable recommendations based on the active scenario's final state.</p>
            </div>

            <div className="advisor-list">
              {policySuggestions.map((suggestion) => (
                <div className="advisor-item" key={suggestion}>{suggestion}</div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <h2>Scenario comparison</h2>
              <p className="muted">
                Side-by-side outcomes for both worlds.
                {comparisonSummary
                  ? " Use the shared metric charts and delta table to spot differences quickly."
                  : ""}
              </p>
            </div>

            <div className="comparison-grid">
              <div className="card nested scenario-panel">
                <div className="scenario-panel-head">
                  <h3>Scenario A</h3>
                  <button className="secondary" onClick={() => setActiveScenario("A")}>
                    Edit
                  </button>
                </div>
                <div className="comparison-summary-mini">
                  <span>Population: {summaryA ? Math.round(summaryA.population).toLocaleString() : "—"}</span>
                  <span>Happiness: {summaryA ? summaryA.happiness.toFixed(1) : "—"}</span>
                  <span>Wealth: {summaryA ? money(summaryA.wealth) : "—"}</span>
                  <span>Debt: {summaryA ? money(summaryA.debt) : "—"}</span>
                </div>
                <WorldTrendChart result={results.A} metric={metric} />
              </div>

              <div className="card nested scenario-panel">
                <div className="scenario-panel-head">
                  <h3>Scenario B</h3>
                  <button className="secondary" onClick={() => setActiveScenario("B")}>
                    Edit
                  </button>
                </div>
                <div className="comparison-summary-mini">
                  <span>Population: {summaryB ? Math.round(summaryB.population).toLocaleString() : "—"}</span>
                  <span>Happiness: {summaryB ? summaryB.happiness.toFixed(1) : "—"}</span>
                  <span>Wealth: {summaryB ? money(summaryB.wealth) : "—"}</span>
                  <span>Debt: {summaryB ? money(summaryB.debt) : "—"}</span>
                </div>
                <WorldTrendChart result={results.B} metric={metric} />
              </div>
            </div>

            <div className="metric-tabs">
              <button
                className={metric === "population" ? "active" : ""}
                onClick={() => setMetric("population")}
              >
                Population
              </button>
              <button
                className={metric === "happiness" ? "active" : ""}
                onClick={() => setMetric("happiness")}
              >
                Happiness
              </button>
              <button
                className={metric === "wealth" ? "active" : ""}
                onClick={() => setMetric("wealth")}
              >
                Wealth
              </button>
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <h2>Side-by-side summary</h2>
              <p className="muted">The delta column shows Scenario B minus Scenario A.</p>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Scenario A</th>
                    <th>Scenario B</th>
                    <th>Delta (B - A)</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => {
                    const delta = row.b - row.a;
                    return (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        <td>{row.format(row.a)}</td>
                        <td>{row.format(row.b)}</td>
                        <td className={deltaClass(delta)}>{signedNumber(delta, row.format)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="comparison-note">
              Lower values are usually better for debt, inflation, and warnings. Higher values are usually better for wealth,
              happiness, population, infrastructure, sufficiency, and trade volume.
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <h2>Country-by-country comparison</h2>
              <p className="muted">Matching countries are compared across both worlds.</p>
            </div>

            {countryComparisonRows.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Country</th>
                      <th>Wealth A</th>
                      <th>Wealth B</th>
                      <th>Δ Wealth</th>
                      <th>Happiness A</th>
                      <th>Happiness B</th>
                      <th>Δ Happiness</th>
                      <th>Debt A</th>
                      <th>Debt B</th>
                      <th>Δ Debt</th>
                      <th>Inflation A</th>
                      <th>Inflation B</th>
                      <th>Δ Inflation</th>
                      <th>Sufficiency A</th>
                      <th>Sufficiency B</th>
                      <th>Δ Sufficiency</th>
                      <th>Net trade A</th>
                      <th>Net trade B</th>
                      <th>Δ Net trade</th>
                      <th>Migration A</th>
                      <th>Migration B</th>
                      <th>Δ Migration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countryComparisonRows.map((row) => {
                      const deltaWealth = row.wealthB - row.wealthA;
                      const deltaHappiness = row.happinessB - row.happinessA;
                      const deltaDebt = row.debtB - row.debtA;
                      const deltaInflation = row.inflationB - row.inflationA;
                      const deltaSufficiency = row.sufficiencyB - row.sufficiencyA;
                      const deltaNetTrade = row.netTradeB - row.netTradeA;
                      const deltaMigration = row.migrationB - row.migrationA;

                      return (
                        <tr key={row.id}>
                          <td>{row.name}</td>
                          <td>{money(row.wealthA)}</td>
                          <td>{money(row.wealthB)}</td>
                          <td className={deltaClass(deltaWealth)}>{signedNumber(deltaWealth, money)}</td>
                          <td>{row.happinessA.toFixed(1)}</td>
                          <td>{row.happinessB.toFixed(1)}</td>
                          <td className={deltaClass(deltaHappiness)}>
                            {signedNumber(deltaHappiness, (n) => n.toFixed(1))}
                          </td>
                          <td>{money(row.debtA)}</td>
                          <td>{money(row.debtB)}</td>
                          <td className={deltaClass(deltaDebt)}>{signedNumber(deltaDebt, money)}</td>
                          <td>{pct(row.inflationA)}</td>
                          <td>{pct(row.inflationB)}</td>
                          <td className={deltaClass(deltaInflation)}>{signedNumber(deltaInflation, pct)}</td>
                          <td>{pct(row.sufficiencyA)}</td>
                          <td>{pct(row.sufficiencyB)}</td>
                          <td className={deltaClass(deltaSufficiency)}>{signedNumber(deltaSufficiency, pct)}</td>
                          <td>{money(row.netTradeA)}</td>
                          <td>{money(row.netTradeB)}</td>
                          <td className={deltaClass(deltaNetTrade)}>{signedNumber(deltaNetTrade, money)}</td>
                          <td>{row.migrationA.toLocaleString()}</td>
                          <td>{row.migrationB.toLocaleString()}</td>
                          <td className={deltaClass(deltaMigration)}>
                            {signedNumber(deltaMigration, (n) => Math.round(n).toLocaleString())}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">Copy one scenario into the other to compare matching countries.</p>
            )}
          </section>

          <section className="card">
            <div className="section-head">
              <h2>Latest events</h2>
              <p className="muted">Recent shocks from the active world.</p>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Step</th>
                    <th>Type</th>
                    <th>Countries</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.length > 0 ? (
                    recentEvents.map((event, index) => (
                      <tr key={`${event.step}-${event.type}-${index}`}>
                        <td>{event.step}</td>
                        <td>{formatEventType(event.type)}</td>
                        <td>{event.countryNames.length > 0 ? event.countryNames.join(" / ") : "Global"}</td>
                        <td>{event.description}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="muted">
                        No recent events in this scenario.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <h2>Active scenario trade routes</h2>
              <p className="muted">Largest shipments in the last step of the active scenario.</p>
            </div>

            {topRoutes.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>From</th>
                      <th>To</th>
                      <th>Resource</th>
                      <th>Shipped</th>
                      <th>Delivered</th>
                      <th>Efficiency</th>
                      <th>Tariff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topRoutes.map((route, index) => (
                      <tr key={`${route.fromCountryId}-${route.toCountryId}-${route.resource}-${index}`}>
                        <td>{route.fromCountryName}</td>
                        <td>{route.toCountryName}</td>
                        <td>{route.resource.toUpperCase()}</td>
                        <td>{route.shipped.toFixed(1)}</td>
                        <td>{route.delivered.toFixed(1)}</td>
                        <td>{pct(route.routeEfficiency)}</td>
                        <td>{pct(route.tariff)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">Run the active scenario to see routes.</p>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
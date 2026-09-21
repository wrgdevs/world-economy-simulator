import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import { GlobalTelemetry } from "./components/GlobalTelemetry";
import { WorldNetworkView } from "./components/WorldNetworkView";
import { TimelineBar } from "./components/TimelineBar";
import { CountryPanel, type CountryTabKey } from "./components/CountryPanel";
import { TrendsView } from "./components/TrendsView";
import { CompareView } from "./components/CompareView";
import { NumberControl } from "./components/NumberControl";
import {
  createCountry,
  createDefaultConfig,
  normalizeSimulationConfig,
} from "./simulation/presets";
import { simulateEconomy } from "./simulation/engine";
import type {
  CountryState,
  CountryStepRecord,
  EventRecord,
  ResourceKey,
  SectorKey,
  SimulationConfig,
  SimulationResult,
} from "./simulation/types";

type ScenarioKey = "A" | "B";
type ViewMode = "world" | "trends" | "compare";
type PolicyPresetKey =
  | "balanced"
  | "freeTrade"
  | "protectionist"
  | "austerity"
  | "stimulus"
  | "crisis";

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
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value < 0 ? "-" : ""}$${formatted}`;
}

function pct(value: number): string {
  const rounded = Math.abs(value) < 0.0005 ? 0 : value;
  return `${(rounded * 100).toFixed(1)}%`;
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

function normalizeScenarioSlot(value: unknown): ScenarioSlot | null {
  if (typeof value !== "object" || value === null) return null;
  const slot = value as Record<string, unknown>;
  const config = normalizeSimulationConfig(slot.config);
  if (!config) return null;

  const requestedId = typeof slot.selectedCountryId === "string" ? slot.selectedCountryId : "";
  const selectedCountryId = config.initialState.countries.some(
    (country) => country.id === requestedId
  )
    ? requestedId
    : config.initialState.countries[0].id;

  return { config, selectedCountryId };
}

function normalizeScenarios(value: unknown): Record<ScenarioKey, ScenarioSlot> | null {
  if (typeof value !== "object" || value === null) return null;
  const input = value as Record<string, unknown>;
  const scenarioA = normalizeScenarioSlot(input.A);
  const scenarioB = normalizeScenarioSlot(input.B);
  return scenarioA && scenarioB ? { A: scenarioA, B: scenarioB } : null;
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

  const topCountryByWealth = finalCountries.reduce<CountryStepRecord | null>(
    (best, country) => (!best || country.wealth > best.wealth ? country : best),
    null
  );
  const worstCountryByHappiness = finalCountries.reduce<CountryStepRecord | null>(
    (worst, country) => (!worst || country.happiness < worst.happiness ? country : worst),
    null
  );
  const mostDependentCountry = finalCountries.reduce<CountryStepRecord | null>(
    (mostDependent, country) =>
      !mostDependent || country.dependencyShare > mostDependent.dependencyShare
        ? country
        : mostDependent,
    null
  );

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
    suggestions.push(
      "Inflation is elevated. Curtail excess import subsidies or expand production investment."
    );
  }
  if (summary.debt > summary.wealth * 0.9) {
    suggestions.push(
      "Debt exceeds 90% of aggregate wealth. Restrain public spending or lower target debt ratios."
    );
  }
  if (summary.happiness < 55) {
    suggestions.push(
      "Happiness is depressed. Increase public spending, ease trade barriers, and address resource shortages."
    );
  }
  if (summary.tradeVolume < summary.population * 0.55) {
    suggestions.push(
      "Trade volume is stagnant. Lower trade friction and bilateral tariffs to stimulate reciprocal commerce."
    );
  }
  if (summary.collapsedCountries > 0 || summary.stressedCountries > 0) {
    suggestions.push(
      "Economic distress detected. Check critical resource deficits and over-reliance on single trade partners."
    );
  }
  if (summary.mostDependentCountry && summary.mostDependentCountry.dependencyShare > 0.45) {
    suggestions.push(
      `${summary.mostDependentCountry.countryName} is heavily dependent on ${
        summary.mostDependentCountry.dependencyPartnerName ?? "one partner"
      }. Diversify trade partners or reinforce domestic capacity.`
    );
  }

  if (suggestions.length === 0) {
    suggestions.push(
      "The world economic system is stable and balanced. Stress-test it with a Crisis preset or elevated event probability."
    );
  }

  return suggestions;
}

function scenarioStatus(score: number): string {
  if (score >= 75) return "Stable";
  if (score >= 50) return "Mixed";
  if (score >= 25) return "Fragile";
  return "Stressed";
}

export default function App() {
  const initialParams = useMemo(() => {
    if (typeof window === "undefined") return { view: "world" as ViewMode, step: 40, scenario: "A" as ScenarioKey, tab: "policy" as CountryTabKey };
    const params = new URLSearchParams(window.location.search);
    const view = (params.get("view") as ViewMode) || "world";
    const step = params.has("step") ? Number(params.get("step")) : 40;
    const scenario = (params.get("scenario") as ScenarioKey) || "A";
    const tab = (params.get("tab") as CountryTabKey) || "policy";
    return { view, step, scenario, tab };
  }, []);

  const [scenarios, setScenarios] = useState<Record<ScenarioKey, ScenarioSlot>>(() => ({
    A: createScenarioSlot(0),
    B: createScenarioSlot(1337),
  }));
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>(initialParams.scenario);
  const [viewMode, setViewMode] = useState<ViewMode>(initialParams.view);
  const [currentStep, setCurrentStep] = useState<number>(initialParams.step);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const activeSlot = scenarios[activeScenario];
  const otherScenario: ScenarioKey = activeScenario === "A" ? "B" : "A";
  const activeConfig = activeSlot.config;

  // Run deterministic simulations for both slots
  const results = useMemo(
    () => ({
      A: simulateEconomy(scenarios.A.config),
      B: simulateEconomy(scenarios.B.config),
    }),
    [scenarios.A.config, scenarios.B.config]
  );

  const activeResult = results[activeScenario];
  const summaryA = useMemo(() => summarizeResult(results.A), [results.A]);
  const summaryB = useMemo(() => summarizeResult(results.B), [results.B]);

  const activeSummary = activeScenario === "A" ? summaryA : summaryB;
  const activeScore = activeSummary ? computeScenarioScore(activeSummary) : 0;
  const activeStatus = activeSummary ? scenarioStatus(activeScore) : "--";
  const policySuggestions = useMemo(
    () => buildPolicySuggestions(activeSummary),
    [activeSummary]
  );

  // Keep currentStep bounded
  const totalSteps = activeConfig.steps;
  const boundedStep = Math.max(1, Math.min(totalSteps, currentStep));

  // Current active step record
  const currentStepRecord = useMemo(() => {
    if (!activeResult || activeResult.history.length === 0) return null;
    return activeResult.history[boundedStep - 1] ?? null;
  }, [activeResult, boundedStep]);

  // Map of events by step for timeline pins
  const eventsByStep = useMemo(() => {
    const map = new Map<number, EventRecord[]>();
    if (!activeResult) return map;
    for (const stepRec of activeResult.history) {
      if (stepRec.events.length > 0) {
        map.set(stepRec.step, stepRec.events);
      }
    }
    return map;
  }, [activeResult]);

  // Playback timer
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= totalSteps) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 280);

    return () => clearInterval(interval);
  }, [isPlaying, totalSteps]);

  // Selected Country
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

  // Selected Country Step Record
  const selectedCountryStepRecord = useMemo(() => {
    if (!currentStepRecord || !selectedCountry) return undefined;
    return currentStepRecord.countries.find((c) => c.countryId === selectedCountry.id);
  }, [currentStepRecord, selectedCountry]);

  // Comparison Rows
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
      label: "World Population",
      a: summaryA?.population ?? 0,
      b: summaryB?.population ?? 0,
      format: (n: number) => Math.round(n).toLocaleString(),
    },
    {
      label: "World Wealth",
      a: summaryA?.wealth ?? 0,
      b: summaryB?.wealth ?? 0,
      format: money,
    },
    {
      label: "Total Debt",
      a: summaryA?.debt ?? 0,
      b: summaryB?.debt ?? 0,
      format: money,
    },
    {
      label: "Average Happiness",
      a: summaryA?.happiness ?? 0,
      b: summaryB?.happiness ?? 0,
      format: (n: number) => `${n.toFixed(1)}%`,
    },
    {
      label: "Average Inflation",
      a: summaryA?.averageInflation ?? 0,
      b: summaryB?.averageInflation ?? 0,
      format: pct,
    },
    {
      label: "Average Infrastructure",
      a: summaryA?.infrastructure ?? 0,
      b: summaryB?.infrastructure ?? 0,
      format: (n: number) => n.toFixed(2),
    },
    {
      label: "Trade Volume",
      a: summaryA?.tradeVolume ?? 0,
      b: summaryB?.tradeVolume ?? 0,
      format: (n: number) => n.toFixed(1),
    },
    {
      label: "Net Migration Flow",
      a: summaryA?.migrationFlow ?? 0,
      b: summaryB?.migrationFlow ?? 0,
      format: (n: number) => Math.round(n).toLocaleString(),
    },
    {
      label: "Collapsed Economies",
      a: summaryA?.collapsedCountries ?? 0,
      b: summaryB?.collapsedCountries ?? 0,
      format: (n: number) => Math.round(n).toString(),
    },
    {
      label: "Recorded Shocks",
      a: summaryA?.eventCount ?? 0,
      b: summaryB?.eventCount ?? 0,
      format: (n: number) => Math.round(n).toString(),
    },
  ];

  // Updaters
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

  function updateSelectedCountryId(id: string) {
    setScenarios((prev) => ({
      ...prev,
      [activeScenario]: {
        ...prev[activeScenario],
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

  function addCountry() {
    const id = crypto.randomUUID();
    const nextCountry = createCountry(
      id,
      `Country ${activeConfig.initialState.countries.length + 1}`
    );

    updateScenarioConfig(activeScenario, (prev) => ({
      ...prev,
      initialState: {
        ...prev.initialState,
        countries: [...prev.initialState.countries, nextCountry],
      },
    }));

    updateSelectedCountryId(id);
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

    updateSelectedCountryId(id);
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
          preferredPartners: country.tradePolicy.preferredPartners.filter(
            (id) => id !== removedId
          ),
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
    if (nextSelected) updateSelectedCountryId(nextSelected.id);
  }

  function applyPolicyPreset(preset: PolicyPresetKey) {
    updateScenarioConfig(activeScenario, (prev) => {
      const countryPolicy = {
        balanced: {
          incomeTaxRate: 0.08,
          publicSpending: 28,
          productionInvestment: 20,
          importSubsidyRate: 0.06,
          importTariff: 0.08,
          tradeBarrier: 0.1,
        },
        freeTrade: {
          incomeTaxRate: 0.07,
          publicSpending: 26,
          productionInvestment: 22,
          importSubsidyRate: 0.09,
          importTariff: 0.02,
          tradeBarrier: 0.03,
        },
        protectionist: {
          incomeTaxRate: 0.11,
          publicSpending: 24,
          productionInvestment: 28,
          importSubsidyRate: 0.02,
          importTariff: 0.22,
          tradeBarrier: 0.24,
        },
        austerity: {
          incomeTaxRate: 0.14,
          publicSpending: 16,
          productionInvestment: 14,
          importSubsidyRate: 0.01,
          importTariff: 0.09,
          tradeBarrier: 0.12,
        },
        stimulus: {
          incomeTaxRate: 0.05,
          publicSpending: 42,
          productionInvestment: 34,
          importSubsidyRate: 0.12,
          importTariff: 0.04,
          tradeBarrier: 0.06,
        },
        crisis: {
          incomeTaxRate: 0.1,
          publicSpending: 18,
          productionInvestment: 10,
          importSubsidyRate: 0.01,
          importTariff: 0.2,
          tradeBarrier: 0.3,
        },
      }[preset];

      return {
        ...prev,
        eventChance: preset === "crisis" ? 0.42 : prev.eventChance,
        tradeFriction:
          preset === "freeTrade"
            ? 0.04
            : preset === "crisis"
            ? 0.28
            : prev.tradeFriction,
        priceFlexibility: preset === "crisis" ? 1.6 : prev.priceFlexibility,
        initialState: {
          ...prev.initialState,
          countries: prev.initialState.countries.map((country) => ({
            ...country,
            happiness:
              preset === "crisis"
                ? clamp(country.happiness - 8, 0, 100)
                : country.happiness,
            infrastructure:
              preset === "crisis"
                ? clamp(country.infrastructure * 0.86, 0.1, 5)
                : country.infrastructure,
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
    setSaveStatus(`Applied ${preset} preset.`);
    setTimeout(() => setSaveStatus(""), 4000);
  }

  function randomizeActiveSeed() {
    updateActiveWorldNumberField("seed", Math.floor(Math.random() * 1_000_000));
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
    setSaveStatus(`Cloned Scenario ${source} to Scenario ${target}.`);
    setTimeout(() => setSaveStatus(""), 4000);
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
    setSaveStatus("Swapped Scenario A and B.");
    setTimeout(() => setSaveStatus(""), 4000);
  }

  function saveToBrowser() {
    localStorage.setItem("world-economy-simulator-scenarios", JSON.stringify(scenarios));
    setSaveStatus("Saved scenarios to browser.");
    setTimeout(() => setSaveStatus(""), 4000);
  }

  function loadFromBrowser() {
    const raw = localStorage.getItem("world-economy-simulator-scenarios");
    if (!raw) {
      setSaveStatus("No saved scenarios found.");
      setTimeout(() => setSaveStatus(""), 4000);
      return;
    }

    try {
      const parsed = normalizeScenarios(JSON.parse(raw));
      if (!parsed) throw new Error("Invalid format");
      setScenarios(parsed);
      setActiveScenario("A");
      setSaveStatus("Loaded saved scenarios.");
    } catch {
      setSaveStatus("Failed to load scenarios.");
    }
    setTimeout(() => setSaveStatus(""), 4000);
  }

  function exportScenarios() {
    const payload = JSON.stringify(
      { version: 1, exportedAt: new Date().toISOString(), scenarios },
      null,
      2
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "world-economy-scenarios.json";
    link.click();
    URL.revokeObjectURL(url);
    setSaveStatus("Exported scenario JSON.");
    setTimeout(() => setSaveStatus(""), 4000);
  }

  function exportResultsCsv() {
    const finalStep = activeResult.history[activeResult.history.length - 1];
    if (!finalStep) {
      setSaveStatus("No results to export.");
      return;
    }

    const columns = [
      "scenario",
      "step",
      "country",
      "status",
      "population",
      "happiness",
      "wealth",
      "debt",
      "gdp",
      "inflation_rate",
      "resource_sufficiency",
      "net_trade",
      "net_migration",
      "warnings",
    ];
    const escapeCsv = (value: string | number) => {
      const text = String(value);
      return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    };
    const rows = finalStep.countries.map((country) =>
      [
        activeScenario,
        finalStep.step,
        country.countryName,
        country.status,
        country.population,
        country.happiness,
        country.wealth,
        country.debt,
        country.gdp,
        country.inflationRate,
        country.averageSufficiency,
        country.netTrade,
        country.netMigration,
        country.warnings.join("; "),
      ]
        .map(escapeCsv)
        .join(",")
    );
    const csv = [columns.join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `scenario-${activeScenario.toLowerCase()}-results.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setSaveStatus(`Exported Scenario ${activeScenario} CSV.`);
    setTimeout(() => setSaveStatus(""), 4000);
  }

  function importScenarios(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as unknown;
        const envelope =
          typeof parsed === "object" && parsed !== null && "scenarios" in parsed
            ? (parsed as { scenarios: unknown }).scenarios
            : parsed;
        const next = normalizeScenarios(envelope);
        if (!next) throw new Error("Invalid format");
        setScenarios(next);
        setActiveScenario("A");
        setSaveStatus(`Imported ${file.name}.`);
      } catch {
        setSaveStatus("Import failed: invalid JSON file.");
      } finally {
        event.target.value = "";
        setTimeout(() => setSaveStatus(""), 4000);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="sim-app">
      {/* Top Application Header */}
      <header className="app-header">
        <div className="header-brand">
          <svg
            className="brand-icon-svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <span className="brand-title">World Economy Simulator</span>
          <span className="brand-seed" title="Deterministic simulation seed">
            Seed #{activeConfig.seed}
          </span>
        </div>

        {/* Primary View Switcher */}
        <nav className="header-nav">
          <button
            type="button"
            className={`nav-btn ${viewMode === "world" ? "active" : ""}`}
            onClick={() => setViewMode("world")}
          >
            World
          </button>
          <button
            type="button"
            className={`nav-btn ${viewMode === "trends" ? "active" : ""}`}
            onClick={() => setViewMode("trends")}
          >
            Trends
          </button>
          <button
            type="button"
            className={`nav-btn ${viewMode === "compare" ? "active" : ""}`}
            onClick={() => setViewMode("compare")}
          >
            Compare
          </button>
        </nav>

        {/* Scenario Toggle & Settings Trigger */}
        <div className="header-scenario-switch">
          <div className="scenario-pill-group">
            <button
              type="button"
              className={`sc-pill ${activeScenario === "A" ? "active" : ""}`}
              onClick={() => setActiveScenario("A")}
            >
              Scenario A
            </button>
            <button
              type="button"
              className={`sc-pill ${activeScenario === "B" ? "active" : ""}`}
              onClick={() => setActiveScenario("B")}
            >
              Scenario B
            </button>
          </div>

          <button
            type="button"
            className={`btn-settings-toggle ${showSettingsDrawer ? "active" : ""}`}
            onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
            title="Toggle Global Settings & Presets"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Global Presets & System Drawer */}
      {showSettingsDrawer && (
        <div className="system-drawer">
          <div className="drawer-col">
            <div className="drawer-label">Presets (Scenario {activeScenario})</div>
            <div className="preset-bar">
              <button type="button" onClick={() => applyPolicyPreset("balanced")}>
                Balanced
              </button>
              <button type="button" onClick={() => applyPolicyPreset("freeTrade")}>
                Free Trade
              </button>
              <button type="button" onClick={() => applyPolicyPreset("protectionist")}>
                Protectionist
              </button>
              <button type="button" onClick={() => applyPolicyPreset("austerity")}>
                Austerity
              </button>
              <button type="button" onClick={() => applyPolicyPreset("stimulus")}>
                Stimulus
              </button>
              <button type="button" onClick={() => applyPolicyPreset("crisis")}>
                Crisis Test
              </button>
            </div>
          </div>

          <div className="drawer-col">
            <div className="drawer-label">Simulation Parameters</div>
            <div className="drawer-settings-grid">
              <NumberControl
                label="Simulation Steps"
                value={activeConfig.steps}
                min={1}
                max={200}
                step={1}
                onChange={(v) => updateActiveWorldNumberField("steps", v)}
              />
              <NumberControl
                label="Base Tax Rate"
                value={activeConfig.taxRate}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => updateActiveWorldNumberField("taxRate", v)}
              />
              <NumberControl
                label="Trade Friction"
                value={activeConfig.tradeFriction}
                min={0}
                max={0.4}
                step={0.01}
                onChange={(v) => updateActiveWorldNumberField("tradeFriction", v)}
              />
              <NumberControl
                label="Event Probability"
                value={activeConfig.eventChance}
                min={0}
                max={0.5}
                step={0.01}
                onChange={(v) => updateActiveWorldNumberField("eventChance", v)}
              />
              <NumberControl
                label="Migration Sensitivity"
                value={activeConfig.migrationSensitivity}
                min={0}
                max={2}
                step={0.05}
                onChange={(v) => updateActiveWorldNumberField("migrationSensitivity", v)}
              />
              <NumberControl
                label="Price Flexibility"
                value={activeConfig.priceFlexibility}
                min={0.2}
                max={2}
                step={0.05}
                onChange={(v) => updateActiveWorldNumberField("priceFlexibility", v)}
              />
            </div>
            <div className="drawer-toggle-row">
              <label className="checkbox-toggle">
                <input
                  type="checkbox"
                  checked={activeConfig.enableEvents}
                  onChange={(e) => updateActiveWorldToggle("enableEvents", e.target.checked)}
                />
                <span>Enable Events</span>
              </label>
              <button
                type="button"
                className="btn-subtle"
                onClick={randomizeActiveSeed}
              >
                Randomize Seed
              </button>
            </div>
          </div>

          <div className="drawer-col">
            <div className="drawer-label">Data Management</div>
            <div className="drawer-actions">
              <button type="button" className="btn-subtle" onClick={saveToBrowser}>
                Save to Browser
              </button>
              <button type="button" className="btn-subtle" onClick={loadFromBrowser}>
                Load from Browser
              </button>
              <button type="button" className="btn-subtle" onClick={exportScenarios}>
                Export JSON
              </button>
              <button type="button" className="btn-subtle" onClick={exportResultsCsv}>
                Export CSV
              </button>
              <button
                type="button"
                className="btn-subtle"
                onClick={() => importInputRef.current?.click()}
              >
                Import JSON
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={importScenarios}
              />
            </div>
          </div>
        </div>
      )}

      {/* Save / Notification Toast */}
      {saveStatus && <div className="status-toast">{saveStatus}</div>}

      {/* Global Telemetry Ribbon */}
      <GlobalTelemetry
        currentStep={boundedStep}
        totalSteps={totalSteps}
        stepRecord={currentStepRecord}
        activeStatus={activeStatus}
      />

      {/* Main Workspace Body */}
      <main className="sim-workspace">
        {/* VIEW 1: World (Core Triad: Network + Timeline + Selected Country) */}
        {viewMode === "world" && (
          <div className="world-view-grid">
            {/* Left Column: Network Simulation & Timeline Bar */}
            <div className="sim-primary-col">
              <WorldNetworkView
                countries={activeConfig.initialState.countries}
                stepRecord={currentStepRecord}
                selectedCountryId={selectedCountry?.id ?? ""}
                onSelectCountry={updateSelectedCountryId}
              />

              <TimelineBar
                currentStep={boundedStep}
                totalSteps={totalSteps}
                isPlaying={isPlaying}
                onTogglePlay={() => setIsPlaying(!isPlaying)}
                onStepChange={(step) => setCurrentStep(step)}
                onStepDelta={(delta) =>
                  setCurrentStep((prev) => Math.max(1, Math.min(totalSteps, prev + delta)))
                }
                eventsByStep={eventsByStep}
              />

              <div className="step-summary-strip">
                <div className="step-summary-head">
                  <span className="summary-title">Trade Routes</span>
                  <span className="summary-subtitle">Step {boundedStep}</span>
                </div>
                {currentStepRecord && currentStepRecord.routes.length > 0 ? (
                  <div className="step-routes-table-wrap">
                    <table className="analytical-table mini">
                      <thead>
                        <tr>
                          <th>From</th>
                          <th>To</th>
                          <th>Resource</th>
                          <th>Delivered / Shipped</th>
                          <th>Loss</th>
                          <th>Tariff</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentStepRecord.routes.map((r, i) => (
                          <tr key={i}>
                            <td className="country-name-cell">{r.fromCountryName}</td>
                            <td className="country-name-cell">{r.toCountryName}</td>
                            <td>
                              <span className={`res-pill ${r.resource}`}>
                                {r.resource.toUpperCase()}
                              </span>
                            </td>
                            <td className="mono-cell">
                              {r.delivered.toFixed(1)} / {r.shipped.toFixed(1)}
                            </td>
                            <td className="mono-cell">
                              {((1 - r.routeEfficiency) * 100).toFixed(0)}%
                            </td>
                            <td className="mono-cell">{(r.tariff * 100).toFixed(0)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-routes-note">
                    No shipments active at Step {boundedStep}.
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Selected Country Panel */}
            <div className="sim-secondary-col">
              {selectedCountry && (
                <CountryPanel
                  country={selectedCountry}
                  allCountries={activeConfig.initialState.countries}
                  currentRecord={selectedCountryStepRecord}
                  onNameChange={updateActiveName}
                  onFieldChange={updateActiveCountryField}
                  onPolicyChange={updateActivePolicyField}
                  onTradePolicyChange={updateActiveTradePolicyField}
                  onResourceChange={updateActiveResource}
                  onTogglePreferredPartner={togglePreferredPartner}
                  onLaborParticipationChange={updateActiveLaborParticipation}
                  onLaborAllocationChange={updateActiveLaborAllocation}
                  onAIPolicyChange={updateActiveAIPolicy}
                  onAddCountry={addCountry}
                  onDuplicateCountry={duplicateSelectedCountry}
                  onRemoveCountry={removeSelectedCountry}
                  canRemove={activeConfig.initialState.countries.length > 1}
                  initialTab={initialParams.tab}
                />
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: Trends (Economic Trends & Event Log) */}
        {viewMode === "trends" && (
          <TrendsView
            result={activeResult}
            currentStep={boundedStep}
            onJumpToStep={(step) => {
              setCurrentStep(step);
              setViewMode("world");
            }}
            policySuggestions={policySuggestions}
          />
        )}

        {/* VIEW 3: Compare (A/B Scenario Evaluation) */}
        {viewMode === "compare" && (
          <CompareView
            resultA={results.A}
            resultB={results.B}
            comparisonRows={comparisonRows}
            countryComparisonRows={countryComparisonRows}
            onSelectScenario={(s) => setActiveScenario(s)}
            onCopyToOther={() => copyScenario(activeScenario, otherScenario)}
            onSwapScenarios={swapScenarios}
          />
        )}
      </main>
    </div>
  );
}

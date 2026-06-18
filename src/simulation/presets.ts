import type {
  AIPolicy,
  CountryPolicy,
  CountryState,
  ResourceKey,
  ResourceState,
  SectorKey,
  SimulationConfig,
  TradePolicy,
} from "./types";

type CountryOverrides = Partial<
  Omit<
    CountryState,
    "id" | "name" | "resources" | "tradePolicy" | "policy" | "laborAllocation" | "aiPolicy"
  >
> & {
  resources?: Partial<Record<ResourceKey, Partial<ResourceState>>>;
  tradePolicy?: Partial<TradePolicy>;
  policy?: Partial<CountryPolicy>;
  laborAllocation?: Partial<Record<SectorKey, number>>;
  aiPolicy?: Partial<AIPolicy>;
};

const DEFAULT_RESOURCES: Record<ResourceKey, ResourceState> = {
  food: { amount: 1200, productionRate: 30, consumptionRate: 18, price: 2 },
  energy: { amount: 800, productionRate: 20, consumptionRate: 10, price: 3 },
  materials: { amount: 600, productionRate: 15, consumptionRate: 8, price: 4 },
};

const DEFAULT_TRADE_POLICY: TradePolicy = {
  importTariff: 0.08,
  tradeBarrier: 0.1,
  preferredPartners: [],
};

const DEFAULT_POLICY: CountryPolicy = {
  incomeTaxRate: 0.08,
  publicSpending: 25,
  productionInvestment: 18,
  importSubsidyRate: 0.06,
};

const DEFAULT_LABOR_ALLOCATION: Record<SectorKey, number> = {
  agriculture: 0.35,
  industry: 0.35,
  services: 0.3,
};

const DEFAULT_AI_POLICY: AIPolicy = {
  enabled: false,
  responsiveness: 0.55,
  targetHappiness: 65,
  targetDebtRatio: 0.8,
};

function mergeResource(base: ResourceState, override?: Partial<ResourceState>): ResourceState {
  return {
    ...base,
    ...(override ?? {}),
  };
}

function mergeTradePolicy(override?: Partial<TradePolicy>): TradePolicy {
  return {
    importTariff: override?.importTariff ?? DEFAULT_TRADE_POLICY.importTariff,
    tradeBarrier: override?.tradeBarrier ?? DEFAULT_TRADE_POLICY.tradeBarrier,
    preferredPartners: override?.preferredPartners ? [...override.preferredPartners] : [],
  };
}

function mergePolicy(override?: Partial<CountryPolicy>): CountryPolicy {
  return {
    incomeTaxRate: override?.incomeTaxRate ?? DEFAULT_POLICY.incomeTaxRate,
    publicSpending: override?.publicSpending ?? DEFAULT_POLICY.publicSpending,
    productionInvestment:
      override?.productionInvestment ?? DEFAULT_POLICY.productionInvestment,
    importSubsidyRate: override?.importSubsidyRate ?? DEFAULT_POLICY.importSubsidyRate,
  };
}

function mergeLaborAllocation(
  override?: Partial<Record<SectorKey, number>>
): Record<SectorKey, number> {
  return {
    agriculture: override?.agriculture ?? DEFAULT_LABOR_ALLOCATION.agriculture,
    industry: override?.industry ?? DEFAULT_LABOR_ALLOCATION.industry,
    services: override?.services ?? DEFAULT_LABOR_ALLOCATION.services,
  };
}

function mergeAIPolicy(override?: Partial<AIPolicy>): AIPolicy {
  return {
    enabled: override?.enabled ?? DEFAULT_AI_POLICY.enabled,
    responsiveness: override?.responsiveness ?? DEFAULT_AI_POLICY.responsiveness,
    targetHappiness: override?.targetHappiness ?? DEFAULT_AI_POLICY.targetHappiness,
    targetDebtRatio: override?.targetDebtRatio ?? DEFAULT_AI_POLICY.targetDebtRatio,
  };
}

export function createCountry(
  id: string,
  name: string,
  overrides: CountryOverrides = {}
): CountryState {
  return {
    id,
    name,
    population: overrides.population ?? 1000,
    happiness: overrides.happiness ?? 65,
    wealth: overrides.wealth ?? 5000,
    debt: overrides.debt ?? 0,
    status: overrides.status ?? "active",
    infrastructure: overrides.infrastructure ?? 1,
    tradeOpenness: overrides.tradeOpenness ?? 1,
    laborParticipation: overrides.laborParticipation ?? 0.64,
    laborAllocation: mergeLaborAllocation(overrides.laborAllocation),
    tradePolicy: mergeTradePolicy(overrides.tradePolicy),
    policy: mergePolicy(overrides.policy),
    aiPolicy: mergeAIPolicy(overrides.aiPolicy),
    resources: {
      food: mergeResource(DEFAULT_RESOURCES.food, overrides.resources?.food),
      energy: mergeResource(DEFAULT_RESOURCES.energy, overrides.resources?.energy),
      materials: mergeResource(DEFAULT_RESOURCES.materials, overrides.resources?.materials),
    },
  };
}

export function createDefaultConfig(): SimulationConfig {
  return {
    steps: 40,
    taxRate: 0.12,
    tradeFriction: 0.1,
    enableEvents: true,
    eventChance: 0.18,
    seed: 42,
    migrationSensitivity: 1,
    interestRate: 0.02,
    priceFlexibility: 1,
    initialState: {
      countries: [
        createCountry("auroria", "Auroria", {
          population: 1200,
          tradeOpenness: 1.1,
          laborAllocation: { agriculture: 0.42, industry: 0.3, services: 0.28 },
          tradePolicy: {
            importTariff: 0.05,
            tradeBarrier: 0.08,
            preferredPartners: ["borealis", "cascadia"],
          },
          policy: {
            incomeTaxRate: 0.06,
            publicSpending: 35,
            productionInvestment: 24,
            importSubsidyRate: 0.08,
          },
          aiPolicy: {
            enabled: true,
            responsiveness: 0.6,
            targetHappiness: 68,
            targetDebtRatio: 0.75,
          },
          resources: {
            food: { amount: 1400, productionRate: 50, consumptionRate: 16, price: 2 },
            energy: { amount: 700, productionRate: 18, consumptionRate: 12, price: 3 },
            materials: { amount: 500, productionRate: 12, consumptionRate: 8, price: 4 },
          },
        }),
        createCountry("borealis", "Borealis", {
          population: 900,
          tradeOpenness: 1.0,
          laborAllocation: { agriculture: 0.25, industry: 0.43, services: 0.32 },
          tradePolicy: {
            importTariff: 0.1,
            tradeBarrier: 0.12,
            preferredPartners: ["cascadia", "auroria"],
          },
          policy: {
            incomeTaxRate: 0.1,
            publicSpending: 24,
            productionInvestment: 16,
            importSubsidyRate: 0.04,
          },
          aiPolicy: {
            enabled: false,
            responsiveness: 0.5,
            targetHappiness: 60,
            targetDebtRatio: 0.9,
          },
          resources: {
            food: { amount: 700, productionRate: 18, consumptionRate: 17, price: 2 },
            energy: { amount: 1600, productionRate: 55, consumptionRate: 9, price: 3 },
            materials: { amount: 450, productionRate: 14, consumptionRate: 7, price: 4 },
          },
        }),
        createCountry("cascadia", "Cascadia", {
          population: 1100,
          tradeOpenness: 0.95,
          laborAllocation: { agriculture: 0.3, industry: 0.32, services: 0.38 },
          tradePolicy: {
            importTariff: 0.07,
            tradeBarrier: 0.1,
            preferredPartners: ["auroria", "borealis"],
          },
          policy: {
            incomeTaxRate: 0.07,
            publicSpending: 30,
            productionInvestment: 20,
            importSubsidyRate: 0.07,
          },
          aiPolicy: {
            enabled: true,
            responsiveness: 0.45,
            targetHappiness: 64,
            targetDebtRatio: 0.85,
          },
          resources: {
            food: { amount: 850, productionRate: 22, consumptionRate: 18, price: 2 },
            energy: { amount: 650, productionRate: 16, consumptionRate: 11, price: 3 },
            materials: { amount: 1500, productionRate: 48, consumptionRate: 10, price: 4 },
          },
        }),
      ],
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function safeNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

/**
 * Converts untrusted save/import data into a complete, bounded configuration.
 * Returns null when the payload does not contain a usable country list.
 */
export function normalizeSimulationConfig(value: unknown): SimulationConfig | null {
  const input = asRecord(value);
  const initialState = asRecord(input?.initialState);
  const rawCountries = initialState?.countries;
  if (!Array.isArray(rawCountries) || rawCountries.length === 0) return null;

  const defaults = createDefaultConfig();
  const usedIds = new Set<string>();

  const countries = rawCountries.map((rawCountry, index) => {
    const country = asRecord(rawCountry) ?? {};
    const resources = asRecord(country.resources) ?? {};
    const tradePolicy = asRecord(country.tradePolicy) ?? {};
    const policy = asRecord(country.policy) ?? {};
    const aiPolicy = asRecord(country.aiPolicy) ?? {};
    const laborAllocation = asRecord(country.laborAllocation) ?? {};

    const requestedId =
      typeof country.id === "string" && country.id.trim()
        ? country.id.trim()
        : `country-${index + 1}`;
    let id = requestedId;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${requestedId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);

    const name =
      typeof country.name === "string" && country.name.trim()
        ? country.name.trim().slice(0, 80)
        : `Country ${index + 1}`;
    const status =
      country.status === "stressed" || country.status === "collapsed"
        ? country.status
        : "active";

    const resourceOverride = (key: ResourceKey): Partial<ResourceState> => {
      const resource = asRecord(resources[key]) ?? {};
      return {
        amount: safeNumber(resource.amount, DEFAULT_RESOURCES[key].amount, 0, 10_000),
        productionRate: safeNumber(
          resource.productionRate,
          DEFAULT_RESOURCES[key].productionRate,
          0,
          500
        ),
        consumptionRate: safeNumber(
          resource.consumptionRate,
          DEFAULT_RESOURCES[key].consumptionRate,
          0,
          200
        ),
        price: safeNumber(resource.price, DEFAULT_RESOURCES[key].price, 0.5, 50),
      };
    };

    return createCountry(id, name, {
      population: safeNumber(country.population, 1000, 10, 100_000),
      happiness: safeNumber(country.happiness, 65, 0, 100),
      wealth: safeNumber(country.wealth, 5000, 0, 100_000),
      debt: safeNumber(country.debt, 0, 0, 1_000_000_000),
      infrastructure: safeNumber(country.infrastructure, 1, 0.8, 2.8),
      tradeOpenness: safeNumber(country.tradeOpenness, 1, 0.5, 1.5),
      laborParticipation: safeNumber(country.laborParticipation, 0.64, 0.3, 0.92),
      status,
      laborAllocation: {
        agriculture: safeNumber(laborAllocation.agriculture, 0.35, 0, 1),
        industry: safeNumber(laborAllocation.industry, 0.35, 0, 1),
        services: safeNumber(laborAllocation.services, 0.3, 0, 1),
      },
      tradePolicy: {
        importTariff: safeNumber(tradePolicy.importTariff, 0.08, 0, 0.4),
        tradeBarrier: safeNumber(tradePolicy.tradeBarrier, 0.1, 0, 0.4),
        preferredPartners: Array.isArray(tradePolicy.preferredPartners)
          ? tradePolicy.preferredPartners.filter(
              (partner): partner is string => typeof partner === "string"
            )
          : [],
      },
      policy: {
        incomeTaxRate: safeNumber(policy.incomeTaxRate, 0.08, 0, 0.5),
        publicSpending: safeNumber(policy.publicSpending, 25, 0, 200),
        productionInvestment: safeNumber(policy.productionInvestment, 18, 0, 200),
        importSubsidyRate: safeNumber(policy.importSubsidyRate, 0.06, 0, 0.5),
      },
      aiPolicy: {
        enabled: typeof aiPolicy.enabled === "boolean" ? aiPolicy.enabled : false,
        responsiveness: safeNumber(aiPolicy.responsiveness, 0.55, 0, 1.5),
        targetHappiness: safeNumber(aiPolicy.targetHappiness, 65, 0, 100),
        targetDebtRatio: safeNumber(aiPolicy.targetDebtRatio, 0.8, 0, 3),
      },
      resources: {
        food: resourceOverride("food"),
        energy: resourceOverride("energy"),
        materials: resourceOverride("materials"),
      },
    });
  });

  const validIds = new Set(countries.map((country) => country.id));
  for (const country of countries) {
    country.tradePolicy.preferredPartners = [...new Set(country.tradePolicy.preferredPartners)].filter(
      (partnerId) => partnerId !== country.id && validIds.has(partnerId)
    );
  }

  return {
    steps: Math.round(safeNumber(input?.steps, defaults.steps, 1, 200)),
    taxRate: safeNumber(input?.taxRate, defaults.taxRate, 0, 1),
    tradeFriction: safeNumber(input?.tradeFriction, defaults.tradeFriction, 0, 0.4),
    enableEvents:
      typeof input?.enableEvents === "boolean" ? input.enableEvents : defaults.enableEvents,
    eventChance: safeNumber(input?.eventChance, defaults.eventChance, 0, 0.5),
    seed: Math.round(safeNumber(input?.seed, defaults.seed, 1, 9_999_999)),
    migrationSensitivity: safeNumber(
      input?.migrationSensitivity,
      defaults.migrationSensitivity,
      0,
      2
    ),
    interestRate: safeNumber(input?.interestRate, defaults.interestRate, 0, 0.1),
    priceFlexibility: safeNumber(input?.priceFlexibility, defaults.priceFlexibility, 0.2, 2),
    initialState: { countries },
  };
}

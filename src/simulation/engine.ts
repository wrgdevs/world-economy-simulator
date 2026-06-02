import { RESOURCE_KEYS } from "./types";
import type {
  CountryState,
  CountryStepRecord,
  EventRecord,
  InsightRecord,
  ResourceKey,
  SectorKey,
  SimulationConfig,
  SimulationResult,
  TradeRouteRecord,
  WorldState,
  WorldStepRecord,
} from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function zeroResourceMap(): Record<ResourceKey, number> {
  return {
    food: 0,
    energy: 0,
    materials: 0,
  };
}

function normalizeAllocation(
  input?: Partial<Record<SectorKey, number>>
): Record<SectorKey, number> {
  const raw = {
    agriculture: input?.agriculture ?? 0.35,
    industry: input?.industry ?? 0.35,
    services: input?.services ?? 0.3,
  };
  const total = raw.agriculture + raw.industry + raw.services;
  if (total <= 0) return { agriculture: 0.35, industry: 0.35, services: 0.3 };
  return {
    agriculture: raw.agriculture / total,
    industry: raw.industry / total,
    services: raw.services / total,
  };
}

function createRng(seed: number): () => number {
  let x = seed | 0;
  if (x === 0) x = 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function cloneCountry(country: CountryState): CountryState {
  return {
    id: country.id,
    name: country.name,
    population: country.population,
    happiness: country.happiness,
    wealth: country.wealth,
    debt: country.debt ?? 0,
    status: country.status ?? "active",
    infrastructure: country.infrastructure,
    tradeOpenness: country.tradeOpenness,
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

function cloneWorld(state: WorldState): WorldState {
  return { countries: state.countries.map(cloneCountry) };
}

function sumMap(map: Record<ResourceKey, number>): number {
  return RESOURCE_KEYS.reduce((sum, key) => sum + map[key], 0);
}

function makeInsight(
  step: number,
  countryId: string | null,
  countryName: string | null,
  severity: "info" | "warning" | "critical",
  title: string,
  message: string
): InsightRecord {
  return { step, countryId, countryName, severity, title, message };
}

function uniquePartnerIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

interface StepContext {
  globalTradeRevenueMultiplier: number;
  globalImportCostMultiplier: number;
  globalInflationMultiplier: number;
}

interface CountryRuntime {
  country: CountryState;
  needs: Record<ResourceKey, number>;
  shortages: Record<ResourceKey, number>;
  stockAfterConsumption: Record<ResourceKey, number>;
  exportSupply: Record<ResourceKey, number>;
  importsReceived: Record<ResourceKey, number>;
  exportsShipped: Record<ResourceKey, number>;
  importsByPartner: Record<string, number>;
  exportsByPartner: Record<string, number>;
  tradeRevenue: number;
  importCost: number;
  eventWarnings: string[];
  blockedPartners: Set<string>;

  agricultureOutput: number;
  industryOutput: number;
  servicesOutput: number;
  gdp: number;

  migrationIn: number;
  migrationOut: number;
  inflationRate: number;
  interestPaid: number;
  debtRepayment: number;
  priceChanges: Record<ResourceKey, number>;
}

function createRuntime(country: CountryState): CountryRuntime {
  return {
    country: cloneCountry(country),
    needs: zeroResourceMap(),
    shortages: zeroResourceMap(),
    stockAfterConsumption: zeroResourceMap(),
    exportSupply: zeroResourceMap(),
    importsReceived: zeroResourceMap(),
    exportsShipped: zeroResourceMap(),
    importsByPartner: {},
    exportsByPartner: {},
    tradeRevenue: 0,
    importCost: 0,
    eventWarnings: [],
    blockedPartners: new Set<string>(),
    agricultureOutput: 0,
    industryOutput: 0,
    servicesOutput: 0,
    gdp: 0,
    migrationIn: 0,
    migrationOut: 0,
    inflationRate: 0,
    interestPaid: 0,
    debtRepayment: 0,
    priceChanges: zeroResourceMap(),
  };
}

function buildExporterOrder(
  importer: CountryRuntime,
  resource: ResourceKey,
  runtimes: CountryRuntime[],
  runtimeById: Map<string, CountryRuntime>
): string[] {
  const preferred = uniquePartnerIds(importer.country.tradePolicy.preferredPartners)
    .filter((id) => id !== importer.country.id)
    .filter((id) => runtimeById.has(id))
    .filter((id) => !importer.blockedPartners.has(id));

  const preferredWithSupply = preferred.filter((id) => {
    const runtime = runtimeById.get(id);
    return Boolean(
      runtime &&
        runtime.exportSupply[resource] > 0 &&
        !runtime.blockedPartners.has(importer.country.id)
    );
  });

  const remaining = runtimes
    .filter((runtime) => runtime.country.id !== importer.country.id)
    .filter((runtime) => !preferredWithSupply.includes(runtime.country.id))
    .filter((runtime) => runtime.exportSupply[resource] > 0)
    .filter((runtime) => !importer.blockedPartners.has(runtime.country.id))
    .filter((runtime) => !runtime.blockedPartners.has(importer.country.id))
    .sort((a, b) => {
      const supplyDiff = b.exportSupply[resource] - a.exportSupply[resource];
      if (supplyDiff !== 0) return supplyDiff;
      return a.country.name.localeCompare(b.country.name);
    })
    .map((runtime) => runtime.country.id);

  return [...preferredWithSupply, ...remaining];
}

function maybeAddGlobalEvent(
  rng: () => number,
  step: number,
  context: StepContext,
  events: EventRecord[]
): void {
  const roll = rng();

  if (roll < 0.34) {
    context.globalTradeRevenueMultiplier *= 1.12;
    events.push({
      step,
      type: "global_market_boom",
      description: "A global market boom lifted trade revenues.",
      severity: 2,
      countryIds: [],
      countryNames: [],
    });
  } else if (roll < 0.67) {
    context.globalImportCostMultiplier *= 1.18;
    context.globalInflationMultiplier *= 1.06;
    events.push({
      step,
      type: "global_shipping_crisis",
      description: "Shipping delays pushed import costs and prices higher.",
      severity: 3,
      countryIds: [],
      countryNames: [],
    });
  } else {
    context.globalTradeRevenueMultiplier *= 0.84;
    context.globalInflationMultiplier *= 1.03;
    events.push({
      step,
      type: "global_recession",
      description: "A global recession reduced demand and slowed growth.",
      severity: 3,
      countryIds: [],
      countryNames: [],
    });
  }
}

function maybeAddCountryEvent(
  rng: () => number,
  step: number,
  runtime: CountryRuntime,
  runtimes: CountryRuntime[],
  runtimeById: Map<string, CountryRuntime>,
  events: EventRecord[]
): void {
  const country = runtime.country;
  const roll = rng();

  if (roll < 0.28) {
    runtime.eventWarnings.push("Drought");
    events.push({
      step,
      type: "drought",
      description: `${country.name} suffered a drought that cut food output.`,
      severity: 4,
      countryIds: [country.id],
      countryNames: [country.name],
      resource: "food",
    });
    return;
  }

  if (roll < 0.5) {
    country.infrastructure = clamp(country.infrastructure * 0.9, 0.8, 2.8);
    runtime.eventWarnings.push("Infrastructure failure");
    events.push({
      step,
      type: "infrastructure_failure",
      description: `${country.name} had an infrastructure failure.`,
      severity: 4,
      countryIds: [country.id],
      countryNames: [country.name],
    });
    return;
  }

  if (roll < 0.72) {
    const resource = RESOURCE_KEYS[Math.floor(rng() * RESOURCE_KEYS.length)];
    const boost = Math.max(2, country.resources[resource].productionRate * 0.12);
    country.resources[resource].productionRate += boost;
    country.wealth += 250;
    runtime.eventWarnings.push(`Discovery: ${resource}`);
    events.push({
      step,
      type: "resource_discovery",
      description: `${country.name} discovered new ${resource} capacity.`,
      severity: 2,
      countryIds: [country.id],
      countryNames: [country.name],
      resource,
    });
    return;
  }

  if (roll < 0.88) {
    const direction = rng() < 0.5 ? 1 : -1;
    const magnitude = 0.04 + rng() * 0.03;
    const delta = Math.round(country.population * magnitude) * direction;
    country.population = Math.max(10, country.population + delta);
    runtime.eventWarnings.push("Migration wave");
    events.push({
      step,
      type: "migration_wave",
      description: `${country.name} experienced a migration wave.`,
      severity: 2,
      countryIds: [country.id],
      countryNames: [country.name],
    });
    return;
  }

  const partners = runtimes.filter((candidate) => candidate.country.id !== country.id);
  if (partners.length === 0) return;

  const preferred = country.tradePolicy.preferredPartners
    .map((id) => runtimeById.get(id))
    .filter((candidate): candidate is CountryRuntime => Boolean(candidate))
    .filter((candidate) => candidate.country.id !== country.id);

  const partner =
    preferred[Math.floor(rng() * preferred.length)] ??
    partners[Math.floor(rng() * partners.length)];

  runtime.blockedPartners.add(partner.country.id);
  partner.blockedPartners.add(country.id);

  runtime.eventWarnings.push(`Embargo with ${partner.country.name}`);
  partner.eventWarnings.push(`Embargo with ${country.name}`);

  events.push({
    step,
    type: "trade_embargo",
    description: `${country.name} and ${partner.country.name} entered a trade embargo.`,
    severity: 5,
    countryIds: [country.id, partner.country.id],
    countryNames: [country.name, partner.country.name],
    partnerId: partner.country.id,
    partnerName: partner.country.name,
  });
}

function applyAIPolicy(country: CountryState): void {
  if (!country.aiPolicy.enabled) return;

  const responsiveness = clamp(country.aiPolicy.responsiveness, 0, 1.5);
  const targetHappiness = clamp(country.aiPolicy.targetHappiness, 0, 100);
  const targetDebtRatio = clamp(country.aiPolicy.targetDebtRatio, 0, 3);

  const happinessGap = (targetHappiness - country.happiness) / 100;
  const debtRatio = (country.debt ?? 0) / Math.max(country.wealth + 1, 1);
  const debtGap = debtRatio - targetDebtRatio;
  const stress = clamp(happinessGap + debtGap * 0.5, -1, 1);

  country.policy.incomeTaxRate = clamp(
    country.policy.incomeTaxRate + responsiveness * (0.02 * debtGap - 0.015 * happinessGap),
    0,
    0.5
  );

  country.policy.publicSpending = clamp(
    country.policy.publicSpending + responsiveness * (12 * happinessGap - 8 * debtGap),
    0,
    220
  );

  country.policy.productionInvestment = clamp(
    country.policy.productionInvestment + responsiveness * (8 * Math.max(debtGap, 0) + 3 * Math.max(happinessGap, 0)),
    0,
    220
  );

  country.policy.importSubsidyRate = clamp(
    country.policy.importSubsidyRate + responsiveness * (0.02 * happinessGap - 0.01 * debtGap),
    0,
    0.5
  );

  country.tradePolicy.importTariff = clamp(
    country.tradePolicy.importTariff + responsiveness * (0.01 * debtGap - 0.006 * happinessGap),
    0,
    0.4
  );

  country.tradePolicy.tradeBarrier = clamp(
    country.tradePolicy.tradeBarrier + responsiveness * (0.008 * debtGap - 0.004 * happinessGap),
    0,
    0.4
  );

  country.laborParticipation = clamp(
    (country.laborParticipation ?? 0.64) + responsiveness * (0.01 * stress),
    0.3,
    0.92
  );
}

function simulateStep(
  state: WorldState,
  config: SimulationConfig,
  step: number,
  rng: () => number
): { nextState: WorldState; record: WorldStepRecord } {
  const runtimes = state.countries.map(createRuntime);
  const runtimeById = new Map(runtimes.map((runtime) => [runtime.country.id, runtime] as const));
  const routes: TradeRouteRecord[] = [];
  const events: EventRecord[] = [];
  const insights: InsightRecord[] = [];

  const context: StepContext = {
    globalTradeRevenueMultiplier: 1,
    globalImportCostMultiplier: 1,
    globalInflationMultiplier: 1,
  };

  if (config.enableEvents && rng() < config.eventChance * 0.3) {
    maybeAddGlobalEvent(rng, step, context, events);
  }

  if (config.enableEvents) {
    for (const runtime of runtimes) {
      if (rng() < config.eventChance) {
        maybeAddCountryEvent(rng, step, runtime, runtimes, runtimeById, events);
      }
    }
  }

  for (const runtime of runtimes) {
    const country = runtime.country;
    applyAIPolicy(country);

    const allocation = normalizeAllocation(country.laborAllocation);
    const laborParticipation = clamp(country.laborParticipation ?? 0.64, 0.3, 0.92);
    const workingPopulation = country.population * laborParticipation;
    const infrastructureMultiplier =
      country.status === "collapsed" ? 0.15 : clamp(country.infrastructure, 0.75, 2.8);

    const agricultureWorkers = workingPopulation * allocation.agriculture;
    const industryWorkers = workingPopulation * allocation.industry;
    const servicesWorkers = workingPopulation * allocation.services;

    const droughtMultiplier = runtime.eventWarnings.includes("Drought") ? 0.55 : 1;
    const infraFailureMultiplier = runtime.eventWarnings.includes("Infrastructure failure") ? 0.9 : 1;

    runtime.agricultureOutput =
      agricultureWorkers * (0.8 + infrastructureMultiplier * 0.18) * droughtMultiplier * infraFailureMultiplier;
    runtime.industryOutput =
      industryWorkers * (0.72 + infrastructureMultiplier * 0.22) * infraFailureMultiplier;
    runtime.servicesOutput =
      servicesWorkers * (0.85 + infrastructureMultiplier * 0.12) * infraFailureMultiplier;

    for (const key of RESOURCE_KEYS) {
      const resource = country.resources[key];
      const need = (resource.consumptionRate * country.population) / 100;
      let produced = resource.amount + resource.productionRate * infrastructureMultiplier;

      if (key === "food") {
        produced += runtime.agricultureOutput * 0.8;
      } else if (key === "energy") {
        produced += runtime.industryOutput * 0.4;
      } else if (key === "materials") {
        produced += runtime.industryOutput * 0.5;
      }

      const consumed = Math.min(produced, need);
      const shortage = Math.max(0, need - consumed);
      const remainingAfterConsumption = produced - consumed;

      const reserve = need * 0.35;
      const exportable = Math.max(0, remainingAfterConsumption - reserve);
      const exportSupply = Math.min(remainingAfterConsumption, exportable * country.tradeOpenness);

      runtime.needs[key] = need;
      runtime.shortages[key] = shortage;
      runtime.stockAfterConsumption[key] = remainingAfterConsumption;
      runtime.exportSupply[key] = exportSupply;
    }
  }

  for (const key of RESOURCE_KEYS) {
    const importers = runtimes
      .filter((runtime) => runtime.shortages[key] > 0)
      .sort((a, b) => b.shortages[key] - a.shortages[key]);

    for (const importer of importers) {
      if (importer.country.status === "collapsed") continue;

      let remainingNeed = importer.shortages[key];
      const exporterOrder = buildExporterOrder(importer, key, runtimes, runtimeById);

      for (const exporterId of exporterOrder) {
        if (remainingNeed <= 0) break;

        const exporter = runtimeById.get(exporterId);
        if (!exporter) continue;
        if (exporter.country.status === "collapsed") continue;

        if (
          importer.blockedPartners.has(exporter.country.id) ||
          exporter.blockedPartners.has(importer.country.id)
        ) {
          continue;
        }

        const availableToShip = exporter.exportSupply[key];
        if (availableToShip <= 0) continue;

        const barrierAvg =
          (importer.country.tradePolicy.tradeBarrier +
            exporter.country.tradePolicy.tradeBarrier) /
          2;

        const opennessAvg =
          (importer.country.tradeOpenness + exporter.country.tradeOpenness) / 2;

        const routeEfficiency = clamp(
          (1 - config.tradeFriction - barrierAvg * 0.8) * opennessAvg,
          0.25,
          1
        );

        const maxDelivered = availableToShip * routeEfficiency;
        const delivered = Math.min(remainingNeed, maxDelivered);
        if (delivered <= 0) continue;

        const shipped = delivered / routeEfficiency;

        exporter.exportSupply[key] -= shipped;
        importer.importsReceived[key] += delivered;
        exporter.exportsShipped[key] += shipped;

        importer.importsByPartner[exporter.country.id] =
          (importer.importsByPartner[exporter.country.id] ?? 0) + delivered;
        exporter.exportsByPartner[importer.country.id] =
          (exporter.exportsByPartner[importer.country.id] ?? 0) + shipped;

        exporter.tradeRevenue +=
          shipped *
          exporter.country.resources[key].price *
          (1 - config.tradeFriction * 0.2) *
          context.globalTradeRevenueMultiplier;

        importer.importCost +=
          delivered *
          importer.country.resources[key].price *
          (1 + importer.country.tradePolicy.importTariff) *
          context.globalImportCostMultiplier;

        routes.push({
          step,
          resource: key,
          fromCountryId: exporter.country.id,
          fromCountryName: exporter.country.name,
          toCountryId: importer.country.id,
          toCountryName: importer.country.name,
          shipped,
          delivered,
          routeEfficiency,
          price: importer.country.resources[key].price,
          tariff: importer.country.tradePolicy.importTariff,
        });

        remainingNeed -= delivered;
      }
    }
  }

  const preliminaryRecords = runtimes.map((runtime) => {
    const country = runtime.country;

    const finalShortages = zeroResourceMap();
    for (const key of RESOURCE_KEYS) {
      finalShortages[key] = Math.max(0, runtime.shortages[key] - runtime.importsReceived[key]);
    }

    const totalNeed = sumMap(runtime.needs);
    const totalShortage = sumMap(finalShortages);
    const totalImports = sumMap(runtime.importsReceived);
    const averageSufficiency = totalNeed > 0 ? clamp(1 - totalShortage / totalNeed, 0, 1) : 1;

    const effectiveTaxRate = clamp(
      config.taxRate + country.policy.incomeTaxRate,
      0,
      0.65
    );

    const servicesRevenue = runtime.servicesOutput * (1.15 + country.infrastructure * 0.05);
    const agricultureRevenue = runtime.agricultureOutput * 0.35;
    const industryRevenue = runtime.industryOutput * 0.45;
    const productionRevenue = servicesRevenue + agricultureRevenue + industryRevenue;

    const taxPaid = (runtime.tradeRevenue + servicesRevenue) * effectiveTaxRate;
    const publicSpendingCost = Math.max(0, country.policy.publicSpending);
    const investmentCost = Math.max(0, country.policy.productionInvestment);

    const subsidyRate = clamp(country.policy.importSubsidyRate, 0, 0.5);
    const effectiveImportCost = runtime.importCost * (1 - subsidyRate * 0.7);
    const subsidyCost = runtime.importCost * subsidyRate * 0.35;

    const debt = country.debt ?? 0;
    const interestPaid = debt * config.interestRate;

    const balance =
      country.wealth +
      productionRevenue +
      runtime.tradeRevenue -
      effectiveImportCost -
      subsidyCost -
      taxPaid -
      publicSpendingCost -
      investmentCost -
      interestPaid;

    let nextDebt = debt;
    let nextWealth = 0;
    let debtRepayment = 0;

    if (balance >= 0) {
      debtRepayment = Math.min(nextDebt, balance * 0.28);
      nextDebt -= debtRepayment;
      nextWealth = balance - debtRepayment;
    } else {
      nextDebt += -balance;
      nextWealth = 0;
    }

    const importsByPartnerEntries = Object.entries(runtime.importsByPartner).sort(
      (a, b) => b[1] - a[1]
    );

    const topPartnerEntry = importsByPartnerEntries[0] ?? null;
    const dependencyShare =
      topPartnerEntry && totalImports > 0 ? topPartnerEntry[1] / totalImports : 0;

    const tradeDiversity = importsByPartnerEntries.length;
    const debtPressure = nextDebt / Math.max(nextWealth + 1, 1);
    const wealthBonus = Math.min(nextWealth / Math.max(country.population * 6, 1), 12);
    const tradeBonus = clamp(
      tradeDiversity * 1.1 + (totalImports / Math.max(totalNeed, 1)) * 6,
      0,
      8
    );

    const publicSpendingBonus = Math.min(publicSpendingCost / Math.max(country.population * 3, 1), 8);
    const investmentBonus = Math.min(investmentCost / Math.max(country.population * 3, 1), 5);
    const subsidyBonus = subsidyRate * 6;

    const policyPenalty =
      effectiveTaxRate * 12 +
      country.tradePolicy.importTariff * 6 +
      country.tradePolicy.tradeBarrier * 4 +
      debtPressure * 3;

    let nextHappiness = clamp(
      28 +
        averageSufficiency * 42 +
        wealthBonus +
        tradeBonus +
        publicSpendingBonus +
        investmentBonus +
        subsidyBonus -
        policyPenalty,
      0,
      100
    );

    let nextPopulation = Math.max(10, Math.round(country.population * (1 + clamp((nextHappiness - 50) / 6500, -0.05, 0.05))));
    let nextInfrastructure = clamp(
      country.infrastructure + investmentCost / 5000 + (nextHappiness - 50) / 12000,
      0.8,
      2.8
    );

    const nextPriceChanges = zeroResourceMap();
    const shortagePressure = totalNeed > 0 ? totalShortage / totalNeed : 0;

    for (const key of RESOURCE_KEYS) {
      const resource = country.resources[key];
      const oldPrice = resource.price;

      const localShortagePressure = runtime.shortages[key] / Math.max(runtime.needs[key], 1);
      const debtPricePressure = clamp(debtPressure * 0.01, 0, 0.12);
      const inflationDriver =
        (localShortagePressure * 0.18 +
          shortagePressure * 0.05 +
          debtPricePressure +
          (runtime.eventWarnings.includes("Drought") && key === "food" ? 0.08 : 0) +
          context.globalInflationMultiplier * 0.02) * config.priceFlexibility;

      const growth = clamp(1 + inflationDriver - 0.03, 0.88, 1.25);
      const nextPrice = clamp(oldPrice * growth, 0.5, 100);

      nextPriceChanges[key] = nextPrice / oldPrice - 1;
    }

    const inflationRate =
      (nextPriceChanges.food + nextPriceChanges.energy + nextPriceChanges.materials) / 3;

    const previousStatus = country.status ?? "active";
    let nextStatus: "active" | "stressed" | "collapsed" = previousStatus;

    if (previousStatus !== "collapsed") {
      if ((nextHappiness < 18 && shortagePressure > 0.35) || nextDebt > Math.max(6000, nextWealth * 2.2)) {
        nextStatus = "collapsed";
      } else if (nextHappiness < 35 || shortagePressure > 0.22 || debtPressure > 1) {
        nextStatus = "stressed";
      } else {
        nextStatus = "active";
      }
    }

    if (nextStatus === "collapsed") {
      nextHappiness = Math.min(nextHappiness, 18);
      nextPopulation = Math.max(10, Math.round(nextPopulation * 0.95));
      nextInfrastructure = Math.max(0.8, nextInfrastructure * 0.9);
    }

    const attractiveness =
      nextHappiness * 1.1 +
      nextInfrastructure * 12 +
      (nextWealth / Math.max(nextPopulation, 1)) * 0.02 -
      nextDebt / Math.max(nextPopulation, 1) * 0.03 -
      shortagePressure * 30 -
      inflationRate * 25 +
      (country.laborParticipation ?? 0.64) * 4;

    return {
      runtime,
      country,
      finalShortages,
      totalNeed,
      totalShortage,
      totalImports,
      averageSufficiency,
      effectiveTaxRate,
      taxPaid,
      publicSpendingCost,
      investmentCost,
      subsidyRate,
      effectiveImportCost,
      subsidyCost,
      interestPaid,
      productionRevenue,
      nextDebt,
      nextWealth,
      debtRepayment,
      nextPopulation,
      nextHappiness,
      nextInfrastructure,
      nextPriceChanges,
      inflationRate,
      attractiveness,
      dependencyShare,
      topPartnerEntry,
      importsByPartnerEntries,
      servicesRevenue,
      agricultureRevenue,
      industryRevenue,
      nextStatus,
    };
  });

  const attractSorted = [...preliminaryRecords].sort((a, b) => b.attractiveness - a.attractiveness);

  const migrationInById: Record<string, number> = {};
  const migrationOutById: Record<string, number> = {};

  for (const source of preliminaryRecords) {
    if (source.nextStatus === "collapsed") continue;

    const bestTarget = attractSorted.find(
      (candidate) => candidate.country.id !== source.country.id && candidate.nextStatus !== "collapsed"
    );
    if (!bestTarget) continue;

    const gap = bestTarget.attractiveness - source.attractiveness;
    if (gap <= 5) continue;

    const rate = clamp((gap / 180) * config.migrationSensitivity, 0, 0.05);
    const migrants = Math.max(
      0,
      Math.min(source.nextPopulation - 1, Math.round(source.nextPopulation * rate))
    );

    if (migrants <= 0) continue;

    migrationOutById[source.country.id] = (migrationOutById[source.country.id] ?? 0) + migrants;
    migrationInById[bestTarget.country.id] = (migrationInById[bestTarget.country.id] ?? 0) + migrants;
  }

  const nextCountries: CountryState[] = [];
  const countryRecords: CountryStepRecord[] = [];

  for (const row of preliminaryRecords) {
    const country = row.country;
    const migrationIn = migrationInById[country.id] ?? 0;
    const migrationOut = migrationOutById[country.id] ?? 0;
    const netMigration = migrationIn - migrationOut;
    const finalPopulation = Math.max(10, row.nextPopulation + netMigration);

    const nextCountry: CountryState = {
      ...country,
      status: row.nextStatus,
      population: finalPopulation,
      happiness: row.nextHappiness,
      wealth: row.nextWealth,
      debt: row.nextDebt,
      infrastructure: row.nextInfrastructure,
      laborParticipation: country.laborParticipation ?? 0.64,
      laborAllocation: normalizeAllocation(country.laborAllocation),
      resources: {
        food: {
          ...country.resources.food,
          amount: row.runtime.stockAfterConsumption.food,
          price: clamp(country.resources.food.price * (1 + row.nextPriceChanges.food), 0.5, 100),
        },
        energy: {
          ...country.resources.energy,
          amount: row.runtime.stockAfterConsumption.energy,
          price: clamp(country.resources.energy.price * (1 + row.nextPriceChanges.energy), 0.5, 100),
        },
        materials: {
          ...country.resources.materials,
          amount: row.runtime.stockAfterConsumption.materials,
          price: clamp(country.resources.materials.price * (1 + row.nextPriceChanges.materials), 0.5, 100),
        },
      },
    };

    nextCountries.push(nextCountry);

    const warnings: string[] = [...row.runtime.eventWarnings];
    if (row.totalNeed > 0 && row.totalShortage / row.totalNeed > 0.2) {
      warnings.push("Persistent shortages");
    }
    if (row.dependencyShare > 0.65 && row.topPartnerEntry) {
      const partnerName =
        runtimeById.get(row.topPartnerEntry[0])?.country.name ?? row.topPartnerEntry[0];
      warnings.push(`High dependence on ${partnerName}`);
    }
    if (row.totalImports === 0 && row.totalShortage > 0) {
      warnings.push("Trade isolation");
    }
    if (row.nextDebt > row.nextWealth * 2) {
      warnings.push("Debt stress");
    }
    if (row.inflationRate > 0.08) {
      warnings.push("Inflationary pressure");
    }
    if (row.nextStatus === "collapsed") {
      warnings.push("Collapsed");
    } else if (row.nextStatus === "stressed") {
      warnings.push("Stressed economy");
    }

    const aiPolicy = country.aiPolicy;

    countryRecords.push({
      countryId: country.id,
      countryName: country.name,
      population: finalPopulation,
      happiness: row.nextHappiness,
      wealth: row.nextWealth,
      debt: row.nextDebt,
      infrastructure: row.nextInfrastructure,
      tradeOpenness: country.tradeOpenness,
      status: row.nextStatus,

      laborParticipation: country.laborParticipation ?? 0.64,
      laborAllocation: normalizeAllocation(country.laborAllocation),
      workingPopulation: country.population * (country.laborParticipation ?? 0.64),

      agricultureOutput: row.runtime.agricultureOutput,
      industryOutput: row.runtime.industryOutput,
      servicesOutput: row.runtime.servicesOutput,
      gdp: row.productionRevenue + row.runtime.tradeRevenue,

      importTariff: country.tradePolicy.importTariff,
      tradeBarrier: country.tradePolicy.tradeBarrier,
      incomeTaxRate: country.policy.incomeTaxRate,
      publicSpending: country.policy.publicSpending,
      productionInvestment: country.policy.productionInvestment,
      importSubsidyRate: country.policy.importSubsidyRate,

      aiEnabled: aiPolicy.enabled,
      aiResponsiveness: aiPolicy.responsiveness,
      aiTargetHappiness: aiPolicy.targetHappiness,
      aiTargetDebtRatio: aiPolicy.targetDebtRatio,

      resourceAmounts: {
        food: row.runtime.stockAfterConsumption.food,
        energy: row.runtime.stockAfterConsumption.energy,
        materials: row.runtime.stockAfterConsumption.materials,
      },
      resourceNeeds: {
        food: row.runtime.needs.food,
        energy: row.runtime.needs.energy,
        materials: row.runtime.needs.materials,
      },
      resourceShortages: {
        food: row.finalShortages.food,
        energy: row.finalShortages.energy,
        materials: row.finalShortages.materials,
      },
      resourcePriceChanges: row.nextPriceChanges,

      imports: {
        food: row.runtime.importsReceived.food,
        energy: row.runtime.importsReceived.energy,
        materials: row.runtime.importsReceived.materials,
      },
      exports: {
        food: row.runtime.exportsShipped.food,
        energy: row.runtime.exportsShipped.energy,
        materials: row.runtime.exportsShipped.materials,
      },
      importsByPartner: row.runtime.importsByPartner,
      exportsByPartner: row.runtime.exportsByPartner,

      tradeRevenue: row.runtime.tradeRevenue,
      importCost: row.runtime.importCost,
      taxPaid: row.taxPaid,
      subsidyCost: row.subsidyCost,
      publicSpendingCost: row.publicSpendingCost,
      investmentCost: row.investmentCost,
      interestPaid: row.interestPaid,
      debtRepayment: row.debtRepayment,
      effectiveTaxRate: row.effectiveTaxRate,
      effectiveImportCost: row.effectiveImportCost,

      inflationRate: row.inflationRate,
      migrationIn,
      migrationOut,
      netMigration,

      totalNeed: row.totalNeed,
      totalShortage: row.totalShortage,
      averageSufficiency: row.averageSufficiency,
      netTrade:
        row.runtime.tradeRevenue -
        row.effectiveImportCost -
        row.subsidyCost -
        row.taxPaid -
        row.publicSpendingCost -
        row.investmentCost -
        row.interestPaid -
        row.debtRepayment,

      dependencyShare: row.dependencyShare,
      dependencyPartnerId: row.topPartnerEntry?.[0] ?? null,
      dependencyPartnerName: row.topPartnerEntry
        ? runtimeById.get(row.topPartnerEntry[0])?.country.name ?? row.topPartnerEntry[0]
        : null,
      warnings,
    });

    if (row.nextStatus === "collapsed") {
      insights.push(
        makeInsight(
          step,
          country.id,
          country.name,
          "critical",
          "Economy collapsed",
          `${country.name} collapsed after shortages and debt overwhelmed the economy.`
        )
      );
    } else {
      if (row.totalNeed > 0 && row.totalShortage / row.totalNeed > 0.25) {
        insights.push(
          makeInsight(
            step,
            country.id,
            country.name,
            "warning",
            "Shortage pressure",
            `${country.name} is facing persistent shortages across basic goods.`
          )
        );
      }

      if (row.inflationRate > 0.08) {
        insights.push(
          makeInsight(
            step,
            country.id,
            country.name,
            "warning",
            "Inflation pressure",
            `${country.name} is seeing prices rise faster than output.`
          )
        );
      }

      if (row.dependencyShare > 0.65 && row.topPartnerEntry) {
        const partnerName =
          runtimeById.get(row.topPartnerEntry[0])?.country.name ?? row.topPartnerEntry[0];
        insights.push(
          makeInsight(
            step,
            country.id,
            country.name,
            "warning",
            "Trade dependency",
            `${country.name} depends heavily on ${partnerName} for imports.`
          )
        );
      }

      if (netMigration > 40) {
        insights.push(
          makeInsight(
            step,
            country.id,
            country.name,
            "info",
            "Population inflow",
            `${country.name} is attracting migrants from other countries.`
          )
        );
      }

      if (country.aiPolicy.enabled) {
        insights.push(
          makeInsight(
            step,
            country.id,
            country.name,
            "info",
            "AI policy active",
            `${country.name} is auto-adjusting its fiscal and trade settings.`
          )
        );
      }
    }
  }

  const collapsedCount = countryRecords.filter((c) => c.status === "collapsed").length;
  const averageInflation =
    countryRecords.length > 0
      ? countryRecords.reduce((sum, c) => sum + c.inflationRate, 0) / countryRecords.length
      : 0;

  if (collapsedCount > 0) {
    insights.push(
      makeInsight(
        step,
        null,
        null,
        "critical",
        "System crisis",
        `${collapsedCount} country/countries collapsed in this step.`
      )
    );
  }

  if (averageInflation > 0.07) {
    insights.push(
      makeInsight(
        step,
        null,
        null,
        "warning",
        "Global inflation",
        "Average inflation is elevated across the world economy."
      )
    );
  }

  return {
    nextState: {
      countries: nextCountries,
    },
    record: {
      step,
      countries: countryRecords,
      routes,
      events,
      insights,
    },
  };
}

export function simulateEconomy(config: SimulationConfig): SimulationResult {
  let state = cloneWorld(config.initialState);
  const history: WorldStepRecord[] = [];
  const rng = createRng(config.seed);

  for (let step = 1; step <= config.steps; step += 1) {
    const result = simulateStep(state, config, step, rng);
    history.push(result.record);
    state = result.nextState;
  }

  return {
    history,
    finalState: state,
  };
}
export const RESOURCE_KEYS = ["food", "energy", "materials"] as const;
export type ResourceKey = (typeof RESOURCE_KEYS)[number];

export const SECTOR_KEYS = ["agriculture", "industry", "services"] as const;
export type SectorKey = (typeof SECTOR_KEYS)[number];

export type EventType =
  | "drought"
  | "infrastructure_failure"
  | "resource_discovery"
  | "migration_wave"
  | "trade_embargo"
  | "global_market_boom"
  | "global_shipping_crisis"
  | "global_recession";

export type CountryStatus = "active" | "stressed" | "collapsed";
export type InsightSeverity = "info" | "warning" | "critical";

export interface ResourceState {
  amount: number;
  productionRate: number;
  consumptionRate: number;
  price: number;
}

export interface TradePolicy {
  importTariff: number;
  tradeBarrier: number;
  preferredPartners: string[];
}

export interface CountryPolicy {
  incomeTaxRate: number;
  publicSpending: number;
  productionInvestment: number;
  importSubsidyRate: number;
}

export interface AIPolicy {
  enabled: boolean;
  responsiveness: number;
  targetHappiness: number;
  targetDebtRatio: number;
}

export interface CountryState {
  id: string;
  name: string;
  population: number;
  happiness: number;
  wealth: number;
  debt?: number;
  infrastructure: number;
  tradeOpenness: number;
  laborParticipation?: number;
  laborAllocation?: Record<SectorKey, number>;
  status?: CountryStatus;
  tradePolicy: TradePolicy;
  policy: CountryPolicy;
  aiPolicy: AIPolicy;
  resources: Record<ResourceKey, ResourceState>;
}

export interface WorldState {
  countries: CountryState[];
}

export interface SimulationConfig {
  steps: number;
  taxRate: number;
  tradeFriction: number;
  enableEvents: boolean;
  eventChance: number;
  seed: number;
  migrationSensitivity: number;
  interestRate: number;
  priceFlexibility: number;
  initialState: WorldState;
}

export interface TradeRouteRecord {
  step: number;
  resource: ResourceKey;
  fromCountryId: string;
  fromCountryName: string;
  toCountryId: string;
  toCountryName: string;
  shipped: number;
  delivered: number;
  routeEfficiency: number;
  price: number;
  tariff: number;
}

export interface EventRecord {
  step: number;
  type: EventType;
  description: string;
  severity: number;
  countryIds: string[];
  countryNames: string[];
  resource?: ResourceKey;
  partnerId?: string | null;
  partnerName?: string | null;
}

export interface InsightRecord {
  step: number;
  countryId: string | null;
  countryName: string | null;
  severity: InsightSeverity;
  title: string;
  message: string;
}

export interface CountryStepRecord {
  countryId: string;
  countryName: string;
  population: number;
  happiness: number;
  wealth: number;
  debt: number;
  infrastructure: number;
  tradeOpenness: number;
  status: CountryStatus;

  laborParticipation: number;
  laborAllocation: Record<SectorKey, number>;
  workingPopulation: number;

  agricultureOutput: number;
  industryOutput: number;
  servicesOutput: number;
  gdp: number;

  importTariff: number;
  tradeBarrier: number;
  incomeTaxRate: number;
  publicSpending: number;
  productionInvestment: number;
  importSubsidyRate: number;

  aiEnabled: boolean;
  aiResponsiveness: number;
  aiTargetHappiness: number;
  aiTargetDebtRatio: number;

  resourceAmounts: Record<ResourceKey, number>;
  resourceNeeds: Record<ResourceKey, number>;
  resourceShortages: Record<ResourceKey, number>;
  resourcePriceChanges: Record<ResourceKey, number>;

  imports: Record<ResourceKey, number>;
  exports: Record<ResourceKey, number>;
  importsByPartner: Record<string, number>;
  exportsByPartner: Record<string, number>;

  tradeRevenue: number;
  importCost: number;
  taxPaid: number;
  subsidyCost: number;
  publicSpendingCost: number;
  investmentCost: number;
  interestPaid: number;
  debtRepayment: number;
  effectiveTaxRate: number;
  effectiveImportCost: number;

  inflationRate: number;
  migrationIn: number;
  migrationOut: number;
  netMigration: number;

  totalNeed: number;
  totalShortage: number;
  averageSufficiency: number;
  netTrade: number;

  dependencyShare: number;
  dependencyPartnerId: string | null;
  dependencyPartnerName: string | null;
  warnings: string[];
}

export interface WorldStepRecord {
  step: number;
  countries: CountryStepRecord[];
  routes: TradeRouteRecord[];
  events: EventRecord[];
  insights: InsightRecord[];
}

export interface SimulationResult {
  history: WorldStepRecord[];
  finalState: WorldState;
}
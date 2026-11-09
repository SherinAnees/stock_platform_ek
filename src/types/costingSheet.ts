export interface QtyPriceRow {
  slNo: number;
  kitchenType: string;
  qtyPerType: number;
  wg1ListPriceCabinetry: number;
  wg1ListPriceWorktops: number;
  wg2ListPriceAccessories: number;
  wg2ListPriceLighting: number;
  volumePerKitchen: number;
  baseUnitLMPerKitchen: number;
  wallUnitLMPerKitchen: number;
  tallUnitLMPerKitchen: number;
  ceilingFillerLMPerKitchen: number;
  worktopLMPerKitchen: number;
  backSplashLMPerKitchen: number;
  sinkType1: number;
  sinkType2: number;
  mixer: number;
  hob: number;
  hood: number;
  refrigerator: number;
  oven: number;
  microwave: number;
  coffeeMachine: number;
  warmingDrawer: number;
  wineCooler: number;
}

export interface CostCalculationInputs {
  projectTitle: string;
  country: string;
  location: string;
  contactPerson: string;
  productSuppliedFrom: string;
  finishSet1Range: string;
  finishSet1FrontColour: string;
  finishSet1Carcass: string;
  finishSet1Handle: string;
  finishSet2Range: string;
  finishSet2FrontColour: string;
  finishSet2Carcass: string;
  finishSet2Handle: string;
  finishSet3Range: string;
  finishSet3FrontColour: string;
  finishSet3Carcass: string;
  finishSet3Handle: string;
  exchangeRate: number;
  exchangeRateContingency: number;
  wg1StandardDiscount: number;
  wg1SpecialDiscount: number;
  wg2StandardDiscount: number;
  wg2SpecialDiscount: number;
  logisticsBasedOnVolume: boolean;
  costPerContainer: number;
  volumePerContainerCBM: number;
  logisticsContingencyPct: number;
  freightInsurancePct: number;
  logisticsPctOfValue: number;
  logisticsPctContingency: number;
  logisticsPctInsurance: number;
  customsDutyRate1: number;
  customsDutyRate2: number;
  customsDutyRate3: number;
  customClearanceRate: number;
  offloadingRateAED: number;
  shiftingRateAED: number;
  storageRateAED: number;
  handlingRateAED: number;
  warehouseInsurancePct: number;
  localTransportationPct: number;
  installationBasedOnLM: boolean;
  installBaseUnitRateAED: number;
  installWallUnitRateAED: number;
  installTallUnitRateAED: number;
  installCeilingFillerRateAED: number;
  installPctOfValue: number;
  installContingencyPctLM: number;
  installContingencyPctValue: number;
  damageContingencyPct: number;
  priceFluctuationPct: number;
  fixedCostPct: number;
  profitMarkupPct: number;
  locallySourcedItems: LocallySourcedItem[];
}

export interface LocallySourcedItem {
  label: string;
  unitRate: number;
  marginPct: number;
}

export const DEFAULT_LOCALLY_SOURCED_LABELS = [
  'Worktop in LM & Rate',
  'Back Splash LM / Kitchen',
  'Sink Type1',
  'Sink Type2',
  'Mixer',
  'Hob',
  'Hood',
  'Refrigerator',
  'Oven',
  'Microwave',
  'Coffee Machine',
  'Warming Drawer',
  'Wine Cooler',
];

export interface CostingSheet {
  id: string;
  projectName: string;
  createdAt: string;
  qtyPrices: QtyPriceRow[];
  inputs: CostCalculationInputs;
}

export function createDefaultInputs(): CostCalculationInputs {
  return {
    projectTitle: '',
    country: 'United Arab Emirates',
    location: '',
    contactPerson: '',
    productSuppliedFrom: 'Nolte Kuechen',
    finishSet1Range: '',
    finishSet1FrontColour: '',
    finishSet1Carcass: '',
    finishSet1Handle: '',
    finishSet2Range: '',
    finishSet2FrontColour: '',
    finishSet2Carcass: '',
    finishSet2Handle: '',
    finishSet3Range: '',
    finishSet3FrontColour: '',
    finishSet3Carcass: '',
    finishSet3Handle: '',
    exchangeRate: 4.32,
    exchangeRateContingency: 0.01,
    wg1StandardDiscount: 0.78,
    wg1SpecialDiscount: 0,
    wg2StandardDiscount: 0.1,
    wg2SpecialDiscount: 0,
    logisticsBasedOnVolume: true,
    costPerContainer: 0,
    volumePerContainerCBM: 60,
    logisticsContingencyPct: 0.05,
    freightInsurancePct: 0.0029,
    logisticsPctOfValue: 0.055,
    logisticsPctContingency: 0.03,
    logisticsPctInsurance: 0.0029,
    customsDutyRate1: 0.05,
    customsDutyRate2: 0,
    customsDutyRate3: 0,
    customClearanceRate: 0.03,
    offloadingRateAED: 2250,
    shiftingRateAED: 240,
    storageRateAED: 0,
    handlingRateAED: 0,
    warehouseInsurancePct: 0.00265,
    localTransportationPct: 0,
    installationBasedOnLM: true,
    installBaseUnitRateAED: 90,
    installWallUnitRateAED: 100,
    installTallUnitRateAED: 110,
    installCeilingFillerRateAED: 50,
    installPctOfValue: 0.175,
    installContingencyPctLM: 0.02,
    installContingencyPctValue: 0.03,
    damageContingencyPct: 0.015,
    priceFluctuationPct: 0.005,
    fixedCostPct: 0.05,
    profitMarkupPct: 0.1275,
    locallySourcedItems: DEFAULT_LOCALLY_SOURCED_LABELS.map(label => ({
      label, unitRate: 0, marginPct: label === 'Worktop in LM & Rate' ? 0 : 0.1,
    })),
  };
}

export function createEmptyQtyRow(slNo: number): QtyPriceRow {
  return {
    slNo, kitchenType: '', qtyPerType: 0,
    wg1ListPriceCabinetry: 0, wg1ListPriceWorktops: 0,
    wg2ListPriceAccessories: 0, wg2ListPriceLighting: 0,
    volumePerKitchen: 0, baseUnitLMPerKitchen: 0, wallUnitLMPerKitchen: 0,
    tallUnitLMPerKitchen: 0, ceilingFillerLMPerKitchen: 0, worktopLMPerKitchen: 0,
    backSplashLMPerKitchen: 0, sinkType1: 0, sinkType2: 0, mixer: 0,
    hob: 0, hood: 0, refrigerator: 0, oven: 0, microwave: 0,
    coffeeMachine: 0, warmingDrawer: 0, wineCooler: 0,
  };
}

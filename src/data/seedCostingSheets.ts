import { CostingSheet, createDefaultInputs } from '@/types/costingSheet';

/**
 * Seed costing sheet data — loaded when localStorage has no saved sheets.
 */
export function getSeedCostingSheets(): CostingSheet[] {
  const inputs = createDefaultInputs();
  inputs.projectTitle = 'Demo1';
  inputs.country = 'United Arab Emirates';
  inputs.location = 'United Arab Emirates';
  inputs.contactPerson = 'Ahmed Al-Rashid';
  inputs.productSuppliedFrom = 'Nolte Kuechen';
  inputs.finishSet1Range = 'Artwood / Legno';
  inputs.finishSet1FrontColour = 'Oak Mocha';
  inputs.finishSet1Carcass = 'White';
  inputs.finishSet1Handle = 'Rail Handle Black';
  inputs.exchangeRate = 4.32;
  inputs.exchangeRateContingency = 0.01;
  inputs.wg1StandardDiscount = 0.78;
  inputs.wg1SpecialDiscount = 0;
  inputs.wg2StandardDiscount = 0.1;
  inputs.wg2SpecialDiscount = 0;
  inputs.costPerContainer = 3200;
  inputs.volumePerContainerCBM = 60;
  inputs.installBaseUnitRateAED = 90;
  inputs.installWallUnitRateAED = 100;
  inputs.installTallUnitRateAED = 110;
  inputs.installCeilingFillerRateAED = 50;
  inputs.profitMarkupPct = 0.1275;
  inputs.fixedCostPct = 0.05;

  // Locally sourced items with sample rates
  inputs.locallySourcedItems = inputs.locallySourcedItems.map(item => {
    const rates: Record<string, number> = {
      'Worktop in LM & Rate': 450,
      'Back Splash LM / Kitchen': 180,
      'Sink Type1': 1200,
      'Sink Type2': 800,
      'Mixer': 650,
      'Hob': 2800,
      'Hood': 2200,
      'Refrigerator': 3500,
      'Oven': 3200,
      'Microwave': 1800,
      'Coffee Machine': 4500,
      'Warming Drawer': 2100,
      'Wine Cooler': 3800,
    };
    return { ...item, unitRate: rates[item.label] || 0 };
  });

  return [
    {
      id: 'seed-demo1',
      projectName: 'Demo1',
      createdAt: new Date().toISOString(),
      qtyPrices: [
        {
          slNo: 1, kitchenType: 'Type A - Studio', qtyPerType: 45,
          wg1ListPriceCabinetry: 3200, wg1ListPriceWorktops: 850,
          wg2ListPriceAccessories: 420, wg2ListPriceLighting: 280,
          volumePerKitchen: 2.8, baseUnitLMPerKitchen: 3.6, wallUnitLMPerKitchen: 2.4,
          tallUnitLMPerKitchen: 0.6, ceilingFillerLMPerKitchen: 0.3,
          worktopLMPerKitchen: 4.2, backSplashLMPerKitchen: 3.8,
          sinkType1: 1, sinkType2: 0, mixer: 1, hob: 1, hood: 1,
          refrigerator: 1, oven: 0, microwave: 1, coffeeMachine: 0, warmingDrawer: 0, wineCooler: 0,
        },
        {
          slNo: 2, kitchenType: 'Type B - 1BR', qtyPerType: 80,
          wg1ListPriceCabinetry: 5400, wg1ListPriceWorktops: 1200,
          wg2ListPriceAccessories: 680, wg2ListPriceLighting: 350,
          volumePerKitchen: 4.5, baseUnitLMPerKitchen: 5.2, wallUnitLMPerKitchen: 3.6,
          tallUnitLMPerKitchen: 1.2, ceilingFillerLMPerKitchen: 0.5,
          worktopLMPerKitchen: 6.0, backSplashLMPerKitchen: 5.4,
          sinkType1: 1, sinkType2: 0, mixer: 1, hob: 1, hood: 1,
          refrigerator: 1, oven: 1, microwave: 1, coffeeMachine: 0, warmingDrawer: 0, wineCooler: 0,
        },
        {
          slNo: 3, kitchenType: 'Type C - 2BR', qtyPerType: 50,
          wg1ListPriceCabinetry: 7800, wg1ListPriceWorktops: 1800,
          wg2ListPriceAccessories: 950, wg2ListPriceLighting: 520,
          volumePerKitchen: 6.2, baseUnitLMPerKitchen: 7.0, wallUnitLMPerKitchen: 4.8,
          tallUnitLMPerKitchen: 1.8, ceilingFillerLMPerKitchen: 0.8,
          worktopLMPerKitchen: 8.0, backSplashLMPerKitchen: 7.2,
          sinkType1: 1, sinkType2: 1, mixer: 2, hob: 1, hood: 1,
          refrigerator: 1, oven: 1, microwave: 1, coffeeMachine: 1, warmingDrawer: 0, wineCooler: 1,
        },
      ],
      inputs,
    },
  ];
}

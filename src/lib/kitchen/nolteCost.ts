import type { CostingSheet, QtyPriceRow, CostCalculationInputs } from "@/types/costingSheet";
import { getSeedCostingSheets } from "@/data/seedCostingSheets";

export interface NolteCostBreakdown {
  cabinetryAED: number;
  worktopsAED: number;
  accessoriesAED: number;
  lightingAED: number;
  appliancesAED: number;
  installationAED: number;
  logisticsAED: number;
  contingencyAED: number;
  subtotalAED: number;
  markupAED: number;
  totalAED: number;
}

/**
 * Simplified Nolte costing for a single kitchen of a given type.
 * Mirrors the discount + markup structure from the ERP without the full
 * shipping/installation breakdown.
 */
export function calcNolteKitchenCost(
  row: QtyPriceRow,
  inputs: CostCalculationInputs
): NolteCostBreakdown {
  const fx = inputs.exchangeRate * (1 + inputs.exchangeRateContingency);

  // WG1 (cabinetry + worktops) — list price in EUR, apply discount, convert to AED
  const wg1Discount = 1 - inputs.wg1StandardDiscount - inputs.wg1SpecialDiscount;
  const cabinetryAED = row.wg1ListPriceCabinetry * wg1Discount * fx;
  const worktopsAED = row.wg1ListPriceWorktops * wg1Discount * fx;

  // WG2 (accessories + lighting)
  const wg2Discount = 1 - inputs.wg2StandardDiscount - inputs.wg2SpecialDiscount;
  const accessoriesAED = row.wg2ListPriceAccessories * wg2Discount * fx;
  const lightingAED = row.wg2ListPriceLighting * wg2Discount * fx;

  // Locally-sourced appliances (already AED via unitRate)
  const lookup = new Map(inputs.locallySourcedItems.map((i) => [i.label, i]));
  const applianceLabelToCount: Record<string, number> = {
    "Sink Type1": row.sinkType1,
    "Sink Type2": row.sinkType2,
    Mixer: row.mixer,
    Hob: row.hob,
    Hood: row.hood,
    Refrigerator: row.refrigerator,
    Oven: row.oven,
    Microwave: row.microwave,
    "Coffee Machine": row.coffeeMachine,
    "Warming Drawer": row.warmingDrawer,
    "Wine Cooler": row.wineCooler,
  };
  let appliancesAED = 0;
  for (const [label, qty] of Object.entries(applianceLabelToCount)) {
    const item = lookup.get(label);
    if (!item || qty <= 0) continue;
    appliancesAED += item.unitRate * qty * (1 + item.marginPct);
  }
  // Worktop & backsplash from LM
  const worktop = lookup.get("Worktop in LM & Rate");
  if (worktop) {
    appliancesAED += worktop.unitRate * row.worktopLMPerKitchen * (1 + worktop.marginPct);
  }
  const backsplash = lookup.get("Back Splash LM / Kitchen");
  if (backsplash) {
    appliancesAED +=
      backsplash.unitRate * row.backSplashLMPerKitchen * (1 + backsplash.marginPct);
  }

  // Installation per LM
  const installationAED =
    row.baseUnitLMPerKitchen * inputs.installBaseUnitRateAED +
    row.wallUnitLMPerKitchen * inputs.installWallUnitRateAED +
    row.tallUnitLMPerKitchen * inputs.installTallUnitRateAED +
    row.ceilingFillerLMPerKitchen * inputs.installCeilingFillerRateAED;

  // Logistics (volume-based, simplified)
  const logisticsAED = inputs.logisticsBasedOnVolume
    ? (row.volumePerKitchen / Math.max(1, inputs.volumePerContainerCBM)) *
      inputs.costPerContainer *
      (1 + inputs.logisticsContingencyPct)
    : (cabinetryAED + worktopsAED) * inputs.logisticsPctOfValue;

  const subtotalAED =
    cabinetryAED +
    worktopsAED +
    accessoriesAED +
    lightingAED +
    appliancesAED +
    installationAED +
    logisticsAED;

  const contingencyAED = subtotalAED * (inputs.damageContingencyPct + inputs.priceFluctuationPct);
  const withFixed = subtotalAED + contingencyAED + subtotalAED * inputs.fixedCostPct;
  const markupAED = withFixed * inputs.profitMarkupPct;
  const totalAED = withFixed + markupAED;

  return {
    cabinetryAED,
    worktopsAED,
    accessoriesAED,
    lightingAED,
    appliancesAED,
    installationAED,
    logisticsAED,
    contingencyAED,
    subtotalAED,
    markupAED,
    totalAED,
  };
}

export function formatAED(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function getDemoSheet(): CostingSheet {
  return getSeedCostingSheets()[0];
}
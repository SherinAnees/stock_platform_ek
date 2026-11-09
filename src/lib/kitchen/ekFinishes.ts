/**
 * Express Küchen 2026 finish catalog.
 * Source: EK_PRODUCT_GUIDE_2026 — Carcase / plinth finishes & Worktops.
 * Hex colours are visual approximations for 3D preview only.
 */

export interface EkFinish {
  code: string;
  name: string;
  color: string;
  /** Plinth-only finishes cannot be used as carcase colour. */
  plinthOnly?: boolean;
  /** Material hint for shading. */
  material: "matt" | "wood" | "metal";
}

export const EK_CARCASE_FINISHES: EkFinish[] = [
  { code: "K01", name: "White", color: "#f3efe8", material: "matt" },
  { code: "K02", name: "Magnolia", color: "#f1e7d3", material: "matt" },
  { code: "K39", name: "Light grey", color: "#c9c9c5", material: "matt" },
  { code: "K19", name: "Cream grey", color: "#cfc7b6", material: "matt" },
  { code: "K23", name: "Anthracite", color: "#3a3d40", material: "matt" },
  { code: "K44", name: "Natural oak", color: "#c39a6b", material: "wood" },
  { code: "K61", name: "Knotty oak", color: "#a87f55", material: "wood" },
  { code: "K62", name: "Grey oak", color: "#8a857a", material: "wood" },
  { code: "EST", name: "Stainless steel look", color: "#b9bcbe", plinthOnly: true, material: "metal" },
  { code: "K29", name: "Black", color: "#1a1a1a", plinthOnly: true, material: "matt" },
];

export interface EkWorktop {
  code: string;
  name: string;
  color: string;
  /** A1 = standard, A2 = premium per the guide. */
  group: "A1" | "A2";
}

export const EK_WORKTOPS: EkWorktop[] = [
  { code: "P41", name: "White stone structure", color: "#ece8e0", group: "A2" },
  { code: "P43", name: "Anthracite stone structure", color: "#3c3e40", group: "A2" },
  { code: "P46", name: "Black stone structure", color: "#1c1c1c", group: "A2" },
  { code: "P66", name: "Wild oak", color: "#8a6240", group: "A1" },
  { code: "P55", name: "Knotty beech", color: "#c79a6e", group: "A2" },
  { code: "P44", name: "Natural oak", color: "#c39a6b", group: "A1" },
  { code: "P48", name: "Rustic oak", color: "#9a6f44", group: "A1" },
  { code: "P64", name: "Mountain oak", color: "#7d5a37", group: "A1" },
  { code: "P61", name: "Knotty oak", color: "#a87f55", group: "A1" },
  { code: "P59", name: "Brown grey oak", color: "#7a6a55", group: "A2" },
  { code: "P99", name: "Brown oak", color: "#6e4d2c", group: "A2" },
  { code: "P62", name: "Grey oak", color: "#8a857a", group: "A1" },
  { code: "P40", name: "Walnut brown", color: "#4a2e1c", group: "A1" },
  { code: "P56", name: "Stone white concrete", color: "#dcd9d2", group: "A2" },
  { code: "P67", name: "Light terrazzo", color: "#d6cfbf", group: "A2" },
  { code: "P31", name: "Light marble", color: "#e8e4dc", group: "A2" },
  { code: "P38", name: "Cream grey cement", color: "#b8ad99", group: "A2" },
  { code: "P87", name: "Light concrete", color: "#bcb6ab", group: "A2" },
  { code: "P52", name: "Granite, light", color: "#a8a39a", group: "A2" },
  { code: "P36", name: "Crema sand lime", color: "#cdbf9f", group: "A2" },
  { code: "P69", name: "Marble greywhite", color: "#cfc9bf", group: "A2" },
  { code: "P94", name: "Brown granite", color: "#6e5a3f", group: "A2" },
  { code: "P60", name: "Granite, green brown", color: "#5a5a3d", group: "A2" },
  { code: "P58", name: "Dark steel", color: "#3c3f44", group: "A2" },
  { code: "P88", name: "Lava grey", color: "#2e2e2e", group: "A2" },
  { code: "P97", name: "Dark cement", color: "#3a3a3a", group: "A2" },
  { code: "P79", name: "Dark concrete", color: "#2a2a2a", group: "A2" },
];

export const EK_HANDLES = [
  { code: "259", name: "Black mat metal", color: "#1a1a1a" },
  { code: "284", name: "Black metal", color: "#222222" },
  { code: "293", name: "Brass", color: "#b08d57" },
  { code: "625", name: "Combination 625 — black mat", color: "#1a1a1a" },
  { code: "626", name: "Combination 626 — stainless look", color: "#b9bcbe" },
  { code: "627", name: "Combination 627 — black mat", color: "#1a1a1a" },
  { code: "628", name: "Combination 628 — stainless look", color: "#b9bcbe" },
] as const;

/**
 * Front (door / drawer) finishes, addressed by Express Küchen front-colour
 * codes (e.g. 282/283/284 matt, 232/233 gloss, 169 wood).
 * Colours are visual approximations for 3D preview only.
 */
export interface EkFrontFinish {
  code: string;
  name: string;
  color: string;
  material: "matt" | "gloss" | "wood";
}

export const EK_FRONT_FINISHES: EkFrontFinish[] = [
  { code: "282", name: "Mat Magnolia",     color: "#ece4cf", material: "matt"  },
  { code: "283", name: "Mat Anthracite",   color: "#4a4d4a", material: "matt"  },
  { code: "284", name: "Mat Cream Grey",   color: "#9b8b73", material: "matt"  },
  { code: "232", name: "Gloss Magnolia",   color: "#f5efd9", material: "gloss" },
  { code: "233", name: "Gloss Anthracite", color: "#6c7074", material: "gloss" },
  { code: "169", name: "Natural Oak",      color: "#c9a878", material: "wood"  },
  { code: "167", name: "Knotty Oak",       color: "#a87f55", material: "wood"  },
];

/**
 * Curated stock colour themes — each theme bundles a Range, a Front finish
 * and a Carcase / Plinth finish so the user picks one swatch instead of
 * configuring fronts and carcase separately.
 */
export interface EkColorTheme {
  id: string;
  name: string;
  range: "CLEAN" | "STAR" | "PLAN";
  frontCode: string;
  carcaseCode: string;
}

export const EK_COLOR_THEMES: EkColorTheme[] = [
  { id: "clean-magnolia",        name: "Clean-Magnolia",        range: "CLEAN", frontCode: "282", carcaseCode: "K02" },
  { id: "clean-anthracite",      name: "Clean-Anthracite",      range: "CLEAN", frontCode: "283", carcaseCode: "K23" },
  { id: "clean-cream-grey",      name: "Clean-Cream Grey",      range: "CLEAN", frontCode: "284", carcaseCode: "K19" },
  { id: "star-magnolia-gloss",   name: "Star-Magnolia Gloss",   range: "STAR",  frontCode: "232", carcaseCode: "K02" },
  { id: "star-anthracite-gloss", name: "Star-Anthracite Gloss", range: "STAR",  frontCode: "233", carcaseCode: "K23" },
  { id: "plan-natural-oak",      name: "Plan-Natural Oak",      range: "PLAN",  frontCode: "169", carcaseCode: "K44" },
];

export const EK_DEFAULT_THEME = EK_COLOR_THEMES[0].id;

export function getColorTheme(id: string): EkColorTheme {
  return EK_COLOR_THEMES.find((t) => t.id === id) ?? EK_COLOR_THEMES[0];
}

export function getFrontFinish(code: string): { code: string; name: string; color: string } {
  const front = EK_FRONT_FINISHES.find((f) => f.code === code);
  if (front) return front;
  const carcase = EK_CARCASE_FINISHES.find((f) => f.code === code);
  if (carcase) return carcase;
  return { code, name: code, color: "#e8dcc4" };
}

export const EK_RANGES = [
  { code: "WIN", priceGroup: 0, line: "SYSTEMLINE" },
  { code: "PLAN", priceGroup: 1, line: "SYSTEMLINE" },
  { code: "HOME", priceGroup: 2, line: "HOME" },
] as const;

/** Picks a sensible default carcase + worktop. */
export const EK_DEFAULT_FINISH = "K01";
export const EK_DEFAULT_WORKTOP = "P41";
export const EK_DEFAULT_HANDLE = "284";

export function getCarcaseFinish(code: string): EkFinish {
  return (
    EK_CARCASE_FINISHES.find((f) => f.code === code) ??
    EK_CARCASE_FINISHES.find((f) => f.code === EK_DEFAULT_FINISH)!
  );
}

export function getWorktop(code: string): EkWorktop {
  return (
    EK_WORKTOPS.find((w) => w.code === code) ??
    EK_WORKTOPS.find((w) => w.code === EK_DEFAULT_WORKTOP)!
  );
}

export function getHandleColor(code: string): string {
  return EK_HANDLES.find((h) => h.code === code)?.color ?? "#222222";
}
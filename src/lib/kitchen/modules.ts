export type ModuleCategory =
  | "base"
  | "wall"
  | "tall"
  | "appliance"
  | "panel"
  | "accessory";

export type HandlePosition =
  | "top_center"
  | "top_opposite_hinge"
  | "vertical_top"
  | "vertical_middle"
  | "bottom_center";

export type FrontSectionKind = "door_single" | "door_double" | "niche" | "drawer";

export interface FrontSection {
  kind: FrontSectionKind;
  /** Section height in mm; sections stack bottom → top */
  height_mm: number;
  /** Hinge for single-door sections */
  hinge?: "L" | "R";
  /** Per-section handle position (falls back to module.handlePosition) */
  handle?: HandlePosition;
}

export interface StockModule {
  id: string;
  name: string;
  category: ModuleCategory;
  /** dimensions in meters (W x H x D) */
  width: number;
  height: number;
  depth: number;
  /** base Y offset in meters (e.g. wall cabinets sit higher) */
  baseY: number;
  color: string;
  accentColor?: string;
  price: number;
  description: string;
  /** Express Küchen unit code (raw, with spaces) */
  unitCode?: string;
  /** EK unit-type classification: BU / TU / WU / PLINTH */
  unitType?: "BU" | "TU" | "WU" | "PLINTH";
  /** Custom front layout, for procedurally-generated modules */
  frontLayout?:
    | "single_door"
    | "double_door"
    | "drawer_over_door"
    | "drawer_stack"
    | "open_shelf"
    | "blank_panel"
    | "horizontal_split";
  /** Drawer height in mm (used by drawer_over_door layout) */
  drawerHeightMm?: number;
  /** Per-drawer heights in mm (used by drawer_stack layout) */
  drawerHeightsMm?: number[];
  /** Horizontal-split sections (used by horizontal_split layout) */
  frontSections?: FrontSection[];
  /** Default handle position applied to all fronts on this module */
  handlePosition?: HandlePosition;
}

interface EkRow {
  unitType: "BU" | "TU" | "WU" | "PLINTH";
  h: number; // mm
  w: number; // mm
  d: number; // mm
  code: string;
  desc: string;
}

const EK_ELEMENTS: EkRow[] = [
  { unitType: "BU", h: 750, w: 1100, d: 650, code: "EUAC110-65  L", desc: "Corner base unit LE MANS, 1 full-height door, Dir=Left" },
  { unitType: "BU", h: 750, w: 1100, d: 650, code: "EUAC110-65  R", desc: "Corner base unit LE MANS, 1 full-height door, Dir=Right" },
  { unitType: "BU", h: 750, w: 1150, d: 650, code: "EUAE110-65  L", desc: "Corner base unit, Carcase width 900mm, Dir=Left" },
  { unitType: "BU", h: 750, w: 1150, d: 650, code: "EUAE110-65  R", desc: "Corner base unit, Carcase width 900mm, Dir=Right" },
  { unitType: "BU", h: 750, w: 900, d: 900, code: "EUC90  L", desc: "Corner base unit, 900x900mm, Dir=Left" },
  { unitType: "BU", h: 750, w: 900, d: 900, code: "EUC90  R", desc: "Corner base unit, 900x900mm, Dir=Right" },
  { unitType: "BU", h: 750, w: 300, d: 580, code: "PSU2",       desc: "Base unit filler panel, W=101, D=560" },
  { unitType: "BU", h: 750, w: 1200, d: 580, code: "SP120",     desc: "Sink base unit, 2 doors" },
  { unitType: "BU", h: 750, w: 600, d: 580, code: "SP60  L",    desc: "Sink base unit, 1 door, Dir=Left" },
  { unitType: "BU", h: 750, w: 600, d: 580, code: "SP60  R",    desc: "Sink base unit, 1 door, Dir=Right" },
  { unitType: "BU", h: 750, w: 900, d: 580, code: "SP90",       desc: "Sink base unit, 2 doors" },
  { unitType: "BU", h: 750, w: 600, d: 100, code: "TGS60-01",   desc: "Front panel for fully integrated dishwasher" },
  { unitType: "BU", h: 750, w: 1000, d: 580, code: "U100",      desc: "Base unit, 2 doors" },
  { unitType: "BU", h: 750, w: 1000, d: 580, code: "U2AS100",   desc: "Base unit, 2 pull-outs, 1 drawer" },
  { unitType: "BU", h: 750, w: 450, d: 580, code: "U2AS45",     desc: "Base unit, 2 pull-outs, 1 drawer" },
  { unitType: "BU", h: 750, w: 600, d: 580, code: "U2AS60",     desc: "Base unit, 2 pull-outs, 1 drawer" },
  { unitType: "BU", h: 750, w: 300, d: 580, code: "U30  L",     desc: "Base unit 1 door, 2 adjustable shelves, Dir=Left" },
  { unitType: "BU", h: 750, w: 300, d: 580, code: "U30  R",     desc: "Base unit 1 door, 2 adjustable shelves, Dir=Right" },
  { unitType: "BU", h: 750, w: 450, d: 580, code: "U45  L",     desc: "Base unit 1 door, 2 adjustable shelves, Dir=Left" },
  { unitType: "BU", h: 750, w: 450, d: 580, code: "U45  R",     desc: "Base unit 1 door, 2 adjustable shelves, Dir=Right" },
  { unitType: "BU", h: 750, w: 500, d: 580, code: "U50  L",     desc: "Base unit 1 door, 2 adjustable shelves, Dir=Left" },
  { unitType: "BU", h: 750, w: 500, d: 580, code: "U50  R",     desc: "Base unit 1 door, 2 adjustable shelves, Dir=Right" },
  { unitType: "BU", h: 750, w: 600, d: 580, code: "U60  L",     desc: "Base unit 1 door, 2 adjustable shelves, Dir=Left" },
  { unitType: "BU", h: 750, w: 600, d: 580, code: "U60  R",     desc: "Base unit 1 door, 2 adjustable shelves, Dir=Right" },
  { unitType: "BU", h: 750, w: 900, d: 580, code: "U90",        desc: "Base unit, 2 doors" },
  { unitType: "BU", h: 750, w: 600, d: 580, code: "UHBL60-EST", desc: "Oven housing in combination with 25mm" },

  { unitType: "PLINTH", h: 120, w: 2100, d: 50, code: "SOBL-210", desc: "Plinth panels, Length 2100mm" },
  { unitType: "PLINTH", h: 120, w: 3150, d: 50, code: "SOBL-315", desc: "Plinth panels, Length 3150mm" },
  { unitType: "PLINTH", h: 120, w: 50,   d: 50, code: "SOSBLT",   desc: "Plinth side return" },

  { unitType: "TU", h: 2100, w: 300, d: 580, code: "PSS2-7-13-210  L", desc: "Unit filler panel, W=150, D=560, Dir=Left" },
  { unitType: "TU", h: 2100, w: 300, d: 580, code: "PSS2-7-13-210  R", desc: "Unit filler panel, W=150, D=560, Dir=Right" },
  { unitType: "TU", h: 2100, w: 600, d: 580, code: "SBB-210-3-1  L", desc: "Appliance housing, 1 door, Dir=Left" },
  { unitType: "TU", h: 2100, w: 600, d: 580, code: "SBB-210-3-1  R", desc: "Appliance housing, 1 door, Dir=Right" },
  { unitType: "TU", h: 2100, w: 600, d: 580, code: "SKG-210-178  L", desc: "Appliance housing, 1 aperture with 2 doors, Dir=Left" },
  { unitType: "TU", h: 2100, w: 600, d: 580, code: "SKG-210-178  R", desc: "Appliance housing, 1 aperture with 2 doors, Dir=Right" },
  { unitType: "TU", h: 2100, w: 600, d: 580, code: "SV60-210-1  L",  desc: "Larder unit, 1 pin-joined door, Dir=Left" },
  { unitType: "TU", h: 2100, w: 600, d: 580, code: "SV60-210-1  R",  desc: "Larder unit, 1 pin-joined door, Dir=Right" },

  { unitType: "WU", h: 750, w: 650, d: 650, code: "EO2T65-75-L", desc: "Corner wall unit, 2 doors with wide-angle, Dir=Left" },
  { unitType: "WU", h: 750, w: 650, d: 650, code: "EO2T65-75-R", desc: "Corner wall unit, 2 doors with wide-angle, Dir=Right" },
  { unitType: "WU", h: 750, w: 900, d: 450, code: "EO90-75  L",  desc: "Corner wall unit, 1 door 450mm, Dir=Left" },
  { unitType: "WU", h: 750, w: 900, d: 450, code: "EO90-75  R",  desc: "Corner wall unit, 1 door 450mm, Dir=Right" },
  { unitType: "WU", h: 750, w: 1000, d: 370, code: "O100-75",    desc: "Wall unit, 2 doors" },
  { unitType: "WU", h: 750, w: 300, d: 370, code: "O30-75  L",   desc: "Wall unit, 1 door, Dir=Left" },
  { unitType: "WU", h: 750, w: 300, d: 370, code: "O30-75  R",   desc: "Wall unit, 1 door, Dir=Right" },
  { unitType: "WU", h: 750, w: 450, d: 370, code: "O45-75  L",   desc: "Wall unit, 1 door, Dir=Left" },
  { unitType: "WU", h: 750, w: 450, d: 370, code: "O45-75  R",   desc: "Wall unit, 1 door, Dir=Right" },
  { unitType: "WU", h: 750, w: 500, d: 370, code: "O50-75  L",   desc: "Wall unit, 1 door, Dir=Left" },
  { unitType: "WU", h: 750, w: 500, d: 370, code: "O50-75  R",   desc: "Wall unit, 1 door, Dir=Right" },
  { unitType: "WU", h: 750, w: 600, d: 370, code: "O60-75  L",   desc: "Wall unit, 1 door, Dir=Left" },
  { unitType: "WU", h: 750, w: 600, d: 370, code: "O60-75  R",   desc: "Wall unit, 1 door, Dir=Right" },
  { unitType: "WU", h: 750, w: 900, d: 370, code: "O90-75",      desc: "Wall unit, 2 doors" },
  { unitType: "WU", h: 600, w: 600, d: 370, code: "OAB60-60  L", desc: "Housing for integrated cooker hood, Dir=Left" },
  { unitType: "WU", h: 600, w: 600, d: 370, code: "OAB60-60  R", desc: "Housing for integrated cooker hood, Dir=Right" },
  { unitType: "WU", h: 750, w: 600, d: 370, code: "OAB60-75  L", desc: "Housing for integrated cooker hood, Dir=Left" },
  { unitType: "WU", h: 750, w: 600, d: 370, code: "OAB60-75  R", desc: "Housing for integrated cooker hood, Dir=Right" },
  { unitType: "WU", h: 750, w: 300, d: 370, code: "PSO2-75",     desc: "Wall unit filler panel, W=101, D=350" },
];

function slugCode(code: string): string {
  return code.trim().replace(/\s+/g, "-");
}

function categoryFor(row: EkRow): ModuleCategory {
  switch (row.unitType) {
    case "BU":     return "base";
    case "TU":     return "tall";
    case "WU":     return "wall";
    case "PLINTH": return "panel";
  }
}

function baseYFor(row: EkRow): number {
  // 120mm plinth lifts base and tall units off the floor
  const PLINTH = 0.12;
  if (row.unitType === "WU") {
    // Align wall unit top edge with tall unit top edge (plinth + 2100mm = 2.22m)
    const TALL_TOP = PLINTH + 2.1;
    return TALL_TOP - row.h / 1000;
  }
  if (row.unitType === "PLINTH") return 0;
  // BU and TU sit on top of the 120mm plinth
  return PLINTH;
}

function priceFor(row: EkRow): number {
  const wM = row.w / 1000;
  const rate =
    row.unitType === "BU"     ? 320 :
    row.unitType === "WU"     ? 240 :
    row.unitType === "TU"     ? 620 :
    /* PLINTH */                40;
  return Math.round(rate * Math.max(wM, 0.2));
}

function colorFor(cat: ModuleCategory): { color: string; accent: string } {
  switch (cat) {
    case "base":      return { color: "#e8dcc4", accent: "#b08d57" };
    case "wall":      return { color: "#f0e6d2", accent: "#b08d57" };
    case "tall":      return { color: "#e2d3b4", accent: "#8a6a3b" };
    case "panel":     return { color: "#d9c9a8", accent: "#8a6a3b" };
    case "appliance": return { color: "#c8c8c8", accent: "#5a5a5a" };
    case "accessory": return { color: "#3a2c1f", accent: "#b08d57" };
  }
}

export const STOCK_MODULES: StockModule[] = EK_ELEMENTS.map((row) => {
  const id = slugCode(row.code);
  const category = categoryFor(row);
  const { color, accent } = colorFor(category);
  return {
    id,
    name: `${row.code.trim()} — ${row.desc}`,
    category,
    width: row.w / 1000,
    height: row.h / 1000,
    depth: row.d / 1000,
    baseY: baseYFor(row),
    color,
    accentColor: accent,
    price: priceFor(row),
    description: row.desc,
    unitCode: row.code,
    unitType: row.unitType,
  };
});

export const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  base: "BU",
  wall: "WU",
  tall: "TU",
  panel: "PLINTH",
  appliance: "Appliances",
  accessory: "Accessories",
};

export function getModule(id: string): StockModule | undefined {
  return (
    STOCK_MODULES.find((m) => m.id === id) ??
    CUSTOM_MODULES_REGISTRY.get(id)
  );
}

// ============================================================
// Custom (procedurally-generated) modules registry
// ------------------------------------------------------------
// Articles added by Admin whose 3D model was built via the wizard
// are registered here at runtime. They flow through `getModule()`
// exactly like the built-in EK library, so `Module3D`, the BOM,
// the store and the review dialog all work with no per-caller
// changes.
// ============================================================

export interface CustomModelConfig {
  subtype:
    | "single_door"
    | "double_door"
    | "drawer_stack"
    | "open_shelf"
    | "blank_panel"
    | "drawer_over_door"
    | "horizontal_split";
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  hinge?: "L" | "R";
  base_y_mm?: number; // optional override for wall-unit mounting height
  /** Height of the top drawer in mm (used by drawer_over_door) */
  drawer_height_mm?: number;
  /** Per-drawer heights in mm (used by drawer_stack layout) */
  drawer_heights_mm?: number[];
  /** Horizontal-split sections (bottom → top) */
  sections?: FrontSection[];
  /** Default handle position applied to all fronts */
  handle_position?: HandlePosition;
  notes?: string;
}

export const CUSTOM_MODULES_REGISTRY: Map<string, StockModule> = new Map();

export function slugArticleCode(code: string): string {
  return slugCode(code);
}

function unitTypeForCategory(cat: ModuleCategory): "BU" | "TU" | "WU" | "PLINTH" {
  switch (cat) {
    case "wall": return "WU";
    case "tall": return "TU";
    case "panel": return "PLINTH";
    default: return "BU";
  }
}

function baseYForCustom(cat: ModuleCategory, h_mm: number, override?: number): number {
  if (typeof override === "number") return override / 1000;
  const PLINTH = 0.12;
  if (cat === "wall") {
    const TALL_TOP = PLINTH + 2.1;
    return Math.max(0, TALL_TOP - h_mm / 1000);
  }
  if (cat === "panel") return 0;
  return PLINTH;
}

function priceForCustom(cat: ModuleCategory, w_mm: number, fallback: number): number {
  if (fallback > 0) return fallback;
  const wM = w_mm / 1000;
  const rate = cat === "base" ? 320 : cat === "wall" ? 240 : cat === "tall" ? 620 : 40;
  return Math.round(rate * Math.max(wM, 0.2));
}

/**
 * Build a StockModule from an Article + its `model_config` and add it to the
 * runtime registry so the whole Kitchen Designer can resolve it. Returns the
 * module id.
 */
export function registerCustomModule(input: {
  articleCode: string;
  articleName: string;
  category: ModuleCategory;
  price?: number;
  config: CustomModelConfig;
}): string {
  const id = slugCode(input.articleCode);
  const { color, accent } = colorFor(input.category);
  const mod: StockModule = {
    id,
    name: `${input.articleCode.trim()} — ${input.articleName}`,
    category: input.category,
    width: input.config.width_mm / 1000,
    height: input.config.height_mm / 1000,
    depth: input.config.depth_mm / 1000,
    baseY: baseYForCustom(input.category, input.config.height_mm, input.config.base_y_mm),
    color,
    accentColor: accent,
    price: priceForCustom(input.category, input.config.width_mm, input.price ?? 0),
    description: input.articleName,
    unitCode: input.articleCode,
    unitType: unitTypeForCategory(input.category),
    frontLayout: input.config.subtype,
    drawerHeightMm: input.config.drawer_height_mm,
    drawerHeightsMm: input.config.drawer_heights_mm,
    frontSections: input.config.sections,
    handlePosition: input.config.handle_position,
  };
  CUSTOM_MODULES_REGISTRY.set(id, mod);
  return id;
}

export function unregisterCustomModule(articleCode: string): void {
  CUSTOM_MODULES_REGISTRY.delete(slugCode(articleCode));
}

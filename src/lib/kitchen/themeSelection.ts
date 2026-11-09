import { create } from "zustand";
import { persist } from "zustand/middleware";
import { THEMES } from "./themeStock";

export type EkUnitType = "BU" | "TU" | "WU" | "PLINTH";

export const UNIT_TYPE_LABELS: Record<EkUnitType, string> = {
  BU: "Base Units",
  TU: "Tall Units",
  WU: "Wall Units",
  PLINTH: "Plinth",
};

const DEFAULT_THEME = THEMES[0].id;

interface ThemeSelectionState {
  themesByUnitType: Record<EkUnitType, string>;
  setThemeFor: (ut: EkUnitType, themeId: string) => void;
}

export const useThemeSelection = create<ThemeSelectionState>()(
  persist(
    (set) => ({
      themesByUnitType: {
        BU: DEFAULT_THEME,
        TU: DEFAULT_THEME,
        WU: DEFAULT_THEME,
        PLINTH: DEFAULT_THEME,
      },
      setThemeFor: (ut, themeId) =>
        set((s) => ({
          themesByUnitType: { ...s.themesByUnitType, [ut]: themeId },
        })),
    }),
    { name: "ek-theme-selection-v1" }
  )
);

import type { ModuleCategory } from "./modules";

export function categoryToUnitType(cat: ModuleCategory): EkUnitType {
  switch (cat) {
    case "base": return "BU";
    case "tall": return "TU";
    case "wall": return "WU";
    case "panel": return "PLINTH";
    default: return "BU";
  }
}
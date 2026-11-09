import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ModuleCategory, StockModule } from "@/lib/kitchen/modules";

export interface CustomModule extends StockModule {
  /** Optional override for weight (kg). If absent, weight is computed from volume. */
  weightKg?: number;
  /** Optional override for volume (CBM). If absent, computed from W×H×D. */
  volumeCbm?: number;
  /** Per-element finish overrides for the stock list. */
  carcaseCode?: string;
  frontCode?: string;
}

interface CustomModulesState {
  modules: CustomModule[];
  finishes: Record<string, { carcaseCode?: string; frontCode?: string }>;
  volumes: Record<string, number>;
  /** Per-element overrides for any module (built-in or custom). */
  overrides: Record<string, Partial<CustomModule>>;
  /** IDs of built-in modules the user has hidden ("deleted"). */
  hidden: string[];
  addModule: (m: CustomModule) => void;
  removeModule: (id: string) => void;
  setFinish: (
    moduleId: string,
    patch: { carcaseCode?: string; frontCode?: string }
  ) => void;
  setVolume: (moduleId: string, volumeCbm: number | undefined) => void;
  setOverride: (moduleId: string, patch: Partial<CustomModule>) => void;
  clearOverride: (moduleId: string) => void;
  hideModule: (moduleId: string) => void;
  unhideModule: (moduleId: string) => void;
}

export const useCustomModules = create<CustomModulesState>()(
  persist(
    (set) => ({
      modules: [],
      finishes: {},
      volumes: {},
      overrides: {},
      hidden: [],
      addModule: (m) =>
        set((s) => ({
          modules: [...s.modules.filter((x) => x.id !== m.id), m],
        })),
      removeModule: (id) =>
        set((s) => ({
          modules: s.modules.filter((x) => x.id !== id),
        })),
      setFinish: (moduleId, patch) =>
        set((s) => ({
          finishes: {
            ...s.finishes,
            [moduleId]: { ...(s.finishes[moduleId] ?? {}), ...patch },
          },
        })),
      setVolume: (moduleId, volumeCbm) =>
        set((s) => {
          const next = { ...s.volumes };
          if (volumeCbm === undefined || Number.isNaN(volumeCbm)) {
            delete next[moduleId];
          } else {
            next[moduleId] = volumeCbm;
          }
          return { volumes: next };
        }),
      setOverride: (moduleId, patch) =>
        set((s) => ({
          overrides: {
            ...s.overrides,
            [moduleId]: { ...(s.overrides[moduleId] ?? {}), ...patch },
          },
        })),
      clearOverride: (moduleId) =>
        set((s) => {
          const next = { ...s.overrides };
          delete next[moduleId];
          return { overrides: next };
        }),
      hideModule: (moduleId) =>
        set((s) => ({
          hidden: s.hidden.includes(moduleId) ? s.hidden : [...s.hidden, moduleId],
        })),
      unhideModule: (moduleId) =>
        set((s) => ({ hidden: s.hidden.filter((x) => x !== moduleId) })),
    }),
    {
      name: "ek-custom-modules-v1",
    }
  )
);

export const ELEMENT_CATEGORY_OPTIONS: { value: ModuleCategory; label: string }[] = [
  { value: "base", label: "Base Unit" },
  { value: "wall", label: "Wall Unit" },
  { value: "tall", label: "Tall Unit" },
  { value: "panel", label: "Panels" },
  { value: "accessory", label: "Accessories" },
];
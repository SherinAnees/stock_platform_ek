import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getModule, type StockModule } from "./modules";
import type { QtyPriceRow } from "@/types/costingSheet";
import { buildLayoutFromKitchenType } from "./buildFromKitchenType";
import { useInventory } from "@/lib/inventory/store";
import { useThemeSelection, categoryToUnitType } from "./themeSelection";
import {
  EK_DEFAULT_HANDLE,
  EK_DEFAULT_WORKTOP,
  EK_DEFAULT_THEME,
  getColorTheme,
} from "./ekFinishes";
import type { DesignIntake } from "./orders";

export interface PlacedModule {
  /** unique instance id */
  uid: string;
  /** stock module id */
  moduleId: string;
  /** position in meters [x, y, z] (y is vertical, anchored at module base) */
  position: [number, number, number];
  /** Y rotation in radians */
  rotation: number;
  /** colour theme used when this unit was placed (drives stock + price) */
  themeId?: string;
}

export interface RoomConfig {
  width: number; // meters
  depth: number;
  height: number;
  /** Room footprint shape */
  shape?: RoomShape;
  /** Cutout dimensions for L/U shapes (meters). Interpretation depends on shape. */
  cutoutWidth?: number;
  cutoutDepth?: number;
  /** Wall color (any CSS color string). */
  wallColor?: string;
}

export type RoomShape = "rect" | "l-shape" | "u-shape";

export interface SavedDesign {
  id: string;
  name: string;
  createdAt: number;
  room: RoomConfig;
  placed: PlacedModule[];
  noltePreset?: NoltePreset | null;
  finish?: EkFinishSelection;
  intake?: DesignIntake | null;
  orderId?: string;
}

export interface NoltePreset {
  kitchenType: string;
  qtyPerType: number;
  row: QtyPriceRow;
}

export interface EkFinishSelection {
  /** Selected colour theme id — drives front + carcase together. */
  themeId: string;
  carcaseCode: string;
  frontCode: string;
  worktopCode: string;
  handleCode: string;
}

export interface CustomFinish {
  code: string;
  name: string;
  color: string;
}

interface KitchenState {
  room: RoomConfig;
  placed: PlacedModule[];
  selectedUid: string | null;
  designs: SavedDesign[];
  noltePreset: NoltePreset | null;
  finish: EkFinishSelection;
  customCarcase: CustomFinish[];
  customFronts: CustomFinish[];
  isDragging: boolean;
  history: PlacedModule[][];
  /** Required intake captured before designing. Null = no active design. */
  currentDesign: DesignIntake | null;
  setCurrentDesign: (d: DesignIntake | null) => void;
  /** Read-only mode: blocks edit mutations (used when a design is linked to a placed order). */
  viewOnly: boolean;
  /** Server kitchen_designs.id this canvas was loaded from (null = unsaved). */
  loadedDesignId: string | null;
  setViewOnly: (v: boolean) => void;
  setLoadedDesignId: (id: string | null) => void;
  /** Replace canvas state from a saved server snapshot (no inventory side-effects). */
  loadFromSnapshot: (snap: {
    room?: RoomConfig;
    placed: PlacedModule[];
    finish?: EkFinishSelection;
    intake?: DesignIntake | null;
    designId: string;
    viewOnly: boolean;
  }) => void;
  /** Clears placed modules, preset and intake so a fresh design can start. */
  resetDesign: () => void;
  setRoom: (room: Partial<RoomConfig>) => void;
  setFinish: (patch: Partial<EkFinishSelection>) => void;
  addCustomCarcase: (f: CustomFinish) => void;
  removeCustomCarcase: (code: string) => void;
  addCustomFront: (f: CustomFinish) => void;
  removeCustomFront: (code: string) => void;
  addModule: (moduleId: string, position?: [number, number, number]) => void;
  removeModule: (uid: string) => void;
  updateModule: (uid: string, patch: Partial<PlacedModule>) => void;
  rotateSelected: () => void;
  selectModule: (uid: string | null) => void;
  setDragging: (v: boolean) => void;
  undo: () => void;
  clearAll: () => void;
  /** Update themeId on every placed module of the given category. */
  reapplyCategoryTheme: (category: import("./modules").ModuleCategory, themeId: string) => void;
  loadNolteKitchen: (row: QtyPriceRow) => void;
  saveDesign: (name: string, extras?: { orderId?: string; intake?: DesignIntake | null }) => SavedDesign;
  loadDesign: (id: string) => void;
  deleteDesign: (id: string) => void;
}

const DEFAULT_ROOM: RoomConfig = {
  width: 4,
  depth: 4,
  height: 2.6,
  shape: "rect",
  cutoutWidth: 1.4,
  cutoutDepth: 1.4,
  wallColor: "#9ca3af",
};
const DEFAULT_FINISH: EkFinishSelection = {
  themeId: EK_DEFAULT_THEME,
  carcaseCode: getColorTheme(EK_DEFAULT_THEME).carcaseCode,
  frontCode: getColorTheme(EK_DEFAULT_THEME).frontCode,
  worktopCode: EK_DEFAULT_WORKTOP,
  handleCode: EK_DEFAULT_HANDLE,
};

function defaultPositionFor(mod: StockModule, room: RoomConfig): [number, number, number] {
  // Drop in the middle of the room so newly added units don't stack on
  // top of cabinets already placed against the wall. User can then drag
  // it to the desired wall position.
  return [0, mod.baseY, 0];
}

const HISTORY_LIMIT = 50;
function pushHist(history: PlacedModule[][], snapshot: PlacedModule[]): PlacedModule[][] {
  const next = [...history, snapshot.map((p) => ({ ...p, position: [...p.position] as [number, number, number] }))];
  if (next.length > HISTORY_LIMIT) next.shift();
  return next;
}

export const useKitchen = create<KitchenState>()(
  persist(
    (set, get) => ({
      room: DEFAULT_ROOM,
      placed: [],
      selectedUid: null,
      designs: [],
      noltePreset: null,
      finish: DEFAULT_FINISH,
      customCarcase: [],
      customFronts: [],
      isDragging: false,
      history: [],
      currentDesign: null,
      setCurrentDesign: (d) => set({ currentDesign: d }),
      viewOnly: false,
      loadedDesignId: null,
      setViewOnly: (v) => set({ viewOnly: v }),
      setLoadedDesignId: (id) => set({ loadedDesignId: id }),
      loadFromSnapshot: (snap) =>
        set((s) => ({
          history: pushHist(s.history, s.placed),
          room: snap.room ?? s.room,
          placed: snap.placed,
          finish: snap.finish ?? s.finish,
          currentDesign: snap.intake ?? s.currentDesign,
          loadedDesignId: snap.designId,
          viewOnly: snap.viewOnly,
          selectedUid: null,
          noltePreset: null,
        })),
      resetDesign: () => {
        const inv = useInventory.getState();
        for (const p of get().placed) inv.returnFromDesign(p.moduleId);
        set((s) => ({
          history: pushHist(s.history, s.placed),
          placed: [],
          selectedUid: null,
          noltePreset: null,
          currentDesign: null,
          viewOnly: false,
          loadedDesignId: null,
        }));
      },
      setRoom: (room) => set((s) => ({ room: { ...s.room, ...room } })),
      setFinish: (patch) => set((s) => ({ finish: { ...s.finish, ...patch } })),
      addCustomCarcase: (f) =>
        set((s) => ({ customCarcase: [...s.customCarcase.filter((c) => c.code !== f.code), f] })),
      removeCustomCarcase: (code) =>
        set((s) => ({ customCarcase: s.customCarcase.filter((c) => c.code !== code) })),
      addCustomFront: (f) =>
        set((s) => ({ customFronts: [...s.customFronts.filter((c) => c.code !== f.code), f] })),
      removeCustomFront: (code) =>
        set((s) => ({ customFronts: s.customFronts.filter((c) => c.code !== code) })),
      addModule: (moduleId, position) => {
        if (get().viewOnly) return;
        const mod = getModule(moduleId);
        if (!mod) return;
        // The active theme for the current design session. UI gates stock
        // (live from Supabase) — the store no longer blocks on the legacy
        // hardcoded THEME_STOCK constant.
        const ut = categoryToUnitType(mod.category);
        const themeId = useThemeSelection.getState().themesByUnitType[ut];
        // Keep legacy inventory store in sync (non-blocking)
        useInventory.getState().consumeForDesign(moduleId);
        const pos = position ?? defaultPositionFor(mod, get().room);
        const uid = `${moduleId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((s) => ({
          history: pushHist(s.history, s.placed),
          placed: [...s.placed, { uid, moduleId, position: pos, rotation: 0, themeId }],
          selectedUid: uid,
        }));
      },
      removeModule: (uid) => {
        if (get().viewOnly) return;
        const target = get().placed.find((p) => p.uid === uid);
        if (target) useInventory.getState().returnFromDesign(target.moduleId);
        set((s) => ({
          history: pushHist(s.history, s.placed),
          placed: s.placed.filter((p) => p.uid !== uid),
          selectedUid: s.selectedUid === uid ? null : s.selectedUid,
        }));
      },
      updateModule: (uid, patch) =>
        set((s) =>
          s.viewOnly
            ? s
            : {
                placed: s.placed.map((p) => (p.uid === uid ? { ...p, ...patch } : p)),
              }
        ),
      rotateSelected: () => {
        if (get().viewOnly) return;
        const uid = get().selectedUid;
        if (!uid) return;
        set((s) => ({
          history: pushHist(s.history, s.placed),
          placed: s.placed.map((p) =>
            p.uid === uid ? { ...p, rotation: p.rotation + Math.PI / 2 } : p
          ),
        }));
      },
      selectModule: (uid) => set({ selectedUid: uid }),
      setDragging: (v) =>
        set((s) => (v ? { isDragging: true, history: pushHist(s.history, s.placed) } : { isDragging: false })),
      reapplyCategoryTheme: (category, themeId) =>
        set((s) => ({
          placed: s.placed.map((p) => {
            const m = getModule(p.moduleId);
            if (!m) return p;
            const matches =
              m.category === category ||
              (category === "base" && m.category === "panel");
            return matches ? { ...p, themeId } : p;
          }),
        })),
      undo: () => {
        const hist = get().history;
        if (hist.length === 0) return;
        const prev = hist[hist.length - 1];
        set((s) => ({
          placed: prev,
          history: s.history.slice(0, -1),
          selectedUid: null,
        }));
      },
      clearAll: () => {
        if (get().viewOnly) return;
        // return all currently placed modules to stock
        const inv = useInventory.getState();
        for (const p of get().placed) inv.returnFromDesign(p.moduleId);
        set((s) => ({
          history: pushHist(s.history, s.placed),
          placed: [],
          selectedUid: null,
          noltePreset: null,
        }));
      },
      loadNolteKitchen: (row) => {
        const room = get().room;
        const layout = buildLayoutFromKitchenType(row, room);
        // return existing, then consume new layout
        const inv = useInventory.getState();
        for (const p of get().placed) inv.returnFromDesign(p.moduleId);
        for (const p of layout) inv.consumeForDesign(p.moduleId, "preset");
        set((s) => ({
          history: pushHist(s.history, s.placed),
          placed: layout,
          selectedUid: null,
          noltePreset: { kitchenType: row.kitchenType, qtyPerType: row.qtyPerType, row },
        }));
      },
      saveDesign: (name, extras) => {
        const { room, placed, noltePreset, finish, currentDesign } = get();
        const design: SavedDesign = {
          id: `design-${Date.now()}`,
          name,
          createdAt: Date.now(),
          room,
          placed,
          noltePreset,
          finish,
          intake: extras?.intake ?? currentDesign,
          orderId: extras?.orderId,
        };
        set((s) => ({ designs: [design, ...s.designs] }));
        return design;
      },
      loadDesign: (id) => {
        const d = get().designs.find((x) => x.id === id);
        if (!d) return;
        set({
          room: d.room,
          placed: d.placed,
          selectedUid: null,
          noltePreset: d.noltePreset ?? null,
          finish: d.finish ?? DEFAULT_FINISH,
        });
      },
      deleteDesign: (id) =>
        set((s) => ({ designs: s.designs.filter((d) => d.id !== id) })),
    }),
    {
      name: "kitchen-designer-v1",
      partialize: (s) => ({
        designs: s.designs,
        room: s.room,
        placed: s.placed,
        noltePreset: s.noltePreset,
        finish: s.finish,
        customCarcase: s.customCarcase,
        customFronts: s.customFronts,
        currentDesign: s.currentDesign,
      }),
    }
  )
);
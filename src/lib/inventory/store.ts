import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STOCK_MODULES } from "@/lib/kitchen/modules";

export interface InventoryItem {
  /** matches StockModule.id */
  moduleId: string;
  onHand: number;
  reorderLevel: number;
  /** optional override of catalog price */
  unitCost?: number;
  notes?: string;
}

export interface StockMovement {
  id: string;
  moduleId: string;
  /** positive = receive, negative = issue */
  delta: number;
  reason: "receive" | "issue" | "adjust" | "design-place" | "design-remove";
  ref?: string;
  at: number;
}

interface InventoryState {
  items: Record<string, InventoryItem>;
  movements: StockMovement[];
  ensureSeeded: () => void;
  receive: (moduleId: string, qty: number, ref?: string) => void;
  issue: (moduleId: string, qty: number, ref?: string) => boolean;
  adjust: (moduleId: string, patch: Partial<InventoryItem>) => void;
  consumeForDesign: (moduleId: string, ref?: string) => boolean;
  returnFromDesign: (moduleId: string, ref?: string) => void;
  resetSeed: () => void;
}

function seedItems(): Record<string, InventoryItem> {
  const out: Record<string, InventoryItem> = {};
  for (const m of STOCK_MODULES) {
    out[m.id] = {
      moduleId: m.id,
      onHand: 1,
      reorderLevel: 1,
    };
  }
  return out;
}

function mvId() {
  return `mv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useInventory = create<InventoryState>()(
  persist(
    (set, get) => ({
      items: seedItems(),
      movements: [],
      ensureSeeded: () => {
        const items = { ...get().items };
        let changed = false;
        for (const m of STOCK_MODULES) {
          if (!items[m.id]) {
            items[m.id] = { moduleId: m.id, onHand: 1, reorderLevel: 1 };
            changed = true;
          }
        }
        if (changed) set({ items });
      },
      receive: (moduleId, qty, ref) => {
        if (qty <= 0) return;
        set((s) => {
          const cur = s.items[moduleId] ?? { moduleId, onHand: 0, reorderLevel: 3 };
          return {
            items: { ...s.items, [moduleId]: { ...cur, onHand: cur.onHand + qty } },
            movements: [
              { id: mvId(), moduleId, delta: qty, reason: "receive" as const, ref, at: Date.now() },
              ...s.movements,
            ].slice(0, 200),
          };
        });
      },
      issue: (moduleId, qty, ref) => {
        if (qty <= 0) return false;
        const cur = get().items[moduleId];
        if (!cur || cur.onHand < qty) return false;
        set((s) => ({
          items: {
            ...s.items,
            [moduleId]: { ...cur, onHand: cur.onHand - qty },
          },
          movements: [
            { id: mvId(), moduleId, delta: -qty, reason: "issue" as const, ref, at: Date.now() },
            ...s.movements,
          ].slice(0, 200),
        }));
        return true;
      },
      adjust: (moduleId, patch) => {
        set((s) => {
          const cur = s.items[moduleId] ?? { moduleId, onHand: 0, reorderLevel: 3 };
          const next = { ...cur, ...patch };
          const movements =
            patch.onHand !== undefined && patch.onHand !== cur.onHand
              ? [
                  {
                    id: mvId(),
                    moduleId,
                    delta: patch.onHand - cur.onHand,
                    reason: "adjust" as const,
                    at: Date.now(),
                  },
                  ...s.movements,
                ].slice(0, 200)
              : s.movements;
          return { items: { ...s.items, [moduleId]: next }, movements };
        });
      },
      consumeForDesign: (moduleId, ref) => {
        const cur = get().items[moduleId];
        if (!cur || cur.onHand <= 0) return false;
        set((s) => ({
          items: {
            ...s.items,
            [moduleId]: { ...cur, onHand: cur.onHand - 1 },
          },
          movements: [
            {
              id: mvId(),
              moduleId,
              delta: -1,
              reason: "design-place" as const,
              ref,
              at: Date.now(),
            },
            ...s.movements,
          ].slice(0, 200),
        }));
        return true;
      },
      returnFromDesign: (moduleId, ref) => {
        set((s) => {
          const cur = s.items[moduleId] ?? { moduleId, onHand: 0, reorderLevel: 3 };
          return {
            items: {
              ...s.items,
              [moduleId]: { ...cur, onHand: cur.onHand + 1 },
            },
            movements: [
              {
                id: mvId(),
                moduleId,
                delta: 1,
                reason: "design-remove" as const,
                ref,
                at: Date.now(),
              },
              ...s.movements,
            ].slice(0, 200),
          };
        });
      },
      resetSeed: () => set({ items: seedItems(), movements: [] }),
    }),
    {
      name: "ek-inventory-v2-test",
      partialize: (s) => ({ items: s.items, movements: s.movements }),
    }
  )
);

export function getStockLevel(moduleId: string): number {
  return useInventory.getState().items[moduleId]?.onHand ?? 0;
}
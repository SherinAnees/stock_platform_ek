import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PlacedModule } from "./store";

export type OrderStatus = "new" | "under_packing" | "delivered" | "invalid";

export interface DesignIntake {
  clientName: string;
  partnerName: string;
  city: string;
  /** ISO date string (yyyy-mm-dd). */
  expectedCollectionDate: string;
}

export interface OrderLine {
  moduleId: string;
  unitCode: string;
  name: string;
  themeId: string;
  themeLabel: string;
  qty: number;
  unitPrice: number;
  /** True for show elements (worktops, appliances) — not priced. */
  decorative: boolean;
}

export interface Order {
  id: string;
  partnerUserId: string;
  intake: DesignIntake;
  placedModules: PlacedModule[];
  lines: OrderLine[];
  total: number;
  status: OrderStatus;
  placedAt: number;
  expiresAt: number;
  deliveredAt?: number;
}

export const ORDER_TTL_MS = 10 * 24 * 60 * 60 * 1000;

interface OrdersState {
  orders: Order[];
  placeOrder: (o: Omit<Order, "id" | "status" | "placedAt" | "expiresAt">) => Order;
  advance: (id: string) => void;
  sweepExpired: () => void;
}

export const useOrders = create<OrdersState>()(
  persist(
    (set, get) => ({
      orders: [],
      placeOrder: (o) => {
        const now = Date.now();
        const order: Order = {
          ...o,
          id: `ord-${now}-${Math.random().toString(36).slice(2, 6)}`,
          status: "new",
          placedAt: now,
          expiresAt: now + ORDER_TTL_MS,
        };
        set((s) => ({ orders: [order, ...s.orders] }));
        return order;
      },
      advance: (id) =>
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== id) return o;
            if (o.status === "new") return { ...o, status: "under_packing" };
            if (o.status === "under_packing")
              return { ...o, status: "delivered", deliveredAt: Date.now() };
            return o;
          }),
        })),
      sweepExpired: () => {
        const now = Date.now();
        let changed = false;
        const next = get().orders.map((o) => {
          if (
            (o.status === "new" || o.status === "under_packing") &&
            o.expiresAt < now
          ) {
            changed = true;
            return { ...o, status: "invalid" as const };
          }
          return o;
        });
        if (changed) set({ orders: next });
      },
    }),
    { name: "nolte-orders-v1" }
  )
);

/** Per-(themeId, unitCode) reserved + delivered qty across all orders. */
export function getStockUsage(orders: Order[]) {
  const reserved: Record<string, Record<string, number>> = {};
  const delivered: Record<string, Record<string, number>> = {};
  for (const o of orders) {
    if (o.status === "invalid") continue;
    const bucket = o.status === "delivered" ? delivered : reserved;
    for (const line of o.lines) {
      if (!line.unitCode) continue;
      bucket[line.themeId] = bucket[line.themeId] ?? {};
      bucket[line.themeId][line.unitCode] =
        (bucket[line.themeId][line.unitCode] ?? 0) + line.qty;
    }
  }
  return { reserved, delivered };
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "New order",
  under_packing: "Under packing",
  delivered: "Delivered",
  invalid: "Invalid (expired)",
};
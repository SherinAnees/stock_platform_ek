import type { ReactNode } from "react";

export type CategoryAbbr = "BU" | "WU" | "TU" | "PA" | "AP" | "AC" | "—";

const MAP: Record<string, { abbr: CategoryAbbr; label: string; cls: string }> = {
  base: { abbr: "BU", label: "Base Unit", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  "base unit": { abbr: "BU", label: "Base Unit", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  wall: { abbr: "WU", label: "Wall Unit", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  "wall unit": { abbr: "WU", label: "Wall Unit", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  tall: { abbr: "TU", label: "Tall Unit", cls: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30" },
  "tall unit": { abbr: "TU", label: "Tall Unit", cls: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30" },
  panel: { abbr: "PA", label: "Panel", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  appliance: { abbr: "AP", label: "Appliance", cls: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30" },
  accessory: { abbr: "AC", label: "Accessory", cls: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30" },
};

export function categoryAbbr(category?: string | null) {
  if (!category) return { abbr: "—" as CategoryAbbr, label: "—", cls: "bg-muted text-muted-foreground border-border" };
  return MAP[category.toLowerCase().trim()] ?? { abbr: (category.slice(0, 2).toUpperCase() as CategoryAbbr), label: category, cls: "bg-muted text-muted-foreground border-border" };
}

export type _Unused = ReactNode;
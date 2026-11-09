import { Building, ChevronDown } from "lucide-react";
import { useCurrentStockCenter } from "@/lib/auth/useSession";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Sidebar-embedded stock center indicator.
 * - Scoped users: read-only label ("SC-IND · India")
 * - Master Admin: dropdown to switch the active center in scope
 */
export function StockCenterSwitcher() {
  const { centers, current, currentId, setCurrent, canSwitch, isLoading } =
    useCurrentStockCenter();

  if (isLoading) {
    return (
      <div className="mx-3 mb-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
        Loading center…
      </div>
    );
  }

  if (!current) {
    return (
      <div className="mx-3 mb-2 rounded-md border border-dashed border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/20 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
        No stock center assigned
      </div>
    );
  }

  const label = `${current.code} · ${current.country ?? current.name}`;

  if (!canSwitch) {
    return (
      <div className="mx-3 mb-2 flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[11px]">
        <Building className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium truncate">{label}</span>
      </div>
    );
  }

  return (
    <div className="mx-3 mb-2">
      <Select value={currentId ?? undefined} onValueChange={setCurrent}>
        <SelectTrigger className="h-8 w-full text-[11px] gap-1.5 border-dashed">
          <Building className="h-3 w-3 text-muted-foreground shrink-0" />
          <SelectValue placeholder="Select center">
            <span className="truncate">{label}</span>
          </SelectValue>
          <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
        </SelectTrigger>
        <SelectContent>
          {centers.map((c) => (
            <SelectItem key={c.id} value={c.id} className="text-xs">
              <span className="font-medium">{c.code}</span>
              <span className="text-muted-foreground"> · {c.country ?? c.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="mt-1 px-1 text-[9px] uppercase tracking-wider text-muted-foreground">
        Master Admin scope
      </p>
    </div>
  );
}
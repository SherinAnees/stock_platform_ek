import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import { getSeedCostingSheets } from "@/data/seedCostingSheets";
import { useKitchen } from "@/lib/kitchen/store";
import { calcNolteKitchenCost, formatAED } from "@/lib/kitchen/nolteCost";
import { toast } from "sonner";

export function NoltePresetDialog() {
  const [open, setOpen] = useState(false);
  const loadNolteKitchen = useKitchen((s) => s.loadNolteKitchen);
  const sheet = useMemo(() => getSeedCostingSheets()[0], []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          Nolte Kitchen Types
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            Nolte Kitchens — Standard Types
          </DialogTitle>
          <DialogDescription>
            Auto-build a 3D layout from your costing sheet. Click a kitchen type
            to populate the room with cabinets, appliances and accessories.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2.5 mt-2">
          {sheet.qtyPrices.map((row) => {
            const cost = calcNolteKitchenCost(row, sheet.inputs);
            return (
              <button
                key={row.slNo}
                onClick={() => {
                  loadNolteKitchen(row);
                  toast.success(`Loaded "${row.kitchenType}"`);
                  setOpen(false);
                }}
                className="text-left rounded-lg border border-border bg-card p-4 hover:border-accent hover:shadow-[var(--shadow-soft)] transition group"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <div className="font-serif text-lg text-foreground">
                      {row.kitchenType}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {row.baseUnitLMPerKitchen}m base · {row.wallUnitLMPerKitchen}m wall ·{" "}
                      {row.tallUnitLMPerKitchen}m tall · {row.volumePerKitchen}m³
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {row.qtyPerType} units in project
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-lg tabular-nums">
                      {formatAED(cost.totalAED)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      per kitchen
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter className="text-[11px] text-muted-foreground">
          Sourced from <span className="font-medium">Demo1</span> costing sheet ·
          Nolte Kuechen · UAE
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
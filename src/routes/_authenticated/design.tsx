import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { KitchenCanvas, type KitchenCanvasHandle } from "@/components/kitchen/KitchenCanvas";
import { Catalog } from "@/components/kitchen/Catalog";
import { BomPanel } from "@/components/kitchen/BomPanel";
import { Toolbar } from "@/components/kitchen/Toolbar";
import { DesignIntakeDialog } from "@/components/kitchen/DesignIntakeDialog";
import { Button } from "@/components/ui/button";
import { useKitchen } from "@/lib/kitchen/store";
import { FilePlus } from "lucide-react";
import { useDesign } from "@/lib/data/queries";
import type { PlacedModule } from "@/lib/kitchen/store";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/design")({
  head: () => ({
    meta: [
      { title: "Kitchen Designer — Kitchen ERP" },
      { name: "description", content: "3D drag-and-drop kitchen designer with live BOM." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    designId: typeof search.designId === "string" ? search.designId : undefined,
  }),
  component: DesignerPage,
});

function DesignerPage() {
  const canvasRef = useRef<KitchenCanvasHandle>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const currentDesign = useKitchen((s) => s.currentDesign);
  const viewOnly = useKitchen((s) => s.viewOnly);
  const loadedDesignId = useKitchen((s) => s.loadedDesignId);
  const loadFromSnapshot = useKitchen((s) => s.loadFromSnapshot);
  const setViewOnly = useKitchen((s) => s.setViewOnly);
  const { designId } = Route.useSearch();
  const designQ = useDesign(designId);

  // Apply server snapshot when ?designId changes
  useEffect(() => {
    if (!designId) return;
    const d = designQ.data;
    if (!d) return;
    const order = (d.orders ?? [])[0];
    const locked = !!order && order.status !== "cancelled" && order.status !== "auto_cancelled" && order.status !== "rejected";
    if (loadedDesignId === d.id && viewOnly === locked) return;
    loadFromSnapshot({
      placed: (d.placed as PlacedModule[]) ?? [],
      intake: (d.intake as never) ?? null,
      designId: d.id,
      viewOnly: locked,
    });
    if (locked) toast.info("This design is linked to a placed order — view only.");
  }, [designId, designQ.data, loadFromSnapshot, loadedDesignId, viewOnly]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Toolbar
        captureCanvas={() => canvasRef.current?.capture() ?? null}
        onNewDesign={() => setIntakeOpen(true)}
      />
      {viewOnly && (
        <div className="px-5 py-2 border-b border-border bg-amber-50/60 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between">
          <span>
            View-only mode — this design is linked to a placed order. Edits are disabled.
          </span>
          <Button size="sm" variant="outline" onClick={() => setViewOnly(false)} className="h-7">
            Override (not recommended)
          </Button>
        </div>
      )}
      <div className="flex-1 flex min-h-0">
        <aside className="w-72 shrink-0 border-r border-border bg-sidebar overflow-auto">
          <Catalog />
        </aside>
        <main className="flex-1 relative min-w-0">
          <KitchenCanvas ref={canvasRef} />
          {!currentDesign && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="pointer-events-auto rounded-lg border border-border bg-card/90 backdrop-blur px-6 py-5 shadow text-center max-w-sm">
                <h2 className="font-serif text-xl mb-1">No active design</h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Click below to start a new kitchen design.
                </p>
                <Button onClick={() => setIntakeOpen(true)} className="gap-1.5">
                  <FilePlus className="h-4 w-4" />
                  Start new design
                </Button>
              </div>
            </div>
          )}
        </main>
        <aside className="w-80 shrink-0 border-l border-border bg-sidebar">
          <BomPanel />
        </aside>
      </div>
      <DesignIntakeDialog open={intakeOpen} onOpenChange={setIntakeOpen} />
    </div>
  );
}
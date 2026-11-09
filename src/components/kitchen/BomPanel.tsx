import { useEffect, useMemo, useRef, useState } from "react";
import { useKitchen } from "@/lib/kitchen/store";
import { getModule } from "@/lib/kitchen/modules";
import { Trash2, RotateCw, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAED } from "@/lib/kitchen/nolteCost";
import { THEMES } from "@/lib/kitchen/themeStock";
import {
  useThemeSelection,
  categoryToUnitType,
} from "@/lib/kitchen/themeSelection";
import {
  useArticles,
  useArticleStockByTheme,
  useColorThemes,
} from "@/lib/data/queries";
import { ReviewOrderDialog } from "./ReviewOrderDialog";

export function BomPanel() {
  const placed = useKitchen((s) => s.placed);
  const selectedUid = useKitchen((s) => s.selectedUid);
  const removeModule = useKitchen((s) => s.removeModule);
  const rotateSelected = useKitchen((s) => s.rotateSelected);
  const selectModule = useKitchen((s) => s.selectModule);
  const currentDesign = useKitchen((s) => s.currentDesign);
  const themesByUnitType = useThemeSelection((s) => s.themesByUnitType);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Live catalogue + per-theme stock lookups (single theme drives the design)
  const themesQ = useColorThemes();
  const activeThemeCode = themesByUnitType.BU;
  const activeTheme = (themesQ.data ?? []).find((t) => t.code === activeThemeCode);
  const articlesQ = useArticles();
  const stockQ = useArticleStockByTheme(activeTheme?.id);
  const articleByCode = useMemo(() => {
    const m = new Map<string, { id: string; unit_price: number }>();
    for (const a of articlesQ.data ?? []) m.set(a.code, { id: a.id, unit_price: Number(a.unit_price ?? 0) });
    return m;
  }, [articlesQ.data]);
  const stockByArticleId = useMemo(() => {
    const m = new Map<string, { current_qty: number; unit_price: number }>();
    for (const r of stockQ.data ?? []) m.set(r.article_id, {
      current_qty: r.current_qty,
      unit_price: Number(r.unit_price ?? 0),
    });
    return m;
  }, [stockQ.data]);

  // Count only real, priced cabinet modules (excludes filler panels & show-elements).
  const cabinetCount = useMemo(
    () =>
      placed.filter((p) => {
        const m = getModule(p.moduleId);
        if (!m) return false;
        return m.category === "base" || m.category === "wall" || m.category === "tall";
      }).length,
    [placed]
  );

  const selectedModuleId = useMemo(() => {
    if (!selectedUid) return null;
    return placed.find((p) => p.uid === selectedUid)?.moduleId ?? null;
  }, [placed, selectedUid]);

  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (!selectedModuleId) return;
    rowRefs.current[selectedModuleId]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedModuleId]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        count: number;
        price: number;
        name: string;
        decorative: boolean;
        themeLabel: string;
        moduleId: string;
        code: string;
        dims: string;
        availableQty: number;
      }
    >();
    for (const p of placed) {
      const m = getModule(p.moduleId);
      if (!m) continue;
      // Worktops and appliances are show-elements (decoratives) — no pricing.
      const decorative = m.category === "appliance";
      const themeId =
        p.themeId ?? themesByUnitType[categoryToUnitType(m.category)];
      const code = (m.unitCode ?? "").trim();
      const article =
        articleByCode.get(code) ?? articleByCode.get(m.unitCode ?? "");
      const stock = article ? stockByArticleId.get(article.id) : undefined;
      const stockPrice = Number(stock?.unit_price ?? 0);
      const catalogPrice = Number(article?.unit_price ?? 0);
      const themePrice = stockPrice > 0 ? stockPrice : catalogPrice;
      const availableQty = stock?.current_qty ?? 0;
      const themeMeta = THEMES.find((t) => t.id === themeId);
      const themeLabel = themeMeta
        ? `${themeMeta.range} · ${themeMeta.frontName}`
        : themeId;
      const key = `${m.id}::${themeId}`;
      const cur =
        map.get(key) ?? {
          count: 0,
          price: decorative ? 0 : themePrice,
          name: m.name,
          decorative,
          themeLabel,
          moduleId: m.id,
          code,
          dims: `W${Math.round(m.width * 1000)}×H${Math.round(m.height * 1000)}×D${Math.round(m.depth * 1000)} mm`,
          availableQty,
        };
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
  }, [placed, themesByUnitType, articleByCode, stockByArticleId]);

  const total = grouped.reduce(
    (s, r) => (r.decorative ? s : s + r.count * r.price),
    0
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-border">
        <h2 className="font-serif text-xl tracking-tight">Bill of Materials</h2>
        <p className="text-xs text-muted-foreground mt-1">
          {cabinetCount} {cabinetCount === 1 ? "item" : "items"} placed
        </p>
        {currentDesign && (
          <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
            <div><span className="text-foreground font-medium">{currentDesign.clientName}</span> · {currentDesign.partnerName}</div>
            <div>{currentDesign.city} · Collection {currentDesign.expectedCollectionDate}</div>
          </div>
        )}
      </div>

      {selectedUid && (
        <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground flex-1">
            Selected
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={rotateSelected}
            className="h-8 gap-1.5"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Rotate
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              removeModule(selectedUid);
              selectModule(null);
            }}
            className="h-8 gap-1.5 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-5 space-y-2">
        {grouped.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-12">
            No modules yet.
            <br />
            Add some from the catalog.
          </div>
        ) : (
          grouped.map((row) => (
            <div
              key={row.key}
              ref={(el) => {
                rowRefs.current[row.moduleId] = el;
              }}
              className={`flex items-baseline justify-between gap-3 py-2 px-2 -mx-2 rounded border-b border-border/60 last:border-0 transition-colors ${
                selectedModuleId === row.moduleId
                  ? "bg-primary/15 ring-1 ring-primary/60"
                  : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{row.name}</div>
                <div className="text-[10px] font-mono text-muted-foreground/80 truncate">
                  {row.code || "—"} · {row.dims}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {row.decorative
                    ? `Show element × ${row.count}`
                    : `${formatAED(row.price)} × ${row.count} · ${row.themeLabel} · Stock ${row.availableQty}`}
                </div>
              </div>
              <div className="font-mono text-sm tabular-nums">
                {row.decorative
                  ? "—"
                  : formatAED(row.count * row.price)}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border bg-secondary/40">
        <div className="p-5 flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Total
          </span>
          <span className="font-serif text-2xl tabular-nums">
            {formatAED(total)}
          </span>
        </div>
        <div className="px-5 pb-5">
          <Button
            className="w-full gap-1.5"
            disabled={placed.length === 0 || !currentDesign}
            onClick={() => setReviewOpen(true)}
          >
            <ShoppingCart className="h-4 w-4" />
            Review &amp; place order
          </Button>
        </div>
      </div>
      <ReviewOrderDialog open={reviewOpen} onOpenChange={setReviewOpen} />
    </div>
  );
}
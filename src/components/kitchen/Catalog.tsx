import { Link } from "@tanstack/react-router";
import {
  STOCK_MODULES,
  CUSTOM_MODULES_REGISTRY,
  registerCustomModule,
  type ModuleCategory,
  type CustomModelConfig,
} from "@/lib/kitchen/modules";
import { useKitchen } from "@/lib/kitchen/store";
import {
  useThemeSelection,
  type EkUnitType,
} from "@/lib/kitchen/themeSelection";
import { Plus, Boxes, Search, AlertTriangle, Box } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import {
  useArticles,
  useArticleStockByTheme,
  useColorThemes,
  type Article,
} from "@/lib/data/queries";
import { formatAED } from "@/lib/kitchen/nolteCost";
import { Input } from "@/components/ui/input";
import { useAppUser } from "@/lib/auth/useSession";
import { ModelActionModal } from "@/components/inventory/ModelActionModal";

// Three primary cabinet categories — each gets its OWN independently
// selectable colour theme. Plinth/panel filler items follow the Base Unit
// theme implicitly.
const CATEGORY_SECTIONS: Array<{ cat: ModuleCategory; ut: EkUnitType; label: string; full: string }> = [
  { cat: "base", ut: "BU", label: "BU", full: "Base Units" },
  { cat: "wall", ut: "WU", label: "WU", full: "Wall Units" },
  { cat: "tall", ut: "TU", label: "TU", full: "Tall Units" },
];

export function Catalog() {
  const addModule = useKitchen((s) => s.addModule);
  const placed = useKitchen((s) => s.placed);
  const currentDesign = useKitchen((s) => s.currentDesign);
  const setThemeFor = useThemeSelection((s) => s.setThemeFor);
  const themesByUnitType = useThemeSelection((s) => s.themesByUnitType);
  const reapplyCategoryTheme = useKitchen((s) => s.reapplyCategoryTheme);
  const { isAdmin } = useAppUser();
  const [illustrationFor, setIllustrationFor] = useState<Article | null>(null);

  const themesQ = useColorThemes();
  const themes = themesQ.data ?? [];
  const [query, setQuery] = useState("");
  const searchTerms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  const matchesSearch = (mod: (typeof STOCK_MODULES)[number]) => {
    if (searchTerms.length === 0) return true;
    const rawCode = (mod.unitCode ?? "").trim().toLowerCase();
    const name = mod.name.toLowerCase();
    const articleName = (articleByCode.get(rawCode) ?? articleByCode.get(mod.unitCode ?? ""))?.name.toLowerCase() ?? "";
    const haystack = [name, rawCode, articleName].join(" ");
    return searchTerms.every((term) => haystack.includes(term));
  };



  // Ensure each category has a default theme selection once themes load.
  useEffect(() => {
    if (themes.length === 0) return;
    for (const { ut } of CATEGORY_SECTIONS) {
      if (!themesByUnitType[ut] || !themes.find((t) => t.code === themesByUnitType[ut])) {
        setThemeFor(ut, themes[0].code);
      }
    }
    // Keep PLINTH aligned with Base Unit theme so filler panels stay
    // consistent with the base cabinets.
    if (themesByUnitType.BU && themesByUnitType.PLINTH !== themesByUnitType.BU) {
      setThemeFor("PLINTH", themesByUnitType.BU);
    }
  }, [themes, themesByUnitType, setThemeFor]);

  const articlesQ = useArticles();
  const articleByCode = useMemo(() => {
    const m = new Map<string, Article>();
    for (const a of articlesQ.data ?? []) m.set(a.code, a);
    return m;
  }, [articlesQ.data]);

  const themeIdByCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of themes) m.set(t.code, t.id);
    return m;
  }, [themes]);

  const baseThemeId = themeIdByCode.get(themesByUnitType.BU ?? "");
  const wallThemeId = themeIdByCode.get(themesByUnitType.WU ?? "");
  const tallThemeId = themeIdByCode.get(themesByUnitType.TU ?? "");

  const baseStockQ = useArticleStockByTheme(baseThemeId);
  const wallStockQ = useArticleStockByTheme(wallThemeId);
  const tallStockQ = useArticleStockByTheme(tallThemeId);

  const stockMapFor = (data: ReturnType<typeof useArticleStockByTheme>["data"]) => {
    const m = new Map<string, { current_qty: number; min_qty: number; unit_price: number }>();
    for (const r of data ?? []) {
      m.set(r.article_id, {
        current_qty: r.current_qty,
        min_qty: r.min_qty,
        unit_price: Number(r.unit_price ?? 0),
      });
    }
    return m;
  };
  const stockByCat: Record<ModuleCategory, Map<string, { current_qty: number; min_qty: number; unit_price: number }>> = {
    base: useMemo(() => stockMapFor(baseStockQ.data), [baseStockQ.data]),
    wall: useMemo(() => stockMapFor(wallStockQ.data), [wallStockQ.data]),
    tall: useMemo(() => stockMapFor(tallStockQ.data), [tallStockQ.data]),
    panel: useMemo(() => stockMapFor(baseStockQ.data), [baseStockQ.data]),
    appliance: new Map(),
    accessory: new Map(),
  };

  const themeIdByCat: Partial<Record<ModuleCategory, string | undefined>> = {
    base: baseThemeId,
    wall: wallThemeId,
    tall: tallThemeId,
    panel: baseThemeId,
  };

  const allCategoriesPicked = !!(baseThemeId && wallThemeId && tallThemeId);

  // Articles that are in the DB but have no 3D model yet. Highlight them so
  // Admins can resolve their illustration status before they can be placed.
  const stockModuleCodes = useMemo(() => {
    const s = new Set<string>();
    for (const m of STOCK_MODULES) {
      const c = (m.unitCode ?? "").trim();
      if (c) s.add(c);
    }
    return s;
  }, []);
  const pendingArticles = useMemo(() => {
    return (articlesQ.data ?? []).filter(
      (a) =>
        a.illustration_status === "pending" &&
        !stockModuleCodes.has(a.code.trim()),
    );
  }, [articlesQ.data, stockModuleCodes]);

  // Register procedural modules for articles whose 3D model was built via the
  // wizard, so they resolve through `getModule()` just like built-in units.
  useEffect(() => {
    for (const a of articlesQ.data ?? []) {
      if (
        a.illustration_status !== "model_ready" ||
        stockModuleCodes.has(a.code.trim()) ||
        !a.model_config
      )
        continue;
      const cfg = a.model_config as Partial<CustomModelConfig> & {
        category?: ModuleCategory;
      };
      if (!cfg.width_mm || !cfg.height_mm || !cfg.depth_mm) continue;
      registerCustomModule({
        articleCode: a.code,
        articleName: a.name,
        category: (cfg.category ?? "base") as ModuleCategory,
        price: Number(a.unit_price ?? 0),
        config: cfg as CustomModelConfig,
      });
    }
  }, [articlesQ.data, stockModuleCodes]);

  // Combined list = built-ins ∪ registered custom modules.
  const allModules = useMemo(
    () => [...STOCK_MODULES, ...CUSTOM_MODULES_REGISTRY.values()],
    // Depend on articles so newly-registered custom modules re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [articlesQ.data],
  );

  const noIllustrationArticles = useMemo(() => {
    return (articlesQ.data ?? []).filter(
      (a) =>
        a.illustration_status === "no_illustration" &&
        !stockModuleCodes.has(a.code.trim()),
    );
  }, [articlesQ.data, stockModuleCodes]);

  return (
    <div className="flex flex-col gap-6 p-5">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl tracking-tight text-foreground">
            Stock Modules
          </h2>
          <Link
            to="/inventory"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition"
          >
            <Boxes className="h-3 w-3" />
            Manage
          </Link>
        </div>
      <p className="text-xs text-muted-foreground mt-1">
          Assign a colour theme per category · stock &amp; price update independently
        </p>
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search modules by name or code..."
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {!allCategoriesPicked && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
          Please assign a color theme to all unit categories before designing.
        </div>
      )}

      {themes.length === 0 && (
        <div className="text-xs text-muted-foreground">Loading themes…</div>
      )}

      {CATEGORY_SECTIONS.map(({ cat, ut, label, full }) => {
          const activeCode = themesByUnitType[ut];
          const activeThemeId = themeIdByCat[cat];
          const stockByArticleId = stockByCat[cat];
          const items = allModules.filter((m) => m.category === cat).filter(
            (m) => {
              const a = articleByCode.get((m.unitCode ?? "").trim()) ??
                articleByCode.get(m.unitCode ?? "");
              return !!a && stockByArticleId.has(a.id);
            }
          ).filter(matchesSearch);
          // Also include filler/plinth alongside the Base section so they
          // stay reachable without a dedicated theme picker.
          const panelItems = cat === "base"
            ? allModules.filter((m) => m.category === "panel").filter((m) => {
                const a = articleByCode.get((m.unitCode ?? "").trim()) ??
                  articleByCode.get(m.unitCode ?? "");
                return !!a && stockByCat.panel.has(a.id);
              }).filter(matchesSearch)
            : [];
          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-2 gap-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground" title={full}>
                  {label}
                </h3>
                <span className="text-[10px] text-muted-foreground">
                  {items.length + panelItems.length} item{items.length + panelItems.length === 1 ? "" : "s"}
                </span>
              </div>
              {/* Per-category theme swatch picker */}
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {themes.map((t) => {
                  const active = t.code === activeCode;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setThemeFor(ut, t.code);
                        if (ut === "BU") setThemeFor("PLINTH", t.code);
                        // Reapply to already-placed items of this category.
                        // Store the public theme code so rendering, stock, and
                        // order mapping all resolve the same selection.
                        reapplyCategoryTheme(cat, t.code);
                      }}
                      className={
                        "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-[11px] transition " +
                        (active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-accent")
                      }
                      title={t.name}
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border border-border/60"
                        style={{ background: t.hex_color ?? "#ccc" }}
                      />
                      <span className="truncate">{t.name}</span>
                    </button>
                  );
                })}
              </div>
              {!activeThemeId ? (
                <div className="text-[11px] text-muted-foreground py-3">
                  Select a theme to view available stock.
                </div>
              ) : (
                <ArticleList
                  items={[...items, ...panelItems]}
                  stockByArticleId={stockByArticleId}
                  articleByCode={articleByCode}
                  placed={placed}
                  activeThemeId={activeThemeId}
                  activeThemeCode={activeCode ?? ""}
                  panelStockMap={stockByCat.panel}
                  disabledReason={!currentDesign ? "Start a new design first" : (!allCategoriesPicked ? "Assign a theme to all categories first" : null)}
                  onAdd={(modId) => addModule(modId)}
                />
              )}
            </div>
          );
        })}

      {(pendingArticles.length > 0 || (isAdmin && noIllustrationArticles.length > 0)) && (
        <div>
          <div className="flex items-center justify-between mb-2 gap-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground inline-flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-amber-600" />
              Awaiting 3D Setup
            </h3>
            <span className="text-[10px] text-muted-foreground">
              {pendingArticles.length + noIllustrationArticles.length}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {pendingArticles.map((a) => (
              <button
                key={a.id}
                type="button"
                disabled={!isAdmin}
                onClick={() => {
                  if (isAdmin) setIllustrationFor(a);
                  else toast.info("This article has no 3D model. Contact your Admin.");
                }}
                title={
                  isAdmin
                    ? "This article has no 3D model. Click to set illustration option."
                    : "This article has no 3D model. Set illustration option before it can be placed in designs."
                }
                className="group flex items-center gap-3 rounded-md border-2 border-amber-500/60 bg-amber-500/5 shadow-[0_0_0_2px_rgba(245,158,11,0.15)] px-3 py-2.5 text-left transition animate-[pulse_2.5s_ease-in-out_infinite] hover:animate-none hover:bg-amber-500/10 disabled:opacity-60"
              >
                <div className="h-8 w-8 shrink-0 rounded-sm border border-amber-500/60 bg-amber-500/10 flex items-center justify-center">
                  <Box className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {a.name}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground/80 truncate">
                    {a.code}
                  </div>
                </div>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  ⚠ No 3D
                </span>
              </button>
            ))}
            {isAdmin && noIllustrationArticles.map((a) => (
              <div
                key={a.id}
                title="Marked as 2D only. Awaiting Phase-3 rendering."
                className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5"
              >
                <div className="h-8 w-8 shrink-0 rounded-sm border border-border bg-card" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-muted-foreground truncate">
                    {a.name}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground/80 truncate">
                    {a.code}
                  </div>
                </div>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  2D only
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {illustrationFor && (
        <ModelActionModal
          article={illustrationFor}
          open
          onClose={() => setIllustrationFor(null)}
        />
      )}
    </div>
  );
}

function ArticleList(props: {
  items: typeof STOCK_MODULES;
  stockByArticleId: Map<string, { current_qty: number; min_qty: number; unit_price: number }>;
  panelStockMap: Map<string, { current_qty: number; min_qty: number; unit_price: number }>;
  articleByCode: Map<string, Article>;
  placed: ReturnType<typeof useKitchen.getState>["placed"];
  activeThemeId: string;
  activeThemeCode: string;
  disabledReason: string | null;
  onAdd: (modId: string) => void;
}) {
  const { items, stockByArticleId, panelStockMap, articleByCode, placed, activeThemeId, activeThemeCode, disabledReason, onAdd } = props;
          if (items.length === 0) return null;
  return (
              <div className="flex flex-col gap-1.5">
                {items.map((mod) => {
                  const rawCode = mod.unitCode ?? "";
                  const article =
                    articleByCode.get(rawCode.trim()) ??
                    articleByCode.get(rawCode);
                  const sourceMap = mod.category === "panel" ? panelStockMap : stockByArticleId;
                  const stock = article ? sourceMap.get(article.id) : undefined;
                  const totalQty = stock?.current_qty ?? 0;
                  const minQty = stock?.min_qty ?? 0;
                  const price = stock?.unit_price ?? Number(article?.unit_price ?? 0);
                  const consumed = placed.filter(
                    (p) => p.moduleId === mod.id && ((p.themeId ?? activeThemeCode) === activeThemeCode || p.themeId === activeThemeId)
                  ).length;
                  const onHand = Math.max(0, totalQty - consumed);
                  const out = onHand <= 0;
                  const disabled = out || !!disabledReason;
                  const atOrBelowMin = onHand <= minQty;
                  const nearMin = !atOrBelowMin && onHand <= Math.ceil(minQty * 1.2);
                  const badgeClass = out
                    ? "bg-muted text-muted-foreground"
                    : atOrBelowMin
                      ? "bg-destructive/15 text-destructive"
                      : nearMin
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
                  return (
                    <button
                      key={mod.id}
                      disabled={disabled}
                      title={
                        out
                          ? "Out of stock for this theme. Cannot add to design."
                          : disabledReason ?? `Add ${mod.name}`
                      }
                      onClick={() => {
                        if (disabledReason) {
                          toast.error(disabledReason);
                          return;
                        }
                        if (totalQty <= 0) {
                          toast.error("Out of stock for this theme. Cannot add to design.");
                          return;
                        }
                        if (onHand <= 0) {
                          toast.error("Maximum available quantity for this theme reached.");
                          return;
                        }
                        onAdd(mod.id);
                      }}
                      className="group flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-left transition-all hover:border-accent hover:shadow-[var(--shadow-soft)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border"
                    >
                      <div
                        className="h-8 w-8 shrink-0 rounded-sm border border-border/60"
                        style={{
                          background: `linear-gradient(135deg, ${mod.color}, ${mod.accentColor ?? mod.color})`,
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {article?.name ?? mod.name}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground/80 truncate">
                          {rawCode.trim()} · W{Math.round(mod.width * 1000)}×H
                          {Math.round(mod.height * 1000)}×D
                          {Math.round(mod.depth * 1000)} mm
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {mod.category === "appliance"
                            ? "Show element"
                            : price > 0
                              ? formatAED(price)
                              : "—"}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span
                          className={
                            "text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded " +
                            badgeClass
                          }
                        >
                          Qty: {onHand}
                        </span>
                        <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                      </div>
                    </button>
                  );
                })}
              </div>
  );
}

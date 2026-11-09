import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useArticles,
  useUpsertArticle,
  useDeleteArticle,
  useRecordMovement,
  useMovementsForArticle,
  useColorThemes,
  useArticleStockByTheme,
  useAllArticleStock,
  useRecordThemeMovement,
  useUpdateThemeStockPrice,
  useBulkZeroStock,
  useBulkSetStock,
  useBulkUpdatePrices,
  usePriceHistory,
  useThemeDeletePrecheck,
  useDeleteColorTheme,
  type ThemeDeletePrecheck,
  type Article,
  type ColorTheme,
} from "@/lib/data/queries";
import { useAppUser } from "@/lib/auth/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, History, ArrowUpCircle, Search, Database, Box, Settings, Lock, ChevronDown as ChevDown, Loader2, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { THEME_STOCK, THEMES } from "@/lib/kitchen/themeStock";
import { STOCK_MODULES } from "@/lib/kitchen/modules";
import { categoryAbbr } from "@/lib/inventory/category";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ExcelIOButtons } from "@/components/inventory/ExcelIOButtons";
import { ModelActionModal } from "@/components/inventory/ModelActionModal";
import { ModelWizard } from "@/components/inventory/ModelWizard";

const BUILTIN_THEME_NAMES = new Set([
  "clean-magnolia","clean-anthracite","clean-cream grey",
  "star-magnolia gloss","star-anthracite gloss","plan-natural oak",
]);
function isBuiltinTheme(t: ColorTheme) {
  return BUILTIN_THEME_NAMES.has(t.name.trim().toLowerCase());
}

function calcVolumeM3(w?: number | null, h?: number | null, d?: number | null) {
  if (!w || !h || !d) return 0;
  return (Number(w) * Number(h) * Number(d)) / 1_000_000_000;
}
function fmtDim(v?: number | null, unit = "mm") {
  if (v == null) return "—";
  return `${v}${unit}`;
}
function fmtVolume(v?: number | null) {
  if (!v) return "—";
  return `${Number(v).toFixed(3)} m³`;
}

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [{ title: "Inventory — Kitchen ERP" }],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const { isAdmin, isStockkeeper, isPartner } = useAppUser();
  const canEdit = isAdmin || isStockkeeper;
  const articles = useArticles();
  const themes = useColorThemes();
  const [themeFilter, setThemeFilter] = useState<string>("all"); // "all" or theme uuid
  const themeRows = useArticleStockByTheme(themeFilter === "all" ? null : themeFilter);
  const allThemeRows = useAllArticleStock();
  const stockByArticle = useMemo(() => {
    const m = new Map<string, { current_qty: number; reserved_qty: number; min_qty: number; unit_price: number }>();
    for (const r of themeRows.data ?? []) m.set(r.article_id, { current_qty: r.current_qty, reserved_qty: r.reserved_qty ?? 0, min_qty: r.min_qty, unit_price: r.unit_price });
    return m;
  }, [themeRows.data]);
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [reservedOnly, setReservedOnly] = useState(false);
  const [noAvailOnly, setNoAvailOnly] = useState(false);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [showDims, setShowDims] = useState(false);
  const [page, setPage] = useState(0);
  const PER = 25;
  const [collapsedThemes, setCollapsedThemes] = useState<Record<string, boolean>>({});

  const CAT_ORDER: Record<string, number> = { BU: 0, TU: 1, WU: 2 };
  function catRank(cat?: string | null) {
    const a = categoryAbbr(cat).abbr;
    return CAT_ORDER[a] ?? 99;
  }

  type Row = {
    key: string;
    article: Article;
    themeId: string | null;
    theme: ColorTheme | null;
    current_qty: number;
    reserved_qty: number;
    min_qty: number;
    unit_price: number;
  };

  const themeById = useMemo(() => {
    const m = new Map<string, ColorTheme>();
    for (const t of themes.data ?? []) m.set(t.id, t);
    return m;
  }, [themes.data]);

  const articleById = useMemo(() => {
    const m = new Map<string, Article>();
    for (const a of articles.data ?? []) m.set(a.id, a);
    return m;
  }, [articles.data]);

  const rows = useMemo<Row[]>(() => {
    if (themeFilter === "all") {
      const out: Row[] = [];
      const seen = new Set<string>();
      for (const r of allThemeRows.data ?? []) {
        const article = articleById.get(r.article_id);
        if (!article) continue;
        seen.add(r.article_id);
        out.push({
          key: `${r.article_id}:${r.theme_id}`,
          article,
          themeId: r.theme_id,
          theme: themeById.get(r.theme_id) ?? null,
          current_qty: r.current_qty,
          reserved_qty: r.reserved_qty ?? 0,
          min_qty: r.min_qty,
          unit_price: Number(r.unit_price ?? 0),
        });
      }
      // Surface newly-added articles that don't yet have any theme stock rows,
      // otherwise they'd be invisible in the list until stock is created.
      for (const a of articles.data ?? []) {
        if (seen.has(a.id)) continue;
        out.push({
          key: `${a.id}:__none`,
          article: a,
          themeId: null,
          theme: null,
          current_qty: 0,
          reserved_qty: 0,
          min_qty: 0,
          unit_price: Number(a.unit_price ?? 0),
        });
      }
      return out;
    }
    const t = themeById.get(themeFilter) ?? null;
    const out: Row[] = [];
    for (const a of articles.data ?? []) {
      const s = stockByArticle.get(a.id);
      if (!s) continue;
      out.push({
        key: `${a.id}:${themeFilter}`,
        article: a,
        themeId: themeFilter,
        theme: t,
        current_qty: s.current_qty,
        reserved_qty: s.reserved_qty,
        min_qty: s.min_qty,
        unit_price: Number(s.unit_price ?? 0),
      });
    }
    out.sort((a, b) => {
      const r = catRank(a.article.category) - catRank(b.article.category);
      if (r !== 0) return r;
      return a.article.code.localeCompare(b.article.code);
    });
    return out;
  }, [themeFilter, allThemeRows.data, articles.data, articleById, themeById, stockByArticle]);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return rows.filter((r) => {
      if (lowOnly && r.current_qty >= r.min_qty) return false;
      if (reservedOnly && (r.reserved_qty ?? 0) <= 0) return false;
      if (noAvailOnly && (r.current_qty - (r.reserved_qty ?? 0)) > 0) return false;
      if (pendingOnly && r.article.illustration_status !== "pending") return false;
      if (!ql) return true;
      return (
        r.article.code.toLowerCase().includes(ql) ||
        r.article.name.toLowerCase().includes(ql) ||
        (r.article.category ?? "").toLowerCase().includes(ql) ||
        (r.theme?.name ?? "").toLowerCase().includes(ql)
      );
    });
  }, [rows, q, lowOnly, reservedOnly, noAvailOnly, pendingOnly]);
  const paged = themeFilter === "all" ? filtered : filtered.slice(page * PER, page * PER + PER);

  // Grouped view for "All themes"
  const grouped = useMemo(() => {
    if (themeFilter !== "all") return null;
    const themeOrder = themes.data ?? [];
    const byTheme = new Map<string, Row[]>();
    for (const r of filtered) {
      const k = r.themeId ?? "__none";
      if (!byTheme.has(k)) byTheme.set(k, []);
      byTheme.get(k)!.push(r);
    }
    for (const arr of byTheme.values()) {
      arr.sort((a, b) => {
        const c = catRank(a.article.category) - catRank(b.article.category);
        if (c !== 0) return c;
        return a.article.code.localeCompare(b.article.code);
      });
    }
    const out: Array<{ theme: ColorTheme | null; key: string; rows: Row[] }> = [];
    for (const t of themeOrder) {
      const rs = byTheme.get(t.id);
      if (rs && rs.length) out.push({ theme: t, key: t.id, rows: rs });
      byTheme.delete(t.id);
    }
    for (const [k, rs] of byTheme.entries()) {
      out.push({ theme: null, key: k, rows: rs });
    }
    return out;
  }, [themeFilter, filtered, themes.data]);

  const [editing, setEditing] = useState<Partial<Article> | null>(null);
  const [movementOpen, setMovementOpen] = useState<{
    article: Article;
    themeId: string | null;
    themeName: string | null;
    currentQty: number;
    currentPrice: number;
  } | null>(null);
  const [historyOpen, setHistoryOpen] = useState<Article | null>(null);
  const [illustrationFor, setIllustrationFor] = useState<Article | null>(null);
  const [editModelFor, setEditModelFor] = useState<Article | null>(null);

  type BulkMode = "none" | "zero" | "edit" | "price";
  const [bulkMode, setBulkMode] = useState<BulkMode>("none");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});
  // Price drafts are keyed by article_id (article-level, not per-theme row)
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [deleteThemeFor, setDeleteThemeFor] = useState<ColorTheme | null>(null);
  const bulkZero = useBulkZeroStock();
  const bulkSet = useBulkSetStock();
  const bulkPrice = useBulkUpdatePrices();

  // Rows currently eligible for selection / inline edit (must have a real theme).
  const eligibleRows = useMemo(() => filtered.filter((r) => r.themeId), [filtered]);
  const allSelected = eligibleRows.length > 0 && eligibleRows.every((r) => selectedKeys.has(r.key));
  const someSelected = selectedKeys.size > 0 && !allSelected;

  function exitBulk() {
    setBulkMode("none");
    setSelectedKeys(new Set());
    setEditDrafts({});
    setPriceDrafts({});
  }
  function toggleAll(v: boolean) {
    if (!v) { setSelectedKeys(new Set()); return; }
    setSelectedKeys(new Set(eligibleRows.map((r) => r.key)));
  }
  function toggleOne(key: string, v: boolean) {
    setSelectedKeys((s) => { const n = new Set(s); if (v) n.add(key); else n.delete(key); return n; });
  }
  const modifiedCount = useMemo(() => {
    let n = 0;
    for (const r of eligibleRows) {
      const draft = editDrafts[r.key];
      if (draft === undefined || draft === "") continue;
      if (Number(draft) !== r.current_qty) n++;
    }
    return n;
  }, [editDrafts, eligibleRows]);

  // For price bulk edit: count unique articles with a valid, changed draft
  const priceModifiedArticles = useMemo(() => {
    const out: Array<{ article_id: string; new_price: number; old_price: number }> = [];
    const seen = new Set<string>();
    const priceByArticle = new Map<string, number>();
    for (const r of filtered) {
      if (!priceByArticle.has(r.article.id)) priceByArticle.set(r.article.id, r.unit_price);
    }
    for (const [aid, draft] of Object.entries(priceDrafts)) {
      if (seen.has(aid)) continue;
      if (draft === undefined || draft.trim() === "") continue;
      const n = Number(draft);
      if (Number.isNaN(n) || n < 0) continue;
      const old = priceByArticle.get(aid) ?? 0;
      if (n === old) continue;
      seen.add(aid);
      out.push({ article_id: aid, new_price: n, old_price: old });
    }
    return out;
  }, [priceDrafts, filtered]);
  const priceHasInvalid = useMemo(() => {
    for (const v of Object.values(priceDrafts)) {
      if (v === undefined || v.trim() === "") continue;
      const n = Number(v);
      if (Number.isNaN(n) || n < 0) return true;
    }
    return false;
  }, [priceDrafts]);

  async function commitBulkZero() {
    const pairs = eligibleRows.filter((r) => selectedKeys.has(r.key) && r.themeId).map((r) => ({
      article_id: r.article.id, theme_id: r.themeId!,
      notes: `Bulk zero-out (${r.theme?.name ?? "theme"})`,
    }));
    if (!pairs.length) return;
    try {
      const res = await bulkZero.mutateAsync(pairs);
      toast.success(`Zeroed ${res.zeroed} article-stock record${res.zeroed === 1 ? "" : "s"}`);
      exitBulk();
    } catch (e) { toast.error((e as Error).message); }
  }
  async function commitBulkSet() {
    const items: Array<{ article_id: string; theme_id: string; new_qty: number }> = [];
    for (const r of eligibleRows) {
      const draft = editDrafts[r.key];
      if (draft === undefined || draft === "") continue;
      const n = Number(draft);
      if (Number.isNaN(n) || n < 0) continue;
      if (n === r.current_qty) continue;
      items.push({ article_id: r.article.id, theme_id: r.themeId!, new_qty: n });
    }
    if (!items.length) { toast.info("Nothing changed"); return; }
    try {
      const res = await bulkSet.mutateAsync(items);
      toast.success(`Updated ${res.updated} stock row${res.updated === 1 ? "" : "s"}`);
      exitBulk();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function commitBulkPrice() {
    if (priceHasInvalid) { toast.error("Fix invalid prices before saving"); return; }
    if (!priceModifiedArticles.length) { toast.info("Nothing changed"); return; }
    try {
      const res = await bulkPrice.mutateAsync(
        priceModifiedArticles.map((p) => ({ article_id: p.article_id, new_price: p.new_price }))
      );
      toast.success(`Prices updated for ${res.updated} article${res.updated === 1 ? "" : "s"}.`);
      exitBulk();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="flex flex-col h-screen">
      <Header title="Inventory" subtitle="Master list of articles and stock movements" />

      <div className="p-6 flex-1 overflow-auto">
        <ThemeTabs
          themes={themes.data ?? []}
          value={themeFilter}
          onChange={(v) => { setThemeFilter(v); setPage(0); exitBulk(); }}
          isAdmin={isAdmin}
          onManage={(t) => setDeleteThemeFor(t)}
        />

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(0); }}
              placeholder="Search code, name, category…"
              className="w-72 pl-9"
            />
          </div>
          <label className="flex items-center gap-2 text-sm ml-2">
            <Switch checked={lowOnly} onCheckedChange={(v) => { setLowOnly(v); setPage(0); }} />
            Low stock only
          </label>
          <label className="flex items-center gap-2 text-sm ml-2">
            <Switch checked={reservedOnly} onCheckedChange={(v) => { setReservedOnly(v); setPage(0); }} />
            Reserved only
          </label>
          <label className="flex items-center gap-2 text-sm ml-2">
            <Switch checked={noAvailOnly} onCheckedChange={(v) => { setNoAvailOnly(v); setPage(0); }} />
            Zero available
          </label>
          {isAdmin && (
            <label className="flex items-center gap-2 text-sm ml-2">
              <Switch checked={pendingOnly} onCheckedChange={(v) => { setPendingOnly(v); setPage(0); }} />
              <span className="inline-flex items-center gap-1">
                <Box className="h-3.5 w-3.5" /> 3D pending only
              </span>
            </label>
          )}
          <label className="flex items-center gap-2 text-sm ml-2">
            <Switch checked={showDims} onCheckedChange={setShowDims} />
            Show dimensions
          </label>
          <div className="ml-auto flex items-center gap-2">
            {isAdmin && (articles.data?.length ?? 0) === 0 && <SeedButton />}
            {canEdit && <ExcelIOButtons />}
            {isAdmin && bulkMode === "none" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    Bulk actions <ChevDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => { setBulkMode("zero"); setSelectedKeys(new Set()); }}>
                    Zero Out Selected
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { setBulkMode("edit"); setEditDrafts({}); }}>
                    Bulk Update Quantities
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setBulkMode("price"); setPriceDrafts({}); }}>
                    Bulk Update Prices
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {bulkMode !== "none" && (
              <Button size="sm" variant="ghost" className="gap-1.5" onClick={exitBulk}>
                <X className="h-3.5 w-3.5" /> Exit bulk mode
              </Button>
            )}
            {bulkMode === "edit" && (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={bulkSet.isPending || modifiedCount === 0}
                onClick={() => void commitBulkSet()}
              >
                {bulkSet.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save All Changes{modifiedCount > 0 ? ` (${modifiedCount})` : ""}
              </Button>
            )}
            {bulkMode === "price" && (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={bulkPrice.isPending || priceHasInvalid || priceModifiedArticles.length === 0}
                onClick={() => void commitBulkPrice()}
              >
                {bulkPrice.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save All Prices{priceModifiedArticles.length > 0 ? ` (${priceModifiedArticles.length})` : ""}
              </Button>
            )}
            {bulkMode === "zero" && (
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5"
                disabled={bulkZero.isPending || selectedKeys.size === 0}
                onClick={() => {
                  const label = themeFilter === "all" ? "the selected articles across all themes" : `[${themes.data?.find((t) => t.id === themeFilter)?.name}]`;
                  if (!confirm(`This will set current stock quantity to 0 for ${selectedKeys.size} article${selectedKeys.size === 1 ? "" : "s"} under ${label}. This cannot be undone automatically. Continue?`)) return;
                  void commitBulkZero();
                }}
              >
                {bulkZero.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Zero Out{selectedKeys.size > 0 ? ` (${selectedKeys.size})` : ""}
              </Button>
            )}
            {canEdit && (
              <Button size="sm" className="gap-1.5" onClick={() => setEditing({})}>
                <Plus className="h-3.5 w-3.5" /> New article
              </Button>
            )}
          </div>
        </div>

        {bulkMode === "edit" && (
          <div className="mb-2 rounded border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
            Inline edit mode — entering a value sets the new total. To add to existing stock, use Excel upload. Blank cells are skipped; 0 is a zero-out.
          </div>
        )}
        {bulkMode === "price" && (
          <div className="mb-2 rounded border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
            Price inline edit — price is stored per article and applies across every colour theme. Blank cells are skipped; negative values are invalid.
          </div>
        )}

        <div className="rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {bulkMode === "zero" && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={(v) => toggleAll(!!v)}
                      aria-label="Select all"
                    />
                  </TableHead>
                )}
                <TableHead className="w-16">Category</TableHead>
                <TableHead className="w-40">Theme</TableHead>
                <TableHead className="w-28">Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-28 text-right" title={bulkMode === "price" ? "Price applies to this article across all colour themes." : undefined}>
                  Price {bulkMode === "price" && <span className="ml-1 text-[10px] text-muted-foreground">(article-level)</span>}
                </TableHead>
                {showDims && <TableHead className="w-20 text-right">W</TableHead>}
                {showDims && <TableHead className="w-20 text-right">H</TableHead>}
                {showDims && <TableHead className="w-20 text-right">D</TableHead>}
                {showDims && <TableHead className="w-24 text-right">Volume</TableHead>}
                <TableHead className="w-24 text-right">Total Stock</TableHead>
                <TableHead className="w-24 text-right">Reserved</TableHead>
                <TableHead className="w-24 text-right">Available</TableHead>
                <TableHead className="w-24 text-right">Min</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-44 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped ? grouped.flatMap((g) => {
                const collapsed = collapsedThemes[g.key];
                const colCount = (showDims ? 15 : 11) + (bulkMode === "zero" ? 1 : 0);
                const header = (
                  <TableRow key={`grp-${g.key}`} className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={colCount} className="py-2">
                      <button
                        type="button"
                        onClick={() => setCollapsedThemes((s) => ({ ...s, [g.key]: !s[g.key] }))}
                        className="flex items-center gap-2 text-sm font-semibold w-full text-left"
                      >
                        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {g.theme && (
                          <span className="h-3 w-3 rounded-full border border-border/40" style={{ background: g.theme.hex_color ?? "#888" }} />
                        )}
                        <span>{g.theme?.name ?? "No theme"}</span>
                        <Badge variant="secondary" className="ml-1">{g.rows.length} article{g.rows.length === 1 ? "" : "s"}</Badge>
                      </button>
                    </TableCell>
                  </TableRow>
                );
                if (collapsed) return [header];
                return [header, ...g.rows.map((r) => renderRow(r))];
              }) : paged.map((r) => renderRow(r))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={(showDims ? 15 : 11) + (bulkMode === "zero" ? 1 : 0)} className="text-center text-sm text-muted-foreground py-10">
                    {articles.isLoading ? "Loading…" : "No articles match."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {themeFilter !== "all" && filtered.length > PER && (
          <div className="flex items-center justify-end gap-2 mt-3">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {Math.ceil(filtered.length / PER)}
            </span>
            <Button size="sm" variant="outline" disabled={(page + 1) * PER >= filtered.length} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </div>

      {bulkMode === "zero" && selectedKeys.size > 0 && (
        <div className="sticky bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur px-6 py-3 flex items-center gap-3">
          <span className="text-sm font-medium">{selectedKeys.size} article{selectedKeys.size === 1 ? "" : "s"} selected</span>
          <span className="text-xs text-muted-foreground">
            {themeFilter === "all" ? "across all themes" : `in ${themes.data?.find((t) => t.id === themeFilter)?.name ?? "theme"}`}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exitBulk}>Cancel</Button>
            <Button size="sm" variant="destructive" disabled={bulkZero.isPending} onClick={() => {
              const label = themeFilter === "all" ? "the selected articles across all themes" : `[${themes.data?.find((t) => t.id === themeFilter)?.name}]`;
              if (!confirm(`This will set current stock quantity to 0 for ${selectedKeys.size} article${selectedKeys.size === 1 ? "" : "s"} under ${label}. This cannot be undone automatically. Continue?`)) return;
              void commitBulkZero();
            }}>
              {bulkZero.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Zero Out Stock
            </Button>
          </div>
        </div>
      )}
      {bulkMode === "edit" && modifiedCount > 0 && (
        <div className="sticky bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur px-6 py-3 flex items-center gap-3">
          <span className="text-sm font-medium">{modifiedCount} row{modifiedCount === 1 ? "" : "s"} modified</span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditDrafts({})}>Discard All</Button>
            <Button size="sm" disabled={bulkSet.isPending} onClick={() => void commitBulkSet()}>
              {bulkSet.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save All Changes
            </Button>
          </div>
        </div>
      )}
      {bulkMode === "price" && (priceModifiedArticles.length > 0 || priceHasInvalid) && (
        <div className="sticky bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur px-6 py-3 flex items-center gap-3">
          <span className="text-sm font-medium">
            {priceModifiedArticles.length} article{priceModifiedArticles.length === 1 ? "" : "s"} modified
          </span>
          {priceHasInvalid && <span className="text-xs text-destructive">Fix invalid prices to enable Save</span>}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setPriceDrafts({})}>Discard All</Button>
            <Button size="sm" disabled={bulkPrice.isPending || priceHasInvalid || priceModifiedArticles.length === 0} onClick={() => void commitBulkPrice()}>
              {bulkPrice.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save All Prices
            </Button>
          </div>
        </div>
      )}

      {editing && (
        <EditArticleDialog
          article={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {movementOpen && (
        <MovementDialog
          article={movementOpen.article}
          themeId={movementOpen.themeId}
          themeName={movementOpen.themeName}
          currentQty={movementOpen.currentQty}
          currentPrice={movementOpen.currentPrice}
          onClose={() => setMovementOpen(null)}
        />
      )}
      {historyOpen && (
        <HistorySheet article={historyOpen} onClose={() => setHistoryOpen(null)} />
      )}
      {illustrationFor && (
        <ModelActionModal
          article={illustrationFor}
          open
          onClose={() => setIllustrationFor(null)}
        />
      )}
      {editModelFor && (
        <ModelWizard
          article={editModelFor}
          open
          edit
          onClose={() => setEditModelFor(null)}
        />
      )}
      {deleteThemeFor && (
        <ThemeDeleteDialog theme={deleteThemeFor} onClose={() => setDeleteThemeFor(null)} />
      )}
    </div>
  );

  function renderRow(r: Row) {
                const a = r.article;
                const curQty = r.current_qty;
                const reserved = r.reserved_qty ?? 0;
                const available = Math.max(0, curQty - reserved);
                const minQty = r.min_qty;
                const price = r.unit_price;
                const low = available < minQty;
                const out = available <= 0;
                const unit = a.dimension_unit ?? "mm";
                const vol = a.volume_m3 ?? calcVolumeM3(a.width_mm, a.height_mm, a.depth_mm);
                const cat = categoryAbbr(a.category);
                const canBulk = !!r.themeId;
                const isChecked = selectedKeys.has(r.key);
                const draft = editDrafts[r.key];
                const draftNum = draft === undefined || draft === "" ? null : Number(draft);
                const isModified = draftNum !== null && !Number.isNaN(draftNum) && draftNum !== curQty;
                return (
                  <TableRow key={r.key} className={out ? "bg-destructive/5" : low ? "bg-amber-500/5" : undefined}>
                    {bulkMode === "zero" && (
                      <TableCell>
                        {canBulk ? (
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(v) => toggleOne(r.key, !!v)}
                            aria-label={`Select ${a.code}`}
                          />
                        ) : (
                          <span className="text-[10px] text-muted-foreground" title="No stock row yet">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <span
                        title={cat.label}
                        className={"inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold " + cat.cls}
                      >
                        {cat.abbr}
                      </span>
                    </TableCell>
                    <TableCell>
                      {r.theme ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span
                            className="h-2.5 w-2.5 rounded-full border border-border/40 shrink-0"
                            style={{ background: r.theme.hex_color ?? "#888" }}
                          />
                          <span className="truncate">{r.theme.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{a.code}</TableCell>
                    <TableCell>
                      <div className="font-medium">{a.name}</div>
                      {a.description && <div className="text-[11px] text-muted-foreground line-clamp-1">{a.description}</div>}
                    </TableCell>
                    {(() => {
                      const pDraft = priceDrafts[a.id];
                      const pNum = pDraft === undefined || pDraft.trim() === "" ? null : Number(pDraft);
                      const pInvalid = pNum !== null && (Number.isNaN(pNum) || pNum < 0);
                      const pModified = pNum !== null && !pInvalid && pNum !== price;
                      return (
                        <TableCell className={"text-right font-mono tabular-nums " + (bulkMode === "price" && pModified ? "bg-blue-500/10" : "")}>
                          {bulkMode === "price" && isAdmin ? (
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={pDraft ?? Number(price ?? 0).toFixed(2)}
                              onChange={(e) => setPriceDrafts((s) => ({ ...s, [a.id]: e.target.value }))}
                              className={"h-7 text-right font-mono " + (pInvalid ? "border-destructive focus-visible:ring-destructive" : pModified ? "border-blue-500" : "")}
                              aria-invalid={pInvalid}
                            />
                          ) : (
                            <>€{Number(price ?? 0).toFixed(2)}</>
                          )}
                        </TableCell>
                      );
                    })()}
                    {showDims && <TableCell className="text-right font-mono tabular-nums text-xs">{fmtDim(a.width_mm, unit)}</TableCell>}
                    {showDims && <TableCell className="text-right font-mono tabular-nums text-xs">{fmtDim(a.height_mm, unit)}</TableCell>}
                    {showDims && <TableCell className="text-right font-mono tabular-nums text-xs">{fmtDim(a.depth_mm, unit)}</TableCell>}
                    {showDims && <TableCell className="text-right font-mono tabular-nums text-xs">{fmtVolume(vol)}</TableCell>}
                    <TableCell className={"text-right font-mono tabular-nums " + (bulkMode === "edit" && isModified ? "bg-blue-500/10" : "")}>
                      {bulkMode === "edit" && canBulk ? (
                        <Input
                          type="number"
                          min={0}
                          value={draft ?? String(curQty)}
                          onChange={(e) => setEditDrafts((s) => ({ ...s, [r.key]: e.target.value }))}
                          className={"h-7 text-right font-mono " + (isModified ? "border-blue-500" : "")}
                        />
                      ) : (
                        curQty
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {reserved > 0 ? reserved : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell
                      className={"text-right font-mono tabular-nums font-semibold " + ((curQty - reserved) <= 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}
                      title={`On hand ${curQty} − reserved ${reserved}`}
                    >
                      {reserved > 0 ? (curQty - reserved) : curQty}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{minQty}</TableCell>
                    <TableCell>
                      {out ? <Badge variant="destructive">Out</Badge>
                        : low ? <Badge className="bg-amber-500 hover:bg-amber-500/90">Low</Badge>
                        : <Badge variant="secondary">OK</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {isAdmin && a.illustration_status === "pending" && (
                          <button
                            type="button"
                            onClick={() => setIllustrationFor(a)}
                            title="No 3D model — click to configure"
                            className="inline-flex items-center gap-1 rounded-full border border-amber-500/60 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 animate-pulse hover:animate-none hover:bg-amber-500/20"
                          >
                            <Box className="h-3 w-3" /> No 3D Model
                          </button>
                        )}
                        {isAdmin && a.illustration_status === "no_illustration" && (
                          <button
                            type="button"
                            onClick={() => setIllustrationFor(a)}
                            title="Marked as 2D only — click to change"
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted/70"
                          >
                            2D only
                          </button>
                        )}
                        {isAdmin && a.illustration_status === "model_ready" && (
                          <button
                            type="button"
                            onClick={() => setEditModelFor(a)}
                            title="Edit 3D model"
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                          >
                            <Box className="h-3 w-3" /> Edit 3D
                          </button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setHistoryOpen(a)} title="History">
                          <History className="h-4 w-4" />
                        </Button>
                        {canEdit && (
                          <>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMovementOpen({ article: a, themeId: r.themeId, themeName: r.theme?.name ?? null, currentQty: r.current_qty, currentPrice: r.unit_price })} title="Receive / adjust">
                              <ArrowUpCircle className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(a)} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {isPartner && curQty > 0 && (
                          <Button size="sm" variant="outline" onClick={() => toast.info("Use the Designer or contact your Admin for direct orders")}>
                            Add to order
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
  }
}

function ThemeTabs({
  themes, value, onChange, isAdmin, onManage,
}: {
  themes: ColorTheme[];
  value: string;
  onChange: (v: string) => void;
  isAdmin: boolean;
  onManage: (t: ColorTheme) => void;
}) {
  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <button
        onClick={() => onChange("all")}
        className={"px-3 py-1.5 text-xs rounded-full border " + (value === "all" ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted")}
      >All themes</button>
      {themes.map((t) => {
        const active = value === t.id;
        const builtin = isBuiltinTheme(t);
        return (
          <div key={t.id} className={"inline-flex items-center rounded-full border " + (active ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted")}>
            <button
              onClick={() => onChange(t.id)}
              className="px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
            >
              <span className="h-2.5 w-2.5 rounded-full border border-border/40" style={{ background: t.hex_color ?? "#888" }} />
              {t.name}
            </button>
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Manage ${t.name}`}
                    title="Manage theme"
                    className={"pr-2 pl-1 py-1.5 " + (active ? "opacity-80 hover:opacity-100" : "opacity-60 hover:opacity-100")}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem disabled title="Use the article editor to update the swatch">
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Theme Details
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {builtin ? (
                    <DropdownMenuItem disabled>
                      <Lock className="h-3.5 w-3.5 mr-2" /> Built-in — cannot delete
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onManage(t)}>
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Theme
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ThemeDeleteDialog({ theme, onClose }: { theme: ColorTheme; onClose: () => void }) {
  const precheck = useThemeDeletePrecheck();
  const del = useDeleteColorTheme();
  const [info, setInfo] = useState<ThemeDeletePrecheck | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(true);

  useMemoRun(() => {
    (async () => {
      try {
        const res = await precheck.mutateAsync(theme.id);
        setInfo(res);
      } catch (e) { toast.error((e as Error).message); onClose(); }
      finally { setLoading(false); }
    })();
  });

  const blocked = !!info && info.active_orders.length > 0;
  const canConfirm = !!info && !blocked && !info.is_builtin && confirmText.trim() === theme.name;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-border/40" style={{ background: theme.hex_color ?? "#888" }} />
            Delete theme — {theme.name}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-8 flex items-center justify-center text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading impact…
          </div>
        ) : info ? (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <Stat2 label="Articles" value={info.article_count} />
              <Stat2 label="Total stock" value={info.stock_qty} />
              <Stat2 label="Reserved" value={info.reserved_qty} />
            </div>
            {info.is_builtin && (
              <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                <Lock className="inline h-3.5 w-3.5 mr-1" /> Built-in theme — cannot be deleted.
              </div>
            )}
            {blocked ? (
              <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-xs space-y-2">
                <div className="font-medium text-destructive">
                  {info.active_orders.length} active order{info.active_orders.length === 1 ? "" : "s"} reference this theme. Delete is blocked until those orders are resolved (fulfilled, cancelled, or rejected).
                </div>
                <div className="space-y-1">
                  {info.active_orders.map((o) => (
                    <a key={o.id} href={`/orders/${o.id}`} className="block underline font-mono text-[11px]">
                      {o.code ?? o.id.slice(0, 8)} — {o.status}
                    </a>
                  ))}
                </div>
              </div>
            ) : !info.is_builtin ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  This will zero all stock rows under the theme, delete its stock &amp; finishes records, and hide it from every module. Historical order records remain intact.
                </p>
                <div>
                  <Label className="text-xs">Type <span className="font-mono font-semibold">{theme.name}</span> to confirm</Label>
                  <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="mt-1" />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!canConfirm || del.isPending}
            onClick={async () => {
              try {
                const res = await del.mutateAsync(theme.id);
                toast.success(`${res.name} and its stock records have been removed.`);
                onClose();
              } catch (e) { toast.error((e as Error).message); }
            }}
          >
            {del.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Delete theme
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat2({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-border bg-card p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

// Run an effect exactly once when a component mounts (avoid pulling in useEffect import churn — simple wrapper).
import { useEffect as _useEffect } from "react";
function useMemoRun(fn: () => void) { _useEffect(() => { fn(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []); }

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="px-6 py-4 border-b border-border bg-card">
      <h1 className="font-serif text-2xl tracking-tight">{title}</h1>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </header>
  );
}

function EditArticleDialog({ article, onClose }: { article: Partial<Article>; onClose: () => void }) {
  const { isAdmin, isStockkeeper } = useAppUser();
  const canEditDims = isAdmin || isStockkeeper;
  const [a, setA] = useState<Partial<Article>>({ unit: "pcs", current_qty: 0, min_qty: 0, unit_price: 0, dimension_unit: "mm", ...article });
  const upsert = useUpsertArticle();
  const del = useDeleteArticle();
  const editing = !!article.id;
  const liveVolume = calcVolumeM3(a.width_mm as number, a.height_mm as number, a.depth_mm as number);
  const unit = a.dimension_unit ?? "mm";

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{editing ? "Edit article" : "New article"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code *" value={a.code ?? ""} onChange={(v) => setA({ ...a, code: v })} disabled={editing} />
          <Field label="Category" value={a.category ?? ""} onChange={(v) => setA({ ...a, category: v })} />
          <Field label="Name *" value={a.name ?? ""} onChange={(v) => setA({ ...a, name: v })} className="col-span-2" />
          <Field label="Description" value={a.description ?? ""} onChange={(v) => setA({ ...a, description: v })} className="col-span-2" />
          <Field label="Unit" value={a.unit ?? "pcs"} onChange={(v) => setA({ ...a, unit: v })} />
          <Field label="Supplier" value={a.supplier ?? ""} onChange={(v) => setA({ ...a, supplier: v })} />
          <Field label="Unit price" type="number" value={String(a.unit_price ?? 0)} onChange={(v) => setA({ ...a, unit_price: Number(v) || 0 })} />
          <Field label="Image URL" value={a.image_url ?? ""} onChange={(v) => setA({ ...a, image_url: v })} />
          <Field label="Current qty" type="number" value={String(a.current_qty ?? 0)} onChange={(v) => setA({ ...a, current_qty: Number(v) || 0 })} disabled={editing} />
          <Field label="Min qty" type="number" value={String(a.min_qty ?? 0)} onChange={(v) => setA({ ...a, min_qty: Number(v) || 0 })} />
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Dimensions</div>
          <div className="grid grid-cols-4 gap-3">
            <Field label={`Width (${unit})`} type="number" value={String(a.width_mm ?? "")} onChange={(v) => setA({ ...a, width_mm: v === "" ? null : Number(v) })} disabled={!canEditDims} />
            <Field label={`Height (${unit})`} type="number" value={String(a.height_mm ?? "")} onChange={(v) => setA({ ...a, height_mm: v === "" ? null : Number(v) })} disabled={!canEditDims} />
            <Field label={`Depth (${unit})`} type="number" value={String(a.depth_mm ?? "")} onChange={(v) => setA({ ...a, depth_mm: v === "" ? null : Number(v) })} disabled={!canEditDims} />
            <Field label="Unit" value={unit} onChange={(v) => setA({ ...a, dimension_unit: v })} disabled={!canEditDims} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground font-mono">
            {a.width_mm ?? "—"}{unit} × {a.height_mm ?? "—"}{unit} × {a.depth_mm ?? "—"}{unit} = <span className="text-foreground">{liveVolume ? `${liveVolume.toFixed(3)} m³` : "—"}</span>
          </p>
        </div>

        <DialogFooter className="flex !justify-between">
          {editing ? (
            <Button variant="destructive" onClick={async () => { await del.mutateAsync(article.id!); toast.success("Deleted"); onClose(); }}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Delete
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={async () => {
              try {
                await upsert.mutateAsync(a);
                toast.success("Saved");
                onClose();
              } catch (e) { toast.error((e as Error).message); }
            }}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovementDialog({ article, themeId, themeName, currentQty, currentPrice, onClose }: { article: Article; themeId: string | null; themeName: string | null; currentQty: number; currentPrice: number; onClose: () => void }) {
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState<"receive" | "adjust">("receive");
  const [notes, setNotes] = useState("");
  const [priceDraft, setPriceDraft] = useState<string>(String(currentPrice ?? 0));
  const themesQ = useColorThemes();
  const [pickedThemeId, setPickedThemeId] = useState<string>("");
  const effectiveThemeId = themeId ?? (pickedThemeId || null);
  const effectiveThemeName =
    themeName ??
    (themesQ.data ?? []).find((t) => t.id === pickedThemeId)?.name ??
    null;
  const m = useRecordMovement();
  const mTheme = useRecordThemeMovement();
  const setPrice = useUpdateThemeStockPrice();
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{article.name} — record movement{effectiveThemeName ? ` · ${effectiveThemeName}` : " · pick a theme"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {!themeId && (
            <div className="space-y-1">
              <Label className="text-xs">Colour theme</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={pickedThemeId}
                onChange={(e) => setPickedThemeId(e.target.value)}
              >
                <option value="">— Select a theme —</option>
                {(themesQ.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Choose which colour theme this stock belongs to. A stock row will be created for the article in that theme.
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant={reason === "receive" ? "default" : "outline"} onClick={() => setReason("receive")}>Receive (+)</Button>
            <Button variant={reason === "adjust" ? "default" : "outline"} onClick={() => setReason("adjust")}>Adjust (±)</Button>
          </div>
          <Field label={reason === "receive" ? "Quantity to add" : "Delta (negative to remove)"} type="number" value={String(delta)} onChange={(v) => setDelta(Number(v) || 0)} />
          <Field label="Notes" value={notes} onChange={setNotes} />
          <p className="text-xs text-muted-foreground">Current on hand{effectiveThemeName ? ` for ${effectiveThemeName}` : ""}: {currentQty}</p>
          {effectiveThemeId && (
            <div className="border-t border-border pt-3">
              <Field label={`Unit price for ${effectiveThemeName}`} type="number" value={priceDraft} onChange={setPriceDraft} />
              <Button size="sm" variant="outline" className="mt-2" onClick={async () => {
                const p = Number(priceDraft);
                if (Number.isNaN(p) || p < 0) { toast.error("Invalid price"); return; }
                await setPrice.mutateAsync({ article_id: article.id, theme_id: effectiveThemeId, unit_price: p });
                toast.success("Price updated");
              }}>Save price</Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={async () => {
            const signed = reason === "receive" ? Math.abs(delta) : delta;
            if (!signed) { toast.error("Enter a quantity"); return; }
            if (effectiveThemeId) {
              await mTheme.mutateAsync({ article_id: article.id, theme_id: effectiveThemeId, delta: signed, reason, notes });
            } else {
              await m.mutateAsync({ article_id: article.id, delta: signed, reason, notes });
            }
            toast.success("Recorded");
            onClose();
          }}>Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistorySheet({ article, onClose }: { article: Article; onClose: () => void }) {
  const { isAdmin } = useAppUser();
  const m = useMovementsForArticle(article.id);
  const [tab, setTab] = useState<"stock" | "price">("stock");
  const priceHist = usePriceHistory(isAdmin && tab === "price" ? article.id : null);
  const labelFor = (reason: string) => {
    switch (reason) {
      case "opening_stock": return "Opening Stock";
      case "stock_received":
      case "receive": return "Stock Received";
      case "order_fulfilled": return "Order Fulfillment";
      case "order_reversal": return "Order Reversal";
      case "adjust": return "Adjustment";
      default: return reason.replace("_", " ");
    }
  };
  const srcLabel = (s: string) => s === "bulk_edit" ? "Bulk Edit" : s === "excel_upload" ? "Excel Upload" : "Manual Edit";
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[420px] sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>{article.name}</SheetTitle>
          <p className="text-xs text-muted-foreground">History</p>
        </SheetHeader>
        {isAdmin && (
          <div className="mt-3 inline-flex rounded-md border border-border p-0.5 text-xs">
            <button className={"px-3 py-1 rounded " + (tab === "stock" ? "bg-foreground text-background" : "hover:bg-muted")} onClick={() => setTab("stock")}>Stock Movements</button>
            <button className={"px-3 py-1 rounded " + (tab === "price" ? "bg-foreground text-background" : "hover:bg-muted")} onClick={() => setTab("price")}>Price History</button>
          </div>
        )}
        {tab === "stock" ? (
        <div className="mt-4 space-y-2">
          {(m.data ?? []).map((row) => (
            <div key={row.id} className="border border-border rounded p-2 text-xs">
              <div className="flex justify-between font-medium">
                <span className={row.delta > 0 ? "text-emerald-600" : "text-destructive"}>
                  {row.delta > 0 ? "+" : ""}{row.delta}
                </span>
                <span className="text-muted-foreground">{new Date(row.created_at).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{labelFor(row.reason)}</span>
                {row.unit_price > 0 && (
                  <span className="font-mono tabular-nums">@ €{Number(row.unit_price).toFixed(2)}</span>
                )}
              </div>
              {row.order_id && (
                <div className="text-[10px] text-muted-foreground">Order: {row.order_id.slice(0, 8)}…</div>
              )}
              {row.notes && <div className="mt-0.5">{row.notes}</div>}
            </div>
          ))}
          {(m.data ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">No movements yet.</p>
          )}
        </div>
        ) : (
        <div className="mt-4 space-y-2">
          {priceHist.isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
          {(priceHist.data ?? []).map((row) => (
            <div key={row.id} className="border border-border rounded p-2 text-xs">
              <div className="flex justify-between font-medium">
                <span className="font-mono tabular-nums">
                  €{Number(row.old_price).toFixed(2)} → €{Number(row.new_price).toFixed(2)}
                </span>
                <span className="text-muted-foreground">{new Date(row.changed_at).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{row.changer?.full_name ?? row.changer?.email ?? "—"}</span>
                <Badge variant="secondary" className="text-[10px]">{srcLabel(row.change_source)}</Badge>
              </div>
            </div>
          ))}
          {!priceHist.isLoading && (priceHist.data ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">No price changes yet.</p>
          )}
        </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value, onChange, type = "text", disabled, className }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; disabled?: boolean; className?: string;
}) {
  return (
    <div className={"space-y-1 " + (className ?? "")}>
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SeedButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={async () => {
      if (!confirm("Seed the article catalog from the Express Küchen stock sheet? This adds one row per unique unit code (using the first theme's price/qty as defaults).")) return;
      setBusy(true);
      try {
        const seen = new Set<string>();
        const rows: Array<Record<string, unknown>> = [];
        for (const theme of THEMES) {
          const t = THEME_STOCK[theme.id] ?? {};
          for (const [rawCode, info] of Object.entries(t)) {
            const code = rawCode.trim();
            if (seen.has(code)) continue;
            seen.add(code);
            const mod = STOCK_MODULES.find((m) => (m.unitCode ?? "").trim() === code);
            rows.push({
              code,
              name: mod?.name ?? code,
              description: mod?.description ?? null,
              category: mod?.category ?? null,
              unit_type: mod?.unitType ?? null,
              unit: "pcs",
              unit_price: info.price,
              current_qty: info.qty,
              min_qty: 1,
              width_mm: mod ? Math.round(mod.width * 1000) : null,
              height_mm: mod ? Math.round(mod.height * 1000) : null,
              depth_mm: mod ? Math.round(mod.depth * 1000) : null,
            });
          }
        }
        const { error } = await supabase.from("articles").insert(rows as never);
        if (error) throw error;
        toast.success(`Seeded ${rows.length} articles`);
        window.location.reload();
      } catch (e) {
        toast.error((e as Error).message);
      } finally { setBusy(false); }
    }}>
      <Database className="h-3.5 w-3.5" />
      {busy ? "Seeding…" : "Seed catalog"}
    </Button>
  );
}
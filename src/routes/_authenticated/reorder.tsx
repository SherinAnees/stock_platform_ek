import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  useArticles,
  useColorThemes,
  useAllArticleStock,
  usePlaceReorders,
  useMarkReorderArrived,
  useReorderBatches,
  type Article,
  type ColorTheme,
  type ReorderItemInput,
} from "@/lib/data/queries";
import { useAppUser } from "@/lib/auth/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Search, PackageCheck, Send, ChevronDown, ChevronRight, CalendarIcon, X } from "lucide-react";
import { toast } from "sonner";
import { categoryAbbr } from "@/lib/inventory/category";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reorder")({
  head: () => ({ meta: [{ title: "Reorder — Kitchen ERP" }] }),
  component: ReorderPage,
});

type Row = {
  key: string;
  article: Article;
  theme: ColorTheme | null;
  themeId: string | null;
  current_qty: number;
  min_qty: number;
  shortage: number;
  reorder_qty: number;
  reorder_status: "none" | "ordered";
  reorder_ordered_at: string | null;
};

function ReorderPage() {
  const { isAdmin, isStockkeeper } = useAppUser();
  const canEdit = isAdmin || isStockkeeper;

  const articles = useArticles();
  const themes = useColorThemes();
  const allStock = useAllArticleStock();
  const placeReorders = usePlaceReorders();
  const markArrived = useMarkReorderArrived();

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [qtyEdits, setQtyEdits] = useState<Record<string, number>>({});
  const [recentlyArrived, setRecentlyArrived] = useState<Record<string, number>>({});

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
    const out: Row[] = [];
    // Per-theme rows
    for (const r of allStock.data ?? []) {
      const article = articleById.get(r.article_id);
      if (!article) continue;
      const status = (r.reorder_status ?? "none") as "none" | "ordered";
      const shortage = Math.max(0, (r.min_qty ?? 0) - (r.current_qty ?? 0));
      if (status === "none" && shortage <= 0) continue;
      out.push({
        key: `${r.article_id}:${r.theme_id}`,
        article,
        theme: themeById.get(r.theme_id) ?? null,
        themeId: r.theme_id,
        current_qty: r.current_qty,
        min_qty: r.min_qty,
        shortage,
        reorder_qty: r.reorder_qty ?? 0,
        reorder_status: status,
        reorder_ordered_at: r.reorder_ordered_at ?? null,
      });
    }
    // Theme-less articles (worktops/handles)
    for (const a of articles.data ?? []) {
      const status = (a.reorder_status ?? "none") as "none" | "ordered";
      const shortage = Math.max(0, (a.min_qty ?? 0) - (a.current_qty ?? 0));
      // skip if any theme row exists for this article (already covered above)
      const hasTheme = (allStock.data ?? []).some((s) => s.article_id === a.id);
      if (hasTheme) continue;
      if (status === "none" && shortage <= 0) continue;
      out.push({
        key: `${a.id}:none`,
        article: a,
        theme: null,
        themeId: null,
        current_qty: a.current_qty,
        min_qty: a.min_qty,
        shortage,
        reorder_qty: a.reorder_qty ?? 0,
        reorder_status: status,
        reorder_ordered_at: a.reorder_ordered_at ?? null,
      });
    }
    out.sort((a, b) => {
      // ordered last, then biggest shortage first
      if (a.reorder_status !== b.reorder_status) return a.reorder_status === "ordered" ? 1 : -1;
      if (b.shortage !== a.shortage) return b.shortage - a.shortage;
      return a.article.code.localeCompare(b.article.code);
    });
    return out;
  }, [allStock.data, articles.data, articleById, themeById]);

  // Detect rows that just transitioned out of "ordered" (arrived → tag briefly)
  useEffect(() => {
    const t = setTimeout(() => setRecentlyArrived({}), 4000);
    return () => clearTimeout(t);
  }, [recentlyArrived]);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    if (!ql) return rows;
    return rows.filter((r) =>
      r.article.code.toLowerCase().includes(ql) ||
      r.article.name.toLowerCase().includes(ql) ||
      (r.theme?.name ?? "").toLowerCase().includes(ql)
    );
  }, [rows, q]);

  const pending = filtered.filter((r) => r.reorder_status === "none");
  const selectedRows = pending.filter((r) => selected[r.key]);

  function effectiveQty(r: Row) {
    if (qtyEdits[r.key] !== undefined) return qtyEdits[r.key];
    return r.reorder_qty > 0 ? r.reorder_qty : r.shortage;
  }

  function toggleAll(v: boolean) {
    const next: Record<string, boolean> = {};
    if (v) for (const r of pending) next[r.key] = true;
    setSelected(next);
  }

  async function handlePlaceOrder() {
    if (selectedRows.length === 0) return;
    const items: ReorderItemInput[] = selectedRows
      .map((r) => ({
        article_id: r.article.id,
        theme_id: r.themeId,
        qty: Math.max(0, Math.floor(effectiveQty(r))),
      }))
      .filter((i) => i.qty > 0);
    if (items.length === 0) {
      toast.error("Set a qty greater than zero on at least one row.");
      return;
    }
    try {
      await placeReorders.mutateAsync(items);
      toast.success(`Reorder placed for ${items.length} element${items.length === 1 ? "" : "s"}.`);
      setSelected({});
      setQtyEdits({});
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to place reorder");
    }
  }

  async function handleMarkArrived(r: Row) {
    try {
      const qty = r.reorder_qty;
      await markArrived.mutateAsync({ article_id: r.article.id, theme_id: r.themeId });
      setRecentlyArrived((s) => ({ ...s, [r.key]: qty }));
      toast.success(`Added ${qty} unit(s) to stock for ${r.article.code}.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to mark arrived");
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="px-6 py-4 border-b border-border bg-card">
        <h1 className="font-serif text-2xl tracking-tight">Reorder</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Elements below their minimum stock level — place orders and mark them as arrived once delivered.
        </p>
      </header>

      <div className="p-6 flex-1 overflow-auto">
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="pending">To order / Ordered</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search code, name, theme…"
              className="w-72 pl-9"
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {pending.length} to order · {filtered.filter((r) => r.reorder_status === "ordered").length} ordered
            </span>
            {canEdit && (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={selectedRows.length === 0 || placeReorders.isPending}
                onClick={handlePlaceOrder}
              >
                <Send className="h-3.5 w-3.5" />
                Place order ({selectedRows.length})
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  {canEdit && (
                    <Checkbox
                      checked={pending.length > 0 && selectedRows.length === pending.length}
                      onCheckedChange={(v) => toggleAll(!!v)}
                      aria-label="Select all pending"
                    />
                  )}
                </TableHead>
                <TableHead className="w-16">Cat</TableHead>
                <TableHead className="w-44">Theme</TableHead>
                <TableHead className="w-28">Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-20 text-right">On hand</TableHead>
                <TableHead className="w-20 text-right">Min</TableHead>
                <TableHead className="w-20 text-right">Short</TableHead>
                <TableHead className="w-28 text-right">Reorder qty</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-36 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const cat = categoryAbbr(r.article.category);
                const isOrdered = r.reorder_status === "ordered";
                const justArrived = recentlyArrived[r.key];
                return (
                  <TableRow
                    key={r.key}
                    className={isOrdered ? "bg-blue-500/5" : justArrived ? "bg-emerald-500/10" : "bg-amber-500/5"}
                  >
                    <TableCell>
                      {canEdit && !isOrdered && (
                        <Checkbox
                          checked={!!selected[r.key]}
                          onCheckedChange={(v) =>
                            setSelected((s) => ({ ...s, [r.key]: !!v }))
                          }
                          aria-label="Select"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={"inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold " + cat.cls}>
                        {cat.abbr}
                      </span>
                    </TableCell>
                    <TableCell>
                      {r.theme ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="h-2.5 w-2.5 rounded-full border border-border/40 shrink-0" style={{ background: r.theme.hex_color ?? "#888" }} />
                          <span className="truncate">{r.theme.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.article.code}</TableCell>
                    <TableCell>
                      <div className="font-medium">{r.article.name}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{r.current_qty}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{r.min_qty}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
                      {r.shortage > 0 ? r.shortage : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {isOrdered ? (
                        <span className="font-mono tabular-nums font-semibold">{r.reorder_qty}</span>
                      ) : (
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-20 text-right font-mono"
                          value={effectiveQty(r)}
                          onChange={(e) =>
                            setQtyEdits((s) => ({ ...s, [r.key]: Math.max(0, Number(e.target.value) || 0) }))
                          }
                          disabled={!canEdit}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {justArrived ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600/90">Added to stock</Badge>
                      ) : isOrdered ? (
                        <Badge className="bg-blue-600 hover:bg-blue-600/90">Ordered</Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-500/50">To order</Badge>
                      )}
                      {isOrdered && r.reorder_ordered_at && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(r.reorder_ordered_at).toLocaleDateString()}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isOrdered && canEdit && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={markArrived.isPending}
                          onClick={() => handleMarkArrived(r)}
                        >
                          <PackageCheck className="h-3.5 w-3.5" />
                          Mark arrived
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-10">
                    {allStock.isLoading ? "Loading…" : "All elements are at or above their minimum stock level."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
          </TabsContent>

          <TabsContent value="history">
            <ReorderHistory />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ReorderHistory() {
  const batches = useReorderBatches();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "placed" | "partial" | "completed">("all");
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();

  const filtered = useMemo(() => {
    const ql = q.toLowerCase().trim();
    const fromMs = from ? new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime() : undefined;
    const toMs = to ? new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999).getTime() : undefined;
    return (batches.data ?? []).filter((b) => {
      if (ql && !b.code.toLowerCase().includes(ql)) return false;
      if (status !== "all" && b.status !== status) return false;
      const created = new Date(b.created_at).getTime();
      if (fromMs !== undefined && created < fromMs) return false;
      if (toMs !== undefined && created > toMs) return false;
      return true;
    });
  }, [batches.data, q, status, from, to]);

  function clearFilters() {
    setQ("");
    setStatus("all");
    setFrom(undefined);
    setTo(undefined);
  }

  if (batches.isLoading) {
    return <div className="text-sm text-muted-foreground py-10 text-center">Loading…</div>;
  }
  const list = batches.data ?? [];
  if (list.length === 0) {
    return <div className="text-sm text-muted-foreground py-10 text-center">No reorders placed yet.</div>;
  }

  const hasFilters = q || status !== "all" || from || to;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search reorder #…"
            className="w-56 pl-9"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("justify-start text-left font-normal gap-2", !from && "text-muted-foreground")}
            >
              <CalendarIcon className="h-4 w-4" />
              {from ? format(from, "PP") : "From date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={from}
              onSelect={setFrom}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("justify-start text-left font-normal gap-2", !to && "text-muted-foreground")}
            >
              <CalendarIcon className="h-4 w-4" />
              {to ? format(to, "PP") : "To date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={to}
              onSelect={setTo}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        <div className="inline-flex items-center rounded-lg border border-border p-1 bg-background">
          {(["all", "placed", "partial", "completed"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? "secondary" : "ghost"}
              onClick={() => setStatus(s)}
              className="text-xs capitalize h-7 px-2.5"
            >
              {s === "all" ? "All" : s}
            </Button>
          ))}
        </div>

        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {list.length} batch{list.length === 1 ? "" : "es"}
        </span>
      </div>

      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead className="w-40">Reorder #</TableHead>
              <TableHead>Placed</TableHead>
              <TableHead className="text-right w-28">Elements</TableHead>
              <TableHead className="text-right w-24">Total qty</TableHead>
              <TableHead className="text-right w-24">Arrived</TableHead>
              <TableHead className="w-44">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.flatMap((b) => {
              const open = !!expanded[b.id];
              const totalQty = b.lines.reduce((s, l) => s + l.qty, 0);
              const arrivedQty = b.lines.filter((l) => l.arrived_at).reduce((s, l) => s + l.qty, 0);
              const header = (
                <TableRow key={b.id} className="cursor-pointer" onClick={() => setExpanded((s) => ({ ...s, [b.id]: !s[b.id] }))}>
                  <TableCell>{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                  <TableCell className="font-mono text-xs">{b.code}</TableCell>
                  <TableCell className="text-xs">{new Date(b.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{b.lines.length}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{totalQty}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{arrivedQty}/{totalQty}</TableCell>
                  <TableCell><StatusBadge status={b.status} /></TableCell>
                </TableRow>
              );
              if (!open) return [header];
              const lineRows = (
                <TableRow key={b.id + "-detail"} className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={7} className="p-0">
                    <div className="px-6 py-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-44">Theme</TableHead>
                            <TableHead className="w-28">Code</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="w-20 text-right">Qty</TableHead>
                            <TableHead className="w-44">Line status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {b.lines.map((l) => (
                            <TableRow key={l.id}>
                              <TableCell>
                                {l.theme ? (
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <span className="h-2.5 w-2.5 rounded-full border border-border/40 shrink-0" style={{ background: l.theme.hex_color ?? "#888" }} />
                                    <span className="truncate">{l.theme.name}</span>
                                  </div>
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="font-mono text-xs">{l.article?.code ?? "—"}</TableCell>
                              <TableCell>{l.article?.name ?? "—"}</TableCell>
                              <TableCell className="text-right font-mono tabular-nums">{l.qty}</TableCell>
                              <TableCell>
                                {l.arrived_at ? (
                                  <Badge className="bg-emerald-600 hover:bg-emerald-600/90">
                                    Added · {new Date(l.arrived_at).toLocaleDateString()}
                                  </Badge>
                                ) : (
                                  <Badge className="bg-blue-600 hover:bg-blue-600/90">Placed</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TableCell>
                </TableRow>
              );
              return [header, lineRows];
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                  No batches match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "placed" | "partial" | "completed" }) {
  if (status === "completed") return <Badge className="bg-emerald-600 hover:bg-emerald-600/90">Added to stock</Badge>;
  if (status === "partial")   return <Badge className="bg-amber-500 hover:bg-amber-500/90">Partially arrived</Badge>;
  return <Badge className="bg-blue-600 hover:bg-blue-600/90">Placed</Badge>;
}
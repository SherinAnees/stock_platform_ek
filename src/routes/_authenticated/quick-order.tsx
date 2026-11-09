import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useArticles, useColorThemes, useAllArticleStock, usePartners,
  createOrderFromLines,
} from "@/lib/data/queries";
import { useAppUser } from "@/lib/auth/useSession";
import { categoryAbbr } from "@/lib/inventory/category";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ResizablePanelGroup, ResizablePanel, ResizableHandle,
} from "@/components/ui/resizable";
import {
  Search, GripVertical, X, Plus, Minus, ShoppingCart, AlertTriangle, Filter, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/quick-order")({
  head: () => ({ meta: [{ title: "Quick Order — Kitchen ERP" }] }),
  component: QuickOrderPage,
});

type BasketLine = {
  articleId: string;
  themeId: string | null;
  code: string;
  name: string;
  category: string | null;
  unitPrice: number;
  qty: number;
  available: number;
  themeName: string | null;
  themeHex: string | null;
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  volume_m3: number | null;
};

const DND_MIME = "application/x-quick-order-line";
const CAT_RANK: Record<string, number> = { BU: 0, TU: 1, WU: 2 };

function QuickOrderPage() {
  const navigate = useNavigate();
  const { profile } = useAppUser();
  const articles = useArticles();
  const themes = useColorThemes();
  const stockRows = useAllArticleStock();
  const partners = usePartners();

  const [themeFilter, setThemeFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<"all" | "BU" | "TU" | "WU">("all");
  const [q, setQ] = useState("");
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [partnerId, setPartnerId] = useState<string>("none");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Look up selected partner and derive its region for the order
  const selectedPartner = useMemo(
    () => (partners.data ?? []).find((p) => p.id === partnerId) ?? null,
    [partners.data, partnerId]
  );
  // Auto-default to the current user's partner the first time the dialog opens
  function openSubmit() {
    setPartnerId(profile?.partner_id ?? "none");
    setSubmitOpen(true);
  }

  const themeById = useMemo(() => {
    const m = new Map<string, { id: string; name: string; hex_color: string | null }>();
    for (const t of themes.data ?? []) m.set(t.id, { id: t.id, name: t.name, hex_color: t.hex_color });
    return m;
  }, [themes.data]);

  const articleById = useMemo(() => {
    const m = new Map<string, typeof articles.data extends Array<infer T> | undefined ? T : never>();
    for (const a of articles.data ?? []) m.set(a.id, a as never);
    return m;
  }, [articles.data]);

  // Combine stock rows with article + theme info, filter by current selections
  type Row = {
    articleId: string;
    themeId: string;
    code: string;
    name: string;
    category: string | null;
    unitPrice: number;
    width_mm: number | null;
    height_mm: number | null;
    depth_mm: number | null;
    volume_m3: number | null;
    available: number; // current - reserved - basket
    dimUnit: string | null;
  };

  const basketByKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of basket) m.set(`${b.articleId}:${b.themeId}`, b.qty);
    return m;
  }, [basket]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const r of stockRows.data ?? []) {
      const a = articleById.get(r.article_id);
      if (!a) continue;
      if (themeFilter !== "all" && r.theme_id !== themeFilter) continue;
      const cat = categoryAbbr(a.category).abbr;
      if (catFilter !== "all" && cat !== catFilter) continue;
      if (q) {
        const ql = q.toLowerCase();
        if (!a.code.toLowerCase().includes(ql)
          && !a.name.toLowerCase().includes(ql)
          && !(themeById.get(r.theme_id)?.name ?? "").toLowerCase().includes(ql)) continue;
      }
      const basketUsed = basketByKey.get(`${r.article_id}:${r.theme_id}`) ?? 0;
      const available = Math.max(0, (r.current_qty ?? 0) - (r.reserved_qty ?? 0) - basketUsed);
      out.push({
        articleId: r.article_id,
        themeId: r.theme_id,
        code: a.code,
        name: a.name,
        category: a.category,
        unitPrice: Number(r.unit_price ?? a.unit_price ?? 0),
        width_mm: a.width_mm, height_mm: a.height_mm, depth_mm: a.depth_mm,
        volume_m3: a.volume_m3, dimUnit: a.dimension_unit,
        available,
      });
    }
    out.sort((x, y) => {
      const r = (CAT_RANK[categoryAbbr(x.category).abbr] ?? 99) - (CAT_RANK[categoryAbbr(y.category).abbr] ?? 99);
      if (r !== 0) return r;
      return x.code.localeCompare(y.code);
    });
    return out;
  }, [stockRows.data, articleById, themeById, themeFilter, catFilter, q, basketByKey]);

  function addToBasket(row: Row) {
    if (row.available <= 0) return;
    setBasket((prev) => {
      const idx = prev.findIndex((b) => b.articleId === row.articleId && b.themeId === row.themeId);
      if (idx >= 0) {
        const next = [...prev];
        const existing = next[idx];
        if (existing.qty + 1 > existing.available) {
          toast.warning(`Only ${existing.available} units available for this theme.`);
          return prev;
        }
        next[idx] = { ...existing, qty: existing.qty + 1 };
        return next;
      }
      const t = themeById.get(row.themeId) ?? null;
      return [...prev, {
        articleId: row.articleId, themeId: row.themeId,
        code: row.code, name: row.name, category: row.category,
        unitPrice: row.unitPrice, qty: 1,
        // available shown on the basket line is current - reserved (excluding basket)
        available: row.available + 1,
        themeName: t?.name ?? null, themeHex: t?.hex_color ?? null,
        width_mm: row.width_mm, height_mm: row.height_mm,
        depth_mm: row.depth_mm, volume_m3: row.volume_m3,
      }];
    });
  }

  function setLineQty(articleId: string, themeId: string | null, qty: number) {
    setBasket((prev) => prev.flatMap((b) => {
      if (b.articleId !== articleId || b.themeId !== themeId) return [b];
      if (qty <= 0) return [];
      if (qty > b.available) {
        toast.warning(`Only ${b.available} units available for this theme.`);
        return [{ ...b, qty: b.available }];
      }
      return [{ ...b, qty }];
    }));
  }

  function removeLine(articleId: string, themeId: string | null) {
    setBasket((prev) => prev.filter((b) => !(b.articleId === articleId && b.themeId === themeId)));
  }

  function onRowDragStart(e: React.DragEvent, row: Row) {
    e.dataTransfer.setData(DND_MIME, JSON.stringify({ articleId: row.articleId, themeId: row.themeId }));
    e.dataTransfer.effectAllowed = "copy";
  }

  function onBasketDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const raw = e.dataTransfer.getData(DND_MIME);
    if (!raw) return;
    const { articleId, themeId } = JSON.parse(raw) as { articleId: string; themeId: string };
    const row = rows.find((r) => r.articleId === articleId && r.themeId === themeId);
    if (!row) return;
    addToBasket(row);
  }

  const totals = useMemo(() => {
    let items = 0, volume = 0, grand = 0;
    for (const b of basket) {
      items += b.qty;
      const v = b.volume_m3 ?? (b.width_mm && b.height_mm && b.depth_mm
        ? (b.width_mm * b.height_mm * b.depth_mm) / 1_000_000_000 : 0);
      volume += v * b.qty;
      grand += b.qty * b.unitPrice;
    }
    return { items, volume, grand };
  }, [basket]);

  async function placeOrder() {
    if (basket.length === 0) return;
    setSubmitting(true);
    try {
      const { id } = await createOrderFromLines({
        partnerId: partnerId === "none" ? null : partnerId,
        regionId: selectedPartner?.region_id ?? null,
        clientName: clientName.trim() || null,
        deliveryNotes,
        notes: "[Quick Order]",
        lines: basket.map((b) => ({
          articleId: b.articleId, qty: b.qty, unitPrice: b.unitPrice, themeId: b.themeId,
        })),
      });
      toast.success("Order submitted for approval");
      setBasket([]);
      setSubmitOpen(false);
      navigate({ to: "/orders/$orderId", params: { orderId: id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSubmitting(false); }
  }

  return (
    <div className="flex flex-col h-screen w-full min-w-0">
      <header className="px-6 py-4 border-b border-border bg-card shrink-0">
        <h1 className="font-serif text-2xl tracking-tight">Quick Order</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Drag articles into the basket on the right, then place your order.</p>
      </header>

      <ResizablePanelGroup orientation="horizontal" className="flex-1 overflow-hidden min-w-0">
        {/* LEFT: catalog */}
        <ResizablePanel defaultSize="22%" minSize="18%" maxSize="40%" className="flex flex-col min-w-0 overflow-hidden">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search element code or name" className="w-full pl-9" />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Filters</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {(["all", "BU", "TU", "WU"] as const).map((c) => (
                <Button key={c} size="sm" variant={catFilter === c ? "default" : "outline"} onClick={() => setCatFilter(c)} className="h-7 px-2 text-xs">
                  {c === "all" ? "All" : c}
                </Button>
              ))}
            </div>
            <Select value={themeFilter} onValueChange={setThemeFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All colors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All colors</SelectItem>
                {(themes.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full border border-border/40" style={{ background: t.hex_color ?? "#888" }} />
                      {t.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {rows.length} item{rows.length === 1 ? "" : "s"} found
            </div>
            {(q || catFilter !== "all" || themeFilter !== "all") && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => { setQ(""); setCatFilter("all"); setThemeFilter("all"); }}>
                <RotateCcw className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>

          <div className="space-y-1">
            {rows.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-12">
                No articles match the current filters.
              </div>
            )}
            {rows.map((row) => {
              const disabled = row.available <= 0;
              const t = themeById.get(row.themeId);
              const cat = categoryAbbr(row.category);
              return (
                <div
                  key={`${row.articleId}:${row.themeId}`}
                  draggable={!disabled}
                  onDragStart={(e) => onRowDragStart(e, row)}
                  onDoubleClick={() => addToBasket(row)}
                  className={
                    "flex items-start gap-2 px-2 py-1.5 rounded-md border bg-card text-sm " +
                    (disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-muted cursor-grab active:cursor-grabbing")
                  }
                  title={
                    disabled
                      ? `Out of stock — ${row.name}`
                      : `${row.name} — ${t?.name ?? ""} · €${row.unitPrice.toFixed(2)} · drag or double-click to add`
                  }
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className={"inline-flex items-center justify-center min-w-[1.75rem] px-1 py-0.5 rounded border text-[10px] font-mono font-bold " + cat.cls}>{cat.abbr}</span>
                      <span className="h-2 w-2 rounded-full border border-border/40 shrink-0" style={{ background: t?.hex_color ?? "#888" }} title={t?.name ?? ""} />
                      <span className="text-xs text-muted-foreground truncate">{t?.name ?? ""}</span>
                    </div>
                    <div className="text-xs leading-tight truncate">{row.name}</div>
                  </div>
                  <Badge variant={disabled ? "destructive" : "secondary"} className="h-5 px-1.5 text-[10px] tabular-nums shrink-0 mt-0.5">
                    {disabled ? "Out" : row.available}
                  </Badge>
                </div>
              );
            })}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* RIGHT: basket */}
        <ResizablePanel
          defaultSize="78%"
          className="flex flex-col min-w-0 overflow-hidden"
        >
          <aside
            className={"flex flex-col flex-1 overflow-hidden bg-muted/30 " + (dragOver ? "ring-2 ring-primary ring-inset" : "")}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onBasketDrop}
          >
          <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="font-medium">Order basket</span>
            <Badge variant="secondary" className="ml-auto">{basket.length} line{basket.length === 1 ? "" : "s"}</Badge>
          </div>

          <div className="flex-1 overflow-auto p-3 space-y-2">
            {basket.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center text-sm text-muted-foreground py-16 px-6 border-2 border-dashed rounded-lg">
                <ShoppingCart className="h-8 w-8 mb-3 opacity-50" />
                <div className="font-medium mb-1">Your basket is empty</div>
                <div className="text-xs">Drag any article from the left into this panel — or double-click it — to start an order.</div>
              </div>
            )}
            {basket.map((b) => {
              const cat = categoryAbbr(b.category);
              const vol = b.volume_m3 ?? (b.width_mm && b.height_mm && b.depth_mm
                ? (b.width_mm * b.height_mm * b.depth_mm) / 1_000_000_000 : 0);
              const atMax = b.qty >= b.available;
              return (
                <div key={`${b.articleId}:${b.themeId}`} className="rounded-md border bg-card p-2 space-y-1">
                  <div className="flex items-start gap-2">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={"inline-flex items-center justify-center min-w-[1.75rem] px-1 py-0.5 rounded border text-[10px] font-mono font-bold " + cat.cls}>{cat.abbr}</span>
                      {b.themeName && (
                        <span className="h-2 w-2 rounded-full border border-border/40 shrink-0" style={{ background: b.themeHex ?? "#888" }} title={b.themeName} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-sm font-medium leading-tight">{b.name}</div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 -mr-1 -mt-1" onClick={() => removeLine(b.articleId, b.themeId)} title="Remove">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => setLineQty(b.articleId, b.themeId, b.qty - 1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        value={b.qty}
                        min={1}
                        max={b.available}
                        onChange={(e) => setLineQty(b.articleId, b.themeId, Number(e.target.value) || 0)}
                        className="w-12 h-6 text-center text-xs"
                      />
                      <Button size="icon" variant="outline" className="h-6 w-6" disabled={atMax} onClick={() => setLineQty(b.articleId, b.themeId, b.qty + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {(b.width_mm || b.height_mm || b.depth_mm) && (
                      <div className="flex-1 min-w-0 text-[11px] text-muted-foreground font-mono truncate text-center">
                        {b.width_mm ?? "?"} × {b.height_mm ?? "?"} × {b.depth_mm ?? "?"} mm
                        {vol > 0 && <> · {vol.toFixed(3)} m³</>}
                      </div>
                    )}
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-muted-foreground">@ €{b.unitPrice.toFixed(2)}</div>
                      <div className="font-mono tabular-nums text-sm">€{(b.qty * b.unitPrice).toFixed(2)}</div>
                    </div>
                  </div>
                  {atMax && (
                    <div className="flex items-center gap-1 text-[11px] text-amber-600">
                      <AlertTriangle className="h-3 w-3" /> Only {b.available} units available for this theme.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-border bg-card p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Items</div>
                <div className="font-mono tabular-nums">{totals.items}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Volume</div>
                <div className="font-mono tabular-nums">{totals.volume.toFixed(3)} m³</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
                <div className="font-serif text-lg tabular-nums">€{totals.grand.toFixed(2)}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled={basket.length === 0} onClick={() => setBasket([])}>
                Clear basket
              </Button>
              <Button className="flex-1" disabled={basket.length === 0} onClick={openSubmit}>
                Place order
              </Button>
            </div>
          </div>
        </aside>
      </ResizablePanel>
      </ResizablePanelGroup>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Place quick order</DialogTitle>
            <DialogDescription>
              Stock for these items will be reserved on submit. If the order is not advanced within 10 days it will be auto-cancelled and stock returns automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Client name</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Enter client name"
              />
            </div>
            <div>
              <Label>Partner</Label>
              <Select value={partnerId} onValueChange={setPartnerId}>
                <SelectTrigger><SelectValue placeholder="Select partner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No partner —</SelectItem>
                  {(partners.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Delivery address (option to type)</Label>
              <Textarea value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} rows={3} placeholder="Enter delivery address" />
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-sm flex justify-between">
              <span>{totals.items} items · {totals.volume.toFixed(3)} m³</span>
              <span className="font-serif text-lg tabular-nums">€{totals.grand.toFixed(2)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>Cancel</Button>
            <Button disabled={submitting || basket.length === 0} onClick={placeOrder}>
              {submitting ? "Submitting…" : "Submit order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
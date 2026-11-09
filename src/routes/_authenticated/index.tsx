import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useArticles, useOrders, useLowStockByTheme, useOrdersNearExpiry, useAllArticleStock, type Order } from "@/lib/data/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import { AlertTriangle, Package, ShoppingCart, Boxes, Clock } from "lucide-react";
import { Link as RLink } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — Kitchen ERP" }] }),
  component: Dashboard,
});

const STATUS_VARIANT: Record<Order["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-500 text-white",
  approved: "bg-emerald-500 text-white",
  fulfilled: "bg-emerald-700 text-white",
  rejected: "bg-destructive text-white",
  cancelled: "bg-zinc-500 text-white line-through",
  auto_cancelled: "bg-zinc-400 text-white line-through italic",
};

function Dashboard() {
  const articles = useArticles();
  const orders = useOrders();
  const lowStock = useLowStockByTheme();
  const nearExpiry = useOrdersNearExpiry();
  const allStock = useAllArticleStock();

  const totals = useMemo(() => {
    const arr = articles.data ?? [];
    const stock = allStock.data ?? [];
    return {
      tracked: stock.length,
      inStock: stock.filter((s) => s.current_qty > 0).length,
      critical: stock.filter((s) => s.current_qty < s.min_qty).length,
      out: stock.filter((s) => s.current_qty <= 0).length,
    };
  }, [articles.data, allStock.data]);

  const alerts = useMemo(() => (lowStock.data ?? []).slice(0, 15), [lowStock.data]);
  const recentOrders = useMemo(() => (orders.data ?? []).slice(0, 8), [orders.data]);
  const activeOrders = useMemo(
    () => (orders.data ?? []).filter((o) => o.status !== "cancelled" && o.status !== "auto_cancelled" && o.status !== "rejected"),
    [orders.data]
  );
  const byRegion = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders.data ?? []) {
      const k = o.region?.name ?? "Unassigned";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [orders.data]);

  return (
    <div className="flex flex-col h-screen overflow-auto">
      <header className="px-6 py-4 border-b border-border bg-card">
        <h1 className="font-serif text-2xl tracking-tight">Dashboard</h1>
        <p className="text-xs text-muted-foreground mt-0.5">At-a-glance view of stock, orders and alerts</p>
      </header>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard icon={Package} label="SKUs tracked (article × theme)" value={totals.tracked} />
          <StatCard icon={Boxes} label="In stock" value={totals.inStock} />
          <StatCard icon={AlertTriangle} label="Low / critical" value={totals.critical} tone="amber" />
          <StatCard icon={ShoppingCart} label="Active orders" value={activeOrders.length} />
        </div>

        {(nearExpiry.data?.length ?? 0) > 0 && (
          <Card className="p-4 border-amber-500/40 bg-amber-500/5">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-amber-900 dark:text-amber-200">
                  {nearExpiry.data!.length} order{nearExpiry.data!.length === 1 ? "" : "s"} will be auto-cancelled in the next 48 hours
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Draft / submitted orders with no action in 10+ days are released automatically.
                </div>
                <ul className="text-xs mt-2 space-y-0.5">
                  {nearExpiry.data!.slice(0, 5).map((o) => (
                    <li key={o.id} className="flex justify-between gap-3">
                      <RLink to="/orders/$orderId" params={{ orderId: o.id }} className="font-mono text-primary hover:underline">{o.code}</RLink>
                      <span className="text-muted-foreground">
                        expires {new Date(o.expires_at).toLocaleString()} · {Math.max(0, Math.round(o.hours_remaining))}h left
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif text-lg tracking-tight flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Stock alerts (per theme)
              </h2>
              <Link to="/inventory" className="text-xs text-primary hover:underline">Open inventory</Link>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Theme</TableHead>
                  <TableHead className="w-32">Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">Min</TableHead>
                  <TableHead className="text-right">Shortage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((a) => {
                  const out = a.current_qty <= 0;
                  return (
                    <TableRow key={`${a.article_id}-${a.theme_id}`} className={out ? "bg-destructive/5" : "bg-amber-500/5"}>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="h-2.5 w-2.5 rounded-full border border-border/40" style={{ background: a.theme_hex ?? "#888" }} />
                          {a.theme_name}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{a.article_code}</TableCell>
                      <TableCell className="truncate max-w-[280px]">{a.article_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.current_qty}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.min_qty}</TableCell>
                      <TableCell className={"text-right tabular-nums font-semibold " + (out ? "text-destructive" : "text-amber-600")}>{Math.max(0, a.min_qty - a.current_qty)}</TableCell>
                    </TableRow>
                  );
                })}
                {alerts.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">All stock levels healthy.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          <Card className="p-5">
            <h2 className="font-serif text-lg tracking-tight mb-3">Orders by Partner / Showroom</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byRegion}>
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-lg tracking-tight">Recent orders</h2>
            <Link to="/orders" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.code}</TableCell>
                  <TableCell>{o.partner?.company_name ?? "—"}</TableCell>
                  <TableCell>{o.region?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</TableCell>
                  <TableCell><Badge className={STATUS_VARIANT[o.status]}>{o.status}</Badge></TableCell>
                </TableRow>
              ))}
              {recentOrders.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No orders yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Package; label: string; value: number; tone?: "amber" }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div className={"h-10 w-10 rounded-md flex items-center justify-center " + (tone === "amber" ? "bg-amber-500/15 text-amber-600" : "bg-primary/10 text-primary")}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
    </Card>
  );
}
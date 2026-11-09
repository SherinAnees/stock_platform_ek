import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useOrders, type Order } from "@/lib/data/queries";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/orders/")({
  head: () => ({ meta: [{ title: "Orders — Kitchen ERP" }] }),
  component: OrdersPage,
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

function OrdersPage() {
  const orders = useOrders();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return (orders.data ?? []).filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (!ql) return true;
      return (
        o.code.toLowerCase().includes(ql) ||
        (o.partner?.company_name ?? "").toLowerCase().includes(ql) ||
        (o.region?.name ?? "").toLowerCase().includes(ql)
      );
    });
  }, [orders.data, q, status]);

  return (
    <div className="flex flex-col h-screen">
      <header className="px-6 py-4 border-b border-border bg-card">
        <h1 className="font-serif text-2xl tracking-tight">Orders</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Track and manage partner orders</p>
      </header>
      <div className="p-6 flex-1 overflow-auto">
        <div className="flex gap-2 mb-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, partner, region" className="w-72 pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="fulfilled">Fulfilled</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.code}</TableCell>
                  <TableCell>{o.partner?.company_name ?? "—"}</TableCell>
                  <TableCell>{o.region?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">€{Number(o.total).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_VARIANT[o.status]}>{o.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link to="/orders/$orderId" params={{ orderId: o.id }} className="text-sm text-primary hover:underline">
                      Open
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  {orders.isLoading ? "Loading…" : "No orders yet."}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
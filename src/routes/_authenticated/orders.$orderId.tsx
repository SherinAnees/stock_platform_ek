import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  useOrder, useApproveOrder, useFulfillOrder, useRejectOrder, useUpdateOrderStatus, useCancelOrder,
} from "@/lib/data/queries";
import { useAppUser } from "@/lib/auth/useSession";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, AlertTriangle, Printer, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { categoryAbbr } from "@/lib/inventory/category";

export const Route = createFileRoute("/_authenticated/orders/$orderId")({
  component: OrderDetail,
});

function OrderDetail() {
  const { orderId } = Route.useParams();
  const { data, isLoading } = useOrder(orderId);
  const { isAdmin, isPartner, profile } = useAppUser();
  const approve = useApproveOrder();
  const fulfill = useFulfillOrder();
  const reject = useRejectOrder();
  const updateStatus = useUpdateOrderStatus();
  const cancel = useCancelOrder();
  const [shortages, setShortages] = useState<Array<{ code: string; name: string; requested: number; available: number }> | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  if (isLoading || !data) return <div className="p-10 text-muted-foreground">Loading…</div>;
  const { order, lines } = data;

  const isClosed = order.status === "cancelled" || order.status === "auto_cancelled" || order.status === "rejected";
  const ownsOrder = isPartner && profile?.partner_id && order.partner_id === profile.partner_id;
  const canCancel = !isClosed && (
    isAdmin || (ownsOrder && (order.status === "draft" || order.status === "submitted"))
  );

  const totalItems = lines.reduce((s, l) => s + Number(l.qty || 0), 0);
  const totalVolume = lines.reduce((s, l) => {
    const w = l.article?.width_mm, h = l.article?.height_mm, d = l.article?.depth_mm;
    const vol = l.article?.volume_m3 ?? (w && h && d ? (w * h * d) / 1_000_000_000 : 0);
    return s + Number(vol || 0) * Number(l.qty || 0);
  }, 0);

  async function handleApprove() {
    try {
      const res = await approve.mutateAsync(order.id);
      if (!res.ok) { setShortages(res.shortages ?? []); return; }
      toast.success("Order approved — stock deducted");
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="flex flex-col h-screen order-detail-root">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body * { visibility: hidden !important; }
          .order-print-area, .order-print-area * { visibility: visible !important; }
          .order-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; background: white; color: black; }
          .no-print { display: none !important; }
          .order-print-area .print-only { display: block !important; }
          aside, nav, [data-sidebar] { display: none !important; }
          .order-print-area table { font-size: 10px; width: 100%; table-layout: auto; }
          .order-print-area td, .order-print-area th { padding: 4px 6px !important; white-space: normal; word-break: normal; }
          .order-print-area .font-mono { white-space: nowrap; }
        }
        .print-only { display: none; }
      `}</style>
      <header className="px-6 py-4 border-b border-border bg-card flex items-center gap-4 no-print">
        <Link to="/orders"><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" />Back</Button></Link>
        <div className="flex-1">
          <h1 className="font-serif text-2xl tracking-tight">{order.code}</h1>
          <p className="text-xs text-muted-foreground">{order.partner?.company_name ?? "—"} · {order.region?.name ?? "—"} · Placed {new Date(order.created_at).toLocaleString()}</p>
        </div>
        <Badge className="text-sm">{order.status}</Badge>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print / Export PDF
        </Button>
        {canCancel && (
          <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setCancelOpen(true)}>
            <XCircle className="h-4 w-4" /> Cancel Order
          </Button>
        )}
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-4 order-print-area">
        <div className="print-only mb-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Express Küchen</h1>
              <p className="text-xs text-muted-foreground">Order Confirmation</p>
            </div>
            <div className="text-right text-xs">
              <div className="text-lg font-mono font-bold">{order.code}</div>
              <div>{new Date(order.created_at).toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs border border-border rounded-md p-3 bg-muted/20">
          <div><div className="text-muted-foreground uppercase tracking-wider text-[10px]">Order ID</div><div className="font-mono">{order.code}</div></div>
          <div><div className="text-muted-foreground uppercase tracking-wider text-[10px]">Partner</div><div>{order.partner?.company_name ?? "—"}</div></div>
          <div><div className="text-muted-foreground uppercase tracking-wider text-[10px]">Region</div><div>{order.region?.name ?? "—"}</div></div>
          <div><div className="text-muted-foreground uppercase tracking-wider text-[10px]">Date</div><div>{new Date(order.created_at).toLocaleDateString()}</div></div>
          <div><div className="text-muted-foreground uppercase tracking-wider text-[10px]">Status</div><div className="capitalize">{order.status}</div></div>
          {order.client_name && <div className="col-span-2 md:col-span-3"><div className="text-muted-foreground uppercase tracking-wider text-[10px]">Client name</div><div>{order.client_name}</div></div>}
          {order.notes && <div className={order.client_name ? "col-span-2 md:col-span-3" : "col-span-2 md:col-span-3"}><div className="text-muted-foreground uppercase tracking-wider text-[10px]">Notes</div><div>{order.notes}</div></div>}
        </div>

        {shortages && shortages.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 no-print">
            <div className="flex items-center gap-2 text-destructive font-medium mb-2"><AlertTriangle className="h-4 w-4" />Insufficient stock — order not approved</div>
            <ul className="text-sm space-y-1">
              {shortages.map((s) => (
                <li key={s.code}><span className="font-mono">{s.code}</span> — requested {s.requested}, available {s.available}</li>
              ))}
            </ul>
          </div>
        )}
        {order.delivery_notes && (
          <div className="rounded border border-border bg-muted/30 p-3 text-sm">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Delivery notes</div>
            {order.delivery_notes}
          </div>
        )}
        {(order.status === "cancelled" || order.status === "auto_cancelled") && (
          <div className="rounded-md border border-zinc-400/40 bg-zinc-500/10 p-3 text-sm">
            <div className="font-medium mb-1">
              {order.status === "auto_cancelled" ? "Auto-cancelled" : "Cancelled"}
              {order.cancelled_at && ` on ${new Date(order.cancelled_at).toLocaleString()}`}
            </div>
            {order.cancellation_reason && (
              <div className="text-muted-foreground">Reason: {order.cancellation_reason}</div>
            )}
          </div>
        )}
        <div className="rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Cat</TableHead>
                <TableHead className="w-36">Theme</TableHead>
                <TableHead className="w-32">Code</TableHead>
                <TableHead>Article</TableHead>
                <TableHead className="w-40">W × H × D</TableHead>
                <TableHead className="w-24 text-right">Volume</TableHead>
                <TableHead className="text-right w-20">Qty</TableHead>
                <TableHead className="text-right w-24">Unit price</TableHead>
                <TableHead className="text-right w-28">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => {
                const u = l.article?.dimension_unit ?? "mm";
                const w = l.article?.width_mm, h = l.article?.height_mm, d = l.article?.depth_mm;
                const vol = l.article?.volume_m3 ?? (w && h && d ? (w * h * d) / 1_000_000_000 : null);
                const cat = categoryAbbr(l.article?.category);
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <span title={cat.label} className={"inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold " + cat.cls}>{cat.abbr}</span>
                    </TableCell>
                    <TableCell>
                      {l.theme ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="h-2.5 w-2.5 rounded-full border border-border/40 shrink-0" style={{ background: l.theme.hex_color ?? "#888" }} />
                          <span className="truncate">{l.theme.name}</span>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{l.article?.code}</TableCell>
                    <TableCell>{l.article?.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {w && h && d ? `${w} × ${h} × ${d} ${u}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-xs">{vol ? `${vol.toFixed(3)} m³` : "—"}</TableCell>
                    <TableCell className="text-right">{l.qty}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">€{Number(l.unit_price).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">€{Number(l.line_total).toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-md border border-border bg-card p-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total items</div>
            <div className="font-mono tabular-nums text-lg">{totalItems}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total volume</div>
            <div className="font-mono tabular-nums text-lg">{totalVolume.toFixed(3)} m³</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Grand total</div>
            <div className="font-serif text-2xl tabular-nums">€{Number(order.total).toFixed(2)}</div>
          </div>
        </div>

        <div className="print-only text-[10px] text-muted-foreground text-center pt-4 border-t">
          Generated {new Date().toLocaleString()}
        </div>

        <div className="flex gap-2 flex-wrap no-print">
          {isPartner && order.status === "draft" && (
            <Button onClick={async () => { await updateStatus.mutateAsync({ id: order.id, status: "submitted" }); toast.success("Submitted"); }}>Submit for approval</Button>
          )}
          {isAdmin && (order.status === "submitted" || order.status === "draft") && (
            <>
              <Button onClick={handleApprove}>Approve & deduct stock</Button>
              <Button variant="destructive" onClick={() => setRejectOpen(true)}>Reject</Button>
            </>
          )}
          {isAdmin && order.status === "approved" && (
            <Button onClick={async () => { await fulfill.mutateAsync(order.id); toast.success("Fulfilled"); }}>Mark fulfilled</Button>
          )}
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject order</DialogTitle></DialogHeader>
          <div className="space-y-2"><Label>Reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => { await reject.mutateAsync({ id: order.id, reason }); toast.success("Rejected"); setRejectOpen(false); }}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel order {order.code}?</DialogTitle>
            <DialogDescription>
              This will return all elements in this order back to stock. Continue?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Cancellation reason (required)</Label>
            <Input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. customer changed their mind"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep order</Button>
            <Button
              variant="destructive"
              disabled={!cancelReason.trim() || cancel.isPending}
              onClick={async () => {
                try {
                  await cancel.mutateAsync({ id: order.id, reason: cancelReason.trim() });
                  toast.success("Order cancelled — elements returned to stock");
                  setCancelOpen(false);
                  setCancelReason("");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Cancel order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
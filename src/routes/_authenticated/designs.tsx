import { createFileRoute, Link } from "@tanstack/react-router";
import { useMyDesigns, deleteDesignDraft, draftExpiresIn } from "@/lib/data/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, ExternalLink, Pencil, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/designs")({
  head: () => ({
    meta: [
      { title: "Designs — Kitchen ERP" },
      { name: "description", content: "Saved kitchen designs (drafts + placed orders)." },
    ],
  }),
  component: DesignsPage,
});

function formatRemaining(ms: number): string {
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  if (h >= 1) return `${h}h left`;
  const m = Math.floor(ms / 60_000);
  return `${m}m left`;
}

function DesignsPage() {
  const { data, isLoading } = useMyDesigns();
  const qc = useQueryClient();
  const rows = (data ?? []).filter((d) => {
    // Hide drafts that have expired AND no linked active order
    const ttl = draftExpiresIn(d);
    if (d.expired_at && (d.orders ?? []).length === 0) return false;
    if (ttl !== null && ttl <= 0 && (d.orders ?? []).length === 0) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto w-full">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Designs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drafts block elements for 2 days. Once an order is placed the design is locked
            (view-only) and kept alongside the order.
          </p>
        </div>
        <Link to="/design" search={{ designId: undefined }}>
          <Button>New design</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No designs yet. Open the Kitchen Designer to start one.
        </div>
      ) : (
        <div className="rounded-md border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="py-3 px-4">Design / Order</th>
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Updated</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const ttl = draftExpiresIn(d);
                const order = (d.orders ?? [])[0];
                const intake = (d.intake ?? {}) as { clientName?: string; partnerName?: string; city?: string };
                const locked = !!order && order.status !== "cancelled" && order.status !== "auto_cancelled" && order.status !== "rejected";
                return (
                  <tr key={d.id} className="border-b border-border/60 last:border-0">
                    <td className="py-3 px-4">
                      <div className="font-medium">{d.name ?? "Untitled"}</div>
                      {order && (
                        <div className="text-[11px] text-muted-foreground font-mono">
                          Order {order.code ?? order.id.slice(0, 8)}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div>{intake.clientName ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {[intake.partnerName, intake.city].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {locked ? (
                        <Badge variant="default">Order placed · {order!.status}</Badge>
                      ) : ttl !== null ? (
                        <Badge variant="secondary">Draft · {formatRemaining(ttl)}</Badge>
                      ) : (
                        <Badge variant="outline">Saved</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {new Date(d.updated_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link to="/design" search={{ designId: d.id } as never}>
                          <Button size="sm" variant="outline" className="gap-1.5">
                            {locked ? <Eye className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                            {locked ? "View" : "Edit"}
                          </Button>
                        </Link>
                        {order && (
                          <Link to="/orders/$orderId" params={{ orderId: order.id }}>
                            <Button size="sm" variant="outline" className="gap-1.5">
                              <ExternalLink className="h-3.5 w-3.5" />
                              Order
                            </Button>
                          </Link>
                        )}
                        {!locked && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5 text-muted-foreground hover:text-destructive"
                            onClick={async () => {
                              if (!confirm("Delete this draft and release reserved elements?")) return;
                              try {
                                await deleteDesignDraft(d.id);
                                toast.success("Draft deleted; stock released.");
                                qc.invalidateQueries({ queryKey: ["kitchen_designs"] });
                                qc.invalidateQueries({ queryKey: ["articles"] });
                                qc.invalidateQueries({ queryKey: ["article_stock_by_theme"] });
                              } catch (e) {
                                toast.error((e as Error).message);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
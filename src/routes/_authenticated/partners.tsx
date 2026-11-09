import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useAppUser, useStockCenters, useCurrentStockCenter } from "@/lib/auth/useSession";
import {
  usePartners, useUpsertPartner, useDeletePartner,
  type Partner,
} from "@/lib/data/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/partners")({
  beforeLoad: async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw redirect({ to: "/auth" });
    const { data } = await supabase.rpc("is_admin");
    if (!data) throw redirect({ to: "/" });
  },
  component: PartnersPage,
});

function PartnersPage() {
  return (
    <div className="flex flex-col h-screen">
      <header className="px-6 py-4 border-b border-border bg-card">
        <h1 className="font-serif text-2xl tracking-tight">Partners / Showrooms</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Scoped to your Stock Center. Master Admin can see and manage all centers.</p>
      </header>
      <div className="p-6 flex-1 overflow-auto">
        <PartnersTab />
      </div>
    </div>
  );
}

const ZONES = ["North", "East", "South", "West", "Center"] as const;

function PartnersTab() {
  const partners = usePartners();
  const upsert = useUpsertPartner();
  const del = useDeletePartner();
  const { isMasterAdmin } = useAppUser();
  const centers = useStockCenters();
  const current = useCurrentStockCenter();
  const [editing, setEditing] = useState<Partial<Partner> | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ field: "account_no" | "company_name" | "city_state"; dir: "asc" | "desc" } | null>(null);

  const centerLabel = (id: string | null | undefined) => {
    if (!id) return "—";
    const c = (centers.data ?? []).find((x) => x.id === id);
    return c ? `${c.code} · ${c.name}` : "—";
  };

  const filtered = (partners.data ?? []).filter((p) => {
    const s = search.toLowerCase();
    if (!s) return true;
    return (
      (p.account_no ?? "").toLowerCase().includes(s) ||
      (p.company_name ?? "").toLowerCase().includes(s) ||
      (p.city ?? "").toLowerCase().includes(s) ||
      (p.state ?? "").toLowerCase().includes(s)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sort) return 0;
    const dir = sort.dir === "asc" ? 1 : -1;
    let aVal: string;
    let bVal: string;
    if (sort.field === "account_no") {
      aVal = a.account_no ?? "";
      bVal = b.account_no ?? "";
    } else if (sort.field === "company_name") {
      aVal = a.company_name ?? "";
      bVal = b.company_name ?? "";
    } else {
      aVal = [a.city, a.state].filter(Boolean).join(", ") ?? "";
      bVal = [b.city, b.state].filter(Boolean).join(", ") ?? "";
    }
    return aVal.localeCompare(bVal) * dir;
  });

  const toggleSort = (field: "account_no" | "company_name" | "city_state") => {
    if (sort?.field === field) {
      setSort({ field, dir: sort.dir === "asc" ? "desc" : "asc" });
    } else {
      setSort({ field, dir: "asc" });
    }
  };

  const SortIcon = ({ field }: { field: "account_no" | "company_name" | "city_state" }) => {
    if (sort?.field !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />;
    return sort.dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  };

  const openNew = () => {
    const initial: Partial<Partner> = {};
    if (isMasterAdmin && current.currentId) initial.stock_center_id = current.currentId;
    setEditing(initial);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between gap-3 mb-3">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by account #, company, or city/state..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="sm" className="gap-1.5" onClick={openNew}><Plus className="h-3.5 w-3.5" />New partner / showroom</Button>
      </div>
      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">S.No.</TableHead>
              {isMasterAdmin && <TableHead>Stock Center</TableHead>}
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("account_no")}>
                <div className="flex items-center gap-1">Account # <SortIcon field="account_no" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("company_name")}>
                <div className="flex items-center gap-1">Partner / Showroom <SortIcon field="company_name" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("city_state")}>
                <div className="flex items-center gap-1">City / State <SortIcon field="city_state" /></div>
              </TableHead>
              <TableHead>Territory</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Contact / Manager</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Nolte IAM</TableHead>
              <TableHead className="w-24 text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((p, i) => (
              <TableRow key={p.id}>
                <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                {isMasterAdmin && <TableCell className="text-xs text-muted-foreground">{centerLabel(p.stock_center_id)}</TableCell>}
                <TableCell className="tabular-nums">{p.account_no ?? "—"}</TableCell>
                <TableCell className="font-medium">{p.company_name}</TableCell>
                <TableCell>{[p.city, p.state].filter(Boolean).join(", ") || "—"}</TableCell>
                <TableCell>{p.territory ?? "—"}</TableCell>
                <TableCell>{p.zone ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-md">{p.address ?? "—"}</TableCell>
                <TableCell>{p.contact_person ?? "—"}</TableCell>
                <TableCell>{p.phone ?? "—"}</TableCell>
                <TableCell className="text-xs">{p.email ?? "—"}</TableCell>
                <TableCell>{p.nolte_iam ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={async () => { if (confirm("Delete?")) { await del.mutateAsync(p.id); toast.success("Deleted"); } }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && <TableRow><TableCell colSpan={isMasterAdmin ? 13 : 12} className="text-center text-muted-foreground py-8">{search ? "No partners match your search." : "No partners yet."}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      {editing && (
        <Dialog open onOpenChange={(v) => !v && setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing.id ? "Edit partner / showroom" : "New partner / showroom"}</DialogTitle></DialogHeader>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              {isMasterAdmin && (
                <div><Label>Stock Center *</Label>
                  <Select value={editing.stock_center_id ?? ""} onValueChange={(v) => setEditing({ ...editing, stock_center_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select stock center" /></SelectTrigger>
                    <SelectContent>
                      {(centers.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>Account #</Label><Input value={editing.account_no ?? ""} onChange={(e) => setEditing({ ...editing, account_no: e.target.value })} /></div>
              <div><Label>Partner / Showroom name *</Label><Input value={editing.company_name ?? ""} onChange={(e) => setEditing({ ...editing, company_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>City</Label><Input value={editing.city ?? ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></div>
                <div><Label>State</Label><Input value={editing.state ?? ""} onChange={(e) => setEditing({ ...editing, state: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Territory</Label><Input value={editing.territory ?? ""} onChange={(e) => setEditing({ ...editing, territory: e.target.value })} /></div>
                <div><Label>Zone</Label>
                  <Select value={editing.zone ?? "none"} onValueChange={(v) => setEditing({ ...editing, zone: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Address</Label><Input value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></div>
              <div><Label>Contact person / Showroom Manager</Label><Input value={editing.contact_person ?? ""} onChange={(e) => setEditing({ ...editing, contact_person: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
              <div><Label>Nolte IAM</Label><Input value={editing.nolte_iam ?? ""} onChange={(e) => setEditing({ ...editing, nolte_iam: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={async () => {
                try {
                  if (!editing.company_name?.trim()) { toast.error("Name is required"); return; }
                  if (isMasterAdmin && !editing.stock_center_id) { toast.error("Stock Center is required"); return; }
                  await upsert.mutateAsync(editing);
                  toast.success("Saved");
                  setEditing(null);
                }
                catch (e) { toast.error((e as Error).message); }
              }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
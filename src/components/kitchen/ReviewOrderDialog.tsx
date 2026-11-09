import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useKitchen } from "@/lib/kitchen/store";
import { getModule } from "@/lib/kitchen/modules";
import { THEMES, THEME_STOCK } from "@/lib/kitchen/themeStock";
import { useThemeSelection, categoryToUnitType } from "@/lib/kitchen/themeSelection";
import { formatAED } from "@/lib/kitchen/nolteCost";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAppUser } from "@/lib/auth/useSession";
import { useArticles, usePartners, useColorThemes, createOrderFromLines, releaseDesignDraft } from "@/lib/data/queries";

interface ReviewLine {
  moduleId: string;
  unitCode: string;
  name: string;
  themeId: string;
  themeLabel: string;
  qty: number;
  unitPrice: number;
  decorative: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ReviewOrderDialog({ open, onOpenChange }: Props) {
  const placed = useKitchen((s) => s.placed);
  const currentDesign = useKitchen((s) => s.currentDesign);
  const resetDesign = useKitchen((s) => s.resetDesign);
  const loadedDesignId = useKitchen((s) => s.loadedDesignId);
  const themesByUnitType = useThemeSelection((s) => s.themesByUnitType);
  const { profile } = useAppUser();
  const articles = useArticles();
  const partners = usePartners();
  const themes = useColorThemes();
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  // Use the partner already set on the design (current user's partner) and derive its region
  const selectedPartner = useMemo(
    () => (partners.data ?? []).find((p) => p.id === profile?.partner_id) ?? null,
    [partners.data, profile?.partner_id]
  );

  const lines = useMemo<ReviewLine[]>(() => {
    const map = new Map<string, ReviewLine>();
    for (const p of placed) {
      const m = getModule(p.moduleId);
      if (!m) continue;
      const themeId = p.themeId ?? themesByUnitType[categoryToUnitType(m.category)];
      const code = (m.unitCode ?? "").trim();
      const price = THEME_STOCK[themeId]?.[code]?.price ?? 0;
      const meta = THEMES.find((t) => t.id === themeId);
      const themeLabel = meta ? `${meta.range} · ${meta.frontName}` : themeId;
      const decorative = m.category === "appliance";
      const key = `${m.id}::${themeId}`;
      const cur =
        map.get(key) ?? {
          moduleId: m.id,
          unitCode: code,
          name: m.name,
          themeId,
          themeLabel,
          qty: 0,
          unitPrice: decorative ? 0 : price,
          decorative,
        };
      cur.qty += 1;
      map.set(key, cur);
    }
    return Array.from(map.values());
  }, [placed, themesByUnitType]);

  const total = lines.reduce(
    (s, l) => (l.decorative ? s : s + l.qty * l.unitPrice),
    0
  );

  async function onPlace() {
    if (!currentDesign) return;
    setSubmitting(true);
    try {
      const byCode = new Map((articles.data ?? []).map((a) => [a.code, a]));
      const themeByCode = new Map<string, string>();
      for (const t of themes.data ?? []) {
        themeByCode.set(t.code, t.id);
        themeByCode.set(t.id, t.id);
      }
      const orderLines: Array<{ articleId: string; qty: number; unitPrice: number; themeId?: string | null }> = [];
      const missing: string[] = [];
      for (const l of lines) {
        if (l.decorative || !l.unitCode) continue;
        const a = byCode.get(l.unitCode);
        if (!a) { missing.push(l.unitCode); continue; }
        orderLines.push({
          articleId: a.id,
          qty: l.qty,
          unitPrice: l.unitPrice,
          themeId: themeByCode.get(l.themeId) ?? null,
        });
      }
      if (missing.length) {
        toast.error(`Missing articles in catalog: ${missing.join(", ")}. Ask Admin to seed the catalog from Inventory.`);
        setSubmitting(false);
        return;
      }
      // Persist design snapshot (reuse loaded draft when present)
      const themeByCodeId = new Map<string, string>();
      for (const t of themes.data ?? []) {
        themeByCodeId.set(t.code, t.id);
        themeByCodeId.set(t.id, t.id);
      }
      let designId: string;
      if (loadedDesignId) {
        const { error: uErr } = await supabase
          .from("kitchen_designs")
          .update({
            name: `${currentDesign.clientName} — ${new Date().toLocaleDateString()}`,
            intake: currentDesign as unknown as never,
            placed: placed as unknown as never,
            bom: lines as unknown as never,
            base_unit_theme_id: themeByCodeId.get(themesByUnitType.BU ?? "") ?? null,
            wall_unit_theme_id: themeByCodeId.get(themesByUnitType.WU ?? "") ?? null,
            tall_unit_theme_id: themeByCodeId.get(themesByUnitType.TU ?? "") ?? null,
          })
          .eq("id", loadedDesignId);
        if (uErr) throw uErr;
        // Release draft reservation — submit_order will create the real one from order_lines.
        await releaseDesignDraft(loadedDesignId);
        designId = loadedDesignId;
      } else {
        const { data: user } = await supabase.auth.getUser();
        const { data: design, error: dErr } = await supabase
          .from("kitchen_designs")
          .insert({
            created_by: user.user!.id,
            partner_id: profile?.partner_id ?? null,
            name: `${currentDesign.clientName} — ${new Date().toLocaleDateString()}`,
            intake: currentDesign as unknown as never,
            placed: placed as unknown as never,
            bom: lines as unknown as never,
            base_unit_theme_id: themeByCodeId.get(themesByUnitType.BU ?? "") ?? null,
            wall_unit_theme_id: themeByCodeId.get(themesByUnitType.WU ?? "") ?? null,
            tall_unit_theme_id: themeByCodeId.get(themesByUnitType.TU ?? "") ?? null,
          })
          .select("id")
          .single();
        if (dErr) throw dErr;
        designId = (design as { id: string }).id;
      }

      const { id } = await createOrderFromLines({
        partnerId: profile?.partner_id ?? null,
        regionId: selectedPartner?.region_id ?? null,
        designId,
        deliveryNotes,
        lines: orderLines,
      });
      toast.success("Order submitted for approval");
      onOpenChange(false);
      resetDesign();
      navigate({ to: "/orders/$orderId", params: { orderId: id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Review &amp; place order</DialogTitle>
          <DialogDescription>
            Stock for these items will be reserved for 10 days. If the order is not advanced within 10 days it will be voided and stock returns automatically.
          </DialogDescription>
        </DialogHeader>

        {currentDesign && (
          <div className="grid grid-cols-2 gap-3 text-sm border border-border rounded-md p-3 bg-muted/30">
            <div><span className="text-muted-foreground">Client:</span> <span className="font-medium">{currentDesign.clientName}</span></div>
            <div><span className="text-muted-foreground">Partner:</span> <span className="font-medium">{currentDesign.partnerName}</span></div>
            <div><span className="text-muted-foreground">City:</span> <span className="font-medium">{currentDesign.city}</span></div>
            <div><span className="text-muted-foreground">Collection:</span> <span className="font-medium">{currentDesign.expectedCollectionDate}</span></div>
          </div>
        )}

        <div className="max-h-[40vh] overflow-auto -mx-1 px-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-2">Code</th>
                <th className="py-2 pr-2">Item</th>
                <th className="py-2 pr-2 text-right">Qty</th>
                <th className="py-2 pr-2 text-right">Unit</th>
                <th className="py-2 pr-0 text-right">Line</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={`${l.moduleId}-${l.themeId}`} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-2 font-mono text-xs">{l.unitCode || "—"}</td>
                  <td className="py-2 pr-2">
                    <div className="font-medium">{l.name}</div>
                    <div className="text-[11px] text-muted-foreground">{l.themeLabel}</div>
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{l.qty}</td>
                  <td className="py-2 pr-2 text-right tabular-nums font-mono">
                    {l.decorative ? "—" : formatAED(l.unitPrice)}
                  </td>
                  <td className="py-2 pr-0 text-right tabular-nums font-mono">
                    {l.decorative ? "—" : formatAED(l.qty * l.unitPrice)}
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td colSpan={5} className="text-center text-sm text-muted-foreground py-6">No items placed.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-border">
                <td colSpan={4} className="py-3 text-right text-xs uppercase tracking-[0.18em] text-muted-foreground">Total</td>
                <td className="py-3 text-right font-serif text-xl tabular-nums">{formatAED(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-2">
          <div className="space-y-1">
            <Label className="text-xs">Delivery address (option to type)</Label>
            <Input value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} placeholder="Enter delivery address" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onPlace} disabled={lines.length === 0 || submitting}>
            {submitting ? "Submitting…" : "Submit order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
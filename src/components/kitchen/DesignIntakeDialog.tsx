import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useKitchen } from "@/lib/kitchen/store";
import type { DesignIntake } from "@/lib/kitchen/orders";
import { usePartners } from "@/lib/data/queries";

function todayIso() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function DesignIntakeDialog({ open, onOpenChange }: Props) {
  const setCurrentDesign = useKitchen((s) => s.setCurrentDesign);
  const resetDesign = useKitchen((s) => s.resetDesign);
  const placed = useKitchen((s) => s.placed);
  const partnersQ = usePartners();
  const partners = partnersQ.data ?? [];
  const [partnerId, setPartnerId] = useState<string>("");
  const [form, setForm] = useState<DesignIntake>({
    clientName: "",
    partnerName: "",
    city: "",
    expectedCollectionDate: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof DesignIntake, string>>>({});

  useEffect(() => {
    if (open) {
      setErrors({});
      setPartnerId("");
      setForm({ clientName: "", partnerName: "", city: "", expectedCollectionDate: "" });
    }
  }, [open]);

  const selectedPartner = partners.find((p) => p.id === partnerId) ?? null;
  const cityState = selectedPartner
    ? [selectedPartner.city, selectedPartner.state].filter(Boolean).join(", ")
    : "";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!form.clientName.trim()) next.clientName = "Required";
    if (!selectedPartner) next.partnerName = "Required";
    if (!cityState.trim()) next.city = "Required";
    if (!form.expectedCollectionDate) next.expectedCollectionDate = "Required";
    else if (form.expectedCollectionDate < todayIso())
      next.expectedCollectionDate = "Must be today or later";
    setErrors(next);
    if (Object.keys(next).length) return;
    // Starting a brand-new design always clears any leftover canvas.
    if (placed.length > 0) resetDesign();
    setCurrentDesign({
      clientName: form.clientName.trim(),
      partnerName: selectedPartner!.company_name ?? "",
      city: cityState,
      expectedCollectionDate: form.expectedCollectionDate,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Start a new design</DialogTitle>
          <DialogDescription>
            Tell us who this kitchen is for. All fields are required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="clientName">Client name</Label>
            <Input
              id="clientName"
              value={form.clientName}
              onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
              autoFocus
            />
            {errors.clientName && <p className="text-xs text-destructive mt-1">{errors.clientName}</p>}
          </div>
          <div>
            <Label htmlFor="partnerName">Partner name</Label>
            <Select value={partnerId} onValueChange={setPartnerId}>
              <SelectTrigger id="partnerName">
                <SelectValue placeholder={partnersQ.isLoading ? "Loading partners..." : "Select a partner"} />
              </SelectTrigger>
              <SelectContent>
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.company_name}
                    {p.account_no ? ` (${p.account_no})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.partnerName && <p className="text-xs text-destructive mt-1">{errors.partnerName}</p>}
          </div>
          <div>
            <Label htmlFor="city">City / State</Label>
            <Input
              id="city"
              value={cityState}
              readOnly
              placeholder="Auto-filled from selected partner"
              className="bg-muted"
            />
            {errors.city && <p className="text-xs text-destructive mt-1">{errors.city}</p>}
          </div>
          <div>
            <Label htmlFor="expectedCollectionDate">Expected collection date</Label>
            <Input
              id="expectedCollectionDate"
              type="date"
              min={todayIso()}
              value={form.expectedCollectionDate}
              onChange={(e) => setForm((f) => ({ ...f, expectedCollectionDate: e.target.value }))}
            />
            {errors.expectedCollectionDate && <p className="text-xs text-destructive mt-1">{errors.expectedCollectionDate}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full">Start designing</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
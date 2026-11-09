import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppUser, ROLE_LABELS, type AppRole } from "@/lib/auth/useSession";
import {
  usePermissionMatrix,
  type PermissionLevel,
  type PermissionRow,
} from "@/lib/auth/usePermissions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Lock, Save, Undo2, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/permissions")({
  component: PermissionsPage,
});

const ROLES: AppRole[] = [
  "master_admin",
  "stock_center_admin",
  "store_keeper",
  "designer_order_processor",
];

const LEVELS: { value: PermissionLevel; label: string }[] = [
  { value: "modify", label: "Modify" },
  { value: "read_only", label: "Read Only" },
  { value: "no_permission", label: "No Permission" },
];

function triggerGradient(level: PermissionLevel): string {
  if (level === "modify") {
    return "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-emerald-600 hover:from-emerald-500 hover:to-emerald-700 focus:ring-emerald-400";
  }
  if (level === "read_only") {
    return "bg-gradient-to-r from-amber-400 to-amber-500 text-white border-amber-500 hover:from-amber-400 hover:to-amber-600 focus:ring-amber-300";
  }
  return "bg-gradient-to-r from-rose-500 to-rose-600 text-white border-rose-600 hover:from-rose-500 hover:to-rose-700 focus:ring-rose-400";
}

function PermissionsPage() {
  const { isMasterAdmin, ready, profile } = useAppUser();
  const q = usePermissionMatrix();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, PermissionLevel>>({});
  const [saving, setSaving] = useState(false);

  // key => module_key|role
  const keyOf = (m: string, r: AppRole) => `${m}|${r}`;

  useEffect(() => {
    if (q.data) {
      const next: Record<string, PermissionLevel> = {};
      for (const row of q.data) next[keyOf(row.module_key, row.role)] = row.permission;
      setDraft(next);
    }
  }, [q.data]);

  const modules = useMemo(() => {
    const map = new Map<string, { key: string; label: string; sort: number }>();
    for (const r of q.data ?? []) {
      if (!map.has(r.module_key)) map.set(r.module_key, {
        key: r.module_key, label: r.module_label, sort: r.module_sort_order,
      });
    }
    return [...map.values()].sort((a, b) => a.sort - b.sort);
  }, [q.data]);

  const changed = useMemo(() => {
    if (!q.data) return [] as PermissionRow[];
    const out: PermissionRow[] = [];
    for (const row of q.data) {
      const d = draft[keyOf(row.module_key, row.role)];
      if (d && d !== row.permission) out.push(row);
    }
    return out;
  }, [draft, q.data]);

  const lastSaved = useMemo(() => {
    if (!q.data?.length) return null;
    return [...q.data].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  }, [q.data]);

  if (!ready) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!isMasterAdmin) {
    return (
      <div className="p-8">
        <Card className="p-6 max-w-md">
          <h1 className="font-semibold text-lg">Permission Matrix</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Only the Master Admin can manage permissions.
          </p>
        </Card>
      </div>
    );
  }

  function isLocked(moduleKey: string, role: AppRole): boolean {
    if (role === "master_admin") return true;
    if (moduleKey === "permissions") return true;
    return false;
  }

  function setCell(moduleKey: string, role: AppRole, level: PermissionLevel) {
    if (isLocked(moduleKey, role)) return;
    setDraft((d) => ({ ...d, [keyOf(moduleKey, role)]: level }));
  }

  async function save() {
    if (changed.length === 0) return;
    setSaving(true);
    try {
      const updates = changed.map((row) => {
        let level = draft[keyOf(row.module_key, row.role)];
        // Safety: never let MA lose modify; force permissions row for non-MA to no_permission
        if (row.role === "master_admin") level = "modify";
        if (row.module_key === "permissions" && row.role !== "master_admin") level = "no_permission";
        return { id: row.id, permission: level };
      });
      for (const u of updates) {
        const { error } = await (supabase as unknown as {
          from: (t: string) => {
            update: (v: Record<string, unknown>) => {
              eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>;
            };
          };
        })
          .from("permission_matrix")
          .update({ permission: u.permission, updated_by: profile?.id ?? null })
          .eq("id", u.id);
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["permission_matrix"] });
      toast.success("Permissions updated successfully. Changes take effect immediately.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (!q.data) return;
    const next: Record<string, PermissionLevel> = {};
    for (const row of q.data) next[keyOf(row.module_key, row.role)] = row.permission;
    setDraft(next);
  }

  return (
    <div className="p-6 space-y-4 max-w-[1400px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" /> Roles & Rights
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Control access per module and role. Changes apply instantly to all logged-in users.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={discard}
            disabled={changed.length === 0 || saving}
            className="gap-1.5"
          >
            <Undo2 className="h-3.5 w-3.5" /> Discard
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={changed.length === 0 || saving}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving…" : `Save Changes${changed.length ? ` (${changed.length})` : ""}`}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px]">Module</TableHead>
              {ROLES.map((r) => (
                <TableHead key={r} className="text-center">
                  {ROLE_LABELS[r]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.map((m) => (
              <TableRow key={m.key}>
                <TableCell className="font-medium">{m.label}</TableCell>
                {ROLES.map((r) => {
                  const current = draft[keyOf(m.key, r)] ?? "no_permission";
                  const locked = isLocked(m.key, r);
                  return (
                    <TableCell key={r} className="align-middle">
                      <div className="flex items-center justify-center gap-1.5">
                        <Select
                          value={current}
                          onValueChange={(v) => setCell(m.key, r, v as PermissionLevel)}
                          disabled={locked}
                        >
                          <SelectTrigger
                            className={
                              "h-8 w-[140px] font-medium text-xs shadow-sm border transition-all " +
                              triggerGradient(current) +
                              (locked ? " opacity-70 cursor-not-allowed" : "")
                            }
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LEVELS.map((lv) => (
                              <SelectItem key={lv.value} value={lv.value}>
                                {lv.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {lastSaved && (
        <p className="text-xs text-muted-foreground">
          Last saved: {new Date(lastSaved.updated_at).toLocaleString()}
          {lastSaved.updated_by ? ` · by user ${lastSaved.updated_by.slice(0, 8)}` : ""}
        </p>
      )}

      <Card className="p-4 text-xs text-muted-foreground space-y-1">
        <div><span className="inline-block w-2 h-2 rounded-full bg-rose-600 mr-1.5" /> No Permission — module hidden and blocked at URL level.</div>
        <div><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5" /> Read Only — module visible, create/edit/delete actions hidden.</div>
        <div><span className="inline-block w-2 h-2 rounded-full bg-emerald-600 mr-1.5" /> Modify — full access.</div>
        <div className="pt-2"><Lock className="inline h-3 w-3 mr-1" /> Master Admin always retains full access; the Permissions row is locked to Master Admin only.</div>
      </Card>
    </div>
  );
}
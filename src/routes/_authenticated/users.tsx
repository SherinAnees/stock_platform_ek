import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppUser, useStockCenters, ROLE_LABELS, type AppRole } from "@/lib/auth/useSession";
import { useProfiles, type ProfileRow } from "@/lib/data/queries";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { UserPlus, KeyRound, Mail, Search, Pencil, Copy, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/users")({
  beforeLoad: async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw redirect({ to: "/auth" });
  },
  component: UsersPage,
});

const MANAGEABLE_ROLES: AppRole[] = ["stock_center_admin", "store_keeper", "designer_order_processor"];

function initials(p: ProfileRow) {
  const f = (p.first_name ?? "").trim();
  const l = (p.last_name ?? "").trim();
  if (f || l) return `${f[0] ?? ""}${l[0] ?? ""}`.toUpperCase();
  return (p.email ?? "?").slice(0, 2).toUpperCase();
}

function statusBadge(s?: string | null, active?: boolean) {
  if (!active) return <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>;
  if (s === "pending") return <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15">Pending invite</Badge>;
  return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">Active</Badge>;
}

function UsersPage() {
  const { isMasterAdmin, isStockCenterAdmin, profile } = useAppUser();
  const canManage = isMasterAdmin || isStockCenterAdmin;
  const centers = useStockCenters();
  const profiles = useProfiles();
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [centerFilter, setCenterFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetting, setResetting] = useState<ProfileRow | null>(null);

  const rows = useMemo(() => {
    const list = profiles.data ?? [];
    return list.filter((p) => {
      const primaryRole = (p.roles?.[0] ?? "") as string;
      // SCA sees only their scope + only manageable subordinate roles
      if (!isMasterAdmin && isStockCenterAdmin) {
        if (p.stock_center_id !== profile?.stock_center_id) return false;
        if (!["store_keeper", "designer_order_processor"].includes(primaryRole)) {
          if (p.id !== profile?.id) return false;
        }
      }
      if (roleFilter !== "all" && primaryRole !== roleFilter) return false;
      if (centerFilter !== "all" && (p.stock_center_id ?? "") !== centerFilter) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "inactive" && p.is_active) return false;
        if (statusFilter === "active" && (!p.is_active || p.invitation_status === "pending")) return false;
        if (statusFilter === "pending" && p.invitation_status !== "pending") return false;
      }
      if (q) {
        const s = q.toLowerCase();
        const hay = `${p.full_name ?? ""} ${p.email ?? ""} ${p.phone ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [profiles.data, q, roleFilter, centerFilter, statusFilter, isMasterAdmin, isStockCenterAdmin, profile]);

  if (!canManage) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        You don't have permission to manage users.
      </div>
    );
  }

  async function toggleActive(p: ProfileRow, next: boolean) {
    try {
      const { error } = await supabase.rpc("admin_toggle_user_active", { _user_id: p.id, _active: next });
      if (error) throw error;
      toast.success(next ? "User activated" : "User deactivated");
      qc.invalidateQueries({ queryKey: ["profiles-all"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  async function sendResetEmail(p: ProfileRow) {
    if (!p.email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(p.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success(`Password reset email sent to ${p.email}`);
    } catch (e) { toast.error((e as Error).message); }
  }

  const centerName = (id?: string | null) =>
    centers.data?.find((c) => c.id === id)?.code ?? "—";

  return (
    <div className="flex flex-col h-screen">
      <header className="px-6 py-4 border-b border-border bg-card flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl tracking-tight">Users</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isMasterAdmin
              ? "Manage all users across every stock center."
              : "Manage Store Keepers and Designer / Order Processors in your stock center."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(isMasterAdmin || isStockCenterAdmin) && (
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" /> Create user
            </Button>
          )}
          {!isMasterAdmin && isStockCenterAdmin && (
            <Button variant="outline" onClick={() => setInviteOpen(true)} className="gap-2">
              <Mail className="h-4 w-4" /> Invite user
            </Button>
          )}
        </div>
      </header>

      <div className="px-6 py-3 border-b border-border bg-card/50 grid grid-cols-1 md:grid-cols-5 gap-2">
        <div className="relative md:col-span-2">
          <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone…" className="pl-8" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger><SelectValue placeholder="All roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {isMasterAdmin && <SelectItem value="master_admin">{ROLE_LABELS.master_admin}</SelectItem>}
            {isMasterAdmin && <SelectItem value="stock_center_admin">{ROLE_LABELS.stock_center_admin}</SelectItem>}
            <SelectItem value="store_keeper">{ROLE_LABELS.store_keeper}</SelectItem>
            <SelectItem value="designer_order_processor">{ROLE_LABELS.designer_order_processor}</SelectItem>
          </SelectContent>
        </Select>
        {isMasterAdmin && (
          <Select value={centerFilter} onValueChange={setCenterFilter}>
            <SelectTrigger><SelectValue placeholder="All centers" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All centers</SelectItem>
              {(centers.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending invite</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="p-6 flex-1 overflow-auto">
        <div className="rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Stock Center</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead className="w-56 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const primaryRole = (p.roles?.[0] ?? "") as AppRole | "";
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                            {initials(p)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.full_name || "—"}</div>
                          <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                          {p.job_title && <div className="text-[11px] text-muted-foreground truncate">{p.job_title}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{primaryRole ? ROLE_LABELS[primaryRole as AppRole] : "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{centerName(p.stock_center_id)}</TableCell>
                    <TableCell>{statusBadge(p.invitation_status, p.is_active)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.last_login_at ? new Date(p.last_login_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(p)} className="gap-1">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setResetting(p)} className="gap-1">
                          <KeyRound className="h-3.5 w-3.5" /> Reset
                        </Button>
                        <Switch checked={p.is_active} onCheckedChange={(v) => toggleActive(p, v)} disabled={p.id === profile?.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No users match the current filters.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {editing && (
        <UserFormDialog
          open={!!editing}
          onClose={() => setEditing(null)}
          mode="edit"
          initial={editing}
        />
      )}
      <UserFormDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        mode="invite"
      />
      <UserFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
      />
      {resetting && (
        <ResetPasswordDialog
          user={resetting}
          onClose={() => setResetting(null)}
          onEmailFallback={() => { void sendResetEmail(resetting); setResetting(null); }}
        />
      )}
    </div>
  );
}

function UserFormDialog({
  open, onClose, mode, initial,
}: {
  open: boolean;
  onClose: () => void;
  mode: "invite" | "edit" | "create";
  initial?: ProfileRow;
}) {
  const { isMasterAdmin, profile } = useAppUser();
  const centers = useStockCenters();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const [firstName, setFirstName] = useState<string>(initial?.first_name ?? "");
  const [lastName, setLastName] = useState<string>(initial?.last_name ?? "");
  const [email, setEmail] = useState<string>(initial?.email ?? "");
  const [phone, setPhone] = useState<string>(initial?.phone ?? "");
  const [jobTitle, setJobTitle] = useState<string>(initial?.job_title ?? "");
  const [role, setRole] = useState<AppRole>(
    ((initial?.roles?.[0] as AppRole) ?? (isMasterAdmin ? "store_keeper" : "store_keeper")),
  );
  const [centerId, setCenterId] = useState<string>(
    initial?.stock_center_id ?? profile?.stock_center_id ?? "",
  );
  const [avatarUrl, setAvatarUrl] = useState<string>((initial?.avatar_url ?? "") as string);
  const [uploading, setUploading] = useState(false);
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string; url: string } | null>(null);

  async function uploadAvatar(file: File, targetUserId: string) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${targetUserId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = data?.signedUrl ?? "";
      setAvatarUrl(url);
      return url;
    } finally { setUploading(false); }
  }

  async function submit() {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error("First name, last name, and email are required");
      return;
    }
    if (role !== "master_admin" && !centerId) {
      toast.error("Stock center is required for this role");
      return;
    }
    if (mode === "create" && password.trim().length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      if (mode === "edit" && initial) {
        const { error } = await supabase.rpc("admin_update_user", {
          _user_id: initial.id,
          _first_name: firstName,
          _last_name: lastName,
          _phone: phone,
          _job_title: jobTitle,
          _avatar_url: avatarUrl,
          _role: role,
          // Function ignores this when role = master_admin
          _stock_center_id: role === "master_admin" ? (profile?.stock_center_id ?? centerId) : centerId,
        } as never);
        if (error) throw error;
        toast.success("User updated");
        qc.invalidateQueries({ queryKey: ["profiles-all"] });
        onClose();
      } else if (mode === "create") {
        const sess = await supabase.auth.getSession();
        const token = sess.data.session?.access_token;
        const res = await fetch("/api/users/create", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            email, password, first_name: firstName, last_name: lastName,
            phone, job_title: jobTitle, avatar_url: avatarUrl,
            role, stock_center_id: role === "master_admin" ? null : centerId,
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Create failed");
        toast.success(`User ${email} created`);
        setCreatedCreds({
          email,
          password,
          url: `${window.location.origin}/auth`,
        });
        qc.invalidateQueries({ queryKey: ["profiles-all"] });
      } else {
        // Invite via server route
        const sess = await supabase.auth.getSession();
        const token = sess.data.session?.access_token;
        const res = await fetch("/api/users/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            email, first_name: firstName, last_name: lastName,
            phone, job_title: jobTitle, avatar_url: avatarUrl,
            role, stock_center_id: role === "master_admin" ? null : centerId,
            redirect_to: `${window.location.origin}/reset-password`,
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Invite failed");
        toast.success(`Invitation sent to ${email}`);
        qc.invalidateQueries({ queryKey: ["profiles-all"] });
        onClose();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  const availableRoles: AppRole[] = isMasterAdmin
    ? ["master_admin", "stock_center_admin", "store_keeper", "designer_order_processor"]
    : ["store_keeper", "designer_order_processor"];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "invite" ? "Invite user" : mode === "create" ? "Create user" : "Edit user"}
          </DialogTitle>
        </DialogHeader>
        {createdCreds ? (
          <CredentialsPanel creds={createdCreds} onDone={() => { setCreatedCreds(null); onClose(); }} />
        ) : (
        <>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover border" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-sm text-muted-foreground">
                {(firstName[0] ?? "?")}{(lastName[0] ?? "")}
              </div>
            )}
            <label className="text-xs cursor-pointer">
              <span className="rounded-md border px-2 py-1 hover:bg-accent">
                {uploading ? "Uploading…" : "Upload photo"}
              </span>
              <input
                type="file" accept="image/*" className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const targetId = initial?.id ?? profile?.id ?? "invite";
                  try { await uploadAvatar(f, targetId); }
                  catch (err) { toast.error((err as Error).message); }
                }}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">First name *</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Last name *</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={email} disabled={mode === "edit"} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode === "create" && (
            <div>
              <Label className="text-xs">Password * (min 8 chars)</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-20"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2"
                    onClick={() => setShowPassword((v) => !v)}>
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs"
                    onClick={() => {
                      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
                      let out = "";
                      for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
                      setPassword(out);
                      setShowPassword(true);
                    }}>
                    Generate
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Job title</Label>
              <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Role *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableRoles.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Stock center {role !== "master_admin" ? "*" : ""}</Label>
              <Select
                value={centerId} onValueChange={setCenterId}
                disabled={role === "master_admin" || !isMasterAdmin}
              >
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {(centers.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-2">
            {mode === "invite" ? <Mail className="h-4 w-4" /> : null}
            {busy ? "Saving…" : (mode === "invite" ? "Send invite" : mode === "create" ? "Create user" : "Save changes")}
          </Button>
        </DialogFooter>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CredentialsPanel({ creds, onDone }: { creds: { email: string; password: string; url: string }; onDone: () => void }) {
  const shareText =
    `Login URL: ${creds.url}\nEmail: ${creds.email}\nPassword: ${creds.password}`;
  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch { toast.error("Copy failed"); }
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        User created. Share these login details securely — the password will not be shown again.
      </p>
      <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
        <Row label="Login URL" value={creds.url} onCopy={() => copy(creds.url, "Login URL")} />
        <Row label="Email" value={creds.email} onCopy={() => copy(creds.email, "Email")} />
        <Row label="Password" value={creds.password} onCopy={() => copy(creds.password, "Password")} mono />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => copy(shareText, "Login details")} className="gap-2">
          <Copy className="h-4 w-4" /> Copy all
        </Button>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </div>
  );
}

function Row({ label, value, onCopy, mono }: { label: string; value: string; onCopy: () => void; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`truncate ${mono ? "font-mono" : ""}`}>{value}</div>
      </div>
      <Button size="sm" variant="ghost" onClick={onCopy} className="gap-1 shrink-0">
        <Copy className="h-3.5 w-3.5" /> Copy
      </Button>
    </div>
  );
}

function ResetPasswordDialog({
  user, onClose, onEmailFallback,
}: {
  user: ProfileRow;
  onClose: () => void;
  onEmailFallback: () => void;
}) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ email: string; password: string; url: string } | null>(null);

  function generate() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let out = "";
    const arr = new Uint32Array(14);
    crypto.getRandomValues(arr);
    for (let i = 0; i < 14; i++) out += chars[arr[i] % chars.length];
    setPassword(out);
    setShow(true);
  }

  async function submit() {
    if (password.trim().length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setBusy(true);
    try {
      const sess = await supabase.auth.getSession();
      const token = sess.data.session?.access_token;
      const res = await fetch("/api/users/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: user.id, password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Reset failed");
      toast.success("Password updated");
      setDone({ email: user.email ?? "", password, url: `${window.location.origin}/auth` });
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password — {user.full_name || user.email}</DialogTitle>
        </DialogHeader>
        {done ? (
          <CredentialsPanel creds={done} onDone={onClose} />
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Set a new password for this user, then share the login details securely.
            </p>
            <div className="space-y-1.5">
              <Label>New password</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button type="button" variant="outline" onClick={generate}>Generate</Button>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="ghost" onClick={onEmailFallback} className="gap-2">
                <Mail className="h-4 w-4" /> Send reset email instead
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={submit} disabled={busy}>{busy ? "Updating…" : "Update password"}</Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
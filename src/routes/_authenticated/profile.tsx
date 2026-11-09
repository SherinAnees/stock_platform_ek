import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppUser, useStockCenters, ROLE_LABELS, type AppRole } from "@/lib/auth/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: MyProfilePage,
});

function MyProfilePage() {
  const { user, profile, role } = useAppUser();
  const centers = useStockCenters();
  const qc = useQueryClient();

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFirst(profile.first_name ?? "");
    setLast(profile.last_name ?? "");
    setPhone(profile.phone ?? "");
    setJobTitle(profile.job_title ?? "");
    setAvatarUrl(profile.avatar_url ?? "");
  }, [profile]);

  async function save() {
    if (!user) return;
    setBusy(true);
    try {
      const full = `${first} ${last}`.trim();
      const { error } = await supabase.from("profiles").update({
        first_name: first, last_name: last, full_name: full,
        phone, job_title: jobTitle, avatar_url: avatarUrl,
      }).eq("id", user.id);
      if (error) throw error;
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function changePassword() {
    if (pw1.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw1 !== pw2) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      toast.success("Password changed");
      setPw1(""); setPw2("");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function uploadAvatar(file: File) {
    if (!user) return;
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
      setAvatarUrl(data?.signedUrl ?? "");
    } catch (e) { toast.error((e as Error).message); }
  }

  const centerName = centers.data?.find((c) => c.id === profile?.stock_center_id)?.name ?? "—";

  return (
    <div className="flex flex-col h-screen">
      <header className="px-6 py-4 border-b border-border bg-card">
        <h1 className="font-serif text-2xl tracking-tight">My Profile</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Manage your personal details, photo, and password.</p>
      </header>
      <div className="p-6 max-w-2xl space-y-6 overflow-auto">
        <section className="rounded-md border border-border bg-card p-4 space-y-3">
          <h2 className="font-medium text-sm">Personal details</h2>
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover border" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-sm text-muted-foreground">
                {(first[0] ?? "?")}{(last[0] ?? "")}
              </div>
            )}
            <label className="text-xs cursor-pointer">
              <span className="rounded-md border px-2 py-1 hover:bg-accent">Upload photo</span>
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAvatar(f); }} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">First name</Label><Input value={first} onChange={(e) => setFirst(e.target.value)} /></div>
            <div><Label className="text-xs">Last name</Label><Input value={last} onChange={(e) => setLast(e.target.value)} /></div>
          </div>
          <div><Label className="text-xs">Email</Label><Input value={user?.email ?? ""} disabled /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><Label className="text-xs">Job title</Label><Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Role</Label><Input value={role ? ROLE_LABELS[role as AppRole] : "—"} disabled /></div>
            <div><Label className="text-xs">Stock center</Label><Input value={centerName} disabled /></div>
          </div>
          <Button onClick={save} disabled={busy}>Save profile</Button>
        </section>

        <section className="rounded-md border border-border bg-card p-4 space-y-3">
          <h2 className="font-medium text-sm">Change password</h2>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">New password</Label><Input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} /></div>
            <div><Label className="text-xs">Confirm password</Label><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
          </div>
          <Button variant="outline" onClick={changePassword} disabled={busy || !pw1}>Update password</Button>
        </section>
      </div>
    </div>
  );
}
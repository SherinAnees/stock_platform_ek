import { createFileRoute, Outlet, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { useAllowedModuleKeys, useModulePermission } from "@/lib/auth/usePermissions";
import { useAppUser } from "@/lib/auth/useSession";
import { toast } from "sonner";
import { Lock } from "lucide-react";

const PATH_TO_KEY: Array<{ prefix: string; key: string }> = [
  { prefix: "/inventory", key: "inventory" },
  { prefix: "/reorder", key: "reorder" },
  { prefix: "/design", key: "kitchen_designer" },
  { prefix: "/designs", key: "designs" },
  { prefix: "/quick-order", key: "quick_order" },
  { prefix: "/orders", key: "orders" },
  { prefix: "/partners", key: "partners_showrooms" },
  { prefix: "/users", key: "users" },
  { prefix: "/permissions", key: "permissions" },
];

function currentModuleKey(pathname: string): string | null {
  const sorted = [...PATH_TO_KEY].sort((a, b) => b.prefix.length - a.prefix.length);
  const match = sorted.find(
    (p) => pathname === p.prefix || pathname.startsWith(p.prefix + "/"),
  );
  return match?.key ?? null;
}

function ReadOnlyBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const key = currentModuleKey(location.pathname);
  const perm = useModulePermission(key ?? "__none__");
  if (!key || !perm.ready || !perm.readOnly) {
    return <>{children}</>;
  }
  return (
    <div className="flex-1 min-w-0 flex flex-col" data-readonly-scope>
      <div className="flex items-center gap-2 border-b border-amber-300/70 bg-amber-50 dark:bg-amber-950/30 px-4 py-2 text-[12px] text-amber-900 dark:text-amber-200">
        <Lock className="h-3.5 w-3.5" />
        <span>
          Read-only access — you can view this module but cannot make changes.
        </span>
      </div>
      <fieldset
        disabled
        className="contents ek-readonly-fieldset"
        aria-label="Read-only module"
      >
        {children}
      </fieldset>
    </div>
  );
}

function GuardedShell() {
  const { role, ready } = useAppUser();
  const allowed = useAllowedModuleKeys();
  const location = useLocation();
  const navigate = useNavigate();
  const notified = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !allowed.ready || !role) return;
    if (role === "master_admin") return;
    // match longest prefix (so /designs beats /design)
    const sorted = [...PATH_TO_KEY].sort((a, b) => b.prefix.length - a.prefix.length);
    const match = sorted.find((p) => location.pathname === p.prefix || location.pathname.startsWith(p.prefix + "/"));
    if (!match) return;
    if (!allowed.keys.has(match.key) && notified.current !== location.pathname) {
      notified.current = location.pathname;
      toast.error("You do not have access to that module.");
      navigate({ to: "/", replace: true });
    }
  }, [ready, allowed.ready, allowed.keys, role, location.pathname, navigate]);

  return (
    <AppShell>
      <ReadOnlyBoundary>
        <Outlet />
      </ReadOnlyBoundary>
    </AppShell>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: GuardedShell,
});
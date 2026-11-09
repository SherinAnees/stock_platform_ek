import logoAsset from "@/assets/express-kuchen-logo.png.asset.json";
import { type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Boxes,
  ChefHat,
  ClipboardList,
  Building2,
  Users,
  LogOut,
  ShoppingCart,
  FolderOpen,
  PackagePlus,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppUser } from "@/lib/auth/useSession";
import { useAllowedModuleKeys } from "@/lib/auth/usePermissions";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { StockCenterSwitcher } from "./StockCenterSwitcher";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Boxes;
  moduleKey: string;
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, moduleKey: "dashboard" },
  { to: "/inventory", label: "Inventory", icon: Boxes, moduleKey: "inventory" },
  { to: "/reorder", label: "Reorder", icon: PackagePlus, moduleKey: "reorder" },
  { to: "/design", label: "Kitchen Designer", icon: ChefHat, moduleKey: "kitchen_designer" },
  { to: "/designs", label: "Designs", icon: FolderOpen, moduleKey: "designs" },
  { to: "/quick-order", label: "Quick Order", icon: ShoppingCart, moduleKey: "quick_order" },
  { to: "/orders", label: "Orders", icon: ClipboardList, moduleKey: "orders" },
  { to: "/partners", label: "Partners / Showrooms", icon: Building2, moduleKey: "partners_showrooms" },
  { to: "/users", label: "Users", icon: Users, moduleKey: "users" },
  { to: "/permissions", label: "Roles & Rights", icon: ShieldCheck, moduleKey: "permissions" },
  { to: "/profile", label: "My Profile", icon: Users, moduleKey: "__profile" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, role, roles, ready, hasLoadError } = useAppUser();
  const allowed = useAllowedModuleKeys();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const items = NAV.filter((n) => {
    if (!role) return false;
    if (n.moduleKey === "__profile") return true;
    if (role === "master_admin") return true;
    return allowed.keys.has(n.moduleKey);
  });

  return (
    <div className="min-h-screen w-full flex bg-muted/20">
      <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col">
        <div className="px-5 py-4 border-b border-border flex flex-col items-center gap-2 text-center">
          <img src={logoAsset.url} alt="Express Küchen" className="h-10 w-auto object-contain" />
          <div className="flex flex-col leading-tight">
            <span className="font-serif text-base tracking-tight">EK Stock Control Program</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {(role ?? "no role").replace("_", " ")}
            </span>
          </div>
        </div>
        <div className="pt-3">
          <StockCenterSwitcher />
        </div>
        <nav className="flex-1 px-3 pb-3 space-y-1">
          {items.map((n) => {
            const active = pathname === n.to || (n.to !== "/" && pathname.startsWith(n.to));
            return (
              <Link
                key={n.to}
                to={n.to}
                className={
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition " +
                  (active
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground")
                }
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
          {!ready && (
            <div className="rounded-md border border-border bg-muted/40 p-3 mt-3">
              <p className="text-[11px] text-muted-foreground">Loading access…</p>
            </div>
          )}
          {ready && hasLoadError && (
            <div className="rounded-md border border-dashed border-destructive/50 bg-destructive/10 p-3 mt-3">
              <p className="text-[11px] text-destructive">
                Access details could not load. Please refresh or sign in again.
              </p>
            </div>
          )}
          {ready && !hasLoadError && roles.length === 0 && (
            <div className="rounded-md border border-dashed border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/20 p-3 mt-3">
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                No role assigned yet. Ask an Admin to grant you a role.
              </p>
            </div>
          )}
        </nav>
        <div className="border-t border-border p-3">
          <div className="px-1 pb-2 text-[11px]">
            <div className="font-medium truncate">{profile?.full_name ?? user?.email}</div>
            <div className="text-muted-foreground truncate">{user?.email}</div>
          </div>
          <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={signOut}>
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
    </div>
  );
}
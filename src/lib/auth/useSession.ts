import { useEffect, useState, useCallback, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole =
  | "master_admin"
  | "stock_center_admin"
  | "store_keeper"
  | "designer_order_processor";

export const ROLE_LABELS: Record<AppRole, string> = {
  master_admin: "Master Admin",
  stock_center_admin: "Stock Center Admin",
  store_keeper: "Store Keeper",
  designer_order_processor: "Designer / Order Processor",
};

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  is_active: boolean;
  partner_id: string | null;
  stock_center_id: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  job_title?: string | null;
  avatar_url?: string | null;
  invitation_status?: "pending" | "active" | "inactive" | null;
  last_login_at?: string | null;
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, ready } as {
    session: Session | null;
    user: User | null;
    ready: boolean;
  };
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,full_name,is_active,partner_id,stock_center_id,first_name,last_name,phone,job_title,avatar_url,invitation_status,last_login_at")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

export function useRoles(userId: string | undefined) {
  return useQuery({
    queryKey: ["roles", userId],
    enabled: !!userId,
    queryFn: async (): Promise<AppRole[]> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
}

export function useAppUser() {
  const { user, ready } = useSession();
  const profile = useProfile(user?.id);
  const roles = useRoles(user?.id);
  const allRoles = roles.data ?? [];
  const isMasterAdmin = allRoles.includes("master_admin");
  const isStockCenterAdmin = allRoles.includes("stock_center_admin");
  const isAdmin = isMasterAdmin || isStockCenterAdmin;
  const isStoreKeeper = allRoles.includes("store_keeper");
  const isDesigner = allRoles.includes("designer_order_processor");
  // Prefer highest-privilege role for label
  const role: AppRole | null =
    (isMasterAdmin && "master_admin") ||
    (isStockCenterAdmin && "stock_center_admin") ||
    (isStoreKeeper && "store_keeper") ||
    (isDesigner && "designer_order_processor") ||
    null;
  const profileReady = !user || profile.isFetched || profile.isError;
  const rolesReady = !user || roles.isFetched || roles.isError;
  return {
    ready: ready && profileReady && rolesReady,
    isLoading: !ready || !profileReady || !rolesReady,
    hasLoadError: profile.isError || roles.isError,
    user,
    profile: profile.data ?? null,
    roles: allRoles,
    role,
    hasRole: (r: AppRole) => allRoles.includes(r),
    isMasterAdmin,
    isAdmin,
    isStockCenterAdmin,
    isStoreKeeper,
    isDesigner,
    // Back-compat aliases used by legacy code paths
    isStockkeeper: isStoreKeeper,
    isPartner: isDesigner,
  };
}

// ---------- Stock Center context ----------

export interface StockCenter {
  id: string;
  code: string;
  name: string;
  country: string | null;
  city: string | null;
  is_active: boolean;
}

export function useStockCenters() {
  return useQuery({
    queryKey: ["stock_centers"],
    queryFn: async (): Promise<StockCenter[]> => {
      const { data, error } = await supabase
        .from("stock_centers")
        .select("id,code,name,country,city,is_active")
        .eq("is_active", true)
        .order("code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StockCenter[];
    },
  });
}

const SELECTED_CENTER_KEY = "ek.selectedStockCenterId";

function subscribeSelectedCenter(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === SELECTED_CENTER_KEY) cb();
  };
  window.addEventListener("storage", handler);
  window.addEventListener("ek:stock-center-changed", cb as EventListener);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("ek:stock-center-changed", cb as EventListener);
  };
}

function getSelectedCenterSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SELECTED_CENTER_KEY);
}

/**
 * Returns the effective stock center in scope:
 * - Scoped users → their assigned profile.stock_center_id (immutable)
 * - Master Admin → the id they picked (persisted in localStorage), falling
 *   back to their profile.stock_center_id, else the first active center.
 */
export function useCurrentStockCenter() {
  const { profile, isMasterAdmin, ready: userReady } = useAppUser();
  const centers = useStockCenters();
  const qc = useQueryClient();
  const stored = useSyncExternalStore(
    subscribeSelectedCenter,
    getSelectedCenterSnapshot,
    () => null,
  );

  const list = centers.data ?? [];
  let currentId: string | null = null;
  if (isMasterAdmin) {
    currentId =
      (stored && list.some((c) => c.id === stored) ? stored : null) ??
      profile?.stock_center_id ??
      list[0]?.id ??
      null;
  } else {
    currentId = profile?.stock_center_id ?? null;
  }
  const current = list.find((c) => c.id === currentId) ?? null;

  const setCurrent = useCallback(
    (id: string) => {
      if (!isMasterAdmin) return;
      window.localStorage.setItem(SELECTED_CENTER_KEY, id);
      window.dispatchEvent(new Event("ek:stock-center-changed"));
      // Refresh scoped data
      qc.invalidateQueries();
    },
    [isMasterAdmin, qc],
  );

  return {
    centers: list,
    current,
    currentId,
    setCurrent,
    canSwitch: isMasterAdmin,
    isLoading: !userReady || centers.isLoading,
  };
}
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppUser, type AppRole } from "./useSession";

export type PermissionLevel = "no_permission" | "read_only" | "modify";

export interface PermissionRow {
  id: string;
  module_key: string;
  module_label: string;
  module_sort_order: number;
  role: AppRole;
  permission: PermissionLevel;
  updated_at: string;
  updated_by: string | null;
}

export function usePermissionMatrix() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase.channel(`permission_matrix:${Math.random().toString(36).slice(2)}`);
    ch.on(
      "postgres_changes" as never,
      { event: "*", schema: "public", table: "permission_matrix" },
      () => qc.invalidateQueries({ queryKey: ["permission_matrix"] }),
    ).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return useQuery({
    queryKey: ["permission_matrix"],
    queryFn: async (): Promise<PermissionRow[]> => {
      const { data, error } = await supabase
        .from("permission_matrix" as never)
        .select("*")
        .order("module_sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PermissionRow[];
    },
    staleTime: 30_000,
  });
}

/** Permission for the current signed-in user on a given module_key. */
export function useModulePermission(moduleKey: string): {
  level: PermissionLevel;
  canView: boolean;
  canModify: boolean;
  readOnly: boolean;
  ready: boolean;
} {
  const { role, ready: userReady } = useAppUser();
  const q = usePermissionMatrix();
  const level: PermissionLevel = (() => {
    if (!role) return "no_permission";
    if (role === "master_admin") return "modify";
    const row = (q.data ?? []).find(
      (r) => r.module_key === moduleKey && r.role === role,
    );
    return row?.permission ?? "no_permission";
  })();
  return {
    level,
    canView: level !== "no_permission",
    canModify: level === "modify",
    readOnly: level === "read_only",
    ready: userReady && q.isFetched,
  };
}

/** Returns a set of module_keys the current role can view. */
export function useAllowedModuleKeys(): { keys: Set<string>; ready: boolean } {
  const { role, ready: userReady } = useAppUser();
  const q = usePermissionMatrix();
  if (role === "master_admin") {
    return {
      keys: new Set((q.data ?? []).map((r) => r.module_key)),
      ready: userReady && q.isFetched,
    };
  }
  const keys = new Set(
    (q.data ?? [])
      .filter((r) => r.role === role && r.permission !== "no_permission")
      .map((r) => r.module_key),
  );
  return { keys, ready: userReady && q.isFetched };
}
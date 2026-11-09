import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentStockCenter } from "@/lib/auth/useSession";

export interface Article {
  id: string;
  code: string;
  name: string;
  category: string | null;
  description: string | null;
  image_url: string | null;
  unit: string;
  supplier: string | null;
  unit_price: number;
  current_qty: number;
  reserved_qty?: number;
  min_qty: number;
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  volume_m3: number | null;
  dimension_unit: string | null;
  unit_type: string | null;
  is_active: boolean;
  reorder_qty?: number;
  reorder_status?: "none" | "ordered";
  reorder_ordered_at?: string | null;
  has_3d_model?: boolean;
  illustration_status?: "pending" | "no_illustration" | "model_ready";
  model_config?: Record<string, unknown> | null;
  model_created_at?: string | null;
  model_created_by?: string | null;
  reference_image_url?: string | null;
  ai_detected_config?: Record<string, unknown> | null;
  model_source?: "ai_auto" | "ai_refined" | "manual" | null;
}

export interface Region {
  id: string;
  name: string;
  country: string | null;
  description: string | null;
}

export interface Partner {
  id: string;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  region_id: string | null;
  account_no?: string | null;
  short_key?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  territory?: string | null;
  nolte_iam?: string | null;
  zone?: string | null;
  stock_center_id?: string | null;
}

export interface Order {
  id: string;
  code: string;
  partner_id: string | null;
  region_id: string | null;
  created_by: string | null;
  design_id: string | null;
  status: "draft" | "submitted" | "approved" | "fulfilled" | "rejected" | "cancelled" | "auto_cancelled";
  client_name: string | null;
  delivery_notes: string | null;
  notes: string | null;
  total: number;
  approved_at: string | null;
  fulfilled_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
  auto_cancelled?: boolean | null;
  last_status_changed_at?: string | null;
  created_at: string;
  updated_at: string;
  partner?: { company_name: string } | null;
  region?: { name: string } | null;
}

export interface OrderLine {
  id: string;
  order_id: string;
  article_id: string;
  qty: number;
  unit_price: number;
  line_total: number;
  theme_id?: string | null;
  article?: {
    code: string;
    name: string;
    category?: string | null;
    width_mm?: number | null;
    height_mm?: number | null;
    depth_mm?: number | null;
    volume_m3?: number | null;
    dimension_unit?: string | null;
  } | null;
  theme?: { id: string; name: string; hex_color: string | null } | null;
}

export interface StockMovement {
  id: string;
  article_id: string;
  delta: number;
  reason: "receive" | "adjust" | "order_fulfilled" | "order_reversal" | "opening_stock" | "stock_received";
  unit_price: number;
  notes: string | null;
  order_id: string | null;
  created_by: string | null;
  created_at: string;
  theme_id?: string | null;
}

export interface ColorTheme {
  id: string;
  code: string;
  name: string;
  range: string | null;
  front_code: string | null;
  carcass_code: string | null;
  hex_color: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface ArticleStockRow {
  id: string;
  article_id: string;
  theme_id: string;
  stock_center_id?: string | null;
  current_qty: number;
  reserved_qty?: number;
  min_qty: number;
  unit_price: number;
  reorder_qty?: number;
  reorder_status?: "none" | "ordered";
  reorder_ordered_at?: string | null;
}

// =========== ARTICLES ===========
export function useArticles() {
  return useQuery({
    queryKey: ["articles"],
    queryFn: async (): Promise<Article[]> => {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .order("code");
      if (error) throw error;
      return data as Article[];
    },
  });
}

export function useUpsertArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: Partial<Article> & { id?: string }) => {
      if (a.id) {
        const { error } = await supabase.from("articles").update(a as never).eq("id", a.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("articles").insert(a as never);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["articles"] }),
  });
}

export function useDeleteArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("articles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["articles"] }),
  });
}

/**
 * Update the 3D-illustration status of an article.
 * "no_illustration" = admin chose to skip a 3D model; article shows as 2D only.
 * "model_ready"    = 3D model saved (Phase 2 wizard).
 * "pending"        = default for newly created articles.
 */
export function useUpdateArticleIllustration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      status: "pending" | "no_illustration" | "model_ready";
      model_config?: Record<string, unknown> | null;
      reference_image_url?: string | null;
      ai_detected_config?: Record<string, unknown> | null;
      model_source?: "ai_auto" | "ai_refined" | "manual" | null;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      const patch: Record<string, unknown> = {
        illustration_status: input.status,
        has_3d_model: input.status === "model_ready",
      };
      if (input.status === "model_ready") {
        patch.model_config = input.model_config ?? null;
        patch.model_created_at = new Date().toISOString();
        patch.model_created_by = user.user?.id ?? null;
      } else if (input.status === "no_illustration") {
        patch.model_config = null;
      }
      if (input.reference_image_url !== undefined) patch.reference_image_url = input.reference_image_url;
      if (input.ai_detected_config !== undefined) patch.ai_detected_config = input.ai_detected_config;
      if (input.model_source !== undefined) patch.model_source = input.model_source;
      const { error } = await supabase
        .from("articles")
        .update(patch as never)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["articles"] }),
  });
}

export function useRecordMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      article_id: string;
      delta: number;
      reason: "receive" | "adjust";
      notes?: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      const { error: e1 } = await supabase.from("stock_movements").insert({
        article_id: input.article_id,
        delta: input.delta,
        reason: input.reason,
        notes: input.notes ?? null,
        created_by: user.user?.id ?? null,
      });
      if (e1) throw e1;
      // Manually update current_qty (no DB trigger for staff movements; keep simple)
      const { data: art, error: e2 } = await supabase
        .from("articles")
        .select("current_qty")
        .eq("id", input.article_id)
        .single();
      if (e2) throw e2;
      const { error: e3 } = await supabase
        .from("articles")
        .update({ current_qty: (art!.current_qty as number) + input.delta })
        .eq("id", input.article_id);
      if (e3) throw e3;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
    },
  });
}

export function useMovementsForArticle(articleId: string | null) {
  return useQuery({
    queryKey: ["movements", articleId],
    enabled: !!articleId,
    queryFn: async (): Promise<StockMovement[]> => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*")
        .eq("article_id", articleId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as StockMovement[];
    },
  });
}

// =========== REGIONS / PARTNERS ===========
export function useRegions() {
  return useQuery({
    queryKey: ["regions"],
    queryFn: async (): Promise<Region[]> => {
      const { data, error } = await supabase.from("regions").select("*").order("name");
      if (error) throw error;
      return data as Region[];
    },
  });
}

export function usePartners() {
  return useQuery({
    queryKey: ["partners"],
    queryFn: async (): Promise<Partner[]> => {
      const { data, error } = await supabase.from("partners").select("*").order("company_name");
      if (error) throw error;
      return data as Partner[];
    },
  });
}

export function useUpsertRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: Partial<Region> & { id?: string }) => {
      if (r.id) {
        const { error } = await supabase.from("regions").update(r as never).eq("id", r.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("regions").insert(r as never);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["regions"] }),
  });
}

export function useDeleteRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("regions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["regions"] }),
  });
}

export function useUpsertPartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<Partner> & { id?: string }) => {
      if (p.id) {
        const { error } = await supabase.from("partners").update(p as never).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("partners").insert(p as never);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partners"] }),
  });
}

export function useDeletePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partners"] }),
  });
}

// =========== ORDERS ===========
export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, partner:partners(company_name), region:regions(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["order", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: order, error } = await supabase
        .from("orders")
        .select("*, partner:partners(company_name), region:regions(name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      const { data: lines, error: e2 } = await supabase
        .from("order_lines")
        .select("*, article:articles(code, name, category, width_mm, height_mm, depth_mm, volume_m3, dimension_unit), theme:color_themes(id, name, hex_color)")
        .eq("order_id", id!);
      if (e2) throw e2;
      return { order: order as Order, lines: lines as OrderLine[] };
    },
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Order["status"] }) => {
      // Submitting must go through the RPC so reservations are recorded.
      if (status === "submitted") {
        const { error } = await supabase.rpc("submit_order", { _order_id: id });
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", v.id] });
      qc.invalidateQueries({ queryKey: ["article_stock_by_theme"] });
      qc.invalidateQueries({ queryKey: ["articles"] });
    },
  });
}

export function useApproveOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("approve_order", { _order_id: id });
      if (error) throw error;
      return data as { ok: boolean; shortages?: Array<{ code: string; name: string; requested: number; available: number }> };
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["articles"] });
    },
  });
}

export function useFulfillOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("fulfill_order", { _order_id: id });
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", id] });
    },
  });
}

export function useRejectOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.rpc("reject_order", { _order_id: id, _reason: reason });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", v.id] });
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.rpc("cancel_order", { _order_id: id, _reason: reason });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", v.id] });
      qc.invalidateQueries({ queryKey: ["article_stock_by_theme"] });
      qc.invalidateQueries({ queryKey: ["articles"] });
    },
  });
}

export interface OrderNearExpiry {
  id: string;
  code: string;
  status: Order["status"];
  last_status_changed_at: string;
  expires_at: string;
  hours_remaining: number;
}

export function useOrdersNearExpiry() {
  return useQuery({
    queryKey: ["orders_near_expiry"],
    queryFn: async (): Promise<OrderNearExpiry[]> => {
      const { data, error } = await supabase
        .from("orders_near_expiry")
        .select("*")
        .order("last_status_changed_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OrderNearExpiry[];
    },
    refetchInterval: 5 * 60 * 1000,
  });
}

// =========== USERS ===========
export interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  is_active: boolean;
  partner_id: string | null;
  stock_center_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  job_title?: string | null;
  avatar_url?: string | null;
  invitation_status?: "pending" | "active" | "inactive" | null;
  invited_at?: string | null;
  last_login_at?: string | null;
  created_at?: string | null;
  roles?: string[];
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles-all"],
    queryFn: async (): Promise<ProfileRow[]> => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id,email,full_name,is_active,partner_id,stock_center_id,first_name,last_name,phone,job_title,avatar_url,invitation_status,invited_at,last_login_at,created_at");
      if (error) throw error;
      const { data: roles, error: e2 } = await supabase.from("user_roles").select("user_id,role");
      if (e2) throw e2;
      const byUser = new Map<string, string[]>();
      for (const r of roles ?? []) {
        const arr = byUser.get(r.user_id) ?? [];
        arr.push(r.role);
        byUser.set(r.user_id, arr);
      }
      return (profiles as ProfileRow[]).map((p) => ({ ...p, roles: byUser.get(p.id) ?? [] }));
    },
  });
}

export function useSetUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      role,
    }: {
      userId: string;
      role: "master_admin" | "stock_center_admin" | "store_keeper" | "designer_order_processor" | null;
    }) => {
      // clear existing roles, then assign
      const { error: e0 } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (e0) throw e0;
      if (role) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles-all"] });
      qc.invalidateQueries({ queryKey: ["roles"] });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<ProfileRow> & { id: string }) => {
      const { error } = await supabase.from("profiles").update({
        full_name: p.full_name,
        is_active: p.is_active,
        partner_id: p.partner_id,
      }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles-all"] }),
  });
}

// =========== CREATE ORDER (from designer or inventory) ===========
export async function createOrderFromLines(input: {
  partnerId: string | null;
  regionId: string | null;
  designId?: string | null;
  clientName?: string | null;
  deliveryNotes?: string;
  notes?: string;
  lines: Array<{ articleId: string; qty: number; unitPrice: number; themeId?: string | null }>;
}): Promise<{ id: string }> {
  const { data: user } = await supabase.auth.getUser();
  const total = input.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      partner_id: input.partnerId,
      region_id: input.regionId,
      design_id: input.designId ?? null,
      client_name: input.clientName ?? null,
      delivery_notes: input.deliveryNotes ?? null,
      notes: input.notes ?? null,
      total,
      status: "draft",
      created_by: user.user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  const orderId = (order as { id: string }).id;
  if (input.lines.length) {
    const { error: e2 } = await supabase.from("order_lines").insert(
      input.lines.map((l) => ({
        order_id: orderId,
        article_id: l.articleId,
        qty: l.qty,
        unit_price: l.unitPrice,
        line_total: l.qty * l.unitPrice,
        theme_id: l.themeId ?? null,
      }))
    );
    if (e2) throw e2;
  }
  // Submit via RPC so stock is reserved atomically.
  const { error: e3 } = await supabase.rpc("submit_order", { _order_id: orderId });
  if (e3) throw e3;
  return { id: orderId };
}

// =========== COLOR THEMES & PER-THEME STOCK ===========
export function useColorThemes() {
  return useQuery({
    queryKey: ["color_themes"],
    queryFn: async (): Promise<ColorTheme[]> => {
      const { data, error } = await supabase
        .from("color_themes")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as ColorTheme[];
    },
  });
}

export function useArticleStockByTheme(themeId: string | null | undefined) {
  const { currentId: stockCenterId, isLoading: centerLoading } = useCurrentStockCenter();
  return useQuery({
    queryKey: ["article_stock_by_theme", themeId ?? "all", stockCenterId ?? "no-center"],
    enabled: !!themeId && !centerLoading && !!stockCenterId,
    queryFn: async (): Promise<ArticleStockRow[]> => {
      const { data, error } = await supabase
        .from("article_stock_by_theme")
        .select("*")
        .eq("theme_id", themeId!)
        .eq("stock_center_id", stockCenterId!);
      if (error) throw error;
      return data as ArticleStockRow[];
    },
  });
}

export function useAllArticleStock() {
  const { currentId: stockCenterId, isLoading: centerLoading } = useCurrentStockCenter();
  return useQuery({
    queryKey: ["article_stock_by_theme", "all-rows", stockCenterId ?? "no-center"],
    enabled: !centerLoading && !!stockCenterId,
    queryFn: async (): Promise<ArticleStockRow[]> => {
      const { data, error } = await supabase
        .from("article_stock_by_theme")
        .select("*")
        .eq("stock_center_id", stockCenterId!);
      if (error) throw error;
      return data as ArticleStockRow[];
    },
  });
}

export interface LowStockAlertRow {
  article_id: string;
  article_code: string;
  article_name: string;
  theme_id: string;
  theme_name: string;
  theme_hex: string | null;
  current_qty: number;
  min_qty: number;
}

export function useLowStockByTheme() {
  const { currentId: stockCenterId, isLoading: centerLoading } = useCurrentStockCenter();
  return useQuery({
    queryKey: ["low_stock_by_theme", stockCenterId ?? "no-center"],
    enabled: !centerLoading && !!stockCenterId,
    queryFn: async (): Promise<LowStockAlertRow[]> => {
      const { data, error } = await supabase
        .from("article_stock_by_theme")
        .select("article_id, theme_id, current_qty, min_qty, articles(code,name), color_themes(name,hex_color)")
        .eq("stock_center_id", stockCenterId!);
      if (error) throw error;
      type Row = {
        article_id: string; theme_id: string; current_qty: number; min_qty: number;
        articles: { code: string; name: string } | null;
        color_themes: { name: string; hex_color: string | null } | null;
      };
      return (data as Row[])
        .filter((r) => r.current_qty < r.min_qty)
        .map((r) => ({
          article_id: r.article_id,
          theme_id: r.theme_id,
          article_code: r.articles?.code ?? "",
          article_name: r.articles?.name ?? "",
          theme_name: r.color_themes?.name ?? "",
          theme_hex: r.color_themes?.hex_color ?? null,
          current_qty: r.current_qty,
          min_qty: r.min_qty,
        }));
    },
  });
}

export function useRecordThemeMovement() {
  const qc = useQueryClient();
  const { currentId: stockCenterId } = useCurrentStockCenter();
  return useMutation({
    mutationFn: async (input: {
      article_id: string;
      theme_id: string;
      delta: number;
      reason: "receive" | "adjust";
      notes?: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      const { error: e1 } = await supabase.from("stock_movements").insert({
        article_id: input.article_id,
        theme_id: input.theme_id,
        stock_center_id: stockCenterId,
        delta: input.delta,
        reason: input.reason,
        notes: input.notes ?? null,
        created_by: user.user?.id ?? null,
      });
      if (e1) throw e1;
      const { data: row, error: e2 } = await supabase
        .from("article_stock_by_theme")
        .select("id,current_qty")
        .eq("article_id", input.article_id)
        .eq("theme_id", input.theme_id)
        .eq("stock_center_id", stockCenterId!)
        .maybeSingle();
      if (e2) throw e2;
      if (row) {
        const { error: e3 } = await supabase
          .from("article_stock_by_theme")
          .update({ current_qty: (row.current_qty as number) + input.delta })
          .eq("id", row.id as string);
        if (e3) throw e3;
      } else {
        const { error: e3 } = await supabase
          .from("article_stock_by_theme")
          .insert({
            article_id: input.article_id,
            theme_id: input.theme_id,
            stock_center_id: stockCenterId,
            current_qty: Math.max(0, input.delta),
            min_qty: 1,
          } as never);
        if (e3) throw e3;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["article_stock_by_theme", v.theme_id] });
      qc.invalidateQueries({ queryKey: ["article_stock_by_theme", "all-rows"] });
      qc.invalidateQueries({ queryKey: ["low_stock_by_theme"] });
      qc.invalidateQueries({ queryKey: ["movements", v.article_id] });
    },
  });
}

// Update unit_price on the per-theme stock row
export function useUpdateThemeStockPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { article_id: string; theme_id: string; unit_price: number }) => {
      const { error } = await supabase
        .from("article_stock_by_theme")
        .update({ unit_price: input.unit_price })
        .eq("article_id", input.article_id)
        .eq("theme_id", input.theme_id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["article_stock_by_theme", v.theme_id] });
      qc.invalidateQueries({ queryKey: ["article_stock_by_theme", "all-rows"] });
    },
  });
}

// =========== Bulk stock ops & theme deletion ===========
export function useBulkZeroStock() {
  const qc = useQueryClient();
  const { currentId: stockCenterId } = useCurrentStockCenter();
  return useMutation({
    mutationFn: async (pairs: Array<{ article_id: string; theme_id: string; notes?: string }>) => {
      const { data, error } = await supabase.rpc("bulk_zero_stock", { _pairs: pairs, _stock_center_id: stockCenterId ?? undefined });
      if (error) throw error;
      return data as unknown as { zeroed: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["article_stock_by_theme"] });
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["low_stock_by_theme"] });
    },
  });
}

export function useBulkSetStock() {
  const qc = useQueryClient();
  const { currentId: stockCenterId } = useCurrentStockCenter();
  return useMutation({
    mutationFn: async (items: Array<{ article_id: string; theme_id: string; new_qty: number }>) => {
      const { data, error } = await supabase.rpc("bulk_set_stock", { _items: items, _stock_center_id: stockCenterId ?? undefined });
      if (error) throw error;
      return data as unknown as { updated: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["article_stock_by_theme"] });
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["low_stock_by_theme"] });
    },
  });
}

// ---------- Bulk price updates + price history ----------
export type PriceChangeSource = "bulk_edit" | "excel_upload" | "manual_edit";

export interface PriceChangeLogRow {
  id: string;
  article_id: string;
  old_price: number;
  new_price: number;
  changed_by: string | null;
  changed_at: string;
  change_source: PriceChangeSource;
  changer?: { full_name: string | null; email: string | null } | null;
}

export function useBulkUpdatePrices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Array<{ article_id: string; new_price: number }>) => {
      const { data, error } = await supabase.rpc("bulk_update_prices", {
        _items: items, _source: "bulk_edit",
      });
      if (error) throw error;
      return data as unknown as { updated: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["article_stock_by_theme"] });
      qc.invalidateQueries({ queryKey: ["price_change_log"] });
    },
  });
}

export function usePriceHistory(articleId: string | null | undefined) {
  return useQuery({
    queryKey: ["price_change_log", articleId],
    enabled: !!articleId,
    queryFn: async (): Promise<PriceChangeLogRow[]> => {
      const { data, error } = await supabase
        .from("price_change_log")
        .select("id,article_id,old_price,new_price,changed_by,changed_at,change_source")
        .eq("article_id", articleId!)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as PriceChangeLogRow[];
      const ids = Array.from(new Set(rows.map((r) => r.changed_by).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
        const m = new Map<string, { full_name: string | null; email: string | null }>();
        (profs ?? []).forEach((p: { id: string; full_name: string | null; email: string | null }) => m.set(p.id, { full_name: p.full_name, email: p.email }));
        rows.forEach((r) => { r.changer = r.changed_by ? m.get(r.changed_by) ?? null : null; });
      }
      return rows;
    },
  });
}

export interface ThemeDeletePrecheck {
  theme_id: string;
  name: string;
  is_builtin: boolean;
  article_count: number;
  stock_qty: number;
  reserved_qty: number;
  active_orders: Array<{ id: string; code: string | null; status: string }>;
}

export function useThemeDeletePrecheck() {
  return useMutation({
    mutationFn: async (themeId: string): Promise<ThemeDeletePrecheck> => {
      const { data, error } = await supabase.rpc("theme_delete_precheck", { _theme_id: themeId });
      if (error) throw error;
      return data as unknown as ThemeDeletePrecheck;
    },
  });
}

export function useDeleteColorTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (themeId: string) => {
      const { data, error } = await supabase.rpc("delete_color_theme", { _theme_id: themeId });
      if (error) throw error;
      return data as unknown as { ok: boolean; name: string; zeroed_rows: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["color_themes"] });
      qc.invalidateQueries({ queryKey: ["article_stock_by_theme"] });
      qc.invalidateQueries({ queryKey: ["theme_finishes"] });
    },
  });
}

// =========== KITCHEN DESIGNS (drafts + ordered) ===========
export interface KitchenDesignRow {
  id: string;
  name: string | null;
  created_at: string;
  updated_at: string;
  reserved_at: string | null;
  expired_at: string | null;
  intake: Record<string, unknown> | null;
  placed: unknown;
  bom: unknown;
  orders: Array<{ id: string; code: string | null; status: Order["status"] }>;
}

const DRAFT_TTL_DAYS = 2;

export function useMyDesigns() {
  return useQuery({
    queryKey: ["kitchen_designs"],
    queryFn: async (): Promise<KitchenDesignRow[]> => {
      const { data, error } = await supabase
        .from("kitchen_designs")
        .select(
          "id,name,created_at,updated_at,reserved_at,expired_at,intake,placed,bom,orders:orders(id,code,status)"
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as unknown as KitchenDesignRow[];
    },
  });
}

export function useDesign(id: string | null | undefined) {
  return useQuery({
    queryKey: ["kitchen_designs", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kitchen_designs")
        .select(
          "id,name,created_at,updated_at,reserved_at,expired_at,intake,placed,bom,orders:orders(id,code,status)"
        )
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as KitchenDesignRow;
    },
  });
}

export interface DraftReserveLine {
  article_id: string;
  theme_id: string | null;
  qty: number;
  unit_price: number;
}

export async function saveDesignDraft(input: {
  designId?: string | null;
  partnerId: string | null;
  intake: Record<string, unknown>;
  placed: unknown;
  bom: unknown;
  baseUnitThemeId?: string | null;
  wallUnitThemeId?: string | null;
  tallUnitThemeId?: string | null;
  reservedLines: DraftReserveLine[];
}): Promise<{ id: string }> {
  const { data: user } = await supabase.auth.getUser();
  const name =
    ((input.intake as { clientName?: string })?.clientName ?? "Untitled") +
    " — " + new Date().toLocaleDateString();
  let designId = input.designId ?? null;
  if (designId) {
    const { error } = await supabase
      .from("kitchen_designs")
      .update({
        name,
        intake: input.intake as never,
        placed: input.placed as never,
        bom: input.bom as never,
        base_unit_theme_id: input.baseUnitThemeId ?? null,
        wall_unit_theme_id: input.wallUnitThemeId ?? null,
        tall_unit_theme_id: input.tallUnitThemeId ?? null,
        expired_at: null,
      })
      .eq("id", designId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("kitchen_designs")
      .insert({
        created_by: user.user!.id,
        partner_id: input.partnerId,
        name,
        intake: input.intake as never,
        placed: input.placed as never,
        bom: input.bom as never,
        base_unit_theme_id: input.baseUnitThemeId ?? null,
        wall_unit_theme_id: input.wallUnitThemeId ?? null,
        tall_unit_theme_id: input.tallUnitThemeId ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    designId = (data as { id: string }).id;
  }
  const { error: rErr } = await supabase.rpc("reserve_design_draft", {
    _design_id: designId!,
    _lines: input.reservedLines as never,
  });
  if (rErr) throw rErr;
  return { id: designId! };
}

export async function releaseDesignDraft(designId: string): Promise<void> {
  const { error } = await supabase.rpc("release_design_draft", { _design_id: designId });
  if (error) throw error;
}

// =========== REORDER ===========
export interface ReorderItemInput {
  article_id: string;
  theme_id: string | null;
  qty: number;
}

export function usePlaceReorders() {
  const qc = useQueryClient();
  const { currentId: stockCenterId } = useCurrentStockCenter();
  return useMutation({
    mutationFn: async (items: ReorderItemInput[]) => {
      const { error } = await supabase.rpc("place_reorders", { _items: items as never, _stock_center_id: stockCenterId ?? undefined });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["article_stock_by_theme"] });
      qc.invalidateQueries({ queryKey: ["reorder_batches"] });
    },
  });
}

export function useMarkReorderArrived() {
  const qc = useQueryClient();
  const { currentId: stockCenterId } = useCurrentStockCenter();
  return useMutation({
    mutationFn: async (input: { article_id: string; theme_id: string | null }) => {
      const { error } = await supabase.rpc("mark_reorder_arrived", {
        _article_id: input.article_id,
        _theme_id: input.theme_id as never,
        _stock_center_id: stockCenterId ?? undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["article_stock_by_theme"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["reorder_batches"] });
    },
  });
}

export interface ReorderBatchLineRow {
  id: string;
  article_id: string;
  theme_id: string | null;
  qty: number;
  arrived_at: string | null;
  article?: { code: string; name: string; category: string | null } | null;
  theme?: { name: string; hex_color: string | null } | null;
}
export interface ReorderBatchRow {
  id: string;
  code: string;
  created_at: string;
  status: "placed" | "partial" | "completed";
  completed_at: string | null;
  created_by: string | null;
  notes: string | null;
  lines: ReorderBatchLineRow[];
}

export function useReorderBatches() {
  return useQuery({
    queryKey: ["reorder_batches"],
    queryFn: async (): Promise<ReorderBatchRow[]> => {
      const { data, error } = await supabase
        .from("reorder_batches")
        .select("id,code,created_at,status,completed_at,created_by,notes, lines:reorder_batch_lines(id,article_id,theme_id,qty,arrived_at, article:articles(code,name,category), theme:color_themes(name,hex_color))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ReorderBatchRow[];
    },
  });
}

// Bump invalidation set for placement too

export async function deleteDesignDraft(designId: string): Promise<void> {
  await releaseDesignDraft(designId);
  const { error } = await supabase.from("kitchen_designs").delete().eq("id", designId);
  if (error) throw error;
}

/** Returns ms remaining until a draft auto-expires, or null when not draft. */
export function draftExpiresIn(row: KitchenDesignRow): number | null {
  if (!row.reserved_at) return null;
  const hasActiveOrder = (row.orders ?? []).some(
    (o) => o.status !== "cancelled" && o.status !== "auto_cancelled" && o.status !== "rejected"
  );
  if (hasActiveOrder) return null;
  const exp = new Date(row.reserved_at).getTime() + DRAFT_TTL_DAYS * 24 * 3600 * 1000;
  return exp - Date.now();
}

// =========== THEME FINISH CARDS (Admin-managed) ===========
export type FinishUnitCategory = "base" | "tall" | "wall";

export interface ThemeFinishRow {
  id: string;
  theme_id: string;
  unit_category: FinishUnitCategory;
  door_image_url: string | null;
  style_badge: string | null;
  front_code: string | null;
  carcase_code: string | null;
  range_name: string | null;
  material_description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export function useThemeFinishes() {
  return useQuery({
    queryKey: ["theme_finishes"],
    queryFn: async (): Promise<ThemeFinishRow[]> => {
      const { data, error } = await supabase
        .from("theme_finishes" as never)
        .select("*")
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as ThemeFinishRow[];
    },
  });
}

export function useUpsertThemeFinish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ThemeFinishRow> & { theme_id: string; unit_category: FinishUnitCategory }) => {
      const payload = {
        theme_id: input.theme_id,
        unit_category: input.unit_category,
        door_image_url: input.door_image_url ?? null,
        style_badge: input.style_badge ?? null,
        front_code: input.front_code ?? null,
        carcase_code: input.carcase_code ?? null,
        range_name: input.range_name ?? null,
        material_description: input.material_description ?? null,
        sort_order: input.sort_order ?? 0,
        is_active: input.is_active ?? true,
      };
      if (input.id) {
        const { error } = await supabase
          .from("theme_finishes" as never)
          .update(payload as never)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("theme_finishes" as never)
          .upsert(payload as never, { onConflict: "theme_id,unit_category" });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["theme_finishes"] }),
  });
}

export function useSoftDeleteThemeFinish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("theme_finishes" as never)
        .update({ is_active: false } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["theme_finishes"] }),
  });
}
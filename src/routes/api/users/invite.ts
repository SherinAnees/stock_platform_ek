import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type InviteBody = {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  job_title?: string | null;
  avatar_url?: string | null;
  role: "master_admin" | "stock_center_admin" | "store_keeper" | "designer_order_processor";
  stock_center_id: string | null;
  redirect_to?: string;
};

export const Route = createFileRoute("/api/users/invite")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return json({ error: "Unauthorized" }, 401);
        }
        const token = authHeader.slice("Bearer ".length);
        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;

        // 1. Verify caller identity + read their role scope with their JWT
        const userClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userErr } = await userClient.auth.getUser(token);
        if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);
        const callerId = userData.user.id;

        const { data: callerRoles } = await userClient
          .from("user_roles").select("role").eq("user_id", callerId);
        const roles = (callerRoles ?? []).map((r) => r.role as string);
        const isMaster = roles.includes("master_admin");
        const isSCA = roles.includes("stock_center_admin");
        if (!isMaster && !isSCA) return json({ error: "Forbidden" }, 403);

        const { data: callerProfile } = await userClient
          .from("profiles").select("stock_center_id").eq("id", callerId).maybeSingle();

        const body = (await request.json()) as InviteBody;
        if (!body.email || !body.first_name || !body.last_name || !body.role) {
          return json({ error: "Missing required fields" }, 400);
        }

        let targetCenter = body.stock_center_id;
        let targetRole = body.role;
        if (!isMaster) {
          if (!["store_keeper", "designer_order_processor"].includes(targetRole)) {
            return json({ error: "You may only invite Store Keeper or Designer / Order Processor" }, 403);
          }
          targetCenter = callerProfile?.stock_center_id ?? null;
        }
        if (targetRole !== "master_admin" && !targetCenter) {
          return json({ error: "Stock center is required" }, 400);
        }

        // 2. Use admin client to invite the user via email
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const invite = await supabaseAdmin.auth.admin.inviteUserByEmail(body.email, {
          data: {
            full_name: `${body.first_name} ${body.last_name}`.trim(),
            first_name: body.first_name,
            last_name: body.last_name,
            invited: true,
          },
          redirectTo: body.redirect_to,
        });
        if (invite.error || !invite.data.user) {
          return json({ error: invite.error?.message ?? "Invite failed" }, 400);
        }

        // 3. Finalize profile + role using the caller's JWT so auth.uid() is set
        const { error: finErr } = await userClient.rpc("admin_finalize_invited_user", {
          _user_id: invite.data.user.id,
          _email: body.email,
          _first_name: body.first_name,
          _last_name: body.last_name,
          _phone: body.phone ?? "",
          _job_title: body.job_title ?? "",
          _avatar_url: body.avatar_url ?? "",
          _role: targetRole,
          _stock_center_id: (targetRole === "master_admin" ? "" : targetCenter) as string,
        } as never);
        if (finErr) return json({ error: finErr.message }, 400);

        return json({ ok: true, user_id: invite.data.user.id });
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
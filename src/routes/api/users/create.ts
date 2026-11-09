import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type CreateBody = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  job_title?: string | null;
  avatar_url?: string | null;
  role: "master_admin" | "stock_center_admin" | "store_keeper" | "designer_order_processor";
  stock_center_id: string | null;
};

export const Route = createFileRoute("/api/users/create")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
        const token = authHeader.slice("Bearer ".length);
        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;

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
        if (!isMaster && !isSCA) {
          return json({ error: "Only Master Admin or Stock Center Admin can create users" }, 403);
        }

        const body = (await request.json()) as CreateBody;

        // Stock Center Admin restrictions: only two roles, forced to own center
        if (!isMaster && isSCA) {
          if (body.role !== "store_keeper" && body.role !== "designer_order_processor") {
            return json({ error: "You may only create Store Keeper or Designer / Order Processor" }, 403);
          }
          const { data: myProfile } = await userClient
            .from("profiles").select("stock_center_id").eq("id", callerId).maybeSingle();
          const myCenter = myProfile?.stock_center_id ?? null;
          if (!myCenter) return json({ error: "Your account has no stock center assigned" }, 403);
          body.stock_center_id = myCenter;
        }

        if (!body.email || !body.password || !body.first_name || !body.last_name || !body.role) {
          return json({ error: "Missing required fields" }, 400);
        }
        if (body.password.length < 8) {
          return json({ error: "Password must be at least 8 characters" }, 400);
        }
        if (body.role !== "master_admin" && !body.stock_center_id) {
          return json({ error: "Stock center is required" }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const created = await supabaseAdmin.auth.admin.createUser({
          email: body.email,
          password: body.password,
          email_confirm: true,
          user_metadata: {
            full_name: `${body.first_name} ${body.last_name}`.trim(),
            first_name: body.first_name,
            last_name: body.last_name,
          },
        });
        if (created.error || !created.data.user) {
          return json({ error: created.error?.message ?? "Create failed" }, 400);
        }

        const { error: finErr } = await userClient.rpc("admin_finalize_invited_user", {
          _user_id: created.data.user.id,
          _email: body.email,
          _first_name: body.first_name,
          _last_name: body.last_name,
          _phone: body.phone ?? "",
          _job_title: body.job_title ?? "",
          _avatar_url: body.avatar_url ?? "",
          _role: body.role,
          _stock_center_id: (body.role === "master_admin" ? "" : body.stock_center_id) as string,
        } as never);
        if (finErr) return json({ error: finErr.message }, 400);

        // Mark active (not pending) since password is set
        await supabaseAdmin
          .from("profiles")
          .update({ invitation_status: "active" })
          .eq("id", created.data.user.id);

        return json({ ok: true, user_id: created.data.user.id });
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
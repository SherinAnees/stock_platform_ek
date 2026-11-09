import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Body = { user_id: string; password: string };

export const Route = createFileRoute("/api/users/set-password")({
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

        const body = (await request.json()) as Body;
        if (!body.user_id || !body.password) return json({ error: "Missing fields" }, 400);
        if (body.password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);

        // Authorization: master_admin can reset anyone; SCA can reset SK/DOP in own center.
        const { data: allowed, error: permErr } = await userClient.rpc("can_manage_user", {
          _target_user_id: body.user_id,
        } as never);
        if (permErr) return json({ error: permErr.message }, 400);
        if (!allowed) return json({ error: "Not authorized to reset this user" }, 403);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const upd = await supabaseAdmin.auth.admin.updateUserById(body.user_id, {
          password: body.password,
        });
        if (upd.error) return json({ error: upd.error.message }, 400);

        return json({ ok: true });
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
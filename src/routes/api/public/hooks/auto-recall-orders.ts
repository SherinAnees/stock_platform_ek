import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily cron endpoint. Cancels draft/submitted orders inactive for >10 days,
 * releases their reservations, and flags stale designs as expired.
 * Authentication: callers must present the Supabase apikey header.
 */
export const Route = createFileRoute("/api/public/hooks/auto-recall-orders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("auto_recall_orders", { _days: 10 });
        if (error) {
          console.error("auto_recall_orders failed:", error);
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ ok: true, result: data }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
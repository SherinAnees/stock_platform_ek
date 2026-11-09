import { createFileRoute } from "@tanstack/react-router";

/**
 * POST { imageDataUrl: string } → { ok, detected, confidence, raw }
 *
 * Sends the uploaded reference photo to Lovable AI Gateway (Gemini vision)
 * and returns a structured JSON description of the kitchen cabinet, used to
 * pre-populate the manual 3D-model wizard.
 */
export const Route = createFileRoute("/api/analyze-cabinet-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return Response.json(
            { ok: false, error: "LOVABLE_API_KEY missing on server" },
            { status: 500 },
          );
        }

        let body: { imageDataUrl?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
        }
        const dataUrl = body.imageDataUrl;
        if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
          return Response.json(
            { ok: false, error: "imageDataUrl (data:image/...;base64,...) is required" },
            { status: 400 },
          );
        }

        const systemPrompt = `You are an expert kitchen cabinet analyst. Look at the uploaded photo of a kitchen cabinet / unit and extract its physical properties.

You MUST reply with ONLY a single JSON object, no prose, no markdown, no code fences. Use exactly these keys (unknown values → null):

{
  "unit_category": "base" | "wall" | "tall" | null,
  "sub_category": "standard" | "sink" | "hob" | "drawer" | "corner" | "l_corner" | "dishwasher_front" | "appliance_housing" | "filler" | "larder" | "oven_housing" | "fridge_housing" | "broom" | "corner_wall" | "open_shelf" | "glass_door" | "extractor_housing" | null,
  "overall_width_mm": number | null,
  "overall_height_mm": number | null,
  "overall_depth_mm": number | null,
  "num_doors": number | null,
  "door_layout": "side_by_side" | "stacked" | "grid" | null,
  "hinge_direction": ("left" | "right")[] | null,
  "handle_position": "top_edge" | "bottom_edge" | "left_edge" | "right_edge" | "centre" | "no_handle" | null,
  "handle_orientation": "horizontal" | "vertical" | "none" | null,
  "num_drawers": number | null,
  "drawer_positions": string[] | null,
  "has_plinth": boolean | null,
  "plinth_height_mm": number | null,
  "has_sink_cutout": boolean | null,
  "has_glass_doors": boolean | null,
  "corner_type": string | null,
  "confidence": number,
  "notes": string
}

Rules:
- Reasonable German/Express Küchen defaults: base ≈ 720×580mm deep, wall ≈ 370mm deep, tall ≈ 2100×580mm deep. Standard widths: 300/450/500/600/900/1000/1200mm.
- "confidence" is your overall certainty as a number between 0 and 1.
- "notes" is a short human sentence describing what you saw.
- Never wrap the JSON in \`\`\` fences. Never add commentary.`;

        const payload = {
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: "Analyse this kitchen cabinet photograph and return the JSON." },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        };

        let upstream: Response;
        try {
          upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": apiKey,
            },
            body: JSON.stringify(payload),
          });
        } catch (e) {
          return Response.json(
            { ok: false, error: `Vision gateway request failed: ${(e as Error).message}` },
            { status: 502 },
          );
        }

        const upstreamText = await upstream.text();
        if (!upstream.ok) {
          if (upstream.status === 429) {
            return Response.json(
              { ok: false, error: "Vision AI is rate-limited. Please try again in a moment." },
              { status: 429 },
            );
          }
          if (upstream.status === 402) {
            return Response.json(
              { ok: false, error: "Lovable AI credits exhausted. Add credits in Settings → Plans & credits." },
              { status: 402 },
            );
          }
          return Response.json(
            { ok: false, error: `Vision gateway error [${upstream.status}]: ${upstreamText.slice(0, 300)}` },
            { status: 502 },
          );
        }

        let content = "";
        try {
          const parsed = JSON.parse(upstreamText);
          content = parsed?.choices?.[0]?.message?.content ?? "";
        } catch {
          return Response.json(
            { ok: false, error: "Vision gateway returned invalid JSON envelope" },
            { status: 502 },
          );
        }

        // Extract JSON block from the model's reply (strip stray fences / prose).
        let cleaned = content.trim();
        const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fenceMatch) cleaned = fenceMatch[1].trim();
        const first = cleaned.indexOf("{");
        const last = cleaned.lastIndexOf("}");
        if (first !== -1 && last !== -1 && last > first) {
          cleaned = cleaned.slice(first, last + 1);
        }

        let detected: Record<string, unknown> | null = null;
        try {
          detected = JSON.parse(cleaned);
        } catch {
          return Response.json(
            { ok: false, error: "AI response was not valid JSON", raw: content },
            { status: 502 },
          );
        }

        return Response.json({
          ok: true,
          detected,
          confidence: typeof detected?.confidence === "number" ? detected.confidence : null,
        });
      },
    },
  },
});
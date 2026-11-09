import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, ArrowRight, Box, Check, GripHorizontal, Sparkles, Upload, Image as ImageIcon, Loader2, AlertTriangle, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useUpdateArticleIllustration,
  type Article,
} from "@/lib/data/queries";
import {
  registerCustomModule,
  type CustomModelConfig,
  type ModuleCategory,
  type HandlePosition,
  type FrontSection,
  type FrontSectionKind,
} from "@/lib/kitchen/modules";

interface Props {
  article: Article;
  open: boolean;
  onClose: () => void;
  /** When true, prefill state from article.model_config for editing. */
  edit?: boolean;
}

type Step = "upload" | "analyzing" | "ai_result" | 1 | 2 | 3;

interface AiDetected {
  unit_category?: "base" | "wall" | "tall" | null;
  sub_category?: string | null;
  overall_width_mm?: number | null;
  overall_height_mm?: number | null;
  overall_depth_mm?: number | null;
  num_doors?: number | null;
  door_layout?: "side_by_side" | "stacked" | "grid" | null;
  hinge_direction?: ("left" | "right")[] | null;
  handle_position?: "top_edge" | "bottom_edge" | "left_edge" | "right_edge" | "centre" | "no_handle" | null;
  handle_orientation?: "horizontal" | "vertical" | "none" | null;
  num_drawers?: number | null;
  drawer_positions?: string[] | null;
  has_plinth?: boolean | null;
  plinth_height_mm?: number | null;
  has_sink_cutout?: boolean | null;
  has_glass_doors?: boolean | null;
  corner_type?: string | null;
  confidence?: number | null;
  notes?: string | null;
}

type FrontLayout =
  | "auto"
  | "single_door"
  | "double_door"
  | "drawer_over_door"
  | "drawer_stack"
  | "blank_panel"
  | "horizontal_split";

const HANDLE_POSITIONS: Array<{ value: HandlePosition; label: string }> = [
  { value: "top_center", label: "Top — horizontally centered" },
  { value: "top_opposite_hinge", label: "Top — opposite hinge side" },
  { value: "vertical_top", label: "Vertical @ top (opposite hinge)" },
  { value: "vertical_middle", label: "Vertical @ middle" },
  { value: "bottom_center", label: "Bottom — centered" },
];

const SECTION_KINDS: Array<{ value: FrontSectionKind; label: string }> = [
  { value: "door_single", label: "Single door" },
  { value: "door_double", label: "Double doors" },
  { value: "drawer", label: "Drawer" },
  { value: "niche", label: "Open niche" },
];

const CATEGORY_OPTIONS: Array<{
  value: ModuleCategory;
  label: string;
  tag: string;
  hint: string;
  defaults: { w: number; h: number; d: number };
}> = [
  { value: "base",     label: "Base Unit",       tag: "BU", hint: "Sits on 120mm plinth, worktop on top",       defaults: { w: 600, h: 750, d: 580 } },
  { value: "wall",     label: "Wall Unit",       tag: "WU", hint: "Mounted so its top aligns with tall units",  defaults: { w: 600, h: 750, d: 370 } },
  { value: "tall",     label: "Tall Unit",       tag: "TU", hint: "Full-height column, 2100mm above plinth",    defaults: { w: 600, h: 2100, d: 580 } },
  { value: "panel",    label: "Filler / Plinth", tag: "PL", hint: "Slim decorative or filler panel",            defaults: { w: 100, h: 750, d: 50 } },
  { value: "appliance",label: "Appliance",       tag: "AP", hint: "Freestanding appliance placeholder",         defaults: { w: 600, h: 850, d: 600 } },
];

const CATEGORY_COLOR: Record<ModuleCategory, string> = {
  base:      "#e8dcc4",
  wall:      "#f0e6d2",
  tall:      "#e2d3b4",
  panel:     "#d9c9a8",
  appliance: "#c8c8c8",
  accessory: "#3a2c1f",
};

/**
 * Guided procedural 3D-model wizard for a new article.
 *
 * Flow:
 *   1. Category (BU / WU / TU / Panel / Appliance)
 *   2. Dimensions (mm) + hinge direction for single-door units
 *   3. Live Three.js preview + save
 *
 * On save we persist to `articles.model_config` and register the module in
 * the in-memory registry so the Designer can immediately place it.
 */
export function ModelWizard({ article, open, onClose, edit = false }: Props) {
  const existing = (article.model_config ?? null) as
    | (CustomModelConfig & { category?: ModuleCategory })
    | null;
  const initial = edit && existing
    ? {
        step: 2 as Step,
        category: (existing.category ?? "base") as ModuleCategory,
        w: existing.width_mm ?? 600,
        h: existing.height_mm ?? 750,
        d: existing.depth_mm ?? 580,
        hinge: (existing.hinge ?? "L") as "L" | "R",
        frontLayout: (existing.subtype ?? "auto") as FrontLayout,
        drawerH: existing.drawer_height_mm ?? 150,
        drawerHeights: (existing.drawer_heights_mm && existing.drawer_heights_mm.length > 0)
          ? existing.drawer_heights_mm
          : [150, 200, 200],
        sections: (existing.sections && existing.sections.length > 0)
          ? existing.sections
          : ([
              { kind: "door_single", height_mm: 1400, hinge: "L" },
              { kind: "niche", height_mm: 300 },
              { kind: "door_double", height_mm: 400 },
            ] as FrontSection[]),
        handlePosition: (existing.handle_position ?? "top_center") as HandlePosition,
      }
    : {
        step: "upload" as Step,
        category: "base" as ModuleCategory,
        w: 600,
        h: 750,
        d: 580,
        hinge: "L" as "L" | "R",
        frontLayout: "auto" as FrontLayout,
        drawerH: 150,
        drawerHeights: [150, 200, 200] as number[],
        sections: [
          { kind: "door_single", height_mm: 1400, hinge: "L" },
          { kind: "niche", height_mm: 300 },
          { kind: "door_double", height_mm: 400 },
        ] as FrontSection[],
        handlePosition: "top_center" as HandlePosition,
      };
  const [step, setStep] = useState<Step>(initial.step);
  const [category, setCategory] = useState<ModuleCategory>(initial.category);
  const [w, setW] = useState<number>(initial.w);
  const [h, setH] = useState<number>(initial.h);
  const [d, setD] = useState<number>(initial.d);
  const [hinge, setHinge] = useState<"L" | "R">(initial.hinge);
  const [frontLayout, setFrontLayout] = useState<FrontLayout>(initial.frontLayout);
  const [drawerH, setDrawerH] = useState<number>(initial.drawerH);
  const [drawerHeights, setDrawerHeights] = useState<number[]>(initial.drawerHeights);
  const [sections, setSections] = useState<FrontSection[]>(initial.sections);
  const [handlePosition, setHandlePosition] = useState<HandlePosition>(initial.handlePosition);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  // Reference image + AI vision state
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refDataUrl, setRefDataUrl] = useState<string | null>(
    (article.reference_image_url as string | null) ?? null,
  );
  const [refPublicUrl, setRefPublicUrl] = useState<string | null>(
    (article.reference_image_url as string | null) ?? null,
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDetected, setAiDetected] = useState<AiDetected | null>(
    (article.ai_detected_config as AiDetected | null) ?? null,
  );
  const [modelSource, setModelSource] = useState<"ai_auto" | "ai_refined" | "manual">(
    (article.model_source as "ai_auto" | "ai_refined" | "manual" | null) ?? "manual",
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const posRef = useRef(pos);
  useEffect(() => { posRef.current = pos; }, [pos]);
  const updateIllustration = useUpdateArticleIllustration();

  // Re-hydrate when the dialog opens for a different article or config changes.
  useEffect(() => {
    if (!open) return;
    setStep(initial.step);
    setCategory(initial.category);
    setW(initial.w);
    setH(initial.h);
    setD(initial.d);
    setHinge(initial.hinge);
    setFrontLayout(initial.frontLayout);
    setDrawerH(initial.drawerH);
    setDrawerHeights(initial.drawerHeights);
    setSections(initial.sections);
    setHandlePosition(initial.handlePosition);
    setSaved(false);
    setPos({ x: 0, y: 0 });
    setRefFile(null);
    setRefDataUrl((article.reference_image_url as string | null) ?? null);
    setRefPublicUrl((article.reference_image_url as string | null) ?? null);
    setAiDetected((article.ai_detected_config as AiDetected | null) ?? null);
    setAnalyzing(false);
    setAiError(null);
    setModelSource((article.model_source as "ai_auto" | "ai_refined" | "manual" | null) ?? "manual");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.id, open, edit]);

  const onDragStart = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, input, textarea, select")) return;
    e.preventDefault();
    e.stopPropagation();
    const start = { sx: e.clientX, sy: e.clientY, ox: posRef.current.x, oy: posRef.current.y };
    dragRef.current = start;
    const move = (ev: PointerEvent) => {
      setPos({ x: start.ox + (ev.clientX - start.sx), y: start.oy + (ev.clientY - start.sy) });
    };
    const end = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  const autoIsDouble = (category === "base" || category === "wall") && w >= 790;
  const isCabinet = category === "base" || category === "wall" || category === "tall";
  const resolvedLayout: CustomModelConfig["subtype"] =
    category === "panel"
      ? "blank_panel"
      : frontLayout !== "auto"
        ? frontLayout
        : autoIsDouble
          ? "double_door"
          : "single_door";
  const isDouble = resolvedLayout === "double_door";
  const isDrawerOverDoor = resolvedLayout === "drawer_over_door";
  const isDrawerStack = resolvedLayout === "drawer_stack";
  const isHorizontalSplit = resolvedLayout === "horizontal_split";
  const supportsHSplit = category === "wall" || category === "tall";
  const drawerSum = drawerHeights.reduce((a, b) => a + (Number(b) || 0), 0);
  const drawerRemaining = h - drawerSum;
  const sectionSum = sections.reduce((a, s) => a + (Number(s.height_mm) || 0), 0);
  const sectionRemaining = h - sectionSum;

  const config: CustomModelConfig = useMemo(() => ({
    subtype: resolvedLayout,
    width_mm: Math.round(w),
    height_mm: Math.round(h),
    depth_mm: Math.round(d),
    hinge: isDouble || isHorizontalSplit ? undefined : hinge,
    drawer_height_mm: isDrawerOverDoor ? Math.round(drawerH) : undefined,
    drawer_heights_mm: isDrawerStack ? drawerHeights.map((n) => Math.round(n)) : undefined,
    sections: isHorizontalSplit
      ? sections.map((s) => ({ ...s, height_mm: Math.round(s.height_mm) }))
      : undefined,
    handle_position: isCabinet ? handlePosition : undefined,
  }), [resolvedLayout, w, h, d, hinge, isDouble, isHorizontalSplit, isDrawerOverDoor, drawerH, isDrawerStack, drawerHeights, sections, handlePosition, isCabinet]);

  const pickCategory = (cat: ModuleCategory) => {
    setCategory(cat);
    const defs = CATEGORY_OPTIONS.find((c) => c.value === cat)!.defaults;
    setW(defs.w);
    setH(defs.h);
    setD(defs.d);
  };

  const reset = () => {
    setStep(1);
    setCategory("base");
    setW(600);
    setH(750);
    setD(580);
    setHinge("L");
    setFrontLayout("auto");
    setDrawerH(150);
    setDrawerHeights([150, 200, 200]);
    setSections([
      { kind: "door_single", height_mm: 1400, hinge: "L" },
      { kind: "niche", height_mm: 300 },
      { kind: "door_double", height_mm: 400 },
    ]);
    setHandlePosition("top_center");
    setSaved(false);
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  // ---------- Reference image + AI vision helpers ----------

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result ?? ""));
      r.onerror = () => reject(new Error("Could not read file"));
      r.readAsDataURL(file);
    });

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file (PNG, JPG, WEBP).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image is too large — max 8 MB.");
      return;
    }
    setRefFile(file);
    setAiError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setRefDataUrl(dataUrl);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const uploadReference = async (): Promise<string | null> => {
    if (!refFile) return refPublicUrl;
    try {
      const ext = (refFile.name.split(".").pop() || "png").toLowerCase();
      const path = `${article.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("article-references")
        .upload(path, refFile, { upsert: true, contentType: refFile.type });
      if (upErr) throw upErr;
      // Bucket is private — use a long-lived signed URL for display.
      const { data: signed, error: sErr } = await supabase.storage
        .from("article-references")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr) throw sErr;
      setRefPublicUrl(signed?.signedUrl ?? null);
      return signed?.signedUrl ?? null;
    } catch (e) {
      // Non-fatal — analysis can still proceed from the local data URL.
      console.warn("[ModelWizard] reference upload failed", e);
      return null;
    }
  };

  const applyAiDetection = (det: AiDetected) => {
    if (det.unit_category === "base" || det.unit_category === "wall" || det.unit_category === "tall") {
      pickCategory(det.unit_category);
    }
    if (typeof det.overall_width_mm === "number" && det.overall_width_mm >= 100) setW(det.overall_width_mm);
    if (typeof det.overall_height_mm === "number" && det.overall_height_mm >= 100) setH(det.overall_height_mm);
    if (typeof det.overall_depth_mm === "number" && det.overall_depth_mm >= 100) setD(det.overall_depth_mm);
    // Front layout heuristics
    const nd = det.num_drawers ?? 0;
    const doors = det.num_doors ?? 0;
    if (nd >= 2 && doors === 0) {
      setFrontLayout("drawer_stack");
      const per = Math.max(100, Math.round(((det.overall_height_mm ?? h) - 10) / nd));
      setDrawerHeights(Array.from({ length: Math.min(8, nd) }, () => per));
    } else if (nd === 1 && doors >= 1) {
      setFrontLayout("drawer_over_door");
      setDrawerH(150);
    } else if (doors >= 2) {
      setFrontLayout("double_door");
    } else if (doors === 1) {
      setFrontLayout("single_door");
      const hd = det.hinge_direction?.[0];
      if (hd === "left") setHinge("L");
      if (hd === "right") setHinge("R");
    }
    // Handle position
    if (det.handle_orientation === "vertical") setHandlePosition("vertical_top");
    else if (det.handle_position === "top_edge") setHandlePosition("top_center");
    else if (det.handle_position === "bottom_edge") setHandlePosition("bottom_center");
  };

  const analyzeReferenceImage = async () => {
    if (!refDataUrl) {
      toast.error("Please upload a reference image first.");
      return;
    }
    setAiError(null);
    setAnalyzing(true);
    setStep("analyzing");
    // Upload in the background — analysis uses the data URL directly.
    uploadReference().catch(() => null);
    try {
      const res = await fetch("/api/analyze-cabinet-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: refDataUrl }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error || `Vision failed [${res.status}]`);
      }
      const det = json.detected as AiDetected;
      setAiDetected(det);
      applyAiDetection(det);
      setModelSource("ai_auto");
      setStep("ai_result");
    } catch (e) {
      setAiError((e as Error).message);
      setStep("upload");
      toast.error((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };

  const refineManually = () => {
    setModelSource("ai_refined");
    setStep(2);
  };

  const skipAiGoManual = () => {
    setModelSource("manual");
    setStep(1);
  };

  const save = async () => {
    if (w < 50 || h < 50 || d < 20) {
      toast.error("Dimensions look off — check the values (mm).");
      return;
    }
    if (isDrawerStack) {
      if (drawerHeights.length < 1) {
        toast.error("Add at least one drawer.");
        return;
      }
      if (drawerHeights.some((n) => !n || n < 50)) {
        toast.error("Each drawer must be at least 50mm.");
        return;
      }
      if (Math.abs(drawerSum - h) > 5) {
        toast.error(`Drawer heights sum to ${drawerSum}mm but unit is ${h}mm — adjust to match.`);
        return;
      }
    }
    if (isHorizontalSplit) {
      if (sections.length < 1) {
        toast.error("Add at least one section.");
        return;
      }
      if (sections.some((s) => !s.height_mm || s.height_mm < 50)) {
        toast.error("Each section must be at least 50mm.");
        return;
      }
      if (Math.abs(sectionSum - h) > 5) {
        toast.error(`Section heights sum to ${sectionSum}mm but unit is ${h}mm — adjust to match.`);
        return;
      }
    }
    setBusy(true);
    try {
      // Persist first, then register locally so a page refresh keeps the model.
      await updateIllustration.mutateAsync({
        id: article.id,
        status: "model_ready",
        model_config: { ...config, category } as Record<string, unknown>,
        reference_image_url: refPublicUrl ?? undefined,
        ai_detected_config: (aiDetected as Record<string, unknown> | null) ?? undefined,
        model_source: modelSource,
      });
      registerCustomModule({
        articleCode: article.code,
        articleName: article.name,
        category,
        price: Number(article.unit_price ?? 0),
        config,
      });
      toast.success(`${article.code} — 3D model saved`);
      setSaved(true);
      setStep(3);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const acceptAiAndSave = async () => {
    setModelSource("ai_auto");
    // Ensure the reference image is uploaded before we persist the article.
    if (refFile && !refPublicUrl) {
      await uploadReference();
    }
    await save();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto top-4 translate-y-0 data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2"
        style={{
          top: `${16 + pos.y}px`,
          left: `50%`,
          transform: `translateX(calc(-50% + ${pos.x}px))`,
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div
          onPointerDown={onDragStart}
          className="-m-6 mb-0 px-6 pt-6 pb-2 cursor-move select-none"
          title="Drag to move"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GripHorizontal className="h-4 w-4 text-muted-foreground" />
              <Sparkles className="h-4 w-4 text-primary" />
              {edit ? "Edit 3D Model" : "3D Model Wizard"}
              <Badge variant="outline" className="font-mono text-[10px]">
                {article.code}
              </Badge>
              {saved && (
                <Badge className="ml-2 bg-emerald-600 hover:bg-emerald-600 text-white text-[10px]">
                  Saved ✓
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>{article.name}</DialogDescription>
          </DialogHeader>
        </div>

        {/* Stepper (only visible during manual steps 1–3) */}
        {typeof step === "number" && (
        <div className="flex items-center gap-2 text-[11px] pb-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <div
                className={
                  "h-6 w-6 rounded-full grid place-items-center text-[11px] font-semibold " +
                  (step === n
                    ? "bg-primary text-primary-foreground"
                    : (step as number) > n
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground")
                }
              >
                {(step as number) > n ? <Check className="h-3 w-3" /> : n}
              </div>
              <span className={step === n ? "text-foreground font-medium" : "text-muted-foreground"}>
                {n === 1 ? "Category" : n === 2 ? "Dimensions" : "Preview"}
              </span>
              {n < 3 && <span className="text-muted-foreground/40 mx-1">›</span>}
            </div>
          ))}
        </div>
        )}

        {step === "upload" && (
          <div className="py-1 space-y-3">
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 flex items-start gap-2">
              <Wand2 className="h-4 w-4 text-primary mt-0.5" />
              <div className="text-xs leading-relaxed">
                <div className="font-semibold text-primary">AI-powered 3D setup</div>
                <div className="text-muted-foreground">
                  Upload a photo of the cabinet and Lovable AI will read its category,
                  dimensions, doors, drawers and handles — then pre-fill the wizard.
                </div>
              </div>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false);
                const f = e.dataTransfer.files?.[0]; if (f) onPickFile(f);
              }}
              className={
                "rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition " +
                (dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")
              }
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
              {refDataUrl ? (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={refDataUrl}
                    alt="Reference"
                    className="max-h-52 rounded border border-border shadow-sm"
                  />
                  <div className="text-[11px] text-muted-foreground">
                    Click to replace, or drop a new image
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-8 w-8" />
                  <div className="text-sm font-medium text-foreground">Drop image or click to browse</div>
                  <div className="text-[11px]">PNG, JPG, WEBP · up to 8 MB</div>
                </div>
              )}
            </div>

            {aiError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive flex gap-2 items-start">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <span>{aiError}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 justify-between pt-1">
              <Button variant="outline" size="sm" onClick={skipAiGoManual}>
                Skip — build manually
              </Button>
              <Button size="sm" disabled={!refDataUrl || analyzing} onClick={analyzeReferenceImage}>
                <Sparkles className="h-4 w-4 mr-1" />
                Analyse with AI
              </Button>
            </div>
          </div>
        )}

        {step === "analyzing" && (
          <div className="py-10 flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-sm font-medium">Analysing reference image…</div>
            <div className="text-xs text-muted-foreground max-w-sm">
              Lovable AI is reading the cabinet's category, dimensions, doors,
              drawers and handle placement. This usually takes 5–15 seconds.
            </div>
          </div>
        )}

        {step === "ai_result" && aiDetected && (
          <div className="py-1 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Your reference
              </div>
              {refDataUrl && (
                <img
                  src={refDataUrl}
                  alt="Reference"
                  className="w-full max-h-72 object-contain rounded border border-border shadow-sm bg-muted/30"
                />
              )}
              {typeof aiDetected.confidence === "number" && (
                <div className="text-[11px] text-muted-foreground">
                  AI confidence: <span className="font-mono">{Math.round((aiDetected.confidence ?? 0) * 100)}%</span>
                </div>
              )}
              {aiDetected.notes && (
                <div className="text-[11px] italic text-muted-foreground border-l-2 border-primary/30 pl-2">
                  “{aiDetected.notes}”
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" /> AI-detected setup
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Info label="Category" value={String(aiDetected.unit_category ?? "—")} />
                <Info label="Subcategory" value={String(aiDetected.sub_category ?? "—")} />
                <Info label="Width mm" value={String(aiDetected.overall_width_mm ?? "—")} />
                <Info label="Height mm" value={String(aiDetected.overall_height_mm ?? "—")} />
                <Info label="Depth mm" value={String(aiDetected.overall_depth_mm ?? "—")} />
                <Info label="Doors" value={String(aiDetected.num_doors ?? "—")} />
                <Info label="Drawers" value={String(aiDetected.num_drawers ?? "—")} />
                <Info label="Handle" value={`${aiDetected.handle_position ?? "—"} / ${aiDetected.handle_orientation ?? "—"}`} />
              </div>
              <div className="text-[11px] text-muted-foreground pt-1">
                Values above have been pre-filled into the wizard. Accept to save
                as-is, or refine any detail before saving.
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" onClick={acceptAiAndSave} disabled={busy}>
                  <Check className="h-4 w-4 mr-1" />
                  Accept &amp; save
                </Button>
                <Button size="sm" variant="secondary" onClick={refineManually}>
                  Refine in wizard
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setStep("upload")}>
                  Try another image
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 py-1">
            {CATEGORY_OPTIONS.map((c) => {
              const active = c.value === category;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => pickCategory(c.value)}
                  className={
                    "text-left rounded-lg border p-3 transition " +
                    (active
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-accent")
                  }
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-6 w-6 rounded-sm border border-border/60"
                      style={{ background: CATEGORY_COLOR[c.value] }}
                    />
                    <span className="font-medium">{c.label}</span>
                    <Badge variant="outline" className="ml-auto font-mono text-[9px]">
                      {c.tag}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{c.hint}</p>
                </button>
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-[11px] uppercase tracking-wider">Width (mm)</Label>
                <Input
                  type="number"
                  value={w}
                  onChange={(e) => setW(Number(e.target.value) || 0)}
                  min={50}
                  max={3200}
                />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider">Height (mm)</Label>
                <Input
                  type="number"
                  value={h}
                  onChange={(e) => setH(Number(e.target.value) || 0)}
                  min={50}
                  max={2400}
                />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider">Depth (mm)</Label>
                <Input
                  type="number"
                  value={d}
                  onChange={(e) => setD(Number(e.target.value) || 0)}
                  min={20}
                  max={1200}
                />
              </div>
            </div>

            {isCabinet && !isDouble && category !== "tall" && (
              <div>
                <Label className="text-[11px] uppercase tracking-wider">Hinge Side</Label>
                <RadioGroup
                  value={hinge}
                  onValueChange={(v) => setHinge(v as "L" | "R")}
                  className="flex gap-4 mt-2"
                >
                  <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value="L" /> Left
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value="R" /> Right
                  </label>
                </RadioGroup>
              </div>
            )}

            {isCabinet && (
              <div>
                <Label className="text-[11px] uppercase tracking-wider">Front Layout</Label>
                <RadioGroup
                  value={frontLayout}
                  onValueChange={(v) => setFrontLayout(v as FrontLayout)}
                  className="grid grid-cols-2 gap-2 mt-2"
                >
                  <label className="inline-flex items-center gap-2 text-sm cursor-pointer rounded-md border border-border p-2">
                    <RadioGroupItem value="auto" /> Auto (by width)
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm cursor-pointer rounded-md border border-border p-2">
                    <RadioGroupItem value="single_door" /> Single door
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm cursor-pointer rounded-md border border-border p-2">
                    <RadioGroupItem value="double_door" /> Double doors
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm cursor-pointer rounded-md border border-border p-2">
                    <RadioGroupItem value="drawer_over_door" /> Drawer on top + door below
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm cursor-pointer rounded-md border border-border p-2 col-span-2">
                    <RadioGroupItem value="drawer_stack" /> Multiple drawers (stack)
                  </label>
                  {supportsHSplit && (
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer rounded-md border border-border p-2 col-span-2">
                      <RadioGroupItem value="horizontal_split" /> Fronts split horizontally (doors + niches)
                    </label>
                  )}
                </RadioGroup>
              </div>
            )}

            {isDrawerOverDoor && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-[11px] uppercase tracking-wider">Drawer height (mm)</Label>
                  <Input
                    type="number"
                    value={drawerH}
                    onChange={(e) => setDrawerH(Number(e.target.value) || 0)}
                    min={50}
                    max={Math.max(50, h - 100)}
                  />
                </div>
                <div className="col-span-2 self-end text-[11px] text-muted-foreground">
                  Door height auto-calculated: {Math.max(0, h - drawerH - 4)} mm
                </div>
              </div>
            )}

            {isDrawerStack && (
              <div className="rounded-md border border-border p-3 space-y-3 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] uppercase tracking-wider">Number of drawers</Label>
                  <Input
                    type="number"
                    value={drawerHeights.length}
                    min={1}
                    max={8}
                    className="w-20 h-8"
                    onChange={(e) => {
                      const n = Math.max(1, Math.min(8, Number(e.target.value) || 1));
                      setDrawerHeights((prev) => {
                        if (n === prev.length) return prev;
                        if (n < prev.length) return prev.slice(0, n);
                        // Add new drawers using the remaining height evenly
                        const currentSum = prev.reduce((a, b) => a + b, 0);
                        const remaining = Math.max(0, h - currentSum);
                        const add = n - prev.length;
                        const per = Math.max(50, Math.round(remaining / add));
                        return [...prev, ...Array(add).fill(per)];
                      });
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 ml-auto"
                    onClick={() => {
                      // Distribute total height evenly across the current count
                      const n = drawerHeights.length;
                      const per = Math.floor(h / n);
                      const rest = h - per * (n - 1);
                      setDrawerHeights([...Array(n - 1).fill(per), rest]);
                    }}
                  >
                    Distribute evenly
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {drawerHeights.map((val, i) => (
                    <div key={i}>
                      <Label className="text-[11px] uppercase tracking-wider">
                        Drawer {i + 1} height (mm) <span className="text-muted-foreground normal-case">{i === 0 ? "top" : i === drawerHeights.length - 1 ? "bottom" : ""}</span>
                      </Label>
                      <Input
                        type="number"
                        value={val}
                        min={50}
                        onChange={(e) => {
                          const n = Number(e.target.value) || 0;
                          setDrawerHeights((prev) => prev.map((p, idx) => (idx === i ? n : p)));
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div
                  className={
                    "text-[11px] " +
                    (Math.abs(drawerRemaining) <= 5
                      ? "text-emerald-600"
                      : drawerRemaining < 0
                        ? "text-destructive"
                        : "text-amber-600")
                  }
                >
                  Sum: {drawerSum} mm / {h} mm ·{" "}
                  {Math.abs(drawerRemaining) <= 5
                    ? "matches unit height ✓"
                    : drawerRemaining > 0
                      ? `${drawerRemaining} mm remaining — add height to another drawer`
                      : `${-drawerRemaining} mm over — reduce a drawer`}
                </div>
              </div>
            )}

            {isHorizontalSplit && (
              <div className="rounded-md border border-border p-3 space-y-3 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] uppercase tracking-wider">Number of sections</Label>
                  <Input
                    type="number"
                    value={sections.length}
                    min={1}
                    max={8}
                    className="w-20 h-8"
                    onChange={(e) => {
                      const n = Math.max(1, Math.min(8, Number(e.target.value) || 1));
                      setSections((prev) => {
                        if (n === prev.length) return prev;
                        if (n < prev.length) return prev.slice(0, n);
                        const currentSum = prev.reduce((a, s) => a + s.height_mm, 0);
                        const remaining = Math.max(0, h - currentSum);
                        const add = n - prev.length;
                        const per = Math.max(50, Math.round(remaining / add));
                        const extras: FrontSection[] = Array.from({ length: add }, () => ({
                          kind: "door_single" as FrontSectionKind,
                          height_mm: per,
                          hinge: "L" as const,
                        }));
                        return [...prev, ...extras];
                      });
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 ml-auto"
                    onClick={() => {
                      const n = sections.length;
                      const per = Math.floor(h / n);
                      const rest = h - per * (n - 1);
                      setSections((prev) =>
                        prev.map((s, i) => ({ ...s, height_mm: i === n - 1 ? rest : per })),
                      );
                    }}
                  >
                    Distribute evenly
                  </Button>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Sections stack bottom → top. Use "Open niche" for an aperture with no front.
                </div>
                <div className="space-y-2">
                  {sections.map((s, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-12 gap-2 items-end rounded border border-border/60 bg-background p-2"
                    >
                      <div className="col-span-1 text-[10px] text-muted-foreground pb-2">
                        #{sections.length - i}
                        <div className="text-[9px]">{i === 0 ? "bottom" : i === sections.length - 1 ? "top" : ""}</div>
                      </div>
                      <div className="col-span-4">
                        <Label className="text-[10px] uppercase tracking-wider">Type</Label>
                        <select
                          className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                          value={s.kind}
                          onChange={(e) =>
                            setSections((prev) =>
                              prev.map((p, idx) =>
                                idx === i ? { ...p, kind: e.target.value as FrontSectionKind } : p,
                              ),
                            )
                          }
                        >
                          {SECTION_KINDS.map((k) => (
                            <option key={k.value} value={k.value}>{k.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-[10px] uppercase tracking-wider">Height (mm)</Label>
                        <Input
                          type="number"
                          value={s.height_mm}
                          min={50}
                          onChange={(e) => {
                            const n = Number(e.target.value) || 0;
                            setSections((prev) =>
                              prev.map((p, idx) => (idx === i ? { ...p, height_mm: n } : p)),
                            );
                          }}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-[10px] uppercase tracking-wider">Hinge</Label>
                        <select
                          disabled={s.kind !== "door_single"}
                          className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-40"
                          value={s.hinge ?? "L"}
                          onChange={(e) =>
                            setSections((prev) =>
                              prev.map((p, idx) =>
                                idx === i ? { ...p, hinge: e.target.value as "L" | "R" } : p,
                              ),
                            )
                          }
                        >
                          <option value="L">Left</option>
                          <option value="R">Right</option>
                        </select>
                      </div>
                      <div className="col-span-3">
                        <Label className="text-[10px] uppercase tracking-wider">Handle</Label>
                        <select
                          disabled={s.kind === "niche"}
                          className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-40"
                          value={s.handle ?? handlePosition}
                          onChange={(e) =>
                            setSections((prev) =>
                              prev.map((p, idx) =>
                                idx === i ? { ...p, handle: e.target.value as HandlePosition } : p,
                              ),
                            )
                          }
                        >
                          {HANDLE_POSITIONS.map((h) => (
                            <option key={h.value} value={h.value}>{h.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  className={
                    "text-[11px] " +
                    (Math.abs(sectionRemaining) <= 5
                      ? "text-emerald-600"
                      : sectionRemaining < 0
                        ? "text-destructive"
                        : "text-amber-600")
                  }
                >
                  Sum: {sectionSum} mm / {h} mm ·{" "}
                  {Math.abs(sectionRemaining) <= 5
                    ? "matches unit height ✓"
                    : sectionRemaining > 0
                      ? `${sectionRemaining} mm remaining`
                      : `${-sectionRemaining} mm over`}
                </div>
              </div>
            )}

            {isCabinet && (
              <div>
                <Label className="text-[11px] uppercase tracking-wider">Default Handle Position</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm mt-1"
                  value={handlePosition}
                  onChange={(e) => {
                    const next = e.target.value as HandlePosition;
                    setHandlePosition(next);
                    setSections((prev) =>
                      prev.map((section) =>
                        section.kind === "niche" ? section : { ...section, handle: next },
                      ),
                    );
                  }}
                >
                  {HANDLE_POSITIONS.map((h) => (
                    <option key={h.value} value={h.value}>{h.label}</option>
                  ))}
                </select>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Applied to every front unless overridden per section in a horizontal split.
                </div>
              </div>
            )}

            <div className="rounded-md border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground">
              <div className="font-medium text-foreground mb-1">
                Layout: {resolvedLayout === "double_door" ? "Double doors" : resolvedLayout === "drawer_over_door" ? `Drawer (${drawerH}mm) + door` : resolvedLayout === "drawer_stack" ? `${drawerHeights.length} drawers` : resolvedLayout === "horizontal_split" ? `${sections.length} horizontal sections` : resolvedLayout === "blank_panel" ? "Blank panel" : category === "appliance" ? "Appliance" : "Single door"}
              </div>
              {isCabinet && (
                <div>
                  Choose "Auto" to let width decide (≥ 800mm → double doors), or pick a specific layout above.
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-3 py-1">
            {(() => {
              const wM = w / 1000, hM = h / 1000, dM = d / 1000;
              const maxDim = Math.max(wM, hM, dM);
              const dist = Math.max(2.2, maxDim * 2.6);
              const camY = Math.max(1.0, hM * 0.65 + 0.35);
              return (
                <div className="h-[460px] w-full rounded-lg overflow-hidden border border-border bg-gradient-to-b from-muted/40 to-background">
                  <Canvas shadows camera={{ position: [dist * 0.7, camY, dist], fov: 40 }}>
                    <Suspense fallback={null}>
                      <ambientLight intensity={0.55} />
                      <directionalLight position={[3, 4, 2]} intensity={0.9} castShadow />
                      <PreviewModule config={config} category={category} />
                      <ContactShadows opacity={0.35} scale={6} blur={2.2} far={2} />
                      <Environment preset="warehouse" />
                      <OrbitControls
                        enablePan={false}
                        target={[0, hM / 2, 0]}
                        minDistance={1.0}
                        maxDistance={Math.max(5, maxDim * 5)}
                      />
                    </Suspense>
                  </Canvas>
                </div>
              );
            })()}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <Info label="Category" value={CATEGORY_OPTIONS.find((c) => c.value === category)?.label ?? ""} />
              <Info label="Width" value={`${w} mm`} />
              <Info label="Height" value={`${h} mm`} />
              <Info label="Depth" value={`${d} mm`} />
              <Info label="Layout" value={config.subtype.replace("_", " ")} />
              {config.hinge && <Info label="Hinge" value={config.hinge === "L" ? "Left" : "Right"} />}
              <Info label="Article Code" value={article.code} />
            </div>
          </div>
        )}

        <DialogFooter className="justify-between sm:justify-between">
          <Button variant="outline" onClick={close} disabled={busy}>
            {saved ? "Close" : "Cancel"}
          </Button>
          <div className="flex gap-2">
            {typeof step === "number" && step > 1 && (
              <Button
                variant="outline"
                onClick={() => setStep(((step as number) - 1) as Step)}
                disabled={busy}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            {step === 2 && (
              <Button variant="secondary" onClick={save} disabled={busy}>
                <Box className="h-4 w-4 mr-1" />
                {busy ? "Saving…" : "Save 3D Model"}
              </Button>
            )}
            {typeof step === "number" && step < 3 && (
              <Button onClick={() => setStep(((step as number) + 1) as Step)}>
                {step === 2 ? "Preview" : "Next"}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={save} disabled={busy}>
                <Box className="h-4 w-4 mr-1" />
                {busy ? "Saving…" : saved ? "Save changes" : "Save 3D Model"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-[11px] truncate">{value}</div>
    </div>
  );
}

/**
 * Simplified procedural preview. Mirrors the generic-cabinet path in
 * `Module3D.tsx` so what you see here is what you'll get on the design plane.
 */
function PreviewModule({
  config,
  category,
}: {
  config: CustomModelConfig;
  category: ModuleCategory;
}) {
  const w = config.width_mm / 1000;
  const h = config.height_mm / 1000;
  const d = config.depth_mm / 1000;
  const isCabinet = category === "base" || category === "wall" || category === "tall";
  const isPanel = category === "panel";
  const isDouble = config.subtype === "double_door";
  const isDrawerOverDoor = config.subtype === "drawer_over_door";
  const isDrawerStack = config.subtype === "drawer_stack";
  const isHSplit = config.subtype === "horizontal_split";
  const body = CATEGORY_COLOR[category];
  const front = isCabinet ? "#e8dcc4" : body;
  const handle = "#a8a8ac";
  const worktop = "#2b2a28";

  const doors = isCabinet && !isPanel ? (
    isHSplit && config.sections && config.sections.length > 0 ? (() => {
      const gap = 0.004;
      const secs = config.sections!;
      const heightsM = secs.map((s) => Math.max(0.02, s.height_mm / 1000));
      const innerH = h - 0.01 - gap * (secs.length - 1);
      const sum = heightsM.reduce((a, b) => a + b, 0);
      const scale = sum > 0 ? innerH / sum : 1;
      let cursor = 0.005;
      const items = secs.map((s, i) => {
        const hh = heightsM[i] * scale;
        const y = cursor + hh / 2;
        cursor += hh + gap;
        return { s, y, h: hh };
      });
      return (
        <>
          {items.map((it, i) => {
            if (it.s.kind === "niche") {
              const T = 0.018;
              const inner = w - 0.02;
              return (
                <group key={i}>
                  {/* Dark recess */}
                  <mesh position={[0, it.y, d / 2 - 0.09]}>
                    <boxGeometry args={[inner, it.h - 2 * T, 0.002]} />
                    <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
                  </mesh>
                  {/* Bottom shelf */}
                  <mesh position={[0, it.y - it.h / 2 + T / 2, d / 2 - 0.045]} castShadow>
                    <boxGeometry args={[inner, T, 0.09]} />
                    <meshStandardMaterial color={body} roughness={0.7} />
                  </mesh>
                  {/* Top shelf */}
                  <mesh position={[0, it.y + it.h / 2 - T / 2, d / 2 - 0.045]} castShadow>
                    <boxGeometry args={[inner, T, 0.09]} />
                    <meshStandardMaterial color={body} roughness={0.7} />
                  </mesh>
                </group>
              );
            }
            if (it.s.kind === "door_double") {
              const reveal = 0.004;
              const leafW = (w - 0.01 - reveal) / 2;
              return (
                <group key={i}>
                  <mesh position={[-(leafW + reveal) / 2, it.y, d / 2 + 0.001]} castShadow>
                    <boxGeometry args={[leafW, it.h, 0.018]} />
                    <meshStandardMaterial color={front} roughness={0.55} metalness={0.05} />
                  </mesh>
                  <mesh position={[(leafW + reveal) / 2, it.y, d / 2 + 0.001]} castShadow>
                    <boxGeometry args={[leafW, it.h, 0.018]} />
                    <meshStandardMaterial color={front} roughness={0.55} metalness={0.05} />
                  </mesh>
                </group>
              );
            }
            return (
              <mesh key={i} position={[0, it.y, d / 2 + 0.001]} castShadow>
                <boxGeometry args={[w - 0.01, it.h, 0.018]} />
                <meshStandardMaterial color={front} roughness={0.55} metalness={0.05} />
              </mesh>
            );
          })}
          {items.map((it, i) => {
            if (it.s.kind === "niche") return null;
            const yBottom = it.y - it.h / 2;
            const yTop = it.y + it.h / 2;
            const hp = it.s.handle ?? config.handle_position;
            if (it.s.kind === "door_double") {
              const reveal = 0.004;
              const leafW = (w - 0.01 - reveal) / 2;
              const off = (leafW + reveal) / 2;
              return (
                <group key={`h-${i}`}>
                  {renderPreviewHandle(`hl-${i}`, hp, { xCenter: -off, yBottom, yTop, doorW: leafW, z: d / 2 + 0.014, hinge: "R" })}
                  {renderPreviewHandle(`hr-${i}`, hp, { xCenter: off, yBottom, yTop, doorW: leafW, z: d / 2 + 0.014, hinge: "L" })}
                </group>
              );
            }
            return renderPreviewHandle(`h-${i}`, hp, { xCenter: 0, yBottom, yTop, doorW: w - 0.01, z: d / 2 + 0.014, hinge: it.s.hinge });
          })}
        </>
      );
    })() :
    isDrawerStack && config.drawer_heights_mm && config.drawer_heights_mm.length > 0 ? (() => {
      const gap = 0.004;
      const heightsM = config.drawer_heights_mm!.map((mm) => Math.max(0.02, mm / 1000));
      const innerH = h - 0.01 - gap * (heightsM.length - 1);
      const sum = heightsM.reduce((a, b) => a + b, 0);
      const scale = sum > 0 ? innerH / sum : 1;
      const hs = heightsM.map((v) => v * scale);
      let cursor = 0.005;
      const drawers = hs.map((hh) => {
        const y = cursor + hh / 2;
        cursor += hh + gap;
        return { y, h: hh };
      });
      return (
        <>
          {drawers.map((dr, i) => (
            <group key={i}>
              <mesh position={[0, dr.y, d / 2 + 0.001]} castShadow>
                <boxGeometry args={[w - 0.01, dr.h, 0.018]} />
                <meshStandardMaterial color={front} roughness={0.55} metalness={0.05} />
              </mesh>
              {renderPreviewHandle(`drawer-${i}`, config.handle_position, {
                xCenter: 0,
                yBottom: dr.y - dr.h / 2,
                yTop: dr.y + dr.h / 2,
                doorW: w - 0.01,
                z: d / 2 + 0.014,
              })}
            </group>
          ))}
        </>
      );
    })() :
    isDrawerOverDoor ? (() => {
      const gap = 0.004;
      const drawerH = Math.max(0.05, (config.drawer_height_mm ?? 150) / 1000);
      const innerH = h - 0.01;
      const doorH = Math.max(0.05, innerH - drawerH - gap);
      const yDoor = 0.005 + doorH / 2;
      const yDrawer = 0.005 + doorH + gap + drawerH / 2;
      return (
        <>
          <mesh position={[0, yDoor, d / 2 + 0.001]} castShadow>
            <boxGeometry args={[w - 0.01, doorH, 0.018]} />
            <meshStandardMaterial color={front} roughness={0.55} metalness={0.05} />
          </mesh>
          <mesh position={[0, yDrawer, d / 2 + 0.001]} castShadow>
            <boxGeometry args={[w - 0.01, drawerH, 0.018]} />
            <meshStandardMaterial color={front} roughness={0.55} metalness={0.05} />
          </mesh>
        </>
      );
    })() :
    isDouble ? (
      <>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[(s * (w - 0.01)) / 4, h / 2, d / 2 + 0.001]} castShadow>
            <boxGeometry args={[(w - 0.01 - 0.004) / 2, h - 0.01, 0.018]} />
            <meshStandardMaterial color={front} roughness={0.55} metalness={0.05} />
          </mesh>
        ))}
      </>
    ) : (
      <mesh position={[0, h / 2, d / 2 + 0.001]} castShadow>
        <boxGeometry args={[w - 0.01, h - 0.01, 0.018]} />
        <meshStandardMaterial color={front} roughness={0.55} metalness={0.05} />
      </mesh>
    )
  ) : null;

  const handleXs = isDouble ? [-w / 4, w / 4] : [0];

  function renderPreviewHandle(
    key: string,
    pos: HandlePosition | undefined,
    opts: { xCenter: number; yBottom: number; yTop: number; doorW: number; z: number; hinge?: "L" | "R" },
  ) {
    const p = pos ?? "top_center";
    const inset = 0.05; // exact 50mm from selected front edge
    const barLen = 0.212;
    const yMid = (opts.yBottom + opts.yTop) / 2;
    let x = opts.xCenter;
    let y = opts.yTop - inset;
    let vertical = false;

    if (p === "top_center") {
      y = opts.yTop - inset;
    } else if (p === "bottom_center") {
      y = opts.yBottom + inset;
    } else if (p === "top_opposite_hinge") {
      const side = opts.hinge === "L" ? 1 : -1;
      x = opts.xCenter + side * (opts.doorW / 2 - barLen / 2 - 0.01);
      y = opts.yTop - inset;
    } else if (p === "vertical_top") {
      const side = opts.hinge === "L" ? 1 : -1;
      x = opts.xCenter + side * (opts.doorW / 2 - inset);
      y = opts.yTop - inset - barLen / 2;
      vertical = true;
    } else if (p === "vertical_middle") {
      y = yMid;
      vertical = true;
    }

    return (
      <group key={key} position={[x, y, opts.z]} rotation={[0, 0, vertical ? Math.PI / 2 : 0]}>
        <mesh castShadow>
          <boxGeometry args={[barLen, 0.012, 0.012]} />
          <meshStandardMaterial color={handle} metalness={0.7} roughness={0.35} />
        </mesh>
      </group>
    );
  }

  // Center the preview on origin (floor)
  return (
    <group position={[-w / 2 + w / 2, 0, 0]}>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.001, 0]}>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#f4efe6" roughness={1} />
      </mesh>

      {/* Body */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={body} roughness={0.7} metalness={0.05} />
      </mesh>

      {doors}

      {/* Handles */}
      {isCabinet && !isDrawerOverDoor && !isDrawerStack && !isHSplit &&
        handleXs.map((x, i) =>
          renderPreviewHandle(`simple-${i}`, config.handle_position, {
            xCenter: x,
            yBottom: 0.005,
            yTop: h - 0.005,
            doorW: isDouble ? (w - 0.014) / 2 : w - 0.01,
            z: d / 2 + 0.014,
            hinge: i === 0 ? "R" : "L",
          }),
        )}

      {isDrawerOverDoor && (() => {
        const gap = 0.004;
        const drawerH = Math.max(0.05, (config.drawer_height_mm ?? 150) / 1000);
        const innerH = h - 0.01;
        const doorH = Math.max(0.05, innerH - drawerH - gap);
        const doorBottom = 0.005;
        const doorTop = doorBottom + doorH;
        const drawerBottom = doorTop + gap;
        const drawerTop = drawerBottom + drawerH;
        return (
          <>
            {renderPreviewHandle("drawer-over-door-drawer", config.handle_position, { xCenter: 0, yBottom: drawerBottom, yTop: drawerTop, doorW: w - 0.01, z: d / 2 + 0.014 })}
            {renderPreviewHandle("drawer-over-door-door", config.handle_position, { xCenter: 0, yBottom: doorBottom, yTop: doorTop, doorW: w - 0.01, z: d / 2 + 0.014 })}
          </>
        );
      })()}

      {/* Worktop on base units */}
      {category === "base" && (
        <mesh position={[0, h + 0.02, 0]} castShadow receiveShadow>
          <boxGeometry args={[w + 0.02, 0.04, d + 0.02]} />
          <meshStandardMaterial color={worktop} roughness={0.4} metalness={0.05} />
        </mesh>
      )}
    </group>
  );
}
import { useState } from "react";
import { useKitchen } from "@/lib/kitchen/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Save, FolderOpen, FileDown, Trash, Settings2, Trash2, Boxes, ClipboardList, FilePlus, BookmarkPlus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { exportDesignPdf } from "@/lib/kitchen/pdf";
import { getModule } from "@/lib/kitchen/modules";
import { toast } from "sonner";
import { useMemo } from "react";
import { saveDesignDraft, useArticles, useColorThemes, type DraftReserveLine } from "@/lib/data/queries";
import { useAppUser } from "@/lib/auth/useSession";
import { THEME_STOCK, THEMES } from "@/lib/kitchen/themeStock";
import { categoryToUnitType } from "@/lib/kitchen/themeSelection";
import { useQueryClient } from "@tanstack/react-query";
import ekLogo from "@/assets/ek-logo.png";
import type { RoomShape } from "@/lib/kitchen/store";
import {
  EK_CARCASE_FINISHES,
  EK_HANDLES,
  EK_WORKTOPS,
  EK_COLOR_THEMES,
  EK_FRONT_FINISHES,
  getCarcaseFinish,
  getFrontFinish,
  getWorktop,
} from "@/lib/kitchen/ekFinishes";
import {
  useThemeSelection,
  UNIT_TYPE_LABELS,
  type EkUnitType,
} from "@/lib/kitchen/themeSelection";
import { FinishesManager } from "./FinishesManager";

interface ToolbarProps {
  captureCanvas: () => string | null;
  onNewDesign: () => void;
}

function ShapeIcon({ shape }: { shape: RoomShape }) {
  // Tiny SVG previews of each room footprint
  const stroke = "currentColor";
  const common = { width: 28, height: 22, fill: "none", stroke, strokeWidth: 1.5 };
  if (shape === "l-shape") {
    return (
      <svg viewBox="0 0 28 22" {...common}>
        <path d="M2 2 H26 V14 H16 V20 H2 Z" />
      </svg>
    );
  }
  if (shape === "u-shape") {
    return (
      <svg viewBox="0 0 28 22" {...common}>
        <path d="M2 2 H26 V20 H18 V12 H10 V20 H2 Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 28 22" {...common}>
      <rect x="2" y="2" width="24" height="18" />
    </svg>
  );
}

export function Toolbar({ captureCanvas, onNewDesign }: ToolbarProps) {
  const room = useKitchen((s) => s.room);
  const setRoom = useKitchen((s) => s.setRoom);
  const placed = useKitchen((s) => s.placed);
  const designs = useKitchen((s) => s.designs);
  const saveDesign = useKitchen((s) => s.saveDesign);
  const loadDesign = useKitchen((s) => s.loadDesign);
  const deleteDesign = useKitchen((s) => s.deleteDesign);
  const clearAll = useKitchen((s) => s.clearAll);
  const finish = useKitchen((s) => s.finish);
  const setFinish = useKitchen((s) => s.setFinish);
  const themesByUnitType = useThemeSelection((s) => s.themesByUnitType);
  const setThemeFor = useThemeSelection((s) => s.setThemeFor);
  const [themeTab, setThemeTab] = useState<Exclude<EkUnitType, "PLINTH">>("BU");
  const resetDesign = useKitchen((s) => s.resetDesign);
  const currentDesign = useKitchen((s) => s.currentDesign);
  const loadedDesignId = useKitchen((s) => s.loadedDesignId);
  const setLoadedDesignId = useKitchen((s) => s.setLoadedDesignId);
  const viewOnly = useKitchen((s) => s.viewOnly);
  const { profile } = useAppUser();
  const articlesQ = useArticles();
  const themesQ = useColorThemes();
  const qc = useQueryClient();

  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [name, setName] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);

  // Resolve canvas placement → article-level reservation lines for the draft.
  const draftPayload = useMemo(() => {
    const lines = new Map<string, { moduleId: string; unitCode: string; themeId: string; themeLabel: string; qty: number; unitPrice: number; decorative: boolean; name: string }>();
    for (const p of placed) {
      const m = getModule(p.moduleId);
      if (!m) continue;
      const ut = categoryToUnitType(m.category);
      const themeId = p.themeId ?? themesByUnitType[ut];
      const code = (m.unitCode ?? "").trim();
      const price = THEME_STOCK[themeId]?.[code]?.price ?? 0;
      const tmeta = THEMES.find((t) => t.id === themeId);
      const key = `${m.id}::${themeId}`;
      const cur = lines.get(key) ?? {
        moduleId: m.id, unitCode: code, themeId,
        themeLabel: tmeta ? `${tmeta.range} · ${tmeta.frontName}` : themeId,
        qty: 0, unitPrice: m.category === "appliance" ? 0 : price,
        decorative: m.category === "appliance", name: m.name,
      };
      cur.qty += 1; lines.set(key, cur);
    }
    return Array.from(lines.values());
  }, [placed, themesByUnitType]);

  async function handleSaveDraft() {
    if (!currentDesign) {
      toast.error("Start a design first (client/partner intake).");
      return;
    }
    if (placed.length === 0) {
      toast.error("Nothing to save — add some modules first.");
      return;
    }
    setSavingDraft(true);
    try {
      const articleByCode = new Map((articlesQ.data ?? []).map((a) => [a.code, a]));
      const themeByCode = new Map<string, string>();
      for (const t of themesQ.data ?? []) {
        themeByCode.set(t.code, t.id);
        themeByCode.set(t.id, t.id);
      }
      const reserved: DraftReserveLine[] = [];
      const missing: string[] = [];
      for (const l of draftPayload) {
        if (l.decorative || !l.unitCode) continue;
        const a = articleByCode.get(l.unitCode);
        if (!a) { missing.push(l.unitCode); continue; }
        reserved.push({
          article_id: a.id,
          theme_id: themeByCode.get(l.themeId) ?? null,
          qty: l.qty,
          unit_price: l.unitPrice,
        });
      }
      if (missing.length) {
        toast.error(`Missing articles: ${missing.join(", ")}`);
        setSavingDraft(false);
        return;
      }
      const { id } = await saveDesignDraft({
        designId: loadedDesignId,
        partnerId: profile?.partner_id ?? null,
        intake: currentDesign as unknown as Record<string, unknown>,
        placed,
        bom: draftPayload,
        baseUnitThemeId: themeByCode.get(themesByUnitType.BU ?? "") ?? null,
        wallUnitThemeId: themeByCode.get(themesByUnitType.WU ?? "") ?? null,
        tallUnitThemeId: themeByCode.get(themesByUnitType.TU ?? "") ?? null,
        reservedLines: reserved,
      });
      setLoadedDesignId(id);
      toast.success("Draft saved — elements reserved for 2 days.");
      qc.invalidateQueries({ queryKey: ["kitchen_designs"] });
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["article_stock_by_theme"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingDraft(false);
    }
  }

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    saveDesign(name.trim());
    toast.success(`Saved "${name.trim()}"`);
    setName("");
    setSaveOpen(false);
  };

  const handleExport = async () => {
    const img = captureCanvas();
    const rows = placed
      .map((p) => {
        const m = getModule(p.moduleId);
        if (!m) return null;
        return { name: m.name, price: m.price, qty: 1 };
      })
      .filter((r): r is { name: string; price: number; qty: number } => r !== null);
    await exportDesignPdf({
      image: img,
      rows,
      room,
      noltePreset: useKitchen.getState().noltePreset,
      logoUrl: ekLogo,
      finish,
    });
    toast.success("PDF downloaded");
  };

  const carcaseSel = getCarcaseFinish(finish.carcaseCode);
  const worktopSel = getWorktop(finish.worktopCode);
  const frontSel = getFrontFinish(finish.frontCode);
  const carcaseSwatch = carcaseSel.color;
  const frontSwatch = frontSel.color;
  const activeTheme =
    EK_COLOR_THEMES.find((t) => t.id === finish.themeId) ??
    EK_COLOR_THEMES.find(
      (t) =>
        t.frontCode === finish.frontCode && t.carcaseCode === finish.carcaseCode,
    );

  return (
    <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-card/80 backdrop-blur">
      <div className="flex items-center gap-3 mr-auto">
        <img src={ekLogo} alt="Express Küchen" className="h-8 w-auto" />
        <div className="flex flex-col leading-none">
          <span className="font-serif text-lg tracking-tight">Kitchen Designer</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">
            Express Küchen · SYSTEM¹⁵
          </span>
        </div>
        {currentDesign && (
          <div className="hidden md:flex flex-col leading-tight ml-4 pl-4 border-l border-border text-[11px]">
            <span className="text-foreground font-medium">{currentDesign.clientName}</span>
            <span className="text-muted-foreground">
              {currentDesign.partnerName} · {currentDesign.city} · Collection {currentDesign.expectedCollectionDate}
            </span>
          </div>
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={onNewDesign}
      >
        <FilePlus className="h-3.5 w-3.5" />
        New Design
      </Button>

      <Link to="/orders">
        <Button variant="outline" size="sm" className="gap-1.5">
          <ClipboardList className="h-3.5 w-3.5" />
          Orders
        </Button>
      </Link>

      <Link to="/designs">
        <Button variant="outline" size="sm" className="gap-1.5">
          <FolderOpen className="h-3.5 w-3.5" />
          Designs
        </Button>
      </Link>

      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={savingDraft || viewOnly || placed.length === 0 || !currentDesign}
        onClick={handleSaveDraft}
        title="Reserves elements in stock for 2 days while you finalize the order"
      >
        <BookmarkPlus className="h-3.5 w-3.5" />
        {savingDraft ? "Saving…" : loadedDesignId ? "Update draft" : "Save as draft"}
      </Button>

      <Link to="/inventory">
        <Button variant="outline" size="sm" className="gap-1.5">
          <Boxes className="h-3.5 w-3.5" />
          Inventory
        </Button>
      </Link>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <span className="flex">
              <span
                className="h-3 w-3 rounded-l-full border border-border"
                style={{ backgroundColor: carcaseSwatch }}
              />
              <span
                className="h-3 w-3 rounded-r-full border border-l-0 border-border"
                style={{ backgroundColor: frontSwatch }}
              />
            </span>
            Finish
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[28rem] max-h-[85vh] overflow-auto">
          <div className="space-y-4">
            <div>
              <Label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Colour theme
              </Label>
              <div className="mt-1.5">
                <FinishesManager themeTab={themeTab} onSetThemeTab={setThemeTab} />
              </div>
              {activeTheme ? (
                <p className="text-[10px] text-muted-foreground mt-2">
                  Selected: <span className="font-medium text-foreground">{activeTheme.name}</span>
                  {" "}· Range {activeTheme.range} · Front {activeTheme.frontCode} · Carcase {activeTheme.carcaseCode}
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground mt-2">
                  Custom: Front {frontSel.code} · Carcase {carcaseSel.code}
                </p>
              )}
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Worktop
              </Label>
              <div className="grid grid-cols-7 gap-1.5 mt-2 max-h-32 overflow-auto">
                {EK_WORKTOPS.map((w) => (
                  <button
                    key={w.code}
                    onClick={() => setFinish({ worktopCode: w.code })}
                    title={`${w.code} — ${w.name} (${w.group})`}
                    className={`aspect-square rounded border-2 transition ${
                      finish.worktopCode === w.code
                        ? "border-foreground scale-110"
                        : "border-border hover:border-muted-foreground"
                    }`}
                    style={{ backgroundColor: w.color }}
                  />
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {worktopSel.code} · {worktopSel.name} · group {worktopSel.group}
              </p>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Handle
              </Label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {EK_HANDLES.map((h) => (
                  <button
                    key={h.code}
                    onClick={() => setFinish({ handleCode: h.code })}
                    className={`px-2 py-1 rounded text-[10px] border transition ${
                      finish.handleCode === h.code
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    Griff {h.code}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            Room
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72">
          <div className="space-y-4">
            <div>
              <Label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Shape
              </Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {(
                  [
                    { code: "rect", label: "Rectangle" },
                    { code: "l-shape", label: "L-shape" },
                    { code: "u-shape", label: "U-shape" },
                  ] as const
                ).map((opt) => {
                  const active = (room.shape ?? "rect") === opt.code;
                  return (
                    <button
                      key={opt.code}
                      onClick={() => setRoom({ shape: opt.code })}
                      className={`flex flex-col items-center gap-1 rounded-md border-2 p-2 transition ${
                        active
                          ? "border-foreground bg-muted/40"
                          : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <ShapeIcon shape={opt.code} />
                      <span className="text-[10px]">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Dimensions (mm)
              </h3>
              {(["width", "depth", "height"] as const).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <Label className="w-16 capitalize text-xs">{k}</Label>
                  <Input
                    type="number"
                    step="10"
                    min="2000"
                    max="12000"
                    value={Math.round((room[k] ?? 2) * 1000)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") return;
                      const n = Number(raw);
                      if (!Number.isFinite(n)) return;
                      setRoom({ [k]: n / 1000 });
                    }}
                    onBlur={(e) => {
                      const n = Number(e.target.value) || 2000;
                      const clamped = Math.min(12000, Math.max(2000, n));
                      setRoom({ [k]: clamped / 1000 });
                    }}
                    className="h-8"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Wall colour
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { code: "#9ca3af", name: "Grey" },
                  { code: "#cbd5e1", name: "Light grey" },
                  { code: "#4b5563", name: "Dark grey" },
                  { code: "#f3ece0", name: "Cream" },
                  { code: "#e7e5e4", name: "Off white" },
                  { code: "#d6e4d4", name: "Sage" },
                  { code: "#d4e1ec", name: "Sky" },
                  { code: "#e9d5c5", name: "Sand" },
                  { code: "#3a3d40", name: "Anthracite" },
                ].map((c) => {
                  const active = (room.wallColor ?? "#9ca3af") === c.code;
                  return (
                    <button
                      key={c.code}
                      title={c.name}
                      onClick={() => setRoom({ wallColor: c.code })}
                      className={`h-7 w-7 rounded-md border-2 transition ${
                        active
                          ? "border-foreground scale-110"
                          : "border-border hover:border-muted-foreground"
                      }`}
                      style={{ backgroundColor: c.code }}
                    />
                  );
                })}
                <label
                  className="h-7 w-7 rounded-md border-2 border-dashed border-border flex items-center justify-center cursor-pointer overflow-hidden relative"
                  title="Custom colour"
                >
                  <input
                    type="color"
                    value={room.wallColor ?? "#9ca3af"}
                    onChange={(e) => setRoom({ wallColor: e.target.value })}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <span className="text-[10px]">+</span>
                </label>
              </div>
            </div>

            {(room.shape ?? "rect") !== "rect" && (
              <div className="space-y-2">
                <h3 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Cutout (mm)
                </h3>
                <div className="flex items-center gap-2">
                  <Label className="w-16 text-xs">Width</Label>
                  <Input
                    type="number"
                    step="10"
                    min="500"
                    max={Math.round((room.width - 0.5) * 1000)}
                    value={Math.round((room.cutoutWidth ?? 1.4) * 1000)}
                    onChange={(e) => {
                      const mm = Math.max(500, Number(e.target.value) || 1400);
                      setRoom({ cutoutWidth: mm / 1000 });
                    }}
                    className="h-8"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-16 text-xs">Depth</Label>
                  <Input
                    type="number"
                    step="10"
                    min="500"
                    max={Math.round((room.depth - 0.5) * 1000)}
                    value={Math.round((room.cutoutDepth ?? 1.4) * 1000)}
                    onChange={(e) => {
                      const mm = Math.max(500, Number(e.target.value) || 1400);
                      setRoom({ cutoutDepth: mm / 1000 });
                    }}
                    className="h-8"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {room.shape === "l-shape"
                    ? "Cutout removed from the front-right corner."
                    : "Alcove cut from the front-center."}
                </p>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save design</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="My dream kitchen"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
          />
          <DialogFooter>
            <Button onClick={handleSave}>Save to browser</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={loadOpen} onOpenChange={setLoadOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" />
            Load
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Saved designs</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-auto space-y-1">
            {designs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No saved designs yet.
              </p>
            )}
            {designs.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/60"
              >
                <button
                  className="flex-1 text-left"
                  onClick={() => {
                    loadDesign(d.id);
                    setLoadOpen(false);
                    toast.success(`Loaded "${d.name}"`);
                  }}
                >
                  <div className="text-sm font-medium">{d.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {d.placed.length} items · {new Date(d.createdAt).toLocaleDateString()}
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteDesign(d.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Button onClick={handleExport} size="sm" className="gap-1.5">
        <FileDown className="h-3.5 w-3.5" />
        Export PDF
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (confirm("Clear all modules?")) clearAll();
        }}
        className="gap-1.5 text-muted-foreground hover:text-destructive"
      >
        <Trash className="h-3.5 w-3.5" />
        Clear
      </Button>
    </div>
  );
}
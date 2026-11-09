import { useMemo, useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  useColorThemes,
  useThemeFinishes,
  useUpsertThemeFinish,
  useSoftDeleteThemeFinish,
  type ThemeFinishRow,
  type FinishUnitCategory,
  type ColorTheme,
} from "@/lib/data/queries";
import { useAppUser } from "@/lib/auth/useSession";
import { EK_FRONT_FINISHES, EK_CARCASE_FINISHES } from "@/lib/kitchen/ekFinishes";
import { UNIT_TYPE_LABELS, type EkUnitType } from "@/lib/kitchen/themeSelection";

const CATEGORY_BY_TAB: Record<Exclude<EkUnitType, "PLINTH">, FinishUnitCategory> = {
  BU: "base",
  TU: "tall",
  WU: "wall",
};

function fallbackSwatch(front_code: string | null): string {
  return EK_FRONT_FINISHES.find((f) => f.code === front_code)?.color ?? "#d6cbb5";
}
function fallbackCarcase(code: string | null): string {
  return EK_CARCASE_FINISHES.find((c) => c.code === code)?.color ?? "#c9c9c5";
}
function isIncomplete(f: ThemeFinishRow): boolean {
  return !f.front_code || !f.material_description;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function FinishesManager({
  themeTab,
  onSetThemeTab,
}: {
  themeTab: Exclude<EkUnitType, "PLINTH">;
  onSetThemeTab: (t: Exclude<EkUnitType, "PLINTH">) => void;
}) {
  const { isAdmin } = useAppUser();
  const themesQ = useColorThemes();
  const finishesQ = useThemeFinishes();
  const upsert = useUpsertThemeFinish();
  const softDelete = useSoftDeleteThemeFinish();

  const [editing, setEditing] = useState<Partial<ThemeFinishRow> | null>(null);
  const [applyAll, setApplyAll] = useState<boolean>(true);

  const themes = themesQ.data ?? [];
  const themeById = useMemo(() => new Map(themes.map((t) => [t.id, t])), [themes]);
  const category = CATEGORY_BY_TAB[themeTab];

  const cards = useMemo(() => {
    return (finishesQ.data ?? [])
      .filter((f) => f.unit_category === category && f.is_active)
      .map((f) => ({ ...f, theme: themeById.get(f.theme_id) }))
      .filter((f) => f.theme && f.theme.is_active !== false)
      .sort((a, b) => a.sort_order - b.sort_order || (a.theme?.name ?? "").localeCompare(b.theme?.name ?? ""));
  }, [finishesQ.data, category, themeById]);

  const incompleteAcrossAll = useMemo(
    () =>
      (finishesQ.data ?? []).filter(
        (f) => f.is_active && isIncomplete(f) && themeById.get(f.theme_id)?.is_active !== false,
      ),
    [finishesQ.data, themeById],
  );

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-md bg-muted p-0.5 w-fit">
          {(["BU", "TU", "WU"] as const).map((ut) => (
            <button
              key={ut}
              onClick={() => onSetThemeTab(ut)}
              className={
                "px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded transition " +
                (themeTab === ut ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")
              }
            >
              {UNIT_TYPE_LABELS[ut]}
            </button>
          ))}
        </div>
        {isAdmin && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-[11px]"
            onClick={() =>
              setEditing({
                unit_category: category,
                is_active: true,
                sort_order: 0,
              })
            }
          >
            <Plus className="h-3.5 w-3.5" /> Add Finish
          </Button>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">
        Manage finish cards for <span className="font-medium text-foreground">{UNIT_TYPE_LABELS[themeTab]}</span>. Assign the colour theme to modules from the Design sidebar.
      </p>

      {isAdmin && incompleteAcrossAll.length > 0 && (
        <div className="mt-2 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/60 p-2 text-[11px] text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            {incompleteAcrossAll.length} finish card{incompleteAcrossAll.length === 1 ? "" : "s"} incomplete
          </div>
          <ul className="mt-1 space-y-0.5 max-h-24 overflow-auto">
            {incompleteAcrossAll.slice(0, 6).map((f) => {
              const t = themeById.get(f.theme_id);
              return (
                <li key={f.id}>
                  <button
                    className="underline hover:no-underline text-left"
                    onClick={() => {
                      onSetThemeTab(
                        (Object.entries(CATEGORY_BY_TAB).find(([, v]) => v === f.unit_category)?.[0] as
                          | Exclude<EkUnitType, "PLINTH">
                          | undefined) ?? "BU",
                      );
                      setEditing(f);
                    }}
                  >
                    {t?.name ?? "Theme"} · {f.unit_category} — click to complete
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2.5 mt-2">
        {cards.length === 0 && (
          <div className="col-span-3 py-8 text-center text-[11px] text-muted-foreground">
            No finish cards yet for {UNIT_TYPE_LABELS[themeTab]}.
          </div>
        )}
        {cards.map((f) => {
          const frontColor = fallbackSwatch(f.front_code);
          const carcColor = fallbackCarcase(f.carcase_code);
          const incomplete = isIncomplete(f);
          return (
            <div key={f.id} className="group relative">
              <div
                title={`${f.theme?.name ?? ""}${f.range_name ? " — " + f.range_name : ""}`}
                className="w-full flex flex-col rounded-md border-2 border-border overflow-hidden text-left"
              >
                <span className="relative block w-full aspect-[3/4]" style={{ backgroundColor: frontColor }}>
                  {f.door_image_url ? (
                    <img
                      src={f.door_image_url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <>
                      <span
                        className="absolute inset-0 pointer-events-none"
                        style={{ backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(0,0,0,0.10))" }}
                      />
                      <span className="absolute left-1/2 -translate-x-1/2 top-2 h-[3px] w-8 rounded-sm bg-foreground/70 shadow-sm" />
                      <span className="absolute left-0 right-0 top-[28%] h-px bg-black/15" />
                    </>
                  )}
                  {f.style_badge && (
                    <span className="absolute top-1 left-1 rounded-sm bg-background/85 text-foreground text-[8px] font-semibold tracking-wider px-1 py-0.5">
                      {f.style_badge}
                    </span>
                  )}
                  <span
                    className="absolute bottom-0 left-0 right-0 h-2 border-t border-black/10"
                    style={{ backgroundColor: carcColor }}
                    title={`Carcase ${f.carcase_code ?? ""}`}
                  />
                  {incomplete && (
                    <span className="absolute top-1 right-1 rounded-sm bg-amber-500/90 text-white text-[8px] font-semibold px-1 py-0.5">
                      !
                    </span>
                  )}
                </span>
                <span className="px-2 py-1.5 bg-card">
                  <span className="block text-[11px] font-semibold leading-tight truncate">
                    {f.theme?.name ?? "—"}
                  </span>
                  <span className="block text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5 truncate">
                    {f.front_code ?? "—"} · {f.material_description ?? "—"}
                  </span>
                </span>
              </div>
              {isAdmin && (
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(f);
                    }}
                    className="h-6 w-6 rounded bg-background/90 border border-border flex items-center justify-center hover:bg-background"
                    title="Edit"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!confirm("Remove this finish card? This does not delete the theme or its stock.")) return;
                      softDelete.mutate(f.id, {
                        onSuccess: () => toast.success("Finish card removed"),
                        onError: (err) => toast.error((err as Error).message),
                      });
                    }}
                    className="h-6 w-6 rounded bg-background/90 border border-border flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <FinishEditorDialog
          value={editing}
          themes={themes}
          applyAll={applyAll}
          onApplyAllChange={setApplyAll}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            try {
              const categories: FinishUnitCategory[] = applyAll
                ? ["base", "tall", "wall"]
                : [v.unit_category];
              // Fetch existing rows for this theme so we update (preserve id) instead of insert-conflict.
              const existing = (finishesQ.data ?? []).filter((f) => f.theme_id === v.theme_id);
              for (const cat of categories) {
                const match = existing.find((f) => f.unit_category === cat);
                await upsert.mutateAsync({
                  ...v,
                  id: match?.id,
                  unit_category: cat,
                  is_active: true,
                } as never);
              }
              toast.success(
                applyAll
                  ? "Finish applied to Base, Tall & Wall"
                  : editing.id
                    ? "Finish card updated"
                    : "Finish card saved",
              );
              setEditing(null);
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        />
      )}
    </div>
  );
}

function FinishEditorDialog({
  value,
  themes,
  applyAll,
  onApplyAllChange,
  onClose,
  onSave,
}: {
  value: Partial<ThemeFinishRow>;
  themes: ColorTheme[];
  applyAll: boolean;
  onApplyAllChange: (v: boolean) => void;
  onClose: () => void;
  onSave: (v: Partial<ThemeFinishRow> & { theme_id: string; unit_category: FinishUnitCategory }) => void;
}) {
  const [draft, setDraft] = useState<Partial<ThemeFinishRow>>(value);
  const fileRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => setDraft(value), [value]);

  function set<K extends keyof ThemeFinishRow>(k: K, v: ThemeFinishRow[K] | null) {
    setDraft((d) => ({ ...d, [k]: v as never }));
  }

  async function handleFile(f: File | null | undefined) {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2 MB");
      return;
    }
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(f.type)) {
      toast.error("Use a JPG, PNG or WEBP image");
      return;
    }
    const url = await fileToDataUrl(f);
    set("door_image_url", url);
  }

  const canSave = !!draft.theme_id && !!draft.unit_category;
  const previewFront = fallbackSwatch(draft.front_code ?? null);
  const previewCarc = fallbackCarcase(draft.carcase_code ?? null);
  const previewTheme = themes.find((t) => t.id === draft.theme_id);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{value.id ? "Edit finish card" : "Add finish card"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_180px] gap-6">
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Colour theme</Label>
              <select
                value={draft.theme_id ?? ""}
                onChange={(e) => set("theme_id", e.target.value || null)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                disabled={!!value.id}
              >
                <option value="">Select a theme…</option>
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Unit category</Label>
              <div className="mt-1 flex gap-1 rounded-md bg-muted p-0.5 w-fit">
                {(["base", "tall", "wall"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => set("unit_category", c)}
                    disabled={!!value.id}
                    className={
                      "px-3 py-1 text-[11px] font-semibold uppercase tracking-wider rounded transition " +
                      (draft.unit_category === c
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">Door image (JPG/PNG/WEBP, max 2 MB)</Label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
                  <Upload className="h-3.5 w-3.5" /> Choose image
                </Button>
                {draft.door_image_url && (
                  <Button variant="ghost" size="sm" onClick={() => set("door_image_url", null)}>
                    Remove
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Style badge</Label>
                <Input
                  className="h-8"
                  value={draft.style_badge ?? ""}
                  onChange={(e) => set("style_badge", e.target.value)}
                  placeholder="CLEAN"
                />
              </div>
              <div>
                <Label className="text-xs">Range name</Label>
                <Input
                  className="h-8"
                  value={draft.range_name ?? ""}
                  onChange={(e) => set("range_name", e.target.value)}
                  placeholder="CLEAN"
                />
              </div>
              <div>
                <Label className="text-xs">Front code</Label>
                <Input
                  className="h-8"
                  value={draft.front_code ?? ""}
                  onChange={(e) => set("front_code", e.target.value)}
                  placeholder="283"
                />
              </div>
              <div>
                <Label className="text-xs">Carcase code</Label>
                <Input
                  className="h-8"
                  value={draft.carcase_code ?? ""}
                  onChange={(e) => set("carcase_code", e.target.value)}
                  placeholder="K23"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Material description</Label>
                <Input
                  className="h-8"
                  value={draft.material_description ?? ""}
                  onChange={(e) => set("material_description", e.target.value)}
                  placeholder="MAT ANTHRACITE"
                />
              </div>
              <div>
                <Label className="text-xs">Sort order</Label>
                <Input
                  className="h-8"
                  type="number"
                  value={draft.sort_order ?? 0}
                  onChange={(e) => set("sort_order", Number(e.target.value) || 0)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Switch
                  checked={draft.is_active ?? true}
                  onCheckedChange={(v) => set("is_active", v)}
                />
                <span className="text-xs text-muted-foreground">Active</span>
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div>
            <Label className="text-xs">Preview</Label>
            <div className="mt-1 rounded-md border-2 border-border overflow-hidden">
              <div className="relative aspect-[3/4]" style={{ backgroundColor: previewFront }}>
                {draft.door_image_url ? (
                  <img src={draft.door_image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <>
                    <span className="absolute left-1/2 -translate-x-1/2 top-2 h-[3px] w-8 rounded-sm bg-foreground/70" />
                    <span className="absolute left-0 right-0 top-[28%] h-px bg-black/15" />
                  </>
                )}
                {draft.style_badge && (
                  <span className="absolute top-1 left-1 rounded-sm bg-background/85 text-foreground text-[8px] font-semibold tracking-wider px-1 py-0.5">
                    {draft.style_badge}
                  </span>
                )}
                <span className="absolute bottom-0 left-0 right-0 h-2 border-t border-black/10" style={{ backgroundColor: previewCarc }} />
              </div>
              <div className="px-2 py-1.5 bg-card">
                <div className="text-[11px] font-semibold leading-tight truncate">{previewTheme?.name ?? "—"}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5 truncate">
                  {draft.front_code ?? "—"} · {draft.material_description ?? "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <label className="flex items-center gap-2 text-xs mr-auto select-none">
            <input
              type="checkbox"
              checked={applyAll}
              onChange={(e) => onApplyAllChange(e.target.checked)}
            />
            Apply to Base, Tall &amp; Wall
          </label>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!canSave}
            onClick={() =>
              onSave({
                ...draft,
                theme_id: draft.theme_id!,
                unit_category: draft.unit_category!,
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
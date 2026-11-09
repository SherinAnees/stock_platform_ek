import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Download, Upload, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useArticles, useColorThemes, useAllArticleStock,
} from "@/lib/data/queries";
import {
  buildStockWorkbook, downloadWorkbook,
  parseStockWorkbook, applyStockUpload,
  type UploadSummary,
} from "@/lib/inventory/excelIO";
import { useAppUser } from "@/lib/auth/useSession";

export function ExcelIOButtons() {
  const { isAdmin } = useAppUser();
  const articles = useArticles();
  const themes = useColorThemes();
  const allStock = useAllArticleStock();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"download" | "upload" | null>(null);
  const [summary, setSummary] = useState<UploadSummary | null>(null);

  function handleDownload() {
    if (!articles.data || !themes.data || !allStock.data) {
      toast.error("Inventory data not loaded yet");
      return;
    }
    try {
      setBusy("download");
      const wb = buildStockWorkbook({
        articles: articles.data,
        themes: themes.data,
        stock: allStock.data,
      });
      const date = new Date().toISOString().slice(0, 10);
      downloadWorkbook(wb, `Stock_Export_${date}.xlsx`);
      toast.success("Stock exported");
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleFile(file: File) {
    setBusy("upload");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const { sheets, errors } = parseStockWorkbook(wb);
      if (errors.length > 0) {
        toast.error(`Invalid file: ${errors[0].message}`);
        return;
      }
      if (sheets.length === 0) {
        toast.error("No sheets found");
        return;
      }
      const result = await applyStockUpload(sheets);
      setSummary(result);
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["article_stock_by_theme"] });
      qc.invalidateQueries({ queryKey: ["color_themes"] });
      qc.invalidateQueries({ queryKey: ["low_stock_by_theme"] });
    } catch (e) {
      toast.error(`Upload failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={handleDownload} disabled={busy !== null}>
        {busy === "download" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        Download Stock (Excel)
      </Button>
      {isAdmin && (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
          {busy === "upload" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload Stock (Excel)
        </Button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />

      <Dialog open={summary !== null} onOpenChange={(o) => !o && setSummary(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload summary</DialogTitle>
          </DialogHeader>
          {summary && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Rows processed" value={summary.totalRows} />
                <Stat label="Qty additions" value={summary.qtyAdditions} />
                <Stat label="Zeroed out" value={summary.zeroedOut} />
                <Stat label="Prices updated" value={summary.pricesUpdated} />
                <Stat label="Rows skipped" value={summary.rowsSkipped} />
              </div>
              {summary.newThemesCreated.length > 0 && (
                <div>
                  <div className="font-medium mb-1">New themes created</div>
                  <div className="text-muted-foreground">{summary.newThemesCreated.join(", ")}</div>
                  <div className="text-xs mt-1 text-amber-600 dark:text-amber-400">
                    Update the swatch color for these themes from the Inventory theme header if needed. They already appear across Design Studio and Quick Order.
                  </div>
                </div>
              )}
              {summary.warnings.length > 0 && (
                <div>
                  <div className="font-medium mb-1">Warnings ({summary.warnings.length})</div>
                  <div className="max-h-64 overflow-auto rounded border border-border bg-muted/30 p-2 text-xs space-y-1">
                    {summary.warnings.map((w, i) => (
                      <div key={i}>
                        <span className="font-mono">[{w.sheet}]</span>{" "}
                        {w.rowNum > 0 && <span>Row {w.rowNum}: </span>}
                        {w.code && <span className="font-mono">{w.code} — </span>}
                        {w.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setSummary(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-border bg-card p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
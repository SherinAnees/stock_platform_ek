import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { Article, ColorTheme, ArticleStockRow } from "@/lib/data/queries";
import { categoryAbbr } from "@/lib/inventory/category";

export const COLUMNS = [
  "Article Code",
  "Article Name",
  "Category (BU/TU/WU)",
  "Width (mm)",
  "Height (mm)",
  "Depth (mm)",
  "Volume (m³)",
  "Unit Price (€)",
  "Current Stock Qty",
  "Reserved Qty",
  "Available Qty",
  "Min Stock Qty",
  "Status",
  "Zero Out (YES/NO)",
] as const;

const CAT_ORDER: Record<string, number> = { BU: 0, TU: 1, WU: 2 };

function safeSheetName(name: string) {
  // Excel sheet name: <=31 chars, no []:*?/\
  return name.replace(/[\[\]:*?/\\]/g, " ").slice(0, 31);
}

export interface BuildExportInput {
  articles: Article[];
  themes: ColorTheme[];
  stock: ArticleStockRow[];
}

export function buildStockWorkbook({ articles, themes, stock }: BuildExportInput): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const artById = new Map(articles.map((a) => [a.id, a]));

  for (const theme of themes) {
    const rows = stock.filter((s) => s.theme_id === theme.id);
    const enriched = rows
      .map((s) => ({ s, a: artById.get(s.article_id) }))
      .filter((r): r is { s: ArticleStockRow; a: Article } => !!r.a)
      .sort((a, b) => {
        const ca = CAT_ORDER[categoryAbbr(a.a.category).abbr] ?? 99;
        const cb = CAT_ORDER[categoryAbbr(b.a.category).abbr] ?? 99;
        if (ca !== cb) return ca - cb;
        return a.a.code.localeCompare(b.a.code);
      });

    const aoa: (string | number)[][] = [COLUMNS.slice() as unknown as string[]];
    for (const { s, a } of enriched) {
      const reserved = s.reserved_qty ?? 0;
      const available = Math.max(0, s.current_qty - reserved);
      const status = available <= 0 ? "Out" : available < s.min_qty ? "Low" : "OK";
      aoa.push([
        a.code,
        a.name,
        categoryAbbr(a.category).abbr,
        a.width_mm ?? 0,
        a.height_mm ?? 0,
        a.depth_mm ?? 0,
        Number(a.volume_m3 ?? 0),
        Number(s.unit_price ?? 0),
        s.current_qty,
        reserved,
        available,
        s.min_qty,
        status,
        "NO",
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!freeze"] = { xSplit: 0, ySplit: 1 } as unknown as never;
    ws["!cols"] = [
      { wch: 14 }, { wch: 40 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
      { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(theme.name));
  }
  return wb;
}

export function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

// ============ IMPORT ============

export interface ParsedRow {
  sheet: string;
  rowNum: number; // Excel row number (1-based, incl. header)
  code: string;
  name: string;
  category: string;
  width: number;
  height: number;
  depth: number;
  unitPrice: number | null;
  addQty: number;
  zeroOut: boolean;
}

export interface ParsedSheet {
  themeName: string;
  rows: ParsedRow[];
}

export interface ParseError { sheet: string; message: string; }

export function parseStockWorkbook(wb: XLSX.WorkBook): { sheets: ParsedSheet[]; errors: ParseError[] } {
  const sheets: ParsedSheet[] = [];
  const errors: ParseError[] = [];
  if (!wb.SheetNames.length) {
    errors.push({ sheet: "(file)", message: "Workbook has no worksheets" });
    return { sheets, errors };
  }
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false }) as (string | number)[][];
    if (aoa.length < 1) { errors.push({ sheet: name, message: "Sheet is empty" }); continue; }
    const header = (aoa[0] ?? []).map((h) => String(h ?? "").trim());
    // Validate first 3 header labels loosely and require 13 columns worth of positions.
    const expected = ["Article Code", "Article Name", "Category"];
    for (let i = 0; i < expected.length; i++) {
      if (!header[i] || !header[i].toLowerCase().startsWith(expected[i].toLowerCase().split(" ")[0])) {
        errors.push({ sheet: name, message: `Header column ${String.fromCharCode(65 + i)} must be "${expected[i]}"` });
      }
    }
    const rows: ParsedRow[] = [];
    for (let r = 1; r < aoa.length; r++) {
      const row = aoa[r] ?? [];
      const code = String(row[0] ?? "").trim();
      if (!code) continue;
      const addQtyRaw = row[8];
      const priceRaw = row[7];
      const zeroRaw = String(row[13] ?? "").trim().toUpperCase();
      rows.push({
        sheet: name,
        rowNum: r + 1,
        code,
        name: String(row[1] ?? "").trim(),
        category: String(row[2] ?? "").trim(),
        width: Number(row[3] ?? 0) || 0,
        height: Number(row[4] ?? 0) || 0,
        depth: Number(row[5] ?? 0) || 0,
        unitPrice: priceRaw === "" || priceRaw == null ? null : Number(priceRaw) || 0,
        addQty: Number(addQtyRaw ?? 0) || 0,
        zeroOut: zeroRaw === "YES" || zeroRaw === "Y" || zeroRaw === "TRUE" || zeroRaw === "1",
      });
    }
    sheets.push({ themeName: name.trim(), rows });
  }
  return { sheets, errors };
}

export interface UploadWarning { sheet: string; rowNum: number; code: string; message: string; }
export interface UploadSummary {
  totalRows: number;
  qtyAdditions: number;
  pricesUpdated: number;
  rowsSkipped: number;
  zeroedOut: number;
  newThemesCreated: string[];
  warnings: UploadWarning[];
}

function randomHex() {
  const c = "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
  return c;
}

function themeCodeFromName(name: string) {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "THEME";
}

/**
 * Apply parsed workbook.
 * NOTE: Best-effort sequential apply. If a critical step fails we stop and
 * return partial summary + error. True DB rollback would need an RPC.
 */
export async function applyStockUpload(parsed: ParsedSheet[]): Promise<UploadSummary> {
  const summary: UploadSummary = {
    totalRows: 0,
    qtyAdditions: 0,
    pricesUpdated: 0,
    rowsSkipped: 0,
    zeroedOut: 0,
    newThemesCreated: [],
    warnings: [],
  };

  // Load existing articles + themes.
  const [{ data: articlesData, error: aErr }, { data: themesData, error: tErr }] = await Promise.all([
    supabase.from("articles").select("id, code, unit_price"),
    supabase.from("color_themes").select("id, name"),
  ]);
  if (aErr) throw aErr;
  if (tErr) throw tErr;
  const articleByCode = new Map((articlesData ?? []).map((a) => [a.code, a as { id: string; code: string; unit_price: number }]));
  const themeByName = new Map((themesData ?? []).map((t) => [t.name.toLowerCase(), t as { id: string; name: string }]));

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  for (const sheet of parsed) {
    // Resolve or create theme.
    let theme = themeByName.get(sheet.themeName.toLowerCase());
    let isNewTheme = false;
    if (!theme) {
      const code = themeCodeFromName(sheet.themeName);
      const { data: inserted, error: insErr } = await supabase
        .from("color_themes")
        .insert({
          code,
          name: sheet.themeName,
          hex_color: randomHex(),
          is_active: true,
          range: "CUSTOM",
        } as never)
        .select("id, name")
        .single();
      if (insErr) {
        summary.warnings.push({ sheet: sheet.themeName, rowNum: 0, code: "", message: `Failed to create theme: ${insErr.message}` });
        continue;
      }
      theme = inserted as { id: string; name: string };
      themeByName.set(sheet.themeName.toLowerCase(), theme);
      summary.newThemesCreated.push(sheet.themeName);
      isNewTheme = true;
    }

    // Track article prices we've already updated so we don't repeat.
    const priceApplied = new Set<string>();

    for (const row of sheet.rows) {
      summary.totalRows++;
      const article = articleByCode.get(row.code);
      if (!article) {
        summary.rowsSkipped++;
        summary.warnings.push({ sheet: sheet.themeName, rowNum: row.rowNum, code: row.code, message: `Article Code '${row.code}' not found — skipped` });
        continue;
      }

      // Price update: article-wide (articles + all article_stock_by_theme rows)
      if (row.unitPrice != null && row.unitPrice > 0 && !priceApplied.has(article.id)) {
        const { error: pe1 } = await supabase.from("articles").update({ unit_price: row.unitPrice } as never).eq("id", article.id);
        if (pe1) {
          summary.warnings.push({ sheet: sheet.themeName, rowNum: row.rowNum, code: row.code, message: `Price update failed: ${pe1.message}` });
        } else {
          const { error: pe2 } = await supabase.from("article_stock_by_theme").update({ unit_price: row.unitPrice } as never).eq("article_id", article.id);
          if (pe2) {
            summary.warnings.push({ sheet: sheet.themeName, rowNum: row.rowNum, code: row.code, message: `Per-theme price update failed: ${pe2.message}` });
          } else {
            summary.pricesUpdated++;
            priceApplied.add(article.id);
            article.unit_price = row.unitPrice;
          }
        }
      }

      // Quantity add (or opening stock for new theme).
      const qty = row.addQty;
      if (!row.zeroOut && (!qty || qty <= 0)) continue;

      // Lookup existing per-theme row.
      const { data: existingRow, error: exErr } = await supabase
        .from("article_stock_by_theme")
        .select("id, current_qty")
        .eq("article_id", article.id)
        .eq("theme_id", theme.id)
        .maybeSingle();
      if (exErr) {
        summary.warnings.push({ sheet: sheet.themeName, rowNum: row.rowNum, code: row.code, message: `Stock lookup failed: ${exErr.message}` });
        continue;
      }

      const currentPrice = row.unitPrice != null && row.unitPrice > 0 ? row.unitPrice : Number(article.unit_price ?? 0);

      // Zero-out short-circuits the qty-add branch.
      if (row.zeroOut) {
        if (!existingRow) {
          summary.rowsSkipped++;
          summary.warnings.push({ sheet: sheet.themeName, rowNum: row.rowNum, code: row.code, message: `Zero-out skipped — no existing stock for this theme` });
          continue;
        }
        const prev = existingRow.current_qty as number;
        if (prev === 0) continue;
        const { error: zeroErr } = await supabase.from("article_stock_by_theme").update({ current_qty: 0 } as never).eq("id", existingRow.id as string);
        if (zeroErr) {
          summary.warnings.push({ sheet: sheet.themeName, rowNum: row.rowNum, code: row.code, message: `Zero-out failed: ${zeroErr.message}` });
          continue;
        }
        await supabase.from("stock_movements").insert({
          article_id: article.id,
          theme_id: theme.id,
          delta: -prev,
          reason: "adjust",
          unit_price: currentPrice,
          notes: `Bulk zero-out via Excel upload (${sheet.themeName}) row ${row.rowNum}`,
          created_by: userId,
        } as never);
        summary.zeroedOut++;
        continue;
      }

      if (existingRow) {
        const newQty = (existingRow.current_qty as number) + qty;
        if (newQty < 0) {
          summary.rowsSkipped++;
          summary.warnings.push({ sheet: sheet.themeName, rowNum: row.rowNum, code: row.code, message: `Would result in negative stock — skipped` });
          continue;
        }
        const { error: upErr } = await supabase.from("article_stock_by_theme").update({ current_qty: newQty } as never).eq("id", existingRow.id as string);
        if (upErr) {
          summary.warnings.push({ sheet: sheet.themeName, rowNum: row.rowNum, code: row.code, message: `Stock update failed: ${upErr.message}` });
          continue;
        }
      } else {
        const { error: insErr } = await supabase.from("article_stock_by_theme").insert({
          article_id: article.id,
          theme_id: theme.id,
          current_qty: qty,
          min_qty: 1,
          unit_price: currentPrice,
        } as never);
        if (insErr) {
          summary.warnings.push({ sheet: sheet.themeName, rowNum: row.rowNum, code: row.code, message: `Stock insert failed: ${insErr.message}` });
          continue;
        }
      }

      // Log movement.
      const reason = isNewTheme ? "opening_stock" : "stock_received";
      await supabase.from("stock_movements").insert({
        article_id: article.id,
        theme_id: theme.id,
        delta: qty,
        reason,
        unit_price: currentPrice,
        notes: `Excel upload (${sheet.themeName}) row ${row.rowNum}`,
        created_by: userId,
      } as never);
      summary.qtyAdditions++;
    }
  }

  return summary;
}
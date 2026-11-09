import jsPDF from "jspdf";
import type { EkFinishSelection, NoltePreset, RoomConfig } from "./store";
import { calcNolteKitchenCost, formatAED, getDemoSheet } from "./nolteCost";
import { getCarcaseFinish, getWorktop } from "./ekFinishes";

interface ExportRow {
  name: string;
  price: number;
  qty: number;
}

interface ExportArgs {
  image: string | null;
  rows: ExportRow[];
  room: RoomConfig;
  noltePreset?: NoltePreset | null;
  logoUrl?: string | null;
  finish?: EkFinishSelection;
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportDesignPdf({
  image,
  rows,
  room,
  noltePreset,
  logoUrl,
  finish,
}: ExportArgs) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 15;

  // Header — Express Küchen branding
  let headerLeft = margin;
  if (logoUrl) {
    const logoData = await loadImageAsDataUrl(logoUrl);
    if (logoData) {
      try {
        pdf.addImage(logoData, "PNG", margin, 12, 28, 14);
        headerLeft = margin + 32;
      } catch {
        // fall through to text-only
      }
    }
  }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Express Küchen", headerLeft, 20);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(110, 100, 80);
  pdf.text("Kitchen Design Quotation · SYSTEM¹⁵", headerLeft, 25);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(110, 100, 80);
  const dateStr = new Date().toLocaleDateString("en-AE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  pdf.text(dateStr, pageW - margin, 16, { align: "right" });
  pdf.text(`Room: ${room.width}m × ${room.depth}m × ${room.height}m`, pageW - margin, 22, {
    align: "right",
  });
  if (noltePreset) {
    pdf.text(`Type: ${noltePreset.kitchenType}`, pageW - margin, 28, { align: "right" });
  }
  if (finish) {
    const carcase = getCarcaseFinish(finish.carcaseCode);
    const worktop = getWorktop(finish.worktopCode);
    pdf.text(
      `Finish: ${carcase.code} ${carcase.name} · Worktop: ${worktop.code} ${worktop.name}`,
      pageW - margin,
      noltePreset ? 33 : 28,
      { align: "right" }
    );
  }
  pdf.setDrawColor(180, 160, 120);
  pdf.setLineWidth(0.4);
  pdf.line(margin, finish ? 36 : 33, pageW - margin, finish ? 36 : 33);
  pdf.setTextColor(40, 30, 20);

  // Image
  let cursorY = finish ? 42 : 39;
  if (image) {
    const imgW = pageW - margin * 2;
    const imgH = imgW * 0.6;
    try {
      pdf.addImage(image, "PNG", margin, cursorY, imgW, imgH);
      cursorY += imgH + 8;
    } catch {
      // ignore image failure
    }
  }

  // BOM table
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Bill of Materials", margin, cursorY);
  cursorY += 6;

  // Aggregate
  const map = new Map<string, ExportRow>();
  for (const r of rows) {
    const cur = map.get(r.name);
    if (cur) cur.qty += r.qty;
    else map.set(r.name, { ...r });
  }
  const agg = Array.from(map.values());

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(110, 100, 80);
  pdf.text("ITEM", margin, cursorY);
  pdf.text("QTY", pageW - margin - 50, cursorY, { align: "right" });
  pdf.text("UNIT", pageW - margin - 25, cursorY, { align: "right" });
  pdf.text("TOTAL", pageW - margin, cursorY, { align: "right" });
  cursorY += 2;
  pdf.setDrawColor(220, 210, 190);
  pdf.line(margin, cursorY, pageW - margin, cursorY);
  cursorY += 5;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(40, 30, 20);

  let total = 0;
  for (const r of agg) {
    if (cursorY > 270) {
      pdf.addPage();
      cursorY = 20;
    }
    const sub = r.qty * r.price;
    total += sub;
    pdf.text(r.name, margin, cursorY);
    pdf.text(String(r.qty), pageW - margin - 50, cursorY, { align: "right" });
    pdf.text(`$${r.price.toLocaleString()}`, pageW - margin - 25, cursorY, {
      align: "right",
    });
    pdf.text(`$${sub.toLocaleString()}`, pageW - margin, cursorY, { align: "right" });
    cursorY += 6;
  }

  cursorY += 2;
  pdf.setDrawColor(180, 160, 120);
  pdf.line(margin, cursorY, pageW - margin, cursorY);
  cursorY += 7;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Catalog Estimate", margin, cursorY);
  pdf.text(`$${total.toLocaleString()}`, pageW - margin, cursorY, { align: "right" });
  cursorY += 10;

  // Nolte costing summary if a preset is loaded
  if (noltePreset) {
    if (cursorY > 240) {
      pdf.addPage();
      cursorY = 20;
    }
    const sheet = getDemoSheet();
    const cost = calcNolteKitchenCost(noltePreset.row, sheet.inputs);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("Project Costing — Per Kitchen", margin, cursorY);
    cursorY += 7;

    const lines: [string, number][] = [
      ["Cabinetry + Worktops", cost.cabinetryAED + cost.worktopsAED],
      ["Accessories + Lighting", cost.accessoriesAED + cost.lightingAED],
      ["Local Appliances", cost.appliancesAED],
      ["Installation", cost.installationAED],
      ["Logistics", cost.logisticsAED],
      ["Contingency + Markup", cost.contingencyAED + cost.markupAED],
    ];
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    for (const [label, value] of lines) {
      pdf.text(label, margin, cursorY);
      pdf.text(formatAED(value), pageW - margin, cursorY, { align: "right" });
      cursorY += 6;
    }

    cursorY += 1;
    pdf.setDrawColor(180, 160, 120);
    pdf.line(margin, cursorY, pageW - margin, cursorY);
    cursorY += 7;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("Total per Kitchen (EUR)", margin, cursorY);
    pdf.text(formatAED(cost.totalAED), pageW - margin, cursorY, { align: "right" });

    if (noltePreset.qtyPerType > 1) {
      cursorY += 7;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(110, 100, 80);
      pdf.text(
        `× ${noltePreset.qtyPerType} units = ${formatAED(cost.totalAED * noltePreset.qtyPerType)}`,
        pageW - margin,
        cursorY,
        { align: "right" }
      );
      pdf.setTextColor(40, 30, 20);
    }
  }

  pdf.save(`express-kuechen-${Date.now()}.pdf`);
}
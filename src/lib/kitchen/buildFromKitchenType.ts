import type { QtyPriceRow } from "@/types/costingSheet";
import type { PlacedModule, RoomConfig } from "./store";
import { getModule } from "./modules";

/**
 * Build a 3D layout from a Nolte QtyPriceRow.
 *
 * Strategy: lay out base + tall units along the back wall (and left wall when
 * needed), wall cabinets above the base run, and place fixed items (hob, hood,
 * sink, fridge) at sensible positions. Quantities come from the LM (linear
 * meters) values per kitchen.
 */
export function buildLayoutFromKitchenType(
  row: QtyPriceRow,
  room: RoomConfig
): PlacedModule[] {
  const placed: PlacedModule[] = [];
  const uid = (id: string, i: number) =>
    `${id}-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`;

  // ---- EK module references ----
  // Use Express Küchen unit codes from the 2026 product guide.
  const base60   = getModule("U60-L")!;          // 600mm base, 1 door
  const tall     = getModule("SV60-210-1-L")!;   // 2100mm larder
  const fridge   = getModule("SKG-210-178-L")!;  // 2100mm appliance housing (fridge column)
  const wall60   = getModule("O60-75-L")!;       // 600mm wall unit
  const oven     = getModule("SBB-210-3-1-L")!;  // 2100mm appliance housing (oven column)
  const sinkUnit = getModule("SP90")!;           // 900mm sink base
  const dishFront = getModule("TGS60-01")!;      // dishwasher front

  const backZ = -room.depth / 2;

  // Base run: total LM in cm, modules are 60cm wide
  const baseLMcm = Math.round(row.baseUnitLMPerKitchen * 100);
  const baseCount = Math.max(2, Math.floor(baseLMcm / 60));

  // Tall units (pantry / oven housing) — count from LM
  const tallCount = Math.max(0, Math.round(row.tallUnitLMPerKitchen / 0.6));

  // Start from left wall, leave space for tall units + fridge first
  let cursorX = -room.width / 2 + base60.depth / 2; // start aligned to corner
  cursorX = -room.width / 2; // cabinets aligned with wall X-edge
  let runX = cursorX;

  // Place fridge first (left-most on back wall) if it fits
  if (runX + fridge.width <= room.width / 2) {
    placed.push({
      uid: uid(fridge.id, placed.length),
      moduleId: fridge.id,
      position: [runX + fridge.width / 2, fridge.baseY, backZ + fridge.depth / 2],
      rotation: 0,
    });
    runX += fridge.width;
  }

  // Tall units after fridge
  for (let i = 0; i < tallCount; i++) {
    if (runX + tall.width > room.width / 2) break;
    const m = i === 0 && row.oven > 0 ? oven : tall;
    placed.push({
      uid: uid(m.id, placed.length),
      moduleId: m.id,
      position: [runX + m.width / 2, m.baseY, backZ + m.depth / 2],
      rotation: 0,
    });
    runX += m.width;
  }

  // Base units along the rest of the back wall
  let baseStartX = runX;
  let placedBase = 0;
  for (let i = 0; i < baseCount; i++) {
    if (runX + base60.width > room.width / 2) break;
    placed.push({
      uid: uid(base60.id, placed.length),
      moduleId: base60.id,
      position: [runX + base60.width / 2, base60.baseY, backZ + base60.depth / 2],
      rotation: 0,
    });
    runX += base60.width;
    placedBase++;
  }

  // Dishwasher front (replace one base if there's room)
  if (placedBase >= 2) {
    const idx = placed.findIndex(
      (p) => p.moduleId === base60.id && p.position[0] > baseStartX + 0.5
    );
    if (idx >= 0) {
      placed[idx] = { ...placed[idx], moduleId: dishFront.id };
    }
  }

  // ---- Wall cabinets above the base run ----
  const wallCount = Math.max(
    0,
    Math.floor((row.wallUnitLMPerKitchen * 100) / 60)
  );
  let wallX = baseStartX;
  for (let i = 0; i < wallCount; i++) {
    if (wallX + wall60.width > room.width / 2) break;
    placed.push({
      uid: uid(wall60.id, placed.length),
      moduleId: wall60.id,
      position: [wallX + wall60.width / 2, wall60.baseY, backZ + wall60.depth / 2],
      rotation: 0,
    });
    wallX += wall60.width;
  }

  // ---- Sink (replace one base toward the centre) ----
  if (row.sinkType1 + row.sinkType2 > 0 && placedBase >= 2) {
    const sinkX = baseStartX + base60.width;
    placed.push({
      uid: uid(sinkUnit.id, placed.length),
      moduleId: sinkUnit.id,
      position: [sinkX, sinkUnit.baseY, backZ + sinkUnit.depth / 2],
      rotation: 0,
    });
  }

  return placed;
}
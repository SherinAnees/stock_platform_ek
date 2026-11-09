import { useRef, useState } from "react";
import { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { PlacedModule } from "@/lib/kitchen/store";
import { getModule, type ModuleCategory, type StockModule } from "@/lib/kitchen/modules";
import { useKitchen } from "@/lib/kitchen/store";
import { getCarcaseFinish, getFrontFinish, getHandleColor, getWorktop, EK_FRONT_FINISHES, EK_CARCASE_FINISHES } from "@/lib/kitchen/ekFinishes";
import { useThemeSelection, categoryToUnitType } from "@/lib/kitchen/themeSelection";
import { useColorThemes, useThemeFinishes, type FinishUnitCategory } from "@/lib/data/queries";

const EK_FRONT_FINISHES_CODES = new Set(EK_FRONT_FINISHES.map((f) => f.code));
const EK_CARCASE_FINISHES_CODES = new Set(EK_CARCASE_FINISHES.map((f) => f.code));

function finishCategoryFor(category: ModuleCategory): FinishUnitCategory {
  if (category === "wall") return "wall";
  if (category === "tall") return "tall";
  return "base";
}

interface Module3DProps {
  placed: PlacedModule;
  module: StockModule;
  selected: boolean;
  onSelect: () => void;
  onMove: (pos: [number, number, number]) => void;
  roomWidth: number;
  roomDepth: number;
  others: PlacedModule[];
}

export function Module3D({
  placed,
  module: moduleProp,
  selected,
  onSelect,
  onMove,
  roomWidth,
  roomDepth,
  others,
}: Module3DProps) {
  // Visual-only depth override: TGS60-01 (dishwasher front panel) is a
  // 100mm panel in inventory/description, but for 3D visualisation we
  // render it as a full 580mm-deep body so it reads as an integrated
  // dishwasher in the room. Dimension in descriptions stays 100mm.
  const module =
    moduleProp.unitCode === "TGS60-01"
      ? { ...moduleProp, depth: 0.58 }
      : moduleProp;
  const groupRef = useRef<THREE.Group>(null);
  const dragOffset = useRef<THREE.Vector3>(new THREE.Vector3());
  const dragging = useRef(false);
  const pointerDownAt = useRef<{ x: number; y: number } | null>(null);
  const pendingCapture = useRef<{ el: Element | null; id: number } | null>(null);
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const hitPoint = useRef(new THREE.Vector3());
  const [hovered, setHovered] = useState(false);

  const finish = useKitchen((s) => s.finish);
  const customCarcase = useKitchen((s) => s.customCarcase);
  const customFronts = useKitchen((s) => s.customFronts);
  const setDragging = useKitchen((s) => s.setDragging);
  const themesByUnitType = useThemeSelection((s) => s.themesByUnitType);
  const colorThemesQ = useColorThemes();
  const themeFinishesQ = useThemeFinishes();
  const dbThemes = colorThemesQ.data ?? [];
  const dbFinishes = themeFinishesQ.data ?? [];
  // Per-unit theme: prefer the theme captured when placed, else current
  // selection for this unit type. This value can be a legacy code
  // ("PLAN-169-K44") or the DB row id, so resolve both shapes.
  const ut = categoryToUnitType(module.category);
  const unitThemeId = placed.themeId ?? themesByUnitType[ut];
  const dbTheme = dbThemes.find(
    (t) =>
      t.id === unitThemeId ||
      t.code === unitThemeId ||
      `${t.range ?? ""}-${t.front_code ?? ""}-${t.carcass_code ?? ""}` === unitThemeId,
  );
  const dbFinish = dbTheme
    ? dbFinishes.find(
        (f) =>
          f.is_active &&
          f.theme_id === dbTheme.id &&
          f.unit_category === finishCategoryFor(module.category),
      )
    : undefined;
  const themeParts = (dbTheme?.code ?? unitThemeId ?? "").split("-");
  const themeFrontCode = dbFinish?.front_code ?? dbTheme?.front_code ?? themeParts[1];
  const themeCarcaseCode = dbFinish?.carcase_code ?? dbTheme?.carcass_code ?? themeParts[2];
  const effFrontCode = themeFrontCode ?? finish.frontCode;
  const effCarcaseCode = themeCarcaseCode ?? finish.carcaseCode;
  const carcase = getCarcaseFinish(effCarcaseCode);
  const worktop = getWorktop(finish.worktopCode);
  const handleColor = getHandleColor(finish.handleCode);
  // Resolve front colour: dedicated front finish, then custom palette
  const frontStock = getFrontFinish(effFrontCode);
  const frontCustom = customFronts.find((c) => c.code === effFrontCode);
  const frontInList = EK_FRONT_FINISHES_CODES.has(effFrontCode);
  const carcInList = EK_CARCASE_FINISHES_CODES.has(effCarcaseCode);
  const frontColor =
    frontCustom?.color ?? (frontInList ? frontStock.color : dbTheme?.hex_color ?? frontStock.color);
  // Resolve carcase colour from custom too
  const carcCustom = customCarcase.find((c) => c.code === effCarcaseCode);
  const carcaseColor =
    carcCustom?.color ?? (carcInList ? carcase.color : dbTheme?.hex_color ?? carcase.color);

  // Cabinets pick up the EK carcase finish; appliances/accessories keep their
  // own colour. Sink/hob (very thin "appliance" units sitting at counter
  // height) act as worktop surfaces.
  const isCabinet =
    module.category === "base" || module.category === "wall" || module.category === "tall";
  const isWorktopSurface =
    module.category === "appliance" && module.height < 0.1;

  const bodyColor = isCabinet
    ? frontColor
    : isWorktopSurface
      ? worktop.color
      : module.color;
  const accentColor = isCabinet ? handleColor : module.accentColor;
  const bodyMetalness = carcase.material === "metal" || module.category === "appliance" ? 0.4 : 0.05;
  const bodyRoughness = carcase.material === "wood" ? 0.75 : 0.55;

  const isRotated = Math.abs(Math.sin(placed.rotation)) > 0.5;
  const effectiveW = isRotated ? module.depth : module.width;
  const effectiveD = isRotated ? module.width : module.depth;

  // Corner-unit geometry: the unit's footprint (module.depth) includes the
  // 70mm filler that projects in front of a 580mm cabinet body. Snap edges
  // therefore land at the filler tip, so the next unit can butt against it.
  const _code = module.unitCode ?? "";
  const isCornerUnit = /^EUAC110|^EUAE110/.test(_code.trim());
  // EO90-75 L/R: corner WALL unit — 370mm body + 80mm front filler on the
  // blanking-corner side. Overall footprint depth 450mm.
  const isEO90Corner = /^EO90-75/.test(_code.trim());
  // EUC90 corner: inward L-shape cabinet (two 580-deep arms meeting at the
  // back-corner; doors face the inside of the L).
  const isEUC90Corner = /^EUC90/.test(_code.trim());
  // EO2T65-75 L/R: corner WALL unit, inward L-shape with two 250mm doors
  // meeting at the inner corner (one on the front face, one on the side
  // face). Arm depth = 370mm (standard wall depth).
  const isEO2TCorner = /^EO2T65/.test(_code.trim());
  const eo2tIsLeft = /-L\s*$/.test(_code.trim());
  const EO2T_ARM = 0.37;
  const eo2tFrontZ = -module.depth / 2 + EO2T_ARM;
  const eo2tSideX = eo2tIsLeft
    ? -module.width / 2 + EO2T_ARM
    : module.width / 2 - EO2T_ARM;
  // UHBL60-EST: oven housing — open carcase aperture with a 124mm filler
  // panel at the bottom front (no door covering the oven aperture).
  const isOvenHousing = /^UHBL60/.test(_code.trim());
  // SBB-210-3-1 L/R: tall appliance housing with bottom door, oven aperture,
  // fixed filler panel, microwave aperture, and top door.
  const isSBB210 = /^SBB-210/.test(_code.trim());
  const sbbIsLeft = /\sL\s*$/.test(_code); // L = hinge left (handle on right)
  // SKG-210-178 L/R: tall fridge-freezer housing — open carcase shell with
  // 2 fixed shelves and 2 doors (lower 750mm + upper 1350mm).
  const isSKG210 = /^SKG-210/.test(_code.trim());
  const skgIsLeft = /\sL\s*$/.test(_code);
  // SV60-210-1 L/R: larder unit — single full-height pin-joined door (with a
  // horizontal seam at 1350mm from the bottom) and a single handle.
  const isSV60Larder = /^SV60-210/.test(_code.trim());
  // PSS2-7-13-210 L/R: tall unit filler panel — render as two stacked front
  // segments (no handle) to match the technical illustration.
  const isPSS2Filler = /^PSS2-7-13-210/.test(_code.trim());
  const euc90IsLeft = /\sL\s*$/.test(_code);
  const ARM = 0.58; // arm depth
  // Inside-corner coordinates (where the two door faces meet)
  const euc90FrontZ = -module.depth / 2 + ARM; // +0.13 for 900 unit
  const euc90SideX = euc90IsLeft
    ? -module.width / 2 + ARM // +0.13 for L
    : module.width / 2 - ARM; // -0.13 for R
  const bodyDepth = isCornerUnit
    ? 0.58
    : isEO90Corner
      ? 0.37
      : module.depth;
  // Body sits at the BACK of the footprint; front face is set back by the
  // filler depth (70mm for base corners, 80mm for EO90).
  const bodyZCenter =
    isCornerUnit || isEO90Corner ? -module.depth / 2 + bodyDepth / 2 : 0;
  const bodyFrontZ = bodyZCenter + bodyDepth / 2;

  // Snap threshold in meters (~8cm)
  const SNAP = 0.08;

  function footprintFor(p: PlacedModule) {
    const m = getModule(p.moduleId);
    if (!m) return null;
    const rot = Math.abs(Math.sin(p.rotation)) > 0.5;
    const w = rot ? m.depth : m.width;
    const d = rot ? m.width : m.depth;
    return {
      mod: m,
      minX: p.position[0] - w / 2,
      maxX: p.position[0] + w / 2,
      minZ: p.position[2] - d / 2,
      maxZ: p.position[2] + d / 2,
      minY: p.position[1],
      maxY: p.position[1] + m.height,
    };
  }

  function resolve(newX: number, newZ: number): [number, number] {
    const halfW = effectiveW / 2;
    const halfD = effectiveD / 2;
    const myMinY = placed.position[1];
    const myMaxY = myMinY + module.height;

    // Other footprints that overlap vertically with this module
    const obstacles = others
      .map(footprintFor)
      .filter((o): o is NonNullable<ReturnType<typeof footprintFor>> => !!o)
      .filter((o) => o.maxY > myMinY + 0.01 && o.minY < myMaxY - 0.01);

    // 1) Snap to walls
    const wallLeft = -roomWidth / 2 + halfW;
    const wallRight = roomWidth / 2 - halfW;
    const wallBack = -roomDepth / 2 + halfD;
    const wallFront = roomDepth / 2 - halfD;
    let x = newX;
    let z = newZ;
    if (Math.abs(x - wallLeft) < SNAP) x = wallLeft;
    else if (Math.abs(x - wallRight) < SNAP) x = wallRight;
    if (Math.abs(z - wallBack) < SNAP) z = wallBack;
    else if (Math.abs(z - wallFront) < SNAP) z = wallFront;

    // 2) Snap edges to neighbouring cabinets (edge-to-edge, aligned axis)
    for (const o of obstacles) {
      // Z overlap → snap on X
      const zOverlap = z + halfD > o.minZ - SNAP && z - halfD < o.maxZ + SNAP;
      if (zOverlap) {
        const snapRight = o.maxX + halfW; // place to the right of o
        const snapLeft = o.minX - halfW; // place to the left of o
        if (Math.abs(x - snapRight) < SNAP) {
          x = snapRight;
          // align z if close
          if (Math.abs(z - (o.minZ + halfD)) < SNAP) z = o.minZ + halfD;
        } else if (Math.abs(x - snapLeft) < SNAP) {
          x = snapLeft;
          if (Math.abs(z - (o.minZ + halfD)) < SNAP) z = o.minZ + halfD;
        }
      }
      // X overlap → snap on Z
      const xOverlap = x + halfW > o.minX - SNAP && x - halfW < o.maxX + SNAP;
      if (xOverlap) {
        const snapFront = o.maxZ + halfD;
        const snapBack = o.minZ - halfD;
        if (Math.abs(z - snapFront) < SNAP) {
          z = snapFront;
          if (Math.abs(x - (o.minX + halfW)) < SNAP) x = o.minX + halfW;
        } else if (Math.abs(z - snapBack) < SNAP) {
          z = snapBack;
          if (Math.abs(x - (o.minX + halfW)) < SNAP) x = o.minX + halfW;
        }
      }
    }

    // 3) Clamp to room
    x = Math.max(wallLeft, Math.min(wallRight, x));
    z = Math.max(wallBack, Math.min(wallFront, z));

    // 4) Collision resolution: if overlapping any obstacle, push out along
    // the smallest penetration axis.
    for (let iter = 0; iter < 4; iter++) {
      let collided = false;
      for (const o of obstacles) {
        const minX = x - halfW;
        const maxX = x + halfW;
        const minZ = z - halfD;
        const maxZ = z + halfD;
        const overlapX = Math.min(maxX, o.maxX) - Math.max(minX, o.minX);
        const overlapZ = Math.min(maxZ, o.maxZ) - Math.max(minZ, o.minZ);
        if (overlapX > 0.001 && overlapZ > 0.001) {
          collided = true;
          if (overlapX < overlapZ) {
            // push along X
            if (x < (o.minX + o.maxX) / 2) x -= overlapX;
            else x += overlapX;
          } else {
            if (z < (o.minZ + o.maxZ) / 2) z -= overlapZ;
            else z += overlapZ;
          }
          x = Math.max(wallLeft, Math.min(wallRight, x));
          z = Math.max(wallBack, Math.min(wallFront, z));
        }
      }
      if (!collided) break;
    }

    return [x, z];
  }

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onSelect();
    dragging.current = false;
    pointerDownAt.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
    pendingCapture.current = { el: e.target as Element, id: e.pointerId };
    // Immediately lock OrbitControls so the room doesn't rotate while the
    // user is positioning the picked module. We still keep a small movement
    // threshold before treating the gesture as an actual drag (so a plain
    // click just selects without teleporting the unit).
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    // Drag along a horizontal plane at the module's base height for stability
    dragPlane.current.set(new THREE.Vector3(0, 1, 0), -placed.position[1]);
    if (e.ray.intersectPlane(dragPlane.current, hitPoint.current)) {
      dragOffset.current.set(
        placed.position[0] - hitPoint.current.x,
        0,
        placed.position[2] - hitPoint.current.z
      );
    } else {
      dragOffset.current.set(0, 0, 0);
    }
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) {
      const start = pointerDownAt.current;
      if (!start) return;
      const dx = e.nativeEvent.clientX - start.x;
      const dy = e.nativeEvent.clientY - start.y;
      if (dx * dx + dy * dy < 25) return; // < 5px = still a click
      dragging.current = true;
      document.body.style.cursor = "grabbing";
    }
    e.stopPropagation();
    if (!e.ray.intersectPlane(dragPlane.current, hitPoint.current)) return;
    const newX = hitPoint.current.x + dragOffset.current.x;
    const newZ = hitPoint.current.z + dragOffset.current.z;
    const [snappedX, snappedZ] = resolve(newX, newZ);
    onMove([snappedX, placed.position[1], snappedZ]);
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    setDragging(false);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    dragging.current = false;
    pointerDownAt.current = null;
    pendingCapture.current = null;
    document.body.style.cursor = "auto";
  };

  return (
    <group
      ref={groupRef}
      position={[placed.position[0], placed.position[1], placed.position[2]]}
      rotation={[0, placed.rotation, 0]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "grab";
      }}
      onPointerOut={() => {
        setHovered(false);
        if (!dragging.current) document.body.style.cursor = "auto";
      }}
    >
      {/* Carcase shell (sides/top/back visible at edges) */}
      {isCabinet ? (
        <>
          {/* Dummy plinth box under base & tall units (120mm tall, set back 50mm from front) */}
          {(module.category === "base" || module.category === "tall") && placed.position[1] > 0.001 && !isEUC90Corner && (
            <mesh position={[0, -placed.position[1] / 2, bodyZCenter - 0.025]} castShadow receiveShadow>
              <boxGeometry args={[module.width, placed.position[1], bodyDepth - 0.05]} />
              <meshStandardMaterial color={frontColor} roughness={bodyRoughness} metalness={bodyMetalness} />
            </mesh>
          )}
          {!isEUC90Corner && !isEO2TCorner && (
            (isOvenHousing || isSBB210 || isSKG210) ? (
              (() => {
                // Open-front oven housing: render side panels, top, bottom and
                // back so the aperture is visible from the front.
                const T = 0.018; // panel thickness
                const w = module.width;
                const h = module.height;
                const d = bodyDepth;
                const mat = (
                  <meshStandardMaterial
                    color={carcaseColor}
                    roughness={bodyRoughness}
                    metalness={bodyMetalness}
                  />
                );
                return (
                  <>
                    {/* Left side */}
                    <mesh position={[-w / 2 + T / 2, h / 2, bodyZCenter]} castShadow receiveShadow>
                      <boxGeometry args={[T, h, d - 0.01]} />
                      {mat}
                    </mesh>
                    {/* Right side */}
                    <mesh position={[w / 2 - T / 2, h / 2, bodyZCenter]} castShadow receiveShadow>
                      <boxGeometry args={[T, h, d - 0.01]} />
                      {mat}
                    </mesh>
                    {/* Top */}
                    <mesh position={[0, h - T / 2, bodyZCenter]} castShadow receiveShadow>
                      <boxGeometry args={[w - 2 * T, T, d - 0.01]} />
                      {mat}
                    </mesh>
                    {/* Bottom (deck above the filler) */}
                    <mesh position={[0, T / 2, bodyZCenter]} castShadow receiveShadow>
                      <boxGeometry args={[w - 2 * T, T, d - 0.01]} />
                      {mat}
                    </mesh>
                    {/* Back panel */}
                    <mesh
                      position={[0, h / 2, bodyZCenter - d / 2 + T / 2 + 0.005]}
                      castShadow
                      receiveShadow
                    >
                      <boxGeometry args={[w - 2 * T, h, T]} />
                      {mat}
                    </mesh>
                    {/* SBB-210 interior shelves: one above the bottom door
                        (top of oven aperture floor) and one between oven and
                        microwave apertures. */}
                    {isSBB210 && (() => {
                      const gap = 0.005;
                      const hBottom = 0.6;
                      const hOven = 0.59;
                      const y1 = hBottom + gap + T / 2;                  // shelf under oven
                      const y2 = hBottom + gap + hOven + gap + T / 2;    // shelf between oven & microwave
                      return (
                        <>
                          <mesh position={[0, y1, bodyZCenter]} castShadow receiveShadow>
                            <boxGeometry args={[w - 2 * T, T, d - 0.01]} />
                            {mat}
                          </mesh>
                          <mesh position={[0, y2, bodyZCenter]} castShadow receiveShadow>
                            <boxGeometry args={[w - 2 * T, T, d - 0.01]} />
                            {mat}
                          </mesh>
                        </>
                      );
                    })()}
                    {isSKG210 && (() => {
                      // 2 fixed interior shelves at ~1/3 and ~2/3 of height.
                      const y1 = h * 0.34;
                      const y2 = h * 0.67;
                      return (
                        <>
                          <mesh position={[0, y1, bodyZCenter]} castShadow receiveShadow>
                            <boxGeometry args={[w - 2 * T, T, d - 0.01]} />
                            {mat}
                          </mesh>
                          <mesh position={[0, y2, bodyZCenter]} castShadow receiveShadow>
                            <boxGeometry args={[w - 2 * T, T, d - 0.01]} />
                            {mat}
                          </mesh>
                        </>
                      );
                    })()}
                  </>
                );
              })()
            ) : (
              <mesh position={[0, module.height / 2, bodyZCenter - 0.005]} castShadow receiveShadow>
                <boxGeometry args={[module.width, module.height, bodyDepth - 0.01]} />
                <meshStandardMaterial
                  color={carcaseColor}
                  roughness={bodyRoughness}
                  metalness={bodyMetalness}
                />
              </mesh>
            )
          )}
          {/* EUC90 inward L-shape: two arms meeting at back corner. */}
          {isEUC90Corner && (
            <>
              {/* Arm A — along back wall (full width, 580 deep) */}
              <mesh
                position={[0, module.height / 2, -module.depth / 2 + ARM / 2]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[module.width - 0.01, module.height, ARM - 0.01]} />
                <meshStandardMaterial color={carcaseColor} roughness={bodyRoughness} metalness={bodyMetalness} />
              </mesh>
              {/* Arm B — along side wall (580 wide, full depth) */}
              <mesh
                position={[
                  euc90IsLeft ? -module.width / 2 + ARM / 2 : module.width / 2 - ARM / 2,
                  module.height / 2,
                  0,
                ]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[ARM - 0.01, module.height, module.depth - 0.01]} />
                <meshStandardMaterial color={carcaseColor} roughness={bodyRoughness} metalness={bodyMetalness} />
              </mesh>
              {/* Plinths under each arm */}
              {(module.category === "base" || module.category === "tall") && placed.position[1] > 0.001 && (
                <>
                  <mesh
                    position={[0, -placed.position[1] / 2, -module.depth / 2 + ARM / 2 - 0.025]}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[module.width, placed.position[1], ARM - 0.05]} />
                    <meshStandardMaterial color={frontColor} roughness={bodyRoughness} metalness={bodyMetalness} />
                  </mesh>
                  <mesh
                    position={[
                      (euc90IsLeft ? -module.width / 2 + ARM / 2 : module.width / 2 - ARM / 2) +
                        (euc90IsLeft ? -0.025 : 0.025),
                      -placed.position[1] / 2,
                      0,
                    ]}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[ARM - 0.05, placed.position[1], module.depth]} />
                    <meshStandardMaterial color={frontColor} roughness={bodyRoughness} metalness={bodyMetalness} />
                  </mesh>
                </>
              )}
            </>
          )}
          {/* EO2T65-75 wall corner: inward L-shape with two 370-deep arms */}
          {isEO2TCorner && (
            <>
              {/* Arm A — along back wall */}
              <mesh
                position={[0, module.height / 2, -module.depth / 2 + EO2T_ARM / 2]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[module.width - 0.01, module.height, EO2T_ARM - 0.01]} />
                <meshStandardMaterial color={carcaseColor} roughness={bodyRoughness} metalness={bodyMetalness} />
              </mesh>
              {/* Arm B — along side wall */}
              <mesh
                position={[
                  eo2tIsLeft ? -module.width / 2 + EO2T_ARM / 2 : module.width / 2 - EO2T_ARM / 2,
                  module.height / 2,
                  0,
                ]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[EO2T_ARM - 0.01, module.height, module.depth - 0.01]} />
                <meshStandardMaterial color={carcaseColor} roughness={bodyRoughness} metalness={bodyMetalness} />
              </mesh>
            </>
          )}
          {/* Front door panel(s) — shows the front colour.
              Base & wall units >= 80cm get a double door (two leaves with a centre reveal). */}
          {(() => {
            // Corner units: single ~600mm door on one side + blanking panel on the other.
            // L = door on right (corner is on the LEFT of the cabinet).
            // R = door on left (corner is on the RIGHT of the cabinet).
            const code = module.unitCode ?? "";
            const isCorner = /^EUAC110|^EUAE110/.test(code.trim());
            const isEUC90 = /^EUC90/.test(code.trim());
            const isEO2T = /^EO2T65/.test(code.trim());
            const isEO90 = /^EO90-75/.test(code.trim());
            const isU2AS = /^U2AS/.test(code.trim());
            const isOven = /^UHBL60/.test(code.trim());
            const isSBB = /^SBB-210/.test(code.trim());
            const isSKG = /^SKG-210/.test(code.trim());
            const isSV60 = /^SV60-210/.test(code.trim());
            if (isSV60) {
              // Pin-joined single door: two leaves butted together at 1350mm
              // from the bottom, rendered as separate panels so the seam is
              // visible. One handle near the centre seam.
              const seamY = 0.75; // 750mm from top = 1350mm from bottom (h=2.1)
              const gap = 0.002; // hairline seam
              const hUpper = module.height - seamY - gap / 2;
              const hLower = seamY - gap / 2;
              const yUpper = seamY + gap / 2 + hUpper / 2;
              const yLower = hLower / 2;
              const w = module.width - 0.01;
              const z = module.depth / 2 + 0.001;
              const HANDLE_INSET = 0.05;
              const sv60Mat = (
                <meshStandardMaterial
                  color={frontColor}
                  roughness={bodyRoughness}
                  metalness={bodyMetalness}
                  emissive={selected ? "#b08d57" : "#000000"}
                  emissiveIntensity={selected ? 0.15 : 0}
                />
              );
              return (
                <>
                  <mesh position={[0, yLower, z]} castShadow receiveShadow>
                    <boxGeometry args={[w, hLower, 0.018]} />
                    {sv60Mat}
                  </mesh>
                  <mesh position={[0, yUpper, z]} castShadow receiveShadow>
                    <boxGeometry args={[w, hUpper, 0.018]} />
                    {sv60Mat}
                  </mesh>
                  {/* Single handle on the upper leaf, near the bottom edge */}
                  <group position={[0, yUpper - hUpper / 2 + HANDLE_INSET, z + 0.012]}>
                    <mesh castShadow>
                      <boxGeometry args={[0.212, 0.012, 0.012]} />
                      <meshStandardMaterial color={handleColor} metalness={0.6} roughness={0.4} />
                    </mesh>
                    <mesh position={[-0.098, 0, -0.008]}>
                      <cylinderGeometry args={[0.005, 0.005, 0.016, 12]} />
                      <meshStandardMaterial color={handleColor} metalness={0.6} roughness={0.4} />
                    </mesh>
                    <mesh position={[0.098, 0, -0.008]}>
                      <cylinderGeometry args={[0.005, 0.005, 0.016, 12]} />
                      <meshStandardMaterial color={handleColor} metalness={0.6} roughness={0.4} />
                    </mesh>
                  </group>
                </>
              );
            }
            if (isPSS2Filler) {
              // Tall filler panel: same full-width two-door front as SKG-210-178,
              // but at 300mm module width and without any handle.
              const gap = 0.004;
              const hLower = 0.75;
              const hUpper = module.height - hLower - gap;
              const yLower = hLower / 2;
              const yUpper = hLower + gap + hUpper / 2;
              const w = module.width - 0.01;
              const z = module.depth / 2 + 0.001;
              const pss2Mat = (
                <meshStandardMaterial
                  color={frontColor}
                  roughness={bodyRoughness}
                  metalness={bodyMetalness}
                  emissive={selected ? "#b08d57" : "#000000"}
                  emissiveIntensity={selected ? 0.15 : 0}
                />
              );
              return (
                <>
                  <mesh position={[0, yLower, z]} castShadow receiveShadow>
                    <boxGeometry args={[w, hLower, 0.018]} />
                    {pss2Mat}
                  </mesh>
                  <mesh position={[0, yUpper, z]} castShadow receiveShadow>
                    <boxGeometry args={[w, hUpper, 0.018]} />
                    {pss2Mat}
                  </mesh>
                </>
              );
            }
            if (isSKG) {
              // 2 doors covering the full front: lower 750mm + upper 1350mm.
              const gap = 0.004;
              const hLower = 0.75;
              const hUpper = module.height - hLower - gap;
              const yLower = hLower / 2;
              const yUpper = hLower + gap + hUpper / 2;
              const w = module.width - 0.01;
              const z = module.depth / 2 + 0.001;
              const HANDLE_INSET = 0.05;
              const skgMat = (
                <meshStandardMaterial
                  color={frontColor}
                  roughness={bodyRoughness}
                  metalness={bodyMetalness}
                  emissive={selected ? "#b08d57" : "#000000"}
                  emissiveIntensity={selected ? 0.15 : 0}
                />
              );
              const skgPanels = [
                { y: yLower, h: hLower, handleY: hLower - HANDLE_INSET },
                { y: yUpper, h: hUpper, handleY: hLower + gap + HANDLE_INSET },
              ];
              return (
                <>
                  {skgPanels.map((p, i) => (
                    <group key={i}>
                      <mesh position={[0, p.y, z]} castShadow receiveShadow>
                        <boxGeometry args={[w, p.h, 0.018]} />
                        {skgMat}
                      </mesh>
                      <group position={[0, p.handleY, z + 0.012]}>
                        <mesh castShadow>
                          <boxGeometry args={[0.212, 0.012, 0.012]} />
                          <meshStandardMaterial color={handleColor} metalness={0.6} roughness={0.4} />
                        </mesh>
                        <mesh position={[-0.098, 0, -0.008]}>
                          <cylinderGeometry args={[0.005, 0.005, 0.016, 12]} />
                          <meshStandardMaterial color={handleColor} metalness={0.6} roughness={0.4} />
                        </mesh>
                        <mesh position={[0.098, 0, -0.008]}>
                          <cylinderGeometry args={[0.005, 0.005, 0.016, 12]} />
                          <meshStandardMaterial color={handleColor} metalness={0.6} roughness={0.4} />
                        </mesh>
                      </group>
                    </group>
                  ))}
                </>
              );
            }
            if (isSBB) {
              // Layout from floor up (heights in m):
              //   bottom door 600, oven aperture 590, filler 50,
              //   microwave aperture 380, top door 450  (≈ 2070 + gaps ≈ 2100)
              // Stack from floor up:
              //   bottom door 600, oven aperture 590, microwave aperture 380,
              //   fixed filler 50, top door 450
              const gap = 0.005;
              const hBottom = 0.6;
              const hOven = 0.59;
              const hMicro = 0.38;
              const hFiller = 0.05;
              const hTop = module.height - (hBottom + gap + hOven + gap + hMicro + gap + hFiller + gap);
              const yBottom = hBottom / 2;
              const yFiller = hBottom + gap + hOven + gap + hMicro + gap + hFiller / 2;
              const yTop = module.height - hTop / 2;
              const w = module.width - 0.01;
              const z = module.depth / 2 + 0.001;
              const HANDLE_INSET = 0.05; // 50mm from door edge
              // Lower door: handle near TOP edge. Upper door: handle near BOTTOM edge.
              const handleYBottom = hBottom - HANDLE_INSET;          // local Y on bottom door
              const handleYTop = (module.height - hTop) + HANDLE_INSET; // local Y on top door
              const panels = [
                { y: yBottom, h: hBottom, handle: true, handleY: handleYBottom },
                { y: yFiller, h: hFiller, handle: false, handleY: 0 },
                { y: yTop, h: hTop, handle: true, handleY: handleYTop },
              ];
              const sbbMat = (
                <meshStandardMaterial
                  color={frontColor}
                  roughness={bodyRoughness}
                  metalness={bodyMetalness}
                  emissive={selected ? "#b08d57" : "#000000"}
                  emissiveIntensity={selected ? 0.15 : 0}
                />
              );
              return (
                <>
                  {panels.map((p, i) => (
                    <group key={i}>
                      <mesh position={[0, p.y, z]} castShadow receiveShadow>
                        <boxGeometry args={[w, p.h, 0.018]} />
                        {sbbMat}
                      </mesh>
                      {p.handle && (
                        <group position={[0, p.handleY, z + 0.012]}>
                          <mesh castShadow>
                            <boxGeometry args={[0.212, 0.012, 0.012]} />
                            <meshStandardMaterial color={handleColor} metalness={0.6} roughness={0.4} />
                          </mesh>
                          <mesh position={[-0.098, 0, -0.008]}>
                            <cylinderGeometry args={[0.005, 0.005, 0.016, 12]} />
                            <meshStandardMaterial color={handleColor} metalness={0.6} roughness={0.4} />
                          </mesh>
                          <mesh position={[0.098, 0, -0.008]}>
                            <cylinderGeometry args={[0.005, 0.005, 0.016, 12]} />
                            <meshStandardMaterial color={handleColor} metalness={0.6} roughness={0.4} />
                          </mesh>
                        </group>
                      )}
                    </group>
                  ))}
                </>
              );
            }
            if (isOven) {
              // Only a small filler panel at the bottom front (124mm tall).
              const fillerH = 0.124;
              return (
                <mesh
                  position={[0, fillerH / 2, module.depth / 2 + 0.001]}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[module.width - 0.01, fillerH, 0.018]} />
                  <meshStandardMaterial
                    color={frontColor}
                    roughness={bodyRoughness}
                    metalness={bodyMetalness}
                    emissive={selected ? "#b08d57" : "#000000"}
                    emissiveIntensity={selected ? 0.15 : 0}
                  />
                </mesh>
              );
            }
            if (isEUC90) {
              // Inward L: doors sit on the two INNER faces of the L, meeting
              // at the inside corner (in the front of the unit, on the side
              // opposite the kitchen corner).
              const isLeft = euc90IsLeft;
              const doorW = 0.32; // 900 - 580 = 320mm
              const halfW = module.width / 2;
              const halfD = module.depth / 2;
              // Front-facing door — on arm A's exposed front edge, opposite the
              // wall corner. For L the wall corner is at left, so the exposed
              // strip is on the right (x ∈ [+0.13, +0.45]).
              const frontX = isLeft
                ? halfW - doorW / 2 - 0.005   // right portion of front
                : -halfW + doorW / 2 + 0.005; // left portion of front
              const frontZ = euc90FrontZ + 0.001;
              // Side-facing door — on arm B's exposed inner side, near the
              // front (z ∈ [+0.13, +0.45]).
              const sideZ = halfD - doorW / 2 - 0.005;
              const sideX = euc90SideX + (isLeft ? 0.001 : -0.001);
              const mat = (
                <meshStandardMaterial
                  color={frontColor}
                  roughness={bodyRoughness}
                  metalness={bodyMetalness}
                  emissive={selected ? "#b08d57" : "#000000"}
                  emissiveIntensity={selected ? 0.15 : 0}
                />
              );
              return (
                <>
                  {/* Door on the FRONT face (handle side) */}
                  <mesh
                    position={[frontX, module.height / 2, frontZ]}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[doorW, module.height - 0.01, 0.018]} />
                    {mat}
                  </mesh>
                  {/* Door on the SIDE face (no handle) */}
                  <mesh
                    position={[sideX, module.height / 2, sideZ]}
                    rotation={[0, isLeft ? -Math.PI / 2 : Math.PI / 2, 0]}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[doorW, module.height - 0.01, 0.018]} />
                    {mat}
                  </mesh>
                </>
              );
            }
            if (isEO2T) {
              // Inward L wall corner: two 250mm doors on the inner faces of
              // the L, meeting at the inside corner (opposite the wall corner).
              const isLeft = eo2tIsLeft;
              const doorW = 0.25;
              const halfW = module.width / 2;
              const halfD = module.depth / 2;
              const HANDLE_INSET = 0.05;
              // Front-facing door — on the exposed front strip of arm A.
              const frontX = isLeft
                ? halfW - doorW / 2 - 0.005
                : -halfW + doorW / 2 + 0.005;
              const frontZ = eo2tFrontZ + 0.001;
              // Side-facing door — on the exposed inner side of arm B, near front.
              const sideZ = halfD - doorW / 2 - 0.005;
              const sideX = eo2tSideX + (isLeft ? 0.001 : -0.001);
              const mat = (
                <meshStandardMaterial
                  color={frontColor}
                  roughness={bodyRoughness}
                  metalness={bodyMetalness}
                  emissive={selected ? "#b08d57" : "#000000"}
                  emissiveIntensity={selected ? 0.15 : 0}
                />
              );
              // Horizontal handle on the SIDE door (the right-arm door for R,
              // left-arm door for L), near the bottom edge. The side door is
              // rotated 90° around Y so it lies along world Z; a bar long
              // along Z reads as horizontal across the door's width.
              const sideHandleX = isLeft ? sideX + 0.013 : sideX - 0.013;
              return (
                <>
                  {/* Front-face door */}
                  <mesh
                    position={[frontX, module.height / 2, frontZ]}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[doorW, module.height - 0.01, 0.018]} />
                    {mat}
                  </mesh>
                  {/* Side-face door */}
                  <mesh
                    position={[sideX, module.height / 2, sideZ]}
                    rotation={[0, isLeft ? -Math.PI / 2 : Math.PI / 2, 0]}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[doorW, module.height - 0.01, 0.018]} />
                    {mat}
                  </mesh>
                  {/* Horizontal handle on the side door, near bottom edge */}
                  <mesh
                    position={[sideHandleX, HANDLE_INSET, sideZ]}
                    castShadow
                  >
                    <boxGeometry args={[0.012, 0.012, 0.18]} />
                    <meshStandardMaterial color={handleColor} metalness={0.6} roughness={0.4} />
                  </mesh>
                </>
              );
            }
            if (isCorner) {
              const isLeft = /\sL\s*$/.test(code);
              const reveal = 0.004;
              const doorW = 0.45;
              const blankW = module.width - 0.01 - doorW - reveal;
              // Door sits on the OPPOSITE side from the corner.
              const doorX = isLeft
                ? module.width / 2 - doorW / 2 - 0.005
                : -module.width / 2 + doorW / 2 + 0.005;
              const blankX = isLeft
                ? -module.width / 2 + blankW / 2 + 0.005
                : module.width / 2 - blankW / 2 - 0.005;
              const mat = (
                <meshStandardMaterial
                  color={frontColor}
                  roughness={bodyRoughness}
                  metalness={bodyMetalness}
                  emissive={selected ? "#b08d57" : "#000000"}
                  emissiveIntensity={selected ? 0.15 : 0}
                />
              );
              return (
                <>
                  {/* Working door */}
                  <mesh
                    position={[doorX, module.height / 2, bodyFrontZ + 0.001]}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[doorW, module.height - 0.01, 0.018]} />
                    {mat}
                  </mesh>
                  {/* Blanking panel on the blind/corner side */}
                  <mesh
                    position={[blankX, module.height / 2, bodyFrontZ + 0.001]}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[blankW, module.height - 0.01, 0.018]} />
                    {mat}
                  </mesh>
                  {/* Corner filler (580mm × 70mm) sits at the FRONT of the
                      footprint, in front of the 580mm cabinet body, on the
                      blanking-side end. Its tip is the snap edge. */}
                  <mesh
                    position={[
                      isLeft
                        ? -module.width / 2 + 0.29
                        : module.width / 2 - 0.29,
                      module.height / 2,
                      module.depth / 2 - 0.035,
                    ]}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[0.58, module.height - 0.01, 0.07]} />
                    {mat}
                  </mesh>
                </>
              );
            }
            if (isEO90) {
              // Corner wall unit: single 450mm door on the side opposite the
              // corner, full-height blanking panel on the corner side. L =
              // corner on left → door on right.
              const isLeft = /\sL\s*$/.test(code);
              const reveal = 0.004;
              const doorW = 0.45;
              const blankW = module.width - 0.01 - doorW - reveal;
              const doorX = isLeft
                ? module.width / 2 - doorW / 2 - 0.005
                : -module.width / 2 + doorW / 2 + 0.005;
              const blankX = isLeft
                ? -module.width / 2 + blankW / 2 + 0.005
                : module.width / 2 - blankW / 2 - 0.005;
              // Door front sits on the 370mm body face (set back 80mm).
              const z = bodyFrontZ + 0.001;
              const mat = (
                <meshStandardMaterial
                  color={frontColor}
                  roughness={bodyRoughness}
                  metalness={bodyMetalness}
                  emissive={selected ? "#b08d57" : "#000000"}
                  emissiveIntensity={selected ? 0.15 : 0}
                />
              );
              return (
                <>
                  <mesh position={[doorX, module.height / 2, z]} castShadow receiveShadow>
                    <boxGeometry args={[doorW, module.height - 0.01, 0.018]} />
                    {mat}
                  </mesh>
                  <mesh position={[blankX, module.height / 2, z]} castShadow receiveShadow>
                    <boxGeometry args={[blankW, module.height - 0.01, 0.018]} />
                    {mat}
                  </mesh>
                  {/* Corner filler panel: 370mm wide × 80mm deep at the
                      blanking-corner end, projecting in front of the body
                      to the front of the overall 450mm footprint. */}
                  <mesh
                    position={[
                      isLeft
                        ? -module.width / 2 + 0.185
                        : module.width / 2 - 0.185,
                      module.height / 2,
                      module.depth / 2 - 0.04,
                    ]}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[0.37, module.height - 0.01, 0.08]} />
                    {mat}
                  </mesh>
                </>
              );
            }
            const isDouble =
              !isU2AS &&
              module.frontLayout !== "drawer_over_door" &&
              module.frontLayout !== "drawer_stack" &&
              module.frontLayout !== "horizontal_split" &&
              module.frontLayout !== "single_door" &&
              (module.category === "base" || module.category === "wall") &&
              module.width >= 0.79; // covers 80, 90, 100, 120cm
            const doorMat = (
              <meshStandardMaterial
                color={frontColor}
                roughness={bodyRoughness}
                metalness={bodyMetalness}
                emissive={selected ? "#b08d57" : "#000000"}
                emissiveIntensity={selected ? 0.15 : 0}
              />
            );
            const renderHandle = (
              key: string,
              pos: import("@/lib/kitchen/modules").HandlePosition | undefined,
              opts: { xCenter: number; yBottom: number; yTop: number; doorW: number; z: number; hinge?: "L" | "R" },
            ) => {
              const p = pos ?? "top_center";
              const inset = 0.05; // 50mm from top/bottom edge of the front
              const barLen = 0.212;
              const yMid = (opts.yBottom + opts.yTop) / 2;
              let x = opts.xCenter;
              let y = opts.yTop - inset;
              let vertical = false;
              if (p === "top_center") {
                y = opts.yTop - inset;
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
                x = opts.xCenter;
                y = yMid;
                vertical = true;
              } else if (p === "bottom_center") {
                y = opts.yBottom + inset;
              }
              return (
                <group key={key} position={[x, y, opts.z + 0.014]} rotation={[0, 0, vertical ? Math.PI / 2 : 0]}>
                  <mesh castShadow>
                    <boxGeometry args={[barLen, 0.012, 0.012]} />
                    <meshStandardMaterial color={handleColor} metalness={0.6} roughness={0.4} />
                  </mesh>
                  <mesh position={[-0.098, 0, -0.008]}>
                    <cylinderGeometry args={[0.005, 0.005, 0.016, 12]} />
                    <meshStandardMaterial color={handleColor} metalness={0.6} roughness={0.4} />
                  </mesh>
                  <mesh position={[0.098, 0, -0.008]}>
                    <cylinderGeometry args={[0.005, 0.005, 0.016, 12]} />
                    <meshStandardMaterial color={handleColor} metalness={0.6} roughness={0.4} />
                  </mesh>
                </group>
              );
            };
            if (module.frontLayout === "horizontal_split" && module.frontSections && module.frontSections.length > 0) {
              const gap = 0.004;
              const secs = module.frontSections;
              const wDoor = module.width - 0.01;
              const z = module.depth / 2 + 0.001;
              const heights = secs.map((s) => Math.max(0.02, s.height_mm / 1000));
              const innerH = module.height - 0.01 - gap * (secs.length - 1);
              const sum = heights.reduce((a, b) => a + b, 0);
              const scale = sum > 0 ? innerH / sum : 1;
              const hs = heights.map((h) => h * scale);
              let cursor = 0.005;
              const items = secs.map((s, i) => {
                const h = hs[i];
                const y = cursor + h / 2;
                cursor += h + gap;
                return { s, y, h };
              });
              return (
                <>
                  {items.map((it, i) => {
                    if (it.s.kind === "niche") {
                      // Render an aperture: recessed dark back + top/bottom shelves,
                      // matching the SBB-210 style oven housing look.
                      const T = 0.018;
                      const inner = wDoor - 0.01;
                      const recessZ = z - 0.09; // 90mm deep recess
                      return (
                        <group key={i}>
                          {/* Dark recess (back of aperture) */}
                          <mesh position={[0, it.y, recessZ]} receiveShadow>
                            <boxGeometry args={[inner, it.h - 2 * T, 0.002]} />
                            <meshStandardMaterial color="#1a1a1a" roughness={0.9} metalness={0} />
                          </mesh>
                          {/* Bottom shelf */}
                          <mesh position={[0, it.y - it.h / 2 + T / 2, z - 0.045]} castShadow receiveShadow>
                            <boxGeometry args={[inner, T, 0.09]} />
                            <meshStandardMaterial color={carcaseColor} roughness={bodyRoughness} metalness={bodyMetalness} />
                          </mesh>
                          {/* Top shelf */}
                          <mesh position={[0, it.y + it.h / 2 - T / 2, z - 0.045]} castShadow receiveShadow>
                            <boxGeometry args={[inner, T, 0.09]} />
                            <meshStandardMaterial color={carcaseColor} roughness={bodyRoughness} metalness={bodyMetalness} />
                          </mesh>
                        </group>
                      );
                    }
                    if (it.s.kind === "door_double") {
                      const reveal = 0.004;
                      const leafW = (wDoor - reveal) / 2;
                      const off = leafW / 2 + reveal / 2;
                      return (
                        <group key={i}>
                          <mesh position={[-off, it.y, z]} castShadow receiveShadow>
                            <boxGeometry args={[leafW, it.h, 0.018]} />
                            {doorMat}
                          </mesh>
                          <mesh position={[off, it.y, z]} castShadow receiveShadow>
                            <boxGeometry args={[leafW, it.h, 0.018]} />
                            {doorMat}
                          </mesh>
                        </group>
                      );
                    }
                    return (
                      <mesh key={i} position={[0, it.y, z]} castShadow receiveShadow>
                        <boxGeometry args={[wDoor, it.h, 0.018]} />
                        {doorMat}
                      </mesh>
                    );
                  })}
                  {items.map((it, i) => {
                    if (it.s.kind === "niche") return null;
                    const yBottom = it.y - it.h / 2;
                    const yTop = it.y + it.h / 2;
                    const hp = it.s.handle ?? module.handlePosition;
                    if (it.s.kind === "door_double") {
                      const leafW = (wDoor - 0.004) / 2;
                      const off = leafW / 2 + 0.002;
                      return (
                        <group key={`h-${i}`}>
                          {renderHandle(`hl-${i}`, hp, { xCenter: -off, yBottom, yTop, doorW: leafW, z, hinge: "R" })}
                          {renderHandle(`hr-${i}`, hp, { xCenter: off, yBottom, yTop, doorW: leafW, z, hinge: "L" })}
                        </group>
                      );
                    }
                    if (it.s.kind === "drawer") {
                      return renderHandle(`hd-${i}`, hp, { xCenter: 0, yBottom, yTop, doorW: wDoor, z });
                    }
                    // single door
                    return renderHandle(`hs-${i}`, hp, { xCenter: 0, yBottom, yTop, doorW: wDoor, z, hinge: it.s.hinge });
                  })}
                </>
              );
            }
            if (module.frontLayout === "drawer_over_door") {
              // Top drawer + single door below
              const gap = 0.004;
              const w = module.width - 0.01;
              const drawerH = Math.max(0.05, (module.drawerHeightMm ?? 150) / 1000);
              const innerH = module.height - 0.01;
              const doorH = Math.max(0.05, innerH - drawerH - gap);
              const z = module.depth / 2 + 0.001;
              const yDoor = 0.005 + doorH / 2;
              const yDrawer = 0.005 + doorH + gap + drawerH / 2;
              const hp = module.handlePosition;
              const drawerBottom = 0.005 + doorH + gap;
              const drawerTop = drawerBottom + drawerH;
              const doorBottom = 0.005;
              const doorTop = doorBottom + doorH;
              return (
                <>
                  <mesh position={[0, yDoor, z]} castShadow receiveShadow>
                    <boxGeometry args={[w, doorH, 0.018]} />
                    {doorMat}
                  </mesh>
                  <mesh position={[0, yDrawer, z]} castShadow receiveShadow>
                    <boxGeometry args={[w, drawerH, 0.018]} />
                    {doorMat}
                  </mesh>
                  {renderHandle("dod-drawer", hp, { xCenter: 0, yBottom: drawerBottom, yTop: drawerTop, doorW: w, z })}
                  {renderHandle("dod-door", hp, { xCenter: 0, yBottom: doorBottom, yTop: doorTop, doorW: w, z })}
                </>
              );
            }
            if (module.frontLayout === "drawer_stack" && module.drawerHeightsMm && module.drawerHeightsMm.length > 0) {
              const gap = 0.004;
              const w = module.width - 0.01;
              const z = module.depth / 2 + 0.001;
              const heights = module.drawerHeightsMm.map((mm) => Math.max(0.02, mm / 1000));
              // Fit to available inner height, preserving ratios if user's sum ≠ height
              const innerH = module.height - 0.01 - gap * (heights.length - 1);
              const sumH = heights.reduce((a, b) => a + b, 0);
              const scale = sumH > 0 ? innerH / sumH : 1;
              const hs = heights.map((h) => h * scale);
              // Build from bottom up
              let cursor = 0.005;
              const drawers = hs.map((h) => {
                const y = cursor + h / 2;
                cursor += h + gap;
                return { y, h };
              });
              const hp = module.handlePosition;
              return (
                <>
                  {drawers.map((d, i) => (
                    <group key={i}>
                      <mesh position={[0, d.y, z]} castShadow receiveShadow>
                        <boxGeometry args={[w, d.h, 0.018]} />
                        {doorMat}
                      </mesh>
                      {renderHandle(`ds-${i}`, hp, { xCenter: 0, yBottom: d.y - d.h / 2, yTop: d.y + d.h / 2, doorW: w, z })}
                    </group>
                  ))}
                </>
              );
            }
            if (isU2AS) {
              // 3-drawer base: fronts in 1:2:3 ratio (≈150/300/450mm of 900mm
              // overall, scaled to module.height). Top = thinnest.
              const gap = 0.004;
              const totalRatio = 1 + 2 + 3;
              const innerH = module.height - 0.01 - gap * 2;
              const h1 = (innerH * 1) / totalRatio; // top (150)
              const h2 = (innerH * 2) / totalRatio; // middle (300)
              const h3 = (innerH * 3) / totalRatio; // bottom (450)
              const w = module.width - 0.01;
              // Centre Y for each front (module local origin: 0 at floor base)
              const yBottom = 0.005 + h3 / 2;
              const yMiddle = 0.005 + h3 + gap + h2 / 2;
              const yTop = 0.005 + h3 + gap + h2 + gap + h1 / 2;
              const z = module.depth / 2 + 0.001;
              const drawers = [
                { y: yBottom, h: h3 },
                { y: yMiddle, h: h2 },
                { y: yTop, h: h1 },
              ];
              return (
                <>
                  {drawers.map((d, i) => (
                    <group key={i}>
                      <mesh position={[0, d.y, z]} castShadow receiveShadow>
                        <boxGeometry args={[w, d.h, 0.018]} />
                        {doorMat}
                      </mesh>
                      {/* Horizontally-centred bar handle on each drawer */}
                      <group position={[0, d.y, z + 0.012]}>
                        <mesh castShadow>
                          <boxGeometry args={[0.212, 0.012, 0.012]} />
                          <meshStandardMaterial color={handleColor} metalness={0.6} roughness={0.4} />
                        </mesh>
                        <mesh position={[-0.098, 0, -0.008]}>
                          <cylinderGeometry args={[0.005, 0.005, 0.016, 12]} />
                          <meshStandardMaterial color={handleColor} metalness={0.6} roughness={0.4} />
                        </mesh>
                        <mesh position={[0.098, 0, -0.008]}>
                          <cylinderGeometry args={[0.005, 0.005, 0.016, 12]} />
                          <meshStandardMaterial color={handleColor} metalness={0.6} roughness={0.4} />
                        </mesh>
                      </group>
                    </group>
                  ))}
                </>
              );
            }
            if (!isDouble) {
              return (
                <mesh
                  position={[0, module.height / 2, module.depth / 2 + 0.001]}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[module.width - 0.01, module.height - 0.01, 0.018]} />
                  {doorMat}
                </mesh>
              );
            }
            const reveal = 0.004; // gap between the two doors
            const leafW = (module.width - 0.01 - reveal) / 2;
            const offset = leafW / 2 + reveal / 2;
            return (
              <>
                <mesh
                  position={[-offset, module.height / 2, module.depth / 2 + 0.001]}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[leafW, module.height - 0.01, 0.018]} />
                  {doorMat}
                </mesh>
                <mesh
                  position={[offset, module.height / 2, module.depth / 2 + 0.001]}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[leafW, module.height - 0.01, 0.018]} />
                  {doorMat}
                </mesh>
              </>
            );
          })()}
        </>
      ) : (
        <mesh position={[0, module.height / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[module.width, module.height, module.depth]} />
          <meshStandardMaterial
            color={bodyColor}
            roughness={bodyRoughness}
            metalness={bodyMetalness}
            emissive={selected ? "#b08d57" : "#000000"}
            emissiveIntensity={selected ? 0.15 : 0}
          />
        </mesh>
      )}
      {/* Bar handles — 128mm hole spacing, stainless steel */}
      {isCabinet && module.height > 0.1 && module.frontLayout !== "drawer_over_door" && module.frontLayout !== "drawer_stack" && module.frontLayout !== "horizontal_split" && !/^U2AS/.test(module.unitCode ?? "") && !/^UHBL60/.test(module.unitCode ?? "") && !/^SBB-210/.test(module.unitCode ?? "") && !/^SKG-210/.test(module.unitCode ?? "") && !/^SV60-210/.test(module.unitCode ?? "") && !/^EO2T65/.test(module.unitCode ?? "") && !/^PSS2-7-13-210/.test(module.unitCode ?? "") && !/^PSO2-75/.test(module.unitCode ?? "") && !/^PSU2/.test(module.unitCode ?? "") && (() => {
        // Tall units: door split at 1.4m (wall-cabinet level) measured from floor.
        // Module group is at baseY (typically 0 for tall), so split is at 1.4 in local Y.
        const SPLIT = 1.4 - placed.position[1];
        const isTallSplit =
          !module.frontLayout && module.category === "tall" && SPLIT > 0.1 && SPLIT < module.height - 0.1;
        const HANDLE_INSET = 0.05; // 50mm from door edge
        const hp = module.handlePosition ?? (module.category === "wall" ? "bottom_center" : "top_center");
        const isBottomCentered = hp === "bottom_center";
        const bottomCenteredY = 0.055; // visible front starts at 5mm, so handle center is 50mm above it
        const positions: number[] = []; // local Y positions for handle centres
        if (module.category === "base") {
          positions.push(isBottomCentered ? bottomCenteredY : module.height - HANDLE_INSET);
        } else if (module.category === "wall") {
          positions.push(isBottomCentered ? bottomCenteredY : module.height - HANDLE_INSET);
        } else if (module.category === "tall") {
          if (isTallSplit) {
            // lower door: handle near top; upper door: handle near bottom (meet at seam)
            positions.push(SPLIT - HANDLE_INSET);
            positions.push(SPLIT + HANDLE_INSET);
          } else {
            positions.push(isBottomCentered ? bottomCenteredY : module.height - HANDLE_INSET);
          }
        }
        // Corner units get a single handle on the working-door side.
        const code = module.unitCode ?? "";
        const isCorner = /^EUAC110|^EUAE110/.test(code.trim());
        const isEUC90 = /^EUC90/.test(code.trim());
        const isEO90 = /^EO90-75/.test(code.trim());
        const isDouble =
          !isCorner && !isEUC90 && !isEO90 &&
          (module.category === "base" || module.category === "wall") &&
          module.width >= 0.79;
        let xOffsets: number[];
        if (isEUC90) {
          const isLeft = /\sL\s*$/.test(code);
          const doorW = 0.32;
          xOffsets = [
            isLeft
              ? module.width / 2 - doorW / 2 - 0.005
              : -module.width / 2 + doorW / 2 + 0.005,
          ];
        } else if (isCorner || isEO90) {
          const isLeft = /\sL\s*$/.test(code);
          const doorW = 0.45;
          const doorX = isLeft
            ? module.width / 2 - doorW / 2 - 0.005
            : -module.width / 2 + doorW / 2 + 0.005;
          // Handle centred horizontally on the working door.
          xOffsets = [doorX];
        } else {
          xOffsets = isDouble
            ? [-module.width / 4, module.width / 4]
            : [0];
        }
        return (
          <group>
            {positions.flatMap((y, i) =>
              xOffsets.map((x, j) => (
              <group key={`${i}-${j}`} position={[x, y, (isEUC90 ? euc90FrontZ : (isCorner || isEO90) ? bodyFrontZ : module.depth / 2) + 0.012]}>
                {/* bar — 196mm hole spacing, ~212mm total length */}
                <mesh castShadow>
                  <boxGeometry args={[0.212, 0.012, 0.012]} />
                  <meshStandardMaterial color={handleColor} metalness={0.6} roughness={0.4} />
                </mesh>
                {/* mounting posts at 196mm spacing */}
                <mesh position={[-0.098, 0, -0.008]}>
                  <cylinderGeometry args={[0.005, 0.005, 0.016, 12]} />
                  <meshStandardMaterial color={handleColor} metalness={0.6} roughness={0.4} />
                </mesh>
                <mesh position={[0.098, 0, -0.008]}>
                  <cylinderGeometry args={[0.005, 0.005, 0.016, 12]} />
                  <meshStandardMaterial color={handleColor} metalness={0.6} roughness={0.4} />
                </mesh>
              </group>
              ))
            )}
          </group>
        );
      })()}
      {/* Non-cabinet accent (appliances etc.) */}
      {!isCabinet && accentColor && module.height > 0.1 && (
        <mesh
          position={[0, module.height / 2, module.depth / 2 + 0.005]}
          castShadow
        >
          <boxGeometry args={[module.width * 0.9, 0.03, 0.01]} />
          <meshStandardMaterial color={accentColor} metalness={0.7} roughness={0.3} />
        </mesh>
      )}
      {/* Worktop strip on top of base cabinets */}
      {module.category === "base" && !isCornerUnit && !isEUC90Corner && (
        <mesh
          position={[0, module.height + 0.02, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[module.width + 0.02, 0.04, module.depth + 0.02]} />
          <meshStandardMaterial color={worktop.color} roughness={0.4} metalness={0.05} />
        </mesh>
      )}
      {/* EUC90 inward L-shape worktop: two slabs matching the two arms. */}
      {module.category === "base" && isEUC90Corner && (
        <>
          <mesh
            position={[0, module.height + 0.02, -module.depth / 2 + ARM / 2]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[module.width + 0.02, 0.04, ARM + 0.01]} />
            <meshStandardMaterial color={worktop.color} roughness={0.4} metalness={0.05} />
          </mesh>
          <mesh
            position={[
              euc90IsLeft ? -module.width / 2 + ARM / 2 : module.width / 2 - ARM / 2,
              module.height + 0.02,
              0,
            ]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[ARM + 0.01, 0.04, module.depth + 0.02]} />
            <meshStandardMaterial color={worktop.color} roughness={0.4} metalness={0.05} />
          </mesh>
        </>
      )}
      {/* Corner units: L-shaped worktop = slab over the 580mm body + slab
          over the 580×70 filler. Each piece carries a 10mm overhang on its
          exposed edges only. */}
      {module.category === "base" && isCornerUnit && (
        <>
          {/* Slab over the cabinet body */}
          <mesh
            position={[0, module.height + 0.02, bodyZCenter - 0.005]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[module.width + 0.02, 0.04, bodyDepth + 0.01]} />
            <meshStandardMaterial color={worktop.color} roughness={0.4} metalness={0.05} />
          </mesh>
          {/* Slab over the projecting filler (front, blanking-side end) */}
          <mesh
            position={[
              /\sL\s*$/.test(_code)
                ? -module.width / 2 + 0.29
                : module.width / 2 - 0.29,
              module.height + 0.02,
              module.depth / 2 - 0.035,
            ]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.58, 0.04, 0.08]} />
            <meshStandardMaterial color={worktop.color} roughness={0.4} metalness={0.05} />
          </mesh>
        </>
      )}
      {/* Selection ring */}
      {selected && (
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(module.width, module.depth) * 0.6, Math.max(module.width, module.depth) * 0.7, 32]} />
          <meshBasicMaterial color="#b08d57" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* Corner grab handles — visible when selected or hovered */}
      {(selected || hovered) && (
        <group>
          {[
            [-module.width / 2, -module.depth / 2],
            [module.width / 2, -module.depth / 2],
            [-module.width / 2, module.depth / 2],
            [module.width / 2, module.depth / 2],
          ].map(([cx, cz], i) => (
            <mesh
              key={i}
              position={[cx, module.height + 0.06, cz]}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <sphereGeometry args={[0.045, 16, 16]} />
              <meshStandardMaterial
                color="#b08d57"
                emissive="#b08d57"
                emissiveIntensity={0.6}
                metalness={0.4}
                roughness={0.3}
              />
            </mesh>
          ))}
          {/* base outline at floor for snap reference */}
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[
              Math.hypot(module.width, module.depth) / 2 - 0.01,
              Math.hypot(module.width, module.depth) / 2 + 0.005,
              48,
            ]} />
            <meshBasicMaterial color="#b08d57" transparent opacity={0.35} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
    </group>
  );
}
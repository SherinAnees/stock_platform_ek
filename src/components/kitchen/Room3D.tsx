import * as THREE from "three";
import { useMemo } from "react";
import type { RoomConfig } from "@/lib/kitchen/store";

interface Room3DProps {
  room: RoomConfig;
  onFloorClick?: () => void;
}

/**
 * Build a 2D footprint (in the X/Z plane, centered at origin) for the room.
 * Returns ordered points going counter-clockwise.
 * - rect: simple rectangle
 * - l-shape: rectangle with the front-right corner cut out
 * - u-shape: rectangle with the front-center cut out (alcove opening forward)
 */
function buildFootprint(room: RoomConfig): THREE.Vector2[] {
  const w = room.width;
  const d = room.depth;
  const cw = Math.min(room.cutoutWidth ?? 1.4, w * 0.7);
  const cd = Math.min(room.cutoutDepth ?? 1.4, d * 0.7);
  const shape = room.shape ?? "rect";

  // Coordinates: x = left(-) → right(+), z = back(-) → front(+)
  const left = -w / 2;
  const right = w / 2;
  const back = -d / 2;
  const front = d / 2;

  if (shape === "l-shape") {
    // Cut out front-right corner
    return [
      new THREE.Vector2(left, back),
      new THREE.Vector2(right, back),
      new THREE.Vector2(right, front - cd),
      new THREE.Vector2(right - cw, front - cd),
      new THREE.Vector2(right - cw, front),
      new THREE.Vector2(left, front),
    ];
  }

  if (shape === "u-shape") {
    // Cut out front-center alcove
    const halfCw = cw / 2;
    return [
      new THREE.Vector2(left, back),
      new THREE.Vector2(right, back),
      new THREE.Vector2(right, front),
      new THREE.Vector2(halfCw, front),
      new THREE.Vector2(halfCw, front - cd),
      new THREE.Vector2(-halfCw, front - cd),
      new THREE.Vector2(-halfCw, front),
      new THREE.Vector2(left, front),
    ];
  }

  // rect
  return [
    new THREE.Vector2(left, back),
    new THREE.Vector2(right, back),
    new THREE.Vector2(right, front),
    new THREE.Vector2(left, front),
  ];
}

export function Room3D({ room, onFloorClick }: Room3DProps) {
  const { width, depth, height } = room;
  const shape = room.shape ?? "rect";

  const footprint = useMemo(() => buildFootprint(room), [room]);
  const wallColor = room.wallColor ?? "#9ca3af";

  // Floor geometry from the polygon footprint
  const floorGeometry = useMemo(() => {
    const s = new THREE.Shape(footprint);
    const geo = new THREE.ShapeGeometry(s);
    // ShapeGeometry is in XY plane; we'll rotate to lay it on XZ via mesh rotation.
    return geo;
  }, [footprint]);

  // Skirting + perimeter walls: walk edges of the footprint and skip the
  // front-most edges so the user can see into the room.
  const edges = useMemo(() => {
    const result: { a: THREE.Vector2; b: THREE.Vector2; isFront: boolean }[] = [];
    for (let i = 0; i < footprint.length; i++) {
      const a = footprint[i];
      const b = footprint[(i + 1) % footprint.length];
      // "front" if the edge lies on the maximum Z (front of room)
      const isFront = a.y === depth / 2 && b.y === depth / 2;
      result.push({ a, b, isFront });
    }
    return result;
  }, [footprint, depth]);

  return (
    <group>
      {/* Floor — clickable to deselect */}
      <mesh
        geometry={floorGeometry}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onPointerDown={(e) => {
          e.stopPropagation();
          onFloorClick?.();
        }}
      >
        <meshStandardMaterial color="#d9c8a8" roughness={0.85} side={THREE.DoubleSide} />
      </mesh>

      {/* Floor grid lines */}
      <gridHelper
        args={[Math.max(width, depth), Math.max(width, depth), "#a08c6a", "#c4b291"]}
        position={[0, 0.001, 0]}
      />

      {/* Walls + skirting along every non-front edge of the footprint */}
      {edges.map((edge, i) => {
        const dx = edge.b.x - edge.a.x;
        const dz = edge.b.y - edge.a.y;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len < 0.001) return null;
        const cx = (edge.a.x + edge.b.x) / 2;
        const cz = (edge.a.y + edge.b.y) / 2;
        // Align the plane's local +X axis with the edge direction (dx, dz)
        const angle = Math.atan2(-dz, dx);

        // For interior cutout edges (l/u) we always render solid walls.
        // For the original "front" edges, render a faint translucent wall so
        // the user can still orbit through and see the room.
        const isFrontEdge = edge.isFront;

        return (
          <group key={i} position={[cx, 0, cz]} rotation={[0, angle, 0]}>
            {/* Wall panel */}
            <mesh position={[0, height / 2, 0]} receiveShadow>
              <planeGeometry args={[len, height]} />
              <meshStandardMaterial
                color={wallColor}
                roughness={0.95}
                side={THREE.DoubleSide}
                transparent={isFrontEdge}
                opacity={isFrontEdge ? 0.18 : 1}
              />
            </mesh>
            {/* Skirting */}
            {!isFrontEdge && (
              <mesh position={[0, 0.04, 0.011]}>
                <boxGeometry args={[len, 0.08, 0.02]} />
                <meshStandardMaterial color="#3a2c1f" />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Subtle indicator of the shape choice in dev tools — invisible but kept for clarity */}
      <group userData={{ shape }} />
    </group>
  );
}
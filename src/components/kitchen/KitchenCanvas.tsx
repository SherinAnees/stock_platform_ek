import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { Suspense, forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { useKitchen } from "@/lib/kitchen/store";
import { getModule } from "@/lib/kitchen/modules";
import { Module3D } from "./Module3D";
import { Room3D } from "./Room3D";

export interface KitchenCanvasHandle {
  capture: () => string | null;
}

export const KitchenCanvas = forwardRef<KitchenCanvasHandle>((_, ref) => {
  const room = useKitchen((s) => s.room);
  const placed = useKitchen((s) => s.placed);
  const selectedUid = useKitchen((s) => s.selectedUid);
  const selectModule = useKitchen((s) => s.selectModule);
  const updateModule = useKitchen((s) => s.updateModule);
  const removeModule = useKitchen((s) => s.removeModule);
  const undo = useKitchen((s) => s.undo);
  const isDragging = useKitchen((s) => s.isDragging);

  const glRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
        if (inField) return;
        e.preventDefault();
        undo();
        return;
      }
      // R = rotate selected module 90°
      if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (inField) return;
        const uid = useKitchen.getState().selectedUid;
        if (!uid) return;
        e.preventDefault();
        useKitchen.getState().rotateSelected();
        return;
      }
      // Arrow-key nudging of the selected module
      if (
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown"
      ) {
        if (inField) return;
        const state = useKitchen.getState();
        const uid = state.selectedUid;
        if (!uid) return;
        const item = state.placed.find((p) => p.uid === uid);
        if (!item) return;
        const mod = getModule(item.moduleId);
        if (!mod) return;
        e.preventDefault();
        // Step: 10cm, or 1cm with Shift (fine), 50cm with Ctrl/Alt (coarse)
        const step = e.shiftKey ? 0.01 : e.altKey ? 0.5 : 0.1;
        let [x, y, z] = item.position;
        if (e.key === "ArrowLeft") x -= step;
        if (e.key === "ArrowRight") x += step;
        if (e.key === "ArrowUp") z -= step;
        if (e.key === "ArrowDown") z += step;
        const isRot = Math.abs(Math.sin(item.rotation)) > 0.5;
        const halfW = (isRot ? mod.depth : mod.width) / 2;
        const halfD = (isRot ? mod.width : mod.depth) / 2;
        x = Math.max(-state.room.width / 2 + halfW, Math.min(state.room.width / 2 - halfW, x));
        z = Math.max(-state.room.depth / 2 + halfD, Math.min(state.room.depth / 2 - halfD, z));
        updateModule(uid, { position: [x, y, z] });
        return;
      }
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (inField) return;
      const uid = useKitchen.getState().selectedUid;
      if (!uid) return;
      e.preventDefault();
      removeModule(uid);
      selectModule(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [removeModule, selectModule, undo, updateModule]);

  useImperativeHandle(ref, () => ({
    capture: () => {
      const gl = glRef.current;
      if (!gl) return null;
      try {
        return gl.domElement.toDataURL("image/png");
      } catch {
        return null;
      }
    },
  }));

  const maxDim = Math.max(room.width, room.depth);

  return (
    <Canvas
      shadows
      camera={{ position: [0, maxDim * 0.75, maxDim * 1.25], fov: 48 }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      onCreated={({ gl }) => {
        glRef.current = gl;
      }}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        background: "linear-gradient(180deg, #efe6d3 0%, #d9c8a8 100%)",
      }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <directionalLight position={[-5, 5, -3]} intensity={0.35} />

      <Room3D room={room} onFloorClick={() => selectModule(null)} />

      {placed.map((p) => {
        const mod = getModule(p.moduleId);
        if (!mod) return null;
        // Plinth items are catalog/BOM-only — skip 3D rendering.
        if (mod.unitType === "PLINTH") return null;
        return (
          <Module3D
            key={p.uid}
            placed={p}
            module={mod}
            selected={p.uid === selectedUid}
            onSelect={() => selectModule(p.uid)}
            onMove={(pos) => updateModule(p.uid, { position: pos })}
            roomWidth={room.width}
            roomDepth={room.depth}
            others={placed.filter((o) => o.uid !== p.uid)}
          />
        );
      })}

        <ContactShadows
          position={[0, 0.002, 0]}
          opacity={0.35}
          scale={maxDim * 2}
          blur={2.4}
          far={4}
        />
      <Suspense fallback={null}>
        <Environment preset="apartment" />
      </Suspense>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.1}
        minDistance={1.5}
        maxDistance={15}
        maxPolarAngle={Math.PI / 2 - 0.05}
        target={[0, 0.65, 0]}
        enableRotate={!isDragging}
        enablePan={!isDragging}
        enableZoom={!isDragging}
      />
    </Canvas>
  );
});

KitchenCanvas.displayName = "KitchenCanvas";
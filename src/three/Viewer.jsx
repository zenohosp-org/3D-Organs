import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, Grid, Html } from '@react-three/drei';
import Stage from './Stage';
import AnatomyMesh from './AnatomyMesh';
import { SafeOrganModel } from './OrganModel';
import { ImplantLayer } from './ImplantMesh';
import FractureLayer from './FractureLayer';
import { useSceneStore } from '../store/useSceneStore';

/* ===================================================================
   VIEWER
   -------------------------------------------------------------------
   Navigation, which is the thing a clinician does constantly and
   notices immediately when it is wrong:

     ORBIT  — left mouse drag / one-finger touch
     PAN    — right mouse drag, middle drag, or two-finger touch
     ZOOM   — wheel, or pinch

   `enableDamping` is on because inertia-free orbiting feels broken on
   a trackpad. `zoomToCursor` is on because zooming toward the pointer
   rather than the screen centre is what lets someone dive into a
   specific vertebra without re-centring three times on the way in.

   Distance limits are derived from the loaded content's radius, not
   hard-coded: "close enough to inspect a 4 mm screw thread" and "far
   enough to see a whole femur" are different absolute numbers for
   different regions, and a fixed minDistance would either clip through
   the anatomy or refuse to let the camera approach it.
   =================================================================== */

const CAMERA_PRESETS = {
  anterior: [0, 0, 1],
  posterior: [0, 0, -1],
  left: [-1, 0, 0],
  right: [1, 0, 0],
  superior: [0, 1, 0.001],
  inferior: [0, -1, 0.001],
  oblique: [0.7, 0.45, 0.75],
};

/**
 * Distance at which a sphere of radius `r` fits the frame.
 *
 * A fixed multiple of the radius crops a standing skeleton, because the
 * body is tall and narrow while the viewport is short and wide: the
 * binding constraint is the VERTICAL fov, but on a portrait-shaped
 * viewport it flips to the horizontal one. So solve both and take
 * whichever needs more distance, then add a 12% margin so the subject
 * is not flush against the edge.
 */
function fitDistance(camera, r) {
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const d = Math.max(r / Math.sin(vFov / 2), r / Math.sin(hFov / 2));
  return d * 1.12;
}

/** Imperative camera helpers, exposed to the toolbar through a ref. */
function CameraRig({ apiRef, radius }) {
  const { camera, controls } = useThree();

  useEffect(() => {
    apiRef.current = {
      frame(r = radius, target = new THREE.Vector3()) {
        const dir = camera.position.clone().sub(controls?.target ?? target).normalize();
        if (dir.lengthSq() < 1e-6) dir.set(0.7, 0.45, 0.75).normalize();
        camera.position.copy(target).addScaledVector(dir, fitDistance(camera, r));
        controls?.target.copy(target);
        controls?.update();
      },
      view(preset, r = radius) {
        const dir = new THREE.Vector3(...(CAMERA_PRESETS[preset] ?? CAMERA_PRESETS.oblique));
        const target = controls?.target ?? new THREE.Vector3();
        camera.position.copy(target).addScaledVector(dir.normalize(), fitDistance(camera, r));
        camera.up.set(0, 1, 0);
        controls?.update();
      },
      focusOn(center, r) {
        const dir = camera.position.clone().sub(controls?.target ?? center).normalize();
        camera.position.copy(center).addScaledVector(dir, Math.max(r * 3.2, 1.2));
        controls?.target.copy(center);
        controls?.update();
      },
      zoomBy(factor) {
        const t = controls?.target ?? new THREE.Vector3();
        const offset = camera.position.clone().sub(t);
        const len = THREE.MathUtils.clamp(offset.length() * factor, radius * 0.05, radius * 14);
        camera.position.copy(t).addScaledVector(offset.normalize(), len);
        controls?.update();
      },
    };
  }, [camera, controls, apiRef, radius]);

  return null;
}

/** Global clipping plane, driven from the display panel. */
function ClipPlane({ radius }) {
  const { gl } = useThree();
  const clipEnabled = useSceneStore((s) => s.clipEnabled);
  const clipAxis = useSceneStore((s) => s.clipAxis);
  const clipPosition = useSceneStore((s) => s.clipPosition);

  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), []);

  useEffect(() => {
    const n =
      clipAxis === 'x' ? [-1, 0, 0] : clipAxis === 'y' ? [0, -1, 0] : [0, 0, -1];
    plane.normal.set(...n);
    plane.constant = clipPosition * radius;
    gl.clippingPlanes = clipEnabled ? [plane] : [];
    gl.localClippingEnabled = clipEnabled;
  }, [gl, plane, clipEnabled, clipAxis, clipPosition, radius]);

  useEffect(() => () => { gl.clippingPlanes = []; }, [gl]);

  return null;
}

/** Tone mapping + colour management, set once on the renderer. */
function RendererSetup() {
  const { gl } = useThree();
  const exposure = useSceneStore((s) => s.exposure);

  useEffect(() => {
    // ACES Filmic keeps the bright specular on polished metal from
    // clipping to flat white, which is exactly where a linear mapping
    // fails on this content.
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
  }, [gl]);

  useEffect(() => {
    gl.toneMappingExposure = exposure;
  }, [gl, exposure]);

  return null;
}

function Loader({ label }) {
  return (
    <Html center>
      <div className="o3d-canvas-loader">
        <div className="o3d-canvas-loader__spinner" />
        <span>{label}</span>
      </div>
    </Html>
  );
}

export default function Viewer({ geometry, parts, organFile, organPosition, radius = 10, cameraApiRef, onPickPart, onOrganError }) {
  const showGrid = useSceneStore((s) => s.showGrid);
  const showShadows = useSceneStore((s) => s.showShadows);
  const autoRotate = useSceneStore((s) => s.autoRotate);
  const selectPart = useSceneStore((s) => s.selectPart);
  const selectImplant = useSceneStore((s) => s.selectImplant);

  // Round to a 1 / 2 / 5 / 10 ... progression so the grid always lands
  // on numbers a clinician can count in.
  const gridCell = useMemo(() => {
    const raw = radius / 12;
    const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 0.01))));
    const n = raw / pow;
    return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * pow;
  }, [radius]);

  const handlePick = useCallback(
    (idx) => {
      selectPart(idx);
      onPickPart?.(idx);
    },
    [selectPart, onPickPart]
  );

  return (
    <Canvas
      shadows={showShadows}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        // Needed for html2canvas-free screenshot capture: without it the
        // drawing buffer is cleared before toDataURL can read it.
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      }}
      camera={{ fov: 45, near: 0.05, far: radius * 40, position: [radius * 1.7, radius * 1.1, radius * 1.8] }}
      onPointerMissed={() => {
        // Clicking empty space clears selection — the standard escape
        // hatch from a gizmo that is in the way.
        selectPart(-1);
        selectImplant(null);
      }}
    >
      <color attach="background" args={['#12161c']} />
      <fog attach="fog" args={['#12161c', radius * 5, radius * 16]} />

      <RendererSetup />
      <ClipPlane radius={radius} />
      <CameraRig apiRef={cameraApiRef} radius={radius} />

      <Suspense fallback={<Loader label="Loading anatomy…" />}>
        <Stage shadows={showShadows} radius={radius} />

        {geometry && parts?.length > 0 && (
          <AnatomyMesh geometry={geometry} parts={parts} onPick={handlePick} />
        )}

        {geometry && <FractureLayer mergedGeometry={geometry} />}

        {organFile && (
          <SafeOrganModel file={organFile} position={organPosition} onError={onOrganError} />
        )}

        <ImplantLayer />
      </Suspense>

      {showGrid && (
        <Grid
          position={[0, -radius * 0.95, 0]}
          args={[radius * 4, radius * 4]}
          // Scene units are centimetres. Deriving the cell from the
          // content radius keeps the grid at roughly a constant visual
          // density whether the view is a whole skeleton or one vertebra.
          cellSize={gridCell}
          cellThickness={0.6}
          cellColor="#2b3440"
          sectionSize={gridCell * 5}
          sectionThickness={1}
          sectionColor="#3d4a5a"
          fadeDistance={radius * 8}
          fadeStrength={1.2}
          followCamera={false}
          infiniteGrid
        />
      )}

      <OrbitControls
        // `makeDefault` is load-bearing: TransformControls disables
        // whatever sits in this slot while a gizmo is being dragged.
        // Drop it and dragging an implant also spins the camera.
        makeDefault
        enableDamping
        dampingFactor={0.08}
        zoomToCursor
        enablePan
        panSpeed={0.9}
        rotateSpeed={0.85}
        zoomSpeed={0.9}
        minDistance={radius * 0.12}
        maxDistance={radius * 12}
        autoRotate={autoRotate}
        autoRotateSpeed={0.7}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      />

      <GizmoHelper alignment="bottom-right" margin={[68, 68]}>
        <GizmoViewport
          axisColors={['#ef4444', '#10b981', '#3b82f6']}
          labelColor="#e5e7eb"
        />
      </GizmoHelper>
    </Canvas>
  );
}

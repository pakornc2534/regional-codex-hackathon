import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Activity, Zone } from "../../shared/model";

import type { CameraPose, Pick } from "./types";
import { positions } from "./types";
import {
  avatarDestination,
  cameraFit,
  cameraPosition,
  cameraTarget,
  type Diorama,
} from "./sculpture";

interface Props {
  savedView: React.RefObject<CameraPose | null>;
  scene: Diorama;
  activity: Activity | null;
  activityText: string;
  highlight: Zone | null;
  bottleneck?: Zone | null;
  reset: number;
  reduced: boolean;
  onHover: (target: Pick | null) => void;
  onPick: (target: Pick) => void;
  onFailure: () => void;
}
function View({
  savedView,
  scene,
  activity,
  activityText,
  highlight,
  bottleneck,
  reset,
  reduced,
  onHover,
  onPick,
  onFailure,
}: Props) {
  const { camera, size, invalidate, gl } = useThree(),
    orbit = useRef<OrbitControlsImpl | null>(null);
  const fit = useRef(0);
  const destination = useRef(
      new THREE.Vector3(...avatarDestination("computer")),
    ),
    label = useRef<THREE.Group>(null),
    [showLabel, setShowLabel] = useState(false);
  useLayoutEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    const zoom = cameraFit(size.width, size.height);
    fit.current = 0;
    const pose = savedView.current?.reset === reset ? savedView.current : null;
    cam.position.set(...(pose?.position ?? cameraPosition));
    cam.zoom = zoom * (pose?.scale ?? 1);
    cam.lookAt(...cameraTarget);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const ctrl = orbit.current;
    if (ctrl) {
      ctrl.target.set(...cameraTarget);
      ctrl.minZoom = zoom * 0.7;
      ctrl.maxZoom = zoom * 2.3;
      ctrl.update();
    }
    fit.current = zoom;
    invalidate();
  }, [size.width, size.height, reset, camera, invalidate, savedView]);
  useEffect(() => {
    const lost = (event: Event) => {
      event.preventDefault();
      onFailure();
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => gl.domElement.removeEventListener("webglcontextlost", lost);
  }, [gl, onFailure]);
  useEffect(() => {
    destination.current.set(...avatarDestination(activity?.zone ?? "computer"));
    if (reduced) scene.avatar.position.copy(destination.current);
    setShowLabel(Boolean(activity));
    invalidate();
    if (!activity) return;
    const labelTimer = window.setTimeout(() => {
      setShowLabel(false);
      invalidate();
    }, 3400);
    return () => window.clearTimeout(labelTimer);
  }, [
    activity?.id,
    activity?.zone,
    activity?.status,
    reduced,
    scene,
    invalidate,
  ]);
  useFrame((_, dt) => {
    const pos = scene.avatar.position,
      dist = pos.distanceTo(destination.current);
    if (dist > 0.008) {
      const dx = destination.current.x - pos.x,
        dz = destination.current.z - pos.z;
      if (Math.abs(dx) + Math.abs(dz) > 0.04)
        scene.avatar.rotation.y = Math.atan2(dx, dz);
      if (reduced) pos.copy(destination.current);
      else
        pos.lerp(destination.current, 1 - Math.exp(-Math.min(dt, 0.06) * 4.5));
      invalidate();
    }
    if (label.current) label.current.position.set(pos.x, pos.y + 1.35, pos.z);
  });
  return (
    <>
      <hemisphereLight args={["#fff2dc", "#91a2a5", 1.75]} />
      <directionalLight
        castShadow
        position={[-5, 11, 7]}
        intensity={2.15}
        color="#ffe8c0"
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-normalBias={0.035}
        shadow-bias={-0.00017}
      />
      <directionalLight
        position={[7, 6, -5]}
        intensity={0.89}
        color="#c2e0ec"
      />
      <primitive
        object={scene.root}
        onPointerMove={(e: {
          stopPropagation: () => void;
          object: THREE.Object3D;
          buttons: number;
        }) => {
          e.stopPropagation();
          if (!e.buttons) onHover(e.object.userData.pick ?? null);
        }}
        onPointerOut={() => onHover(null)}
        onClick={(e: {
          stopPropagation: () => void;
          object: THREE.Object3D;
          delta: number;
        }) => {
          e.stopPropagation();
          if (e.delta < 5 && e.object.userData.pick)
            onPick(e.object.userData.pick);
        }}
      />
      <mesh
        position={[0, -0.72, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[38, 38]} />
        <shadowMaterial transparent opacity={0.24} />
      </mesh>
      {highlight && (
        <mesh
          position={[
            positions[highlight][0],
            positions[highlight][1] + 0.1,
            positions[highlight][2],
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.73, 0.8, 48]} />
          <meshBasicMaterial
            color={highlight === bottleneck ? "#ff986f" : "#ffe09f"}
            side={THREE.DoubleSide}
            depthTest={false}
            transparent
            opacity={0.86}
          />
        </mesh>
      )}
      <group ref={label}>
        {showLabel && activity && (
          <Html center zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
            <span className={"gallery-avatar-bubble status-" + activity.status}>
              {activity.status === "verified"
                ? "✓ "
                : activity.status === "failed" ||
                    activity.status === "uncertain"
                  ? "! "
                  : ""}
              {activityText}
            </span>
          </Html>
        )}
      </group>
      <OrbitControls
        ref={orbit}
        makeDefault
        enablePan={false}
        enableDamping={!reduced}
        dampingFactor={0.13}
        minPolarAngle={0.43}
        maxPolarAngle={1.35}
        minAzimuthAngle={-1.14}
        maxAzimuthAngle={1.6}
        rotateSpeed={0.67}
        zoomSpeed={0.7}
        target={cameraTarget}
        onStart={() => onHover(null)}
        onChange={() => {
          const cam = camera as THREE.OrthographicCamera;
          if (fit.current > 0)
            savedView.current = {
              position: cam.position.toArray(),
              scale: cam.zoom / fit.current,
              reset,
            };
          invalidate();
        }}
      />
    </>
  );
}
export default function Webgl(props: Props) {
  return (
    <Canvas
      orthographic
      camera={{ position: cameraPosition, near: 0.1, far: 100 }}
      shadows
      frameloop="demand"
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onPointerMissed={() => props.onHover(null)}
      aria-label="ร้านสามมิติ หมุนและซูมได้"
    >
      <View {...props} />
    </Canvas>
  );
}

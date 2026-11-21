import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import {
  cameraFit,
  cameraPosition,
  cameraTarget,
  type Diorama,
  avatarDestination,
} from "./sculpture";
import type { Pick } from "./types";
import { positions } from "./types";
import { type Zone, type Activity } from "../../shared/model";

interface Props {
  scene: Diorama;
  activity: Activity | null;
  highlight: Zone | null;
  bottleneck?: Zone | null;
  onHover: (pick: Pick | null) => void;
  onPick: (pick: Pick) => void;
}
const light = new THREE.Vector3(-0.45, 0.91, 0.68).normalize();

// The fallback draws the very same geometry and uses a depth buffer so large
// wall or floor triangles cannot cover a nearer collectible or workstation.
function shadeTriangle(
  data: ImageData,
  depth: Float32Array,
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  rgb: number,
) {
  const { width, height } = data,
    pixels = data.data;
  const ax = ((a.x + 1) * width) / 2,
    ay = ((1 - a.y) * height) / 2;
  const bx = ((b.x + 1) * width) / 2,
    by = ((1 - b.y) * height) / 2;
  const cx = ((c.x + 1) * width) / 2,
    cy = ((1 - c.y) * height) / 2;
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (area >= -0.0001) return;
  const xMin = Math.max(0, Math.floor(Math.min(ax, bx, cx))),
    xMax = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
  const yMin = Math.max(0, Math.floor(Math.min(ay, by, cy))),
    yMax = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
  const dxB = (cy - ay) / area,
    dxC = (ay - by) / area,
    dyB = (ax - cx) / area,
    dyC = (bx - ax) / area;
  const startB = (xMin + 0.5 - ax) * dxB + (yMin + 0.5 - ay) * dyB;
  const startC = (xMin + 0.5 - ax) * dxC + (yMin + 0.5 - ay) * dyC;
  const red = rgb >> 16,
    green = (rgb >> 8) & 255,
    blue = rgb & 255;
  for (let y = yMin; y <= yMax; y++) {
    let wb = startB + (y - yMin) * dyB,
      wc = startC + (y - yMin) * dyC;
    for (let x = xMin; x <= xMax; x++, wb += dxB, wc += dxC) {
      const wa = 1 - wb - wc;
      if (wa < -0.000001 || wb < -0.000001 || wc < -0.000001) continue;
      const z = wa * a.z + wb * b.z + wc * c.z,
        offset = y * width + x;
      if (z >= depth[offset]) continue;
      depth[offset] = z;
      const pixel = offset * 4;
      pixels[pixel] = red;
      pixels[pixel + 1] = green;
      pixels[pixel + 2] = blue;
      pixels[pixel + 3] = 255;
    }
  }
}
function paint(
  canvas: HTMLCanvasElement,
  scene: Diorama,
  camera: THREE.OrthographicCamera,
  width: number,
  height: number,
  highlight: Zone | null,
  bottleneck?: Zone | null,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(1.7, Math.max(1.25, window.devicePixelRatio || 1));
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (!width || !height) return;
  const toView = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  );
  scene.root.updateMatrixWorld(true);
  const image = ctx.createImageData(canvas.width, canvas.height),
    depth = new Float32Array(canvas.width * canvas.height);
  depth.fill(Infinity);
  const color = new THREE.Color(),
    va = new THREE.Vector3(),
    vb = new THREE.Vector3(),
    vc = new THREE.Vector3(),
    normal = new THREE.Vector3(),
    side = new THREE.Vector3();
  const ax = new THREE.Vector3(),
    bx = new THREE.Vector3(),
    cx = new THREE.Vector3();
  const accent = new THREE.Color(
    highlight === bottleneck ? "#dc7850" : "#d8b46d",
  );
  scene.root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const pos = object.geometry.getAttribute("position"),
      idx = object.geometry.index,
      source = object.material as THREE.MeshStandardMaterial;
    const project = new THREE.Matrix4().multiplyMatrices(
      toView,
      object.matrixWorld,
    );
    const count = idx ? idx.count : pos.count;
    for (let i = 0; i < count; i += 3) {
      const a = idx ? idx.getX(i) : i,
        b = idx ? idx.getX(i + 1) : i + 1,
        c = idx ? idx.getX(i + 2) : i + 2;
      va.fromBufferAttribute(pos, a);
      vb.fromBufferAttribute(pos, b);
      vc.fromBufferAttribute(pos, c);
      ax.copy(va).applyMatrix4(project);
      bx.copy(vb).applyMatrix4(project);
      cx.copy(vc).applyMatrix4(project);
      if ((bx.x - ax.x) * (cx.y - ax.y) - (bx.y - ax.y) * (cx.x - ax.x) <= 0)
        continue;
      va.applyMatrix4(object.matrixWorld);
      vb.applyMatrix4(object.matrixWorld);
      vc.applyMatrix4(object.matrixWorld);
      normal.subVectors(vb, va).cross(side.subVectors(vc, va)).normalize();
      const lum =
        0.58 +
        0.58 * Math.max(0, normal.dot(light)) +
        0.06 * Math.max(0, normal.y);
      color.copy(source.color).multiplyScalar(lum);
      const pick = object.userData.pick as Pick | undefined;
      if (pick && pick.zone === highlight) color.lerp(accent, 0.18);
      shadeTriangle(image, depth, ax, bx, cx, color.getHex());
    }
  });
  ctx.putImageData(image, 0, 0);
  if (highlight) {
    const marker = new THREE.Vector3(...positions[highlight])
      .add(new THREE.Vector3(0, 0.12, 0))
      .project(camera);
    ctx.strokeStyle = highlight === bottleneck ? "#ff986f" : "#ffe0a3";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(
      ((marker.x + 1) * width) / 2,
      ((1 - marker.y) * height) / 2,
      22,
      10,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }
}
export default function MapCanvas({
  scene,
  activity,
  highlight,
  bottleneck,
  onHover,
  onPick,
}: Props) {
  const el = useRef<HTMLCanvasElement>(null),
    camera = useRef(new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)),
    down = useRef<[number, number] | null>(null);
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    scene.avatar.position.set(
      ...avatarDestination(activity?.zone ?? "computer"),
    );
    function draw() {
      if (!node) return;
      const { width, height } = node.getBoundingClientRect();
      if (width < 2 || height < 2) return;
      const cam = camera.current;
      cam.position.set(...cameraPosition);
      cam.lookAt(...cameraTarget);
      cam.left = -width / 2;
      cam.right = width / 2;
      cam.top = height / 2;
      cam.bottom = -height / 2;
      cam.zoom = cameraFit(width, height);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      paint(node, scene, cam, width, height, highlight, bottleneck);
    }
    const ro = new ResizeObserver(draw);
    ro.observe(node);
    draw();
    return () => ro.disconnect();
  }, [scene, highlight, bottleneck, activity?.zone]);
  useEffect(() => () => onHover(null), [onHover]);
  function hit(x: number, y: number): Pick | null {
    if (!el.current) return null;
    const r = el.current.getBoundingClientRect(),
      ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        (2 * (x - r.left)) / r.width - 1,
        1 - (2 * (y - r.top)) / r.height,
      ),
      camera.current,
    );
    const hits = ray.intersectObjects(scene.root.children, true);
    for (const h of hits) {
      if (h.object.userData.pick) return h.object.userData.pick as Pick;
      // Non-actionable pieces in front of an object must not activate it.
      if (h.distance > 0) break;
    }
    return null;
  }
  return (
    <canvas
      className="gallery-map-canvas"
      aria-label="แผนผังร้านสองมิติ"
      ref={el}
      onPointerDown={(e) => {
        down.current = [e.clientX, e.clientY];
      }}
      onPointerMove={(e) => {
        if (e.pointerType === "mouse") onHover(hit(e.clientX, e.clientY));
      }}
      onPointerLeave={() => onHover(null)}
      onPointerUp={(e) => {
        const start = down.current;
        down.current = null;
        if (
          !start ||
          Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 5
        )
          return;
        const pick = hit(e.clientX, e.clientY);
        if (pick) onPick(pick);
      }}
    />
  );
}

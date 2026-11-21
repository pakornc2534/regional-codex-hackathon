import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { GalleryVariant, Pick } from "./types";
import { positions } from "./types";
import type { Zone } from "../../shared/model";

type Vec = [number, number, number];
type Group = THREE.Group;
type Mat = THREE.MeshStandardMaterial;
const ink = "#182e38",
  teal = "#486863",
  blue = "#416279",
  cream = "#f4e1bd",
  stone = "#d9c3a6",
  brass = "#b99254",
  wood = "#ae7654",
  copper = "#b26f50",
  red = "#ad4d3c",
  black = "#293940",
  ivory = "#f5eee0";
const materials = new Map<string, Mat>();
function material(color: string, metal = false, glow = false) {
  const key = color + metal + glow;
  if (!materials.has(key))
    materials.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        metalness: metal ? 0.3 : 0.04,
        roughness: metal ? 0.42 : 0.78,
        emissive: glow ? color : "#000000",
        emissiveIntensity: glow ? 0.28 : 0,
        flatShading: false,
      }),
    );
  return materials.get(key)!;
}
const unitBox = new THREE.BoxGeometry(1, 1, 1),
  cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 24),
  orbGeo = new THREE.SphereGeometry(0.5, 12, 8),
  coneGeo = new THREE.ConeGeometry(0.5, 1, 8),
  ringGeo = new THREE.TorusGeometry(1, 0.035, 7, 48),
  archGeo = new THREE.TorusGeometry(1, 0.057, 7, 32, Math.PI);
function part(
  parent: Group,
  geo: THREE.BufferGeometry,
  pos: Vec,
  size: Vec,
  color: string,
  rotation: Vec = [0, 0, 0],
  metal = false,
  glow = false,
) {
  const mesh = new THREE.Mesh(geo, material(color, metal, glow));
  mesh.position.set(...pos);
  mesh.scale.set(...size);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}
function box(
  g: Group,
  p: Vec,
  s: Vec,
  c: string,
  r: Vec = [0, 0, 0],
  m = false,
  l = false,
) {
  return part(g, unitBox, p, s, c, r, m, l);
}
function cyl(
  g: Group,
  p: Vec,
  s: Vec,
  c: string,
  r: Vec = [0, 0, 0],
  m = false,
) {
  return part(g, cylGeo, p, s, c, r, m);
}
function orb(g: Group, p: Vec, s: Vec, c: string) {
  return part(g, orbGeo, p, s, c);
}
function cone(g: Group, p: Vec, s: Vec, c: string, r: Vec = [0, 0, 0]) {
  return part(g, coneGeo, p, s, c, r);
}
function group(g: Group, pos: Vec, angle = 0, scale = 1, pick?: Pick) {
  const o = new THREE.Group();
  o.position.set(...pos);
  o.rotation.y = angle;
  o.scale.setScalar(scale);
  if (pick) o.userData.pick = pick;
  g.add(o);
  return o;
}
function rod(g: Group, a: Vec, b: Vec, width: number, color: string) {
  const begin = new THREE.Vector3(...a),
    end = new THREE.Vector3(...b),
    dir = end.clone().sub(begin);
  const mesh = cyl(
    g,
    begin.clone().add(end).multiplyScalar(0.5).toArray() as Vec,
    [width, dir.length(), width],
    color,
  );
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.normalize(),
  );
  return mesh;
}
function robot(g: Group) {
  for (const side of [-1, 1]) {
    const x = side * 0.27;
    box(g, [x, 0.12, 0.1], [0.45, 0.2, 0.63], red);
    box(g, [x, 0.26, 0.005], [0.37, 0.2, 0.44], ivory);
    box(g, [x, 0.48, -0.02], [0.3, 0.38, 0.32], ivory, [
      side * 0.05,
      0,
      side * 0.035,
    ]);
    box(g, [x, 0.53, 0.155], [0.27, 0.18, 0.08], blue);
    orb(g, [x, 0.74, -0.02], [0.25, 0.22, 0.26], ink);
    box(g, [x, 0.88, -0.02], [0.23, 0.23, 0.26], stone);
    box(g, [side * 0.38, 1.05, 0], [0.27, 0.34, 0.36], ivory, [
      0,
      0,
      side * 0.17,
    ]);
    box(g, [side * 0.54, 1.58, 0], [0.43, 0.3, 0.44], ivory, [
      0,
      0,
      -side * 0.12,
    ]);
    box(g, [side * 0.61, 1.65, 0.035], [0.29, 0.07, 0.39], blue, [
      0,
      0,
      -side * 0.12,
    ]);
    orb(g, [side * 0.57, 1.36, 0], [0.2, 0.24, 0.22], ink);
    box(g, [side * 0.62, 1.16, 0.02], [0.23, 0.29, 0.27], ivory, [
      0,
      0,
      side * 0.11,
    ]);
    box(g, [side * 0.65, 0.98, 0.02], [0.19, 0.15, 0.2], black);
    box(
      g,
      [side * 0.19, 1.52, 0.205],
      [0.2, 0.14, 0.05],
      brass,
      [0, 0, 0],
      true,
    );
    for (const j of [0, 1])
      box(g, [side * 0.19, 1.49 + j * 0.045, 0.239], [0.17, 0.012, 0.014], ink);
    box(g, [side * 0.22, 1.96, -0.015], [0.1, 0.23, 0.23], ivory);
    box(g, [side * 0.25, 2.025, -0.025], [0.08, 0.045, 0.2], blue);
    rod(
      g,
      [side * 0.035, 2.04, 0.173],
      [side * 0.32, 2.27, 0.146],
      0.06,
      "#ecc06b",
    );
  }
  box(g, [0, 0.97, 0], [0.56, 0.2, 0.34], blue);
  box(g, [0, 1.06, 0.18], [0.27, 0.17, 0.12], red);
  box(g, [0, 1.22, 0.005], [0.44, 0.24, 0.33], red);
  box(g, [0, 1.24, 0.19], [0.18, 0.105, 0.07], brass);
  box(g, [0, 1.48, 0], [0.78, 0.35, 0.44], blue);
  box(g, [0, 1.56, 0.225], [0.28, 0.22, 0.09], blue, [0.09, 0, 0]);
  box(g, [0, 1.72, 0], [0.29, 0.16, 0.25], ink);
  box(g, [0, 1.94, 0], [0.39, 0.36, 0.32], ivory);
  box(g, [0, 2.1, 0], [0.16, 0.07, 0.3], ivory);
  box(g, [0, 1.965, 0.173], [0.32, 0.075, 0.045], ink);
  box(g, [0, 1.965, 0.201], [0.23, 0.03, 0.016], "#73b5aa");
  box(g, [0, 1.87, 0.177], [0.19, 0.13, 0.09], ivory);
  box(g, [0, 1.825, 0.195], [0.1, 0.07, 0.07], red);
  box(g, [0, 2.071, 0.175], [0.095, 0.12, 0.06], red);
  box(g, [-0.68, 1.22, -0.1], [0.17, 0.61, 0.35], red, [0.1, 0, -0.13]);
  box(g, [-0.69, 1.23, 0.085], [0.13, 0.46, 0.025], ivory, [0.1, 0, -0.13]);
  box(g, [0.73, 1.0, 0.11], [0.14, 0.16, 0.49], black);
  box(g, [0.73, 1.03, 0.42], [0.09, 0.09, 0.26], black);
}
function bear(g: Group) {
  orb(g, [0, 0.45, 0], [0.68, 0.8, 0.56], "#ab754d");
  orb(g, [0, 1, 0], [0.83, 0.75, 0.62], "#c59363");
  for (const s of [-1, 1]) {
    orb(g, [s * 0.32, 1.3, 0], [0.23, 0.27, 0.24], "#a56e4b");
    orb(g, [s * 0.13, 1.04, 0.285], [0.055, 0.063, 0.035], ink);
    orb(g, [s * 0.21, 0.13, 0.12], [0.29, 0.22, 0.38], "#a6754f");
    orb(g, [s * 0.35, 0.48, 0.025], [0.21, 0.43, 0.23], "#a6754f");
  }
  orb(g, [0, 0.92, 0.28], [0.42, 0.26, 0.19], cream);
  orb(g, [0, 0.97, 0.37], [0.11, 0.065, 0.045], ink);
  box(g, [0, 0.67, 0.24], [0.41, 0.11, 0.15], teal);
}
function hedgehog(g: Group) {
  orb(g, [0, 0.94, 0], [0.85, 0.8, 0.7], "#3e7897");
  orb(g, [0, 0.48, 0], [0.5, 0.62, 0.4], "#377393");
  for (const s of [-1, 1]) {
    cone(g, [s * 0.29, 1.29, -0.01], [0.18, 0.26, 0.2], "#397c99");
    cone(g, [s * 0.35, 0.91, -0.21], [0.39, 0.58, 0.32], "#386e8c", [
      -0.2,
      0,
      -s * 0.82,
    ]);
    orb(g, [s * 0.13, 1.02, 0.316], [0.12, 0.16, 0.05], ivory);
    orb(g, [s * 0.13, 1.02, 0.346], [0.055, 0.09, 0.025], ink);
    orb(g, [s * 0.172, 0.15, 0.1], [0.3, 0.24, 0.45], red);
  }
  orb(g, [0, 0.89, 0.29], [0.47, 0.3, 0.25], cream);
  orb(g, [0, 0.97, 0.41], [0.12, 0.09, 0.1], ink);
}
function album(g: Group, sku: string) {
  const photo = sku.includes("PH"),
    rare = sku.startsWith("FORTUNE"),
    card = sku.startsWith("KITTY"),
    dark = sku.startsWith("KIBOU");
  const main = rare
    ? "#b39a6a"
    : card
      ? "#ae777e"
      : dark
        ? "#545f80"
        : photo
          ? "#ac7272"
          : "#c89088";
  const w = photo ? 0.76 : 0.9,
    h = photo ? 1.2 : 0.94,
    d = photo ? 0.17 : 0.11;
  box(g, [0, h / 2, 0], [w, h, d], main, [-0.12, 0, 0]);
  box(
    g,
    [-w * 0.41, h * 0.51, d * 0.68],
    [w * 0.06, h * 0.9, 0.026],
    cream,
    [-0.12, 0, 0],
  );
  if (card) {
    orb(g, [0.04, h * 0.55, d * 0.9], [w * 0.55, w * 0.45, 0.1], ivory);
    for (const side of [-1, 1]) {
      cone(
        g,
        [0.04 + side * w * 0.18, h * 0.73, d * 0.72],
        [w * 0.18, w * 0.21, 0.09],
        ivory,
      );
      orb(
        g,
        [0.04 + side * w * 0.09, h * 0.56, d * 1.37],
        [0.05, 0.075, 0.02],
        ink,
      );
    }
  } else if (!photo) {
    cyl(
      g,
      [0.075, h * 0.56, d * 0.87],
      [w * 0.59, 0.04, w * 0.59],
      rare ? brass : "#d9d4cc",
      [Math.PI / 2 - 0.12, 0, 0],
      true,
    );
    cyl(g, [0.075, h * 0.56, d * 1.17], [w * 0.18, 0.04, w * 0.18], main, [
      Math.PI / 2 - 0.12,
      0,
      0,
    ]);
  } else {
    box(
      g,
      [0.03, h * 0.6, d * 0.77],
      [w * 0.63, h * 0.49, 0.04],
      cream,
      [-0.12, 0, 0],
    );
    orb(g, [0.035, h * 0.61, d * 0.93], [w * 0.29, h * 0.25, 0.053], main);
  }
  for (let i = 0; i < 2; i++)
    box(
      g,
      [0, h * (0.15 + i * 0.06), d * 1.18],
      [w * (i ? 0.39 : 0.62), 0.02, 0.026],
      ivory,
      [-0.12, 0, 0],
    );
}
function car(g: Group) {
  box(g, [0, 0.29, 0], [1.33, 0.31, 0.61], blue);
  box(g, [-0.07, 0.52, -0.01], [0.69, 0.24, 0.52], blue);
  box(g, [-0.07, 0.55, 0.255], [0.52, 0.13, 0.034], "#a7c1c0");
  for (const s of [-1, 1])
    for (const z of [-0.31, 0.31]) {
      cyl(g, [s * 0.42, 0.2, z], [0.33, 0.13, 0.33], black, [
        Math.PI / 2,
        0,
        0,
      ]);
      cyl(g, [s * 0.42, 0.2, z * 1.18], [0.15, 0.03, 0.15], stone, [
        Math.PI / 2,
        0,
        0,
      ]);
    }
  box(g, [0.66, 0.31, 0], [0.03, 0.105, 0.48], cream);
  box(g, [-0.65, 0.32, 0], [0.03, 0.12, 0.46], red);
}
function collectible(g: Group, sku: string) {
  if (sku === "ROBOT") robot(g);
  else if (sku === "FOREST") bear(g);
  else if (sku === "SONIC") hedgehog(g);
  else if (sku === "RARE-CAR") car(g);
  else album(g, sku);
}
function parcel(g: Group, p: Vec, w = 0.59, h = 0.45, d = 0.51, angle = 0) {
  const o = group(g, p, angle);
  box(o, [0, h / 2, 0], [w, h, d], wood);
  box(o, [0, h + 0.002, 0], [w * 0.16, 0.018, d * 1.01], cream);
  box(o, [0, h * 0.86, d * 0.503], [w * 0.16, h * 0.27, 0.015], cream);
  box(o, [w * 0.24, h * 0.55, d * 0.507], [w * 0.2, h * 0.21, 0.014], ivory);
}
function counter(g: Group, p: Vec, w: number, d: number, color: string) {
  const o = group(g, p);
  box(o, [0, 0.09, 0], [w * 0.97, 0.18, d * 0.95], ink);
  box(o, [0, 0.5, 0], [w, 0.73, d], color);
  box(o, [0, 0.9, 0], [w + 0.08, 0.12, d + 0.08], cream);
  return o;
}
function monitor(g: Group, x: number, y: number, z: number, scale = 1) {
  const o = group(g, [x, y, z], 0, scale);
  box(o, [0, 0.025, 0], [0.45, 0.05, 0.26], black);
  box(o, [0, 0.19, 0], [0.11, 0.3, 0.12], black);
  box(o, [0, 0.53, 0], [0.78, 0.49, 0.11], ink);
  box(o, [0, 0.55, 0.066], [0.66, 0.36, 0.022], blue);
  for (let i = 0; i < 3; i++)
    box(
      o,
      [-0.22 + i * 0.18, 0.5, 0.083],
      [0.085, 0.1 + 0.06 * i, 0.012],
      i === 2 ? brass : "#acc2b2",
    );
}
function cabinet(g: Group, p: Vec, angle: number, width: number) {
  const o = group(g, p, angle, 1, { zone: "shelf" });
  box(o, [0, 1.36, -0.28], [width, 2.65, 0.12], "#73897b");
  for (const x of [-width / 2, width / 2]) {
    box(o, [x, 1.35, 0.04], [0.105, 2.72, 0.79], wood);
    box(o, [x, 1.35, 0.45], [0.055, 2.72, 0.055], brass);
  }
  for (const y of [0.2, 1.25, 2.48]) {
    box(o, [0, y, 0.05], [width, 0.105, 0.76], wood);
    box(o, [0, y, 0.445], [width, 0.04, 0.05], brass, [0, 0, 0], true, true);
  }
  box(o, [0, 2.63, 0.02], [width + 0.11, 0.18, 0.84], cream);
  box(
    o,
    [0, 2.52, 0.44],
    [width - 0.1, 0.045, 0.04],
    "#efc27d",
    [0, 0, 0],
    false,
    true,
  );
  return o;
}
function arch(g: Group, x: number, z: number, w: number, height: number) {
  const r = w / 2,
    pier = height - r;
  box(g, [x, pier / 2, z], [w, pier, 0.08], "#82998b");
  const disk = cyl(g, [x, pier, z], [w, 0.08, w], "#82998b", [
    Math.PI / 2,
    0,
    0,
  ]);
  disk.scale.y = 0.08;
  part(g, archGeo, [x, pier, z + 0.077], [r, r, 1], cream);
  for (const side of [-1, 1])
    box(g, [x + side * r, pier / 2, z + 0.08], [0.09, pier, 0.12], cream);
}
function plant(g: Group, p: Vec, scale: number) {
  const o = group(g, p, 0, scale);
  cyl(o, [0, 0.24, 0], [0.53, 0.47, 0.53], copper);
  cyl(o, [0, 0.47, 0], [0.56, 0.07, 0.56], cream);
  for (const [x, y, z, angle] of [
    [-0.13, 0.81, 0, 0.31],
    [0.15, 0.97, 0.035, -0.31],
    [0, 1.14, -0.08, -0.04],
    [0.22, 0.73, 0.08, -0.74],
    [-0.2, 0.7, 0.1, 0.71],
  ]) {
    const leaf = orb(
      o,
      [x, y, z],
      [0.2, 0.59, 0.16],
      y > 1 ? "#819070" : "#58715d",
    );
    leaf.rotation.z = angle;
  }
}
function architecture(root: Group) {
  box(root, [0, -0.46, 0], [11.05, 0.39, 7.35], ink);
  box(root, [0, -0.255, 0], [11.11, 0.07, 7.4], brass, [0, 0, 0], true);
  box(root, [0, -0.125, 0], [11.1, 0.2, 7.38], stone);
  box(root, [0, -0.01, 0], [11.18, 0.05, 7.43], cream);
  box(root, [3.16, 0.026, 0], [4.55, 0.045, 6.94], "#c58a69");
  for (let x = -5; x <= 5; x++) {
    box(
      root,
      [x, 0.057, 0],
      [0.012, 0.009, 7.12],
      x >= 1 ? "#a87860" : "#d6c2a2",
    );
  }
  for (let z = -3; z <= 3; z++) {
    box(root, [-2.28, 0.057, z], [6.18, 0.009, 0.014], "#d6c2a2");
    box(root, [3.17, 0.057, z], [4.51, 0.009, 0.014], "#a87860");
  }
  box(root, [0, 1.87, -3.34], [10.77, 3.75, 0.22], stone);
  box(root, [0, 3.78, -3.32], [10.92, 0.16, 0.35], cream);
  box(root, [-5.24, 1.39, -0.92], [0.19, 2.79, 4.87], stone);
  box(root, [-5.24, 2.83, -0.92], [0.28, 0.14, 4.94], cream);
  for (const x of [-3.88, -1.5, 0.88]) arch(root, x, -3.17, 1.92, 3.48);
  box(root, [3.82, 1.85, -3.17], [2.63, 3.68, 0.15], teal);
  for (let i = 0; i < 10; i++)
    box(root, [2.62 + i * 0.265, 1.84, -3.07], [0.026, 3.62, 0.025], "#5a7870");
  for (const x of [-5.16, -2.69, -0.29, 2.22, 5.22]) {
    box(root, [x, 1.84, -3.02], [0.13, 3.65, 0.28], cream);
    box(root, [x, 0.22, -3.02], [0.23, 0.33, 0.36], stone);
  }
  for (const x of [-3.15, -0.78, 1.55]) {
    box(root, [x, 2.97, -2.99], [0.2, 0.22, 0.2], brass);
    box(
      root,
      [x, 2.94, -2.854],
      [0.13, 0.14, 0.1],
      "#ffda96",
      [0, 0, 0],
      false,
      true,
    );
  }
  plant(root, [-4.75, 0.08, 2.8], 0.8);
  plant(root, [5.03, 0.08, -2.89], 0.73);
}
function feature(root: Group, v: GalleryVariant | undefined, angle = 0.24) {
  const p = positions.shelf;
  const g = group(root, [p[0], 0.06, p[2]], angle, 1, {
    zone: "shelf",
    variantId: v?.id,
  });
  cyl(g, [0, 0.115, 0], [2.42, 0.23, 2.42], teal);
  cyl(g, [0, 0.26, 0], [2.33, 0.09, 2.33], brass, [0, 0, 0], true);
  cyl(g, [0, 0.52, 0], [2.17, 0.47, 2.17], cream);
  for (let i = 0; i < 30; i++) {
    const a = (i * Math.PI) / 15;
    cyl(
      g,
      [1.074 * Math.cos(a), 0.52, 1.074 * Math.sin(a)],
      [0.045, 0.42, 0.045],
      stone,
    );
  }
  cyl(g, [0, 0.8, 0], [2.3, 0.12, 2.3], ivory);
  part(
    g,
    ringGeo,
    [0, 0.875, 0],
    [1.03, 1.03, 0.65],
    "#e8bd6b",
    [Math.PI / 2, 0, 0],
    true,
    true,
  );
  if (v) {
    const model = group(
      g,
      [0, 0.87, 0],
      0.12,
      v.sku === "ROBOT" ? 0.93 : v.sku === "RARE-CAR" ? 1.5 : 1.4,
    );
    collectible(model, v.sku);
  }
}
function displays(root: Group, variants: GalleryVariant[]) {
  const cabinets = [
    cabinet(root, [-3.63, 0.04, -2.72], 0, 2.04),
    cabinet(root, [-1.35, 0.04, -2.72], 0, 2.04),
    cabinet(root, [-4.86, 0.04, -1.65], Math.PI / 2, 2.16),
    cabinet(root, [-4.86, 0.04, 0.57], Math.PI / 2, 1.83),
  ];
  variants.forEach((v, i) => {
    const k = Math.floor(i / 4);
    if (!cabinets[k]) return;
    const row = Math.floor((i % 4) / 2),
      column = i % 2;
    const g = group(
      cabinets[k],
      [(column - 0.5) * 0.89, 0.3 + row * 1.05, 0.08],
      0.16,
      v.sku === "ROBOT" ? 0.34 : v.sku === "RARE-CAR" ? 0.59 : 0.59,
      { zone: "shelf", variantId: v.id },
    );
    collectible(g, v.sku);
  });
}
function stations(root: Group) {
  const picker = group(root, positions.pick, 0.12, 1, { zone: "pick" });
  for (const x of [-0.53, 0.53]) {
    box(picker, [x, 0.54, 0], [0.065, 1.0, 0.8], teal);
    for (const z of [-0.31, 0.31])
      cyl(picker, [x, 0.12, z], [0.16, 0.095, 0.16], ink, [Math.PI / 2, 0, 0]);
  }
  for (const y of [0.28, 0.91])
    box(picker, [0, y, 0], [1.16, 0.085, 0.78], teal);
  parcel(picker, [-0.25, 0.95, 0], 0.49, 0.42, 0.45);
  parcel(picker, [0.24, 0.95, 0], 0.38, 0.26, 0.43, -0.08);
  const pack = group(root, positions.pack, 0.055, 1, { zone: "pack" });
  for (const x of [-0.93, 0.93])
    for (const z of [-0.39, 0.39])
      box(pack, [x, 0.43, z], [0.12, 0.79, 0.12], teal);
  box(pack, [0, 0.23, 0], [1.95, 0.11, 0.85], wood);
  box(pack, [0, 0.9, 0], [2.15, 0.13, 1.08], cream);
  box(pack, [0, 0.983, 0.01], [1.0, 0.025, 0.69], teal);
  parcel(pack, [0.05, 1.0, 0], 0.53, 0.31, 0.42, -0.1);
  cyl(pack, [-0.68, 1.06, 0.1], [0.18, 0.16, 0.18], cream);
  box(pack, [0.73, 1.02, -0.2], [0.4, 0.08, 0.3], blue);
  const pickup = group(root, positions.pickup, -0.06, 1, { zone: "pickup" });
  for (const x of [-0.6, 0, 0.6])
    box(pickup, [x, 0.1, 0], [0.17, 0.17, 1.18], wood);
  for (let i = 0; i < 4; i++)
    box(pickup, [0, 0.22, -0.47 + i * 0.31], [1.63, 0.1, 0.24], wood);
  parcel(pickup, [-0.29, 0.28, 0.04], 0.76, 0.48, 0.65);
  parcel(pickup, [0.39, 0.28, -0.19], 0.5, 0.37, 0.44);
  parcel(pickup, [-0.3, 0.76, 0.06], 0.57, 0.39, 0.44, 0.06);
  const truck = group(root, positions.carrier, -0.18, 1, { zone: "carrier" });
  box(truck, [0, 0.38, 0], [1.98, 0.23, 1.01], black);
  box(truck, [0.34, 0.89, 0], [1.3, 0.86, 1.04], ivory);
  box(truck, [0.34, 1.335, 0], [1.35, 0.064, 1.09], cream);
  box(truck, [-0.63, 0.68, 0], [0.74, 0.39, 0.96], teal);
  box(truck, [-0.55, 0.99, 0], [0.6, 0.37, 0.89], teal);
  box(truck, [-0.55, 1.01, 0.455], [0.41, 0.25, 0.028], "#a7c0bb");
  box(truck, [-0.865, 1.02, 0], [0.035, 0.23, 0.71], "#a7c0bb");
  box(truck, [0.34, 0.74, 0.53], [1.29, 0.18, 0.018], copper);
  box(truck, [0.35, 0.99, 0.54], [0.39, 0.12, 0.02], teal);
  box(truck, [-0.99, 0.62, 0], [0.035, 0.12, 0.71], cream);
  for (const x of [-0.61, 0.6])
    for (const z of [-0.5, 0.5]) {
      cyl(truck, [x, 0.34, z], [0.46, 0.18, 0.46], ink, [Math.PI / 2, 0, 0]);
      cyl(truck, [x, 0.34, z * 1.18], [0.22, 0.045, 0.22], stone, [
        Math.PI / 2,
        0,
        0,
      ]);
    }
  const returns = group(root, positions.returns, 0.06, 1, { zone: "returns" });
  box(returns, [0, 0.35, 0], [1.03, 0.63, 0.79], blue);
  box(returns, [0, 0.69, 0], [1.11, 0.1, 0.86], teal);
  parcel(returns, [0.03, 0.75, 0.01], 0.71, 0.28, 0.55);
  const cash = group(root, positions.cash, 0.24, 1, { zone: "cash" });
  const till = counter(cash, [0, 0, 0], 1.53, 0.83, teal);
  for (let i = 0; i < 12; i++)
    box(till, [-0.68 + i * 0.125, 0.5, 0.43], [0.044, 0.65, 0.048], "#6b867c");
  monitor(till, 0.26, 0.97, 0, 0.64);
  box(till, [-0.39, 1.01, 0.15], [0.36, 0.07, 0.24], wood);
  const dashboard = group(root, positions.dashboard, 0, 1, {
    zone: "dashboard",
  });
  box(dashboard, [0, 0.17, 0.02], [2.03, 1.32, 0.12], brass, [0, 0, 0], true);
  box(dashboard, [0, 0.17, 0.1], [1.91, 1.18, 0.11], ink);
  for (let i = 0; i < 6; i++) {
    const h = [0.2, 0.35, 0.27, 0.51, 0.4, 0.64][i];
    box(
      dashboard,
      [-0.69 + i * 0.264, -0.24 + h / 2, 0.165],
      [0.136, h, 0.032],
      i === 5 ? "#d5b779" : "#739b8c",
    );
  }
  const desk = group(root, positions.computer, 0, 1, { zone: "computer" });
  const table = counter(desk, [0, 0, 0], 1.58, 0.72, wood);
  monitor(table, -0.17, 0.97, -0.04, 0.95);
  box(table, [-0.1, 0.99, 0.21], [0.59, 0.04, 0.18], black);
  orb(table, [0.47, 1.03, 0.22], [0.14, 0.08, 0.18], teal);
  const seat = group(desk, [0.28, 0, 0.78], 0.17);
  cyl(seat, [0, 0.37, 0], [0.12, 0.59, 0.12], brass);
  cyl(seat, [0, 0.65, 0], [0.52, 0.14, 0.52], teal);
  cyl(seat, [0, 0.1, 0], [0.53, 0.1, 0.53], ink);
}
function buildAvatar(root: Group) {
  const g = group(root, [1.35, 0.06, -1.31], 0.23, 0.55, { zone: "computer" });
  for (const side of [-1, 1]) {
    box(g, [side * 0.18, 0.17, 0.05], [0.24, 0.24, 0.32], teal);
    box(g, [side * 0.18, 0.37, 0], [0.16, 0.31, 0.19], black);
    orb(g, [side * 0.4, 0.8, 0.02], [0.21, 0.39, 0.2], cream);
  }
  box(g, [0, 0.76, 0], [0.57, 0.53, 0.35], teal);
  box(g, [0, 0.73, 0.19], [0.24, 0.23, 0.045], cream);
  orb(g, [0, 1.27, 0], [0.66, 0.57, 0.55], ivory);
  box(g, [0, 1.29, 0.25], [0.53, 0.16, 0.08], ink);
  for (const x of [-0.13, 0.13])
    box(
      g,
      [x, 1.29, 0.301],
      [0.075, 0.055, 0.02],
      "#8bb8aa",
      [0, 0, 0],
      false,
      true,
    );
  cyl(g, [0, 1.59, 0], [0.24, 0.08, 0.24], brass);
  orb(g, [0, 1.7, 0], [0.1, 0.13, 0.1], brass);
  return g;
}
// Bake static pieces by their material and actionable parent. One object retains each
// selection even after combining geometry, so visible models and hit tests agree.
function bake(root: Group, skip?: Group) {
  root.updateWorldMatrix(true, true);
  const batches = new Map<
    string,
    { geo: THREE.BufferGeometry[]; mat: Mat; pick?: Pick }
  >();
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    let found: Pick | undefined,
      cur: THREE.Object3D | null = obj;
    while (cur) {
      if (cur === skip) return;
      if (!found && cur.userData.pick) found = cur.userData.pick;
      cur = cur.parent;
    }
    const mat = obj.material as Mat,
      key = [found?.zone, found?.variantId, mat.uuid].join("/");
    const group = batches.get(key) ?? { geo: [], mat, pick: found };
    batches.set(key, group);
    group.geo.push(
      obj.geometry
        .clone()
        .applyMatrix4(
          new THREE.Matrix4().multiplyMatrices(inverse, obj.matrixWorld),
        ),
    );
  });
  const out = new THREE.Group();
  for (const batch of batches.values()) {
    const geom = mergeGeometries(batch.geo);
    for (const item of batch.geo) item.dispose();
    if (!geom) continue;
    const mesh = new THREE.Mesh(geom, batch.mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.userData.pick = batch.pick;
    out.add(mesh);
  }
  return out;
}
export function createDiorama(variants: GalleryVariant[], selected: string) {
  const raw = new THREE.Group();
  architecture(raw);
  stations(raw);
  displays(raw, variants);
  feature(raw, variants.find((v) => v.id === selected) ?? variants[0]);
  const root = bake(raw),
    avRaw = new THREE.Group(),
    originalAvatar = buildAvatar(avRaw),
    avatar = bake(originalAvatar);
  avatar.scale.copy(originalAvatar.scale);
  avatar.rotation.copy(originalAvatar.rotation);
  avatar.position.copy(originalAvatar.position);
  root.add(avatar);
  return {
    root,
    avatar,
    dispose: () =>
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose();
      }),
  };
}
export type Diorama = ReturnType<typeof createDiorama>;
export function avatarDestination(zone: Zone): Vec {
  const [x, , z] = positions[zone];
  if (zone === "computer") return [1.35, 0.06, -1.31];
  if (zone === "dashboard") return [x, 0.07, z + 0.84];
  return [x - 0.45, 0.07, Math.min(3.1, z + 0.88)];
}
export function cameraFit(width: number, height: number) {
  return Math.max(0.1, Math.min(width / 14.35, height / 10.25));
}
export const cameraPosition: Vec = [10.8, 9.29, 14.6],
  cameraTarget: Vec = [0, 1.59, 0];

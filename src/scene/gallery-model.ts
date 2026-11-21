import * as T from "three";

type Part = T.Object3D;
const stone = 0xebe0c6,
  ivory = 0xffefd6,
  brass = 0xc69b52,
  wood = 0x966548,
  walnut = 0x5e4839,
  terracotta = 0xb97455,
  blue = 0x437c92,
  green = 0x496855;
const mats = new Map<number, T.MeshStandardMaterial>();
function material(color: number) {
  if (!mats.has(color))
    mats.set(
      color,
      new T.MeshStandardMaterial({
        color,
        roughness: 0.68,
        metalness: color === brass ? 0.42 : 0.06,
      }),
    );
  return mats.get(color)!;
}
function mesh(
  parent: Part,
  geo: T.BufferGeometry,
  color: number,
  x: number,
  y: number,
  z: number,
) {
  const m = new T.Mesh(geo, material(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function box(
  p: Part,
  w: number,
  h: number,
  d: number,
  c: number,
  x: number,
  y: number,
  z: number,
) {
  return mesh(p, new T.BoxGeometry(w, h, d), c, x, y, z);
}
function cyl(
  p: Part,
  r: number,
  h: number,
  c: number,
  x: number,
  y: number,
  z: number,
  rt = r,
) {
  return mesh(p, new T.CylinderGeometry(rt, r, h, 40), c, x, y, z);
}
function sphere(
  p: Part,
  r: number,
  c: number,
  x: number,
  y: number,
  z: number,
) {
  return mesh(p, new T.SphereGeometry(r, 16, 12), c, x, y, z);
}
function group(p: Part, x: number, y: number, z: number) {
  const g = new T.Group();
  g.position.set(x, y, z);
  p.add(g);
  return g;
}
function line(p: Part, a: number[], b: number[], r: number, c: number) {
  const v = new T.Vector3(...a),
    w = new T.Vector3(...b),
    dir = w.clone().sub(v);
  const m = cyl(p, r, dir.length(), c, 0, 0, 0);
  m.position.copy(v.add(w).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
  return m;
}
function arch(
  p: Part,
  w: number,
  h: number,
  d: number,
  c: number,
  x: number,
  y: number,
  z: number,
) {
  const s = new T.Shape(),
    r = w / 2;
  s.moveTo(-r, 0);
  s.lineTo(-r, h - r);
  s.absarc(0, h - r, r, Math.PI, 0, true);
  s.lineTo(r, 0);
  s.closePath();
  return mesh(
    p,
    new T.ExtrudeGeometry(s, {
      depth: d,
      bevelEnabled: false,
      curveSegments: 24,
    }),
    c,
    x,
    y,
    z,
  );
}
function sign(
  p: Part,
  str: string,
  w: number,
  h: number,
  x: number,
  y: number,
  z: number,
  bg: string,
  fg: string,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = Math.round((768 * h) / w);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = fg;
  ctx.font = "bold " + Math.round(canvas.height * 0.65) + "px Georgia";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(str, canvas.width / 2, canvas.height * 0.5, canvas.width * 0.96);
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  const m = new T.Mesh(
    new T.PlaneGeometry(w, h),
    new T.MeshBasicMaterial({ map: tex }),
  );
  m.position.set(x, y, z);
  p.add(m);
  return m;
}
function crate(p: Part, x: number, y: number, z: number, s = 0.55) {
  box(p, s, s * 0.76, s * 0.74, 0xc79966, x, y + s * 0.38, z);
  box(p, s * 0.15, s * 0.78, s * 0.75, 0xe1bc83, x + 0.05, y + s * 0.38, z);
  box(
    p,
    s * 0.26,
    s * 0.16,
    0.012,
    ivory,
    x - 0.12 * s,
    y + s * 0.4,
    z + s * 0.375,
  );
}
function toy(
  p: Part,
  x: number,
  y: number,
  z: number,
  scale: number,
  type: number,
) {
  const t = group(p, x, y, z);
  t.scale.setScalar(scale);
  const col = [blue, 0xd8a465, 0xca786a, 0x7c94a2, 0xc5a565, 0x85a787][
    type % 6
  ];
  if (type % 4 === 0) {
    for (const side of [-1, 1]) {
      box(t, 0.27, 0.18, 0.46, 0xaa5549, side * 0.2, 0.09, 0.055);
      box(t, 0.24, 0.34, 0.25, 0xe6e6dc, side * 0.19, 0.3, 0);
      box(t, 0.19, 0.18, 0.23, 0x54656c, side * 0.18, 0.54, 0);
      box(t, 0.24, 0.2, 0.22, ivory, side * 0.17, 0.68, 0);
      box(t, 0.25, 0.23, 0.35, 0xf4ecdc, side * 0.46, 1.06, 0);
      box(t, 0.17, 0.32, 0.21, 0xe4ddd0, side * 0.46, 0.83, 0);
      box(t, 0.17, 0.12, 0.19, 0x3b505b, side * 0.46, 0.62, 0);
      line(
        t,
        [side * 0.06, 1.46, 0.13],
        [side * 0.29, 1.72, 0.09],
        0.029,
        brass,
      );
    }
    box(t, 0.4, 0.19, 0.29, 0x63737a, 0, 0.76, 0);
    box(t, 0.57, 0.35, 0.34, col, 0, 1, 0);
    box(t, 0.16, 0.2, 0.05, 0xc96142, 0, 0.96, 0.19);
    box(t, 0.32, 0.29, 0.28, ivory, 0, 1.34, 0);
    box(t, 0.25, 0.065, 0.025, 0x326d77, 0, 1.365, 0.151);
    box(t, 0.08, 0.12, 0.05, 0xc8664b, 0, 1.24, 0.155);
  } else if (type % 4 === 1) {
    sphere(t, 0.29, col, 0, 0.36, 0);
    sphere(t, 0.32, col, 0, 0.75, 0);
    for (const s of [-1, 1]) {
      sphere(t, 0.14, col, s * 0.24, 0.98, 0);
      sphere(t, 0.045, 0x473f36, s * 0.12, 0.78, 0.275);
      sphere(t, 0.12, stone, s * 0.17, 0.14, 0.05);
    }
    sphere(t, 0.1, ivory, 0, 0.66, 0.27);
  } else if (type % 4 === 2) {
    box(t, 0.52, 0.72, 0.25, 0xe8d6b5, 0, 0.36, 0);
    box(t, 0.43, 0.5, 0.014, col, 0, 0.4, 0.136);
    sphere(t, 0.13, ivory, 0, 0.43, 0.13);
    box(t, 0.28, 0.035, 0.02, walnut, 0, 0.1, 0.14);
  } else {
    box(t, 0.45, 0.25, 0.75, col, 0, 0.24, 0);
    box(t, 0.35, 0.16, 0.37, 0xa6bbbc, 0, 0.43, -0.02);
    for (const s of [-1, 1])
      for (const zz of [-0.23, 0.23]) {
        const tire = cyl(t, 0.115, 0.1, 0x36444b, s * 0.23, 0.14, zz);
        tire.rotation.z = Math.PI / 2;
      }
  }
  return t;
}
function plant(p: Part, x: number, z: number, s: number) {
  const root = group(p, x, 0, z);
  root.scale.setScalar(s);
  cyl(root, 0.27, 0.53, 0xaa6b4e, 0, 0.265, 0, 0.36);
  cyl(root, 0.35, 0.04, 0x635543, 0, 0.55, 0);
  for (let i = 0; i < 10; i++) {
    const a = i * 2.399,
      r = 0.28 + (i % 3) * 0.04,
      h = 0.95 + (i % 4) * 0.17,
      dx = Math.cos(a) * r,
      dz = Math.sin(a) * r;
    line(root, [0, 0.52, 0], [dx, h, dz], 0.016, green);
    const leaf = sphere(root, 0.24, i % 2 ? 0x597655 : 0x748c65, dx, h, dz);
    leaf.scale.set(0.58, 1.6, 0.23);
    leaf.rotation.set(Math.sin(a) * 0.65, a, Math.cos(a) * -0.65);
  }
}
export function buildGallery(ids: string[], selectedIndex: number, shopName: string) {
  const root = new T.Group(),
    floor = group(root, 0, -0.18, 0);
  box(floor, 13.1, 0.32, 7.9, 0x9e8b73, 0, -0.18, 0);
  box(floor, 12.95, 0.18, 7.78, ivory, 0, 0.05, 0);
  for (let x = -6.3; x <= 6.2; x += 1.05)
    for (let z = -3.69; z <= 3.63; z += 1.055)
      box(
        floor,
        1.038,
        0.047,
        1.038,
        Math.round((x + z) * 12) % 3 === 0 ? 0xe3d7be : stone,
        x + 0.49,
        0.158,
        z + 0.5,
      );
  // Rear arcade with actual shelf merchandise and shop sign.
  box(root, 12.85, 4.35, 0.38, 0xcbb89b, 0, 2.09, -3.67);
  box(root, 12.98, 0.16, 0.53, ivory, 0, 4.32, -3.65);
  let idx = 0;
  const shelves = new Map<string, { parts: T.Group[]; pin: T.Group }>();
  function cabinet(x: number, width: number) {
    const bay = group(root, x, 0, -3.45);
    arch(bay, width + 0.18, 3.97, 0.11, ivory, 0, 0, 0);
    arch(bay, width - 0.1, 3.78, 0.12, brass, 0, 0.04, 0.105);
    arch(bay, width - 0.22, 3.64, 0.13, 0x6c6857, 0, 0.07, 0.18);
    for (const y of [0.56, 1.44, 2.32]) {
      box(bay, width - 0.22, 0.11, 0.66, wood, 0, y, 0.4);
      box(bay, width - 0.23, 0.035, 0.05, 0xffdea1, 0, y - 0.045, 0.73);
      for (let i = 0; i < 3; i++) {
        if (!ids.length) continue;
        const index = idx++ % ids.length;
        const item = toy(
          bay,
          (i - 1) * (width * 0.28),
          y + 0.07,
          0.46,
          0.49 + (index % 2) * 0.05,
          index,
        );
        const id = ids[index];
        const shelf = shelves.get(id);
        if (shelf) shelf.parts.push(item);
        else shelves.set(id, { parts: [item], pin: group(item, 0, 0.64, 0.13) });
      }
    }
    box(bay, width + 0.03, 0.38, 0.8, wood, 0, 0.2, 0.39);
    for (const side of [-1, 1])
      box(
        bay,
        0.04,
        2.18,
        0.04,
        brass,
        (side * (width - 0.15)) / 2,
        1.48,
        0.76,
      );
  }
  cabinet(-4.54, 2.55);
  cabinet(-1.6, 2.58);
  cabinet(1.34, 2.58);
  const mark = group(root, 4.55, 0, -3.41);
  arch(mark, 2.95, 3.89, 0.12, 0xdcbd98, 0, 0, 0);
  arch(mark, 2.52, 3.55, 0.12, 0xb98264, 0, 0.08, 0.15);
  if (shopName) sign(mark, shopName, 2.45, 0.61, 0, 2.92, 0.285, "#b98264", "#fff1d0");
  const dashboard = group(mark, 0, 1.82, 0.31);
  box(dashboard, 1.67, 0.92, 0.11, walnut, 0, 0, 0);
  box(dashboard, 1.52, 0.79, 0.13, 0x354f51, 0, 0, 0);
  for (let i = 0; i < 6; i++) {
    const h = 0.14 + [0.13, 0.06, 0.22, 0.14, 0.36, 0.47][i];
    box(
      dashboard,
      0.13,
      h,
      0.025,
      i > 3 ? 0xe1af6e : 0x8baea1,
      -0.57 + i * 0.22,
      -0.32 + h / 2,
      0.083,
    );
  }
  // Side arcade frames facing the gallery.
  const side = group(root, -6.26, 0, -0.07);
  side.rotation.y = Math.PI / 2;
  box(side, 7.22, 3.9, 0.24, 0xceba9d, 0, 1.93, 0);
  box(side, 7.33, 0.15, 0.38, ivory, 0, 3.94, 0);
  for (const x of [-2.36, 0, 2.36]) {
    arch(side, 2.21, 3.59, 0.1, ivory, x, 0.04, 0.12);
    arch(side, 1.87, 3.35, 0.1, 0xb09a79, x, 0.09, 0.22);
    arch(side, 1.7, 3.17, 0.1, 0x788887, x, 0.14, 0.32);
    box(side, 0.045, 1.9, 0.05, stone, x, 1.3, 0.45);
    box(side, 1.71, 0.055, 0.05, stone, x, 1.8, 0.45);
    box(side, 2.04, 0.1, 0.32, ivory, x, 0.43, 0.42);
  }
  const pedestal = group(root, -0.63, 0, 0.37);
  cyl(pedestal, 1.5, 0.14, 0xb5a187, 0, 0.06, 0);
  cyl(pedestal, 1.4, 0.21, ivory, 0, 0.22, 0);
  cyl(pedestal, 1.18, 0.52, 0xcdbd9f, 0, 0.54, 0);
  cyl(pedestal, 1.24, 0.07, brass, 0, 0.825, 0);
  cyl(pedestal, 1.21, 0.08, ivory, 0, 0.9, 0);
  if (ids[selectedIndex]) {
    const hero = toy(pedestal, 0, 0.94, 0, 1.35, selectedIndex);
    hero.rotation.y = 0.35;
  }
  const ring = mesh(
    pedestal,
    new T.TorusGeometry(1.18, 0.048, 12, 72),
    brass,
    0,
    2.03,
    -0.58,
  );
  ring.rotation.y = 0.15;
  const desk = group(root, -4.02, 0, 1.94);
  box(desk, 2.68, 0.88, 1.07, wood, 0, 0.45, 0);
  for (let i = 0; i < 15; i++)
    box(desk, 0.065, 0.82, 0.06, 0xbb936a, -1.24 + i * 0.177, 0.47, 0.55);
  box(desk, 2.79, 0.14, 1.18, stone, 0, 0.96, 0);
  const pc = group(desk, 0, 1.04, 0);
  box(pc, 0.59, 0.08, 0.38, walnut, 0, 0.04, 0);
  box(pc, 0.11, 0.35, 0.13, brass, 0, 0.21, 0);
  const screen = box(pc, 0.8, 0.49, 0.09, 0x3a4544, 0, 0.46, 0);
  screen.rotation.x = -0.12;
  box(pc, 0.68, 0.36, 0.03, 0x739494, 0, 0.465, 0.06);
  box(desk, 0.51, 0.045, 0.18, 0x767668, 0.17, 1.05, 0.32);
  plant(root, -5.25, 2.92, 0.76);
  plant(root, 2.86, -2.52, 0.68);
  const strip = group(root, 4.35, 0, 0.13);
  box(strip, 3.73, 0.1, 6.95, terracotta, 0, 0.015, 0);
  for (let i = 0; i < 7; i++)
    box(strip, 3.66, 0.014, 0.016, 0xd5a082, 0, 0.079, -3.03 + i * 1.0);
  const table = group(root, 4.15, 0.08, -1.84);
  box(table, 2.66, 0.14, 0.99, wood, 0, 1.1, 0);
  for (const xx of [-1.12, 1.12])
    for (const zz of [-0.34, 0.34])
      box(table, 0.11, 1.1, 0.13, green, xx, 0.55, zz);
  crate(table, -0.64, 1.18, 0, 0.6);
  crate(table, 0.2, 1.18, 0, 0.43);
  cyl(table, 0.19, 0.14, 0xe9d0a0, 0.85, 1.25, 0.01);
  box(table, 0.43, 0.05, 0.33, ivory, 0.45, 1.19, 0.2);
  const pick = group(root, 2.02, 0, -1.43);
  for (const yy of [0.2, 0.85]) {
    box(pick, 1.15, 0.09, 0.74, wood, 0, yy, 0);
    crate(pick, -0.21, yy + 0.05, 0, 0.43);
    crate(pick, 0.26, yy + 0.05, 0, 0.34);
  }
  for (const xx of [-0.48, 0.48])
    line(pick, [xx, 0.1, -0.26], [xx, 1.15, -0.26], 0.035, brass);
  const stage = group(root, 3.25, 0.1, 0.01);
  for (const x of [-0.38, 0, 0.38])
    box(stage, 0.32, 0.1, 1.01, wood, x, 0.06, 0);
  crate(stage, -0.24, 0.12, 0.1, 0.64);
  crate(stage, 0.35, 0.12, -0.1, 0.48);
  crate(stage, -0.21, 0.6, 0.06, 0.4);
  const van = group(root, 4.84, 0.12, 1.84);
  van.rotation.y = -0.26;
  box(van, 1.18, 0.28, 2.28, 0x384b4c, 0, 0.4, 0);
  box(van, 1.2, 0.95, 1.36, 0xf2dcb6, 0, 0.92, -0.43);
  box(van, 1.18, 0.54, 0.89, green, 0, 0.66, 0.66);
  box(van, 1.12, 0.48, 0.71, 0x698888, 0, 1.07, 0.53);
  box(van, 1.2, 0.09, 0.8, ivory, 0, 1.34, 0.54);
  box(van, 1.24, 0.1, 0.12, brass, 0, 0.48, 1.13);
  for (const x of [-0.41, 0.41])
    box(van, 0.19, 0.14, 0.03, 0xf1d093, x, 0.73, 1.12);
  for (const xx of [-0.6, 0.6])
    for (const zz of [-0.7, 0.69]) {
      const tire = cyl(van, 0.25, 0.16, 0x354041, xx, 0.3, zz);
      tire.rotation.z = Math.PI / 2;
      const cap = cyl(van, 0.12, 0.17, 0xb3ad94, xx, 0.3, zz);
      cap.rotation.z = Math.PI / 2;
    }
  const ret = group(root, 1.21, 0, 2.53);
  box(ret, 1.03, 0.38, 0.68, green, 0, 0.21, 0);
  crate(ret, 0.06, 0.4, 0.03, 0.5);
  // Attach each label to the part a shopper would actually point to.
  // Nested transforms (in particular the monitor and van) move its pin too.
  const stations = {
    computer: { part: pc, pin: group(screen, 0, 0, 0.07) },
    cashier: { part: desk, pin: group(desk, -0.7, 0.69, 0.58) },
    returns: { part: ret, pin: group(ret, 0.06, 0.69, 0.21) },
    insights: { part: mark, pin: group(dashboard, 0.16, 0.1, 0.09) },
    picking: { part: pick, pin: group(pick, -0.16, 1.12, 0.11) },
    packing: { part: table, pin: group(table, 0.45, 1.2, 0.2) },
    staging: { part: stage, pin: group(stage, -0.18, 0.83, 0.16) },
    carrier: { part: van, pin: group(van, 0.55, 0.95, -0.36) },
  };
  return { root, stations, shelves, pedestal, pedestalPin: group(pedestal, 0, 1.75, 0.28) };
}

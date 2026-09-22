import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const palette = {
  stone: 0x595b4b,
  stoneLight: 0x8f9076,
  iron: 0x263638,
  wood: 0x574835,
  copper: 0xae7540,
  gold: 0xd1ae68,
  soil: 0x5b5d3d,
};
const dummy = new T.Object3D(),
  color = new T.Color();
export class Builder {
  constructor() {
    this.parts = [];
  }
  add(
    g,
    c,
    x = 0,
    y = 0,
    z = 0,
    sx = 1,
    sy = 1,
    sz = 1,
    rx = 0,
    ry = 0,
    rz = 0,
    limb = 0,
    pivot = [0, 0, 0],
  ) {
    g = g.index ? g.toNonIndexed() : g.clone();
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    g.applyMatrix4(dummy.matrix);
    const n = g.attributes.position.count,
      colors = new Float32Array(n * 3),
      bones = new Float32Array(n),
      pivots = new Float32Array(n * 3);
    color.setHex(c);
    for (let i = 0; i < n; i++) {
      colors.set([color.r, color.g, color.b], i * 3);
      bones[i] = limb;
      pivots.set(pivot, i * 3);
    }
    g.setAttribute("color", new T.BufferAttribute(colors, 3));
    g.setAttribute("limb", new T.BufferAttribute(bones, 1));
    g.setAttribute("pivot", new T.BufferAttribute(pivots, 3));
    this.parts.push(g);
    return this;
  }
  box(c, x, y, z, sx, sy, sz, ry = 0) {
    return this.add(new T.BoxGeometry(1, 1, 1), c, x, y, z, sx, sy, sz, 0, ry);
  }
  cyl(c, x, y, z, rt, rb, h, n = 12) {
    return this.add(new T.CylinderGeometry(rt, rb, h, n), c, x, y, z);
  }
  sphere(c, x, y, z, sx, sy, sz, n = 1) {
    return this.add(new T.IcosahedronGeometry(1, n), c, x, y, z, sx, sy, sz);
  }
  beam(c, a, b, r = 0.07, n = 6) {
    const av = new T.Vector3(...a),
      bv = new T.Vector3(...b),
      mid = av.clone().add(bv).multiplyScalar(0.5),
      q = new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        bv.clone().sub(av).normalize(),
      );
    const g = new T.CylinderGeometry(r, r, av.distanceTo(bv), n);
    g.applyQuaternion(q);
    g.translate(mid.x, mid.y, mid.z);
    return this.add(g, c);
  }
  build() {
    const g = mergeGeometries(this.parts);
    this.parts.forEach((p) => p.dispose());
    return g;
  }
  mesh(mat) {
    return new T.Mesh(this.build(), mat);
  }
}
export const stoneMaterial = () => {
  const mat = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.1,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWeather;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvWeather=position;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWeather;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
 float grain=fract(sin(dot(floor(vWeather*38.),vec3(12.9898,78.233,37.719)))*43758.5453);
 float stain=sin(vWeather.x*3.1+sin(vWeather.y*1.7))*sin(vWeather.z*2.4);
 diffuseColor.rgb*=.9+grain*.2+stain*.075;`,
      );
  };
  return mat;
};

export function zombieGeometry(type = 0, retro = false) {
  const b = new Builder(),
    skin = (
      retro ? [0xd9e4ae, 0xb9e7d3, 0xa3c581] : [0xb4b397, 0xbdb79e, 0x959c79]
    )[type],
    shirt = (
      retro ? [0x794657, 0x334878, 0x68533b] : [0x6b5042, 0x566266, 0x4d5c48]
    )[type],
    pants = 0x313b37;
  // Proportions are adult silhouettes, with exposed hands and a hunched neck.
  b.add(
    new T.CylinderGeometry(0.16, 0.2, 0.37, 7),
    shirt,
    0,
    0.92,
    0.04,
    1,
    1,
    1,
    -0.2,
    0,
    0,
    0,
  );
  b.sphere(shirt, 0, 1.08, 0.095, 0.22, 0.17, 0.15, 1);
  b.sphere(skin, 0, 1.31, 0.12, 0.13, 0.17, 0.14, 1);
  b.box(0x252b25, 0, 1.39, 0.095, 0.18, 0.07, 0.14);
  b.box(0x3b382e, 0, 1.25, 0.245, 0.11, 0.04, 0.018);
  b.box(0xcaba75, -0.055, 1.34, 0.247, 0.027, 0.025, 0.014);
  b.box(0xcaba75, 0.055, 1.34, 0.247, 0.027, 0.025, 0.014);
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 1 : 2,
      hip = [side * 0.105, 0.76, 0];
    b.add(
      new T.CylinderGeometry(0.095, 0.075, 0.38, 6),
      pants,
      side * 0.105,
      0.58,
      0,
      1,
      1,
      1,
      0,
      0,
      side * 0.04,
      tag,
      hip,
    );
    b.add(
      new T.CylinderGeometry(0.072, 0.052, 0.34, 6),
      type === 1 ? skin : pants,
      side * 0.11,
      0.24,
      0.015,
      1,
      1,
      1,
      0.13,
      0,
      0,
      tag,
      hip,
    );
    b.add(
      new T.BoxGeometry(0.14, 0.1, 0.24),
      0x242a26,
      side * 0.11,
      0.07,
      0.08,
      1,
      1,
      1,
      0,
      0,
      0,
      tag,
      hip,
    );
    const arm = side < 0 ? 3 : 4,
      pivot = [side * 0.23, 1.1, 0.07];
    b.add(
      new T.CylinderGeometry(0.075, 0.055, 0.31, 6),
      shirt,
      side * 0.255,
      0.97,
      0.12,
      1,
      1,
      1,
      -0.4,
      0,
      -side * 0.14,
      arm,
      pivot,
    );
    b.add(
      new T.CylinderGeometry(0.057, 0.039, 0.28, 6),
      skin,
      side * 0.28,
      0.75,
      0.24,
      1,
      1,
      1,
      -0.7,
      0,
      0,
      arm,
      pivot,
    );
    b.add(
      new T.IcosahedronGeometry(0.071, 0),
      skin,
      side * 0.28,
      0.67,
      0.35,
      1,
      0.65,
      1,
      0,
      0,
      0,
      arm,
      pivot,
    );
  }
  if (type === 2) {
    b.sphere(0x747b56, 0, 0.99, -0.13, 0.25, 0.32, 0.18);
    b.box(0x60503e, 0, 0.9, 0.225, 0.25, 0.3, 0.035);
  }
  b.box(0x49332e, 0.07, 0.94, 0.208, 0.07, 0.17, 0.015);
  const geometry = b.build();
  if (retro) {
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const head = y > 1.15;
      pos.setXYZ(
        i,
        pos.getX(i) * (head ? 1.6 : 1.17),
        head ? 1.15 + (y - 1.15) * 1.3 : y,
        head ? 0.12 + (pos.getZ(i) - 0.12) * 1.5 : pos.getZ(i),
      );
    }
    geometry.computeVertexNormals();
  }
  return geometry;
}

export function groundTexture(seed = 17) {
  const size = 1024,
    c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  ctx.fillStyle = "#555b37";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 24000; i++) {
    const x = rnd() * size,
      y = rnd() * size,
      r = rnd() * 14 + 1;
    ctx.fillStyle = `rgba(${(70 + rnd() * 60) | 0},${(77 + rnd() * 45) | 0},${(42 + rnd() * 30) | 0},${rnd() * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.6, rnd() * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 1300; i++) {
    const x = rnd() * size,
      y = rnd() * size;
    ctx.strokeStyle = rnd() > 0.5 ? "#69704d44" : "#262f2444";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * 7, y - rnd() * 7);
    ctx.stroke();
  }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(3, 3);
  t.anisotropy = 4;
  return t;
}

export function environment(scene) {
  const ground = new T.Mesh(
    new T.PlaneGeometry(130, 130),
    new T.MeshStandardMaterial({
      map: groundTexture(),
      roughness: 1,
      color: 0xb8ba92,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const b = new Builder(),
    p = palette,
    obstacles = [];
  let seed = 45;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // Worn spokes, small exposed slabs and irregular rubble leave clear approach lanes.
  for (let i = 0; i < 700; i++) {
    const a = rnd() * 6.283,
      r = 5 + rnd() * 40,
      x = Math.sin(a) * r,
      z = Math.cos(a) * r;
    if (r < 9) continue;
    const v = rnd();
    if (v < 0.4)
      b.sphere(
        [0x6b7155, 0x70735b, 0x4d5446][i % 3],
        x,
        0.09,
        z,
        0.13 + rnd() * 0.28,
        0.1 + rnd() * 0.18,
        0.1 + rnd() * 0.27,
        0,
      );
    else if (v < 0.75) {
      for (let j = 0; j < 3; j++)
        b.add(
          new T.ConeGeometry(0.05, 0.3 + rnd() * 0.3, 3),
          0x616d3c,
          x + (rnd() - 0.5) * 0.3,
          0.16,
          z + (rnd() - 0.5) * 0.3,
        );
    } else if (r > 23) {
      const h = 1 + rnd() * 2.5;
      b.cyl(0x3f3e2c, x, h * 0.5, z, 0.09, 0.16, h, 5);
      for (let j = 0; j < 3; j++)
        b.beam(
          0x4b4933,
          [x, h * 0.5 + j * 0.3, z],
          [x + (rnd() - 0.5) * 1.6, h * 0.7 + j * 0.4, z + (rnd() - 0.5) * 1.6],
          0.045,
        );
    }
  }
  for (let i = 0; i < 75; i++) {
    const a = rnd() * 6.28,
      r = 28 + rnd() * 18,
      x = Math.sin(a) * r,
      z = Math.cos(a) * r;
    if (i % 3 === 0) {
      const r = 1 + rnd();
      b.sphere(0x555c51, x, 0.8, z, r, 1 + rnd(), r, 1);
      obstacles.push({ x, z, r: r * 0.8 });
      continue;
    }
    obstacles.push({ x, z, r: 0.28 });
    const h = 2.5 + rnd() * 3;
    b.cyl(0x3a3526, x, h * 0.4, z, 0.14, 0.2, h * 0.8, 6);
    for (let k = 0; k < 3; k++)
      b.add(
        new T.ConeGeometry(1.1 - k * 0.2, h * 0.65, 7),
        [0x283e31, 0x354b35, 0x415740][k],
        x,
        h * 0.45 + k * 0.6,
        z,
        1,
        1,
        1,
        0,
        rnd() * 6.2,
      );
  }
  // Ruined masonry on the edge of the clearing.
  for (const [x, z, ry] of [
    [-18, -19, 0.2],
    [21, 13, -0.4],
    [-24, 7, 0.8],
  ])
    for (let row = 0; row < 4; row++)
      for (let j = 0; j < 7 - row; j++)
        b.box(
          row % 2 ? 0x6d6b56 : 0x646653,
          x + j * 0.8,
          row * 0.39 + 0.2,
          z,
          0.76,
          0.36,
          0.48,
          ry,
        );
  for (const [x, z] of [
    [-18, -19],
    [21, 13],
    [-24, 7],
  ])
    for (let j = 0; j < 7; j++) obstacles.push({ x: x + j * 0.8, z, r: 0.4 });
  const scenery = b.mesh(stoneMaterial());
  scenery.castShadow = true;
  scenery.receiveShadow = true;
  scene.add(scenery);
  // Faded wheel ruts around the tower, not a neon range circle.
  const rut = new T.Mesh(
    new T.RingGeometry(7.8, 8.35, 96),
    new T.MeshBasicMaterial({
      color: 0x968565,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  );
  rut.rotation.x = -Math.PI / 2;
  rut.position.y = 0.014;
  scene.add(rut);
  return { ground, scenery, obstacles };
}

export function fortress(scene) {
  const b = new Builder(),
    lit = new Builder(),
    p = palette;
  b.cyl(0x393e36, 0, 0.18, 0, 5.8, 6.1, 0.36, 32);
  b.cyl(0x797763, 0, 0.4, 0, 5.35, 5.6, 0.4, 32);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2,
      x = Math.sin(a) * 5.5,
      z = Math.cos(a) * 5.5;
    b.box(p.stone, x, 1.03, z, 0.96, 1.25, 0.5, a);
    b.box(p.stoneLight, x, 1.72, z, 1, 0.18, 0.62, a);
    if (i % 2 === 0) b.box(p.stoneLight, x, 1.99, z, 0.38, 0.4, 0.56, a);
    if (i % 4 === 0) {
      b.cyl(p.iron, x, 2.08, z, 0.06, 0.09, 0.65, 6);
      lit.sphere(0xffb04c, x, 2.37, z, 0.11, 0.17, 0.11);
    }
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    b.box(p.wood, Math.sin(a) * 4.5, 0.75, Math.cos(a) * 4.5, 0.9, 0.3, 0.7, a);
  }
  b.cyl(p.stone, 0, 2.15, 0, 2.35, 2.7, 3.65, 12);
  for (let row = 0; row < 6; row++)
    for (let i = 0; i < 12; i++) {
      const a = ((i + (row % 2) * 0.5) / 12) * Math.PI * 2;
      b.box(
        row % 2 ? p.stoneLight : 0x777765,
        Math.sin(a) * 2.48,
        0.78 + row * 0.48,
        Math.cos(a) * 2.48,
        0.94,
        0.42,
        0.18,
        a,
      );
    }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.box(
      p.iron,
      Math.sin(a) * 2.44,
      2.8,
      Math.cos(a) * 2.44,
      0.32,
      0.64,
      0.1,
      a,
    );
    lit.box(
      0xffb74f,
      Math.sin(a) * 2.5,
      2.79,
      Math.cos(a) * 2.5,
      0.14,
      0.42,
      0.045,
      a,
    );
  }
  b.cyl(p.iron, 0, 4.12, 0, 2.75, 2.75, 0.28, 16);
  b.cyl(p.copper, 0, 4.31, 0, 2.8, 2.7, 0.14, 16);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2,
      x = Math.sin(a) * 2.65,
      z = Math.cos(a) * 2.65;
    b.beam(p.iron, [x, 4.4, z], [x, 5.15, z], 0.055);
    const a2 = ((i + 1) / 16) * Math.PI * 2;
    b.beam(
      p.gold,
      [x, 5.05, z],
      [Math.sin(a2) * 2.65, 5.05, Math.cos(a2) * 2.65],
      0.035,
    );
  }
  b.cyl(p.iron, 0, 5.1, 0, 0.72, 1.05, 1.5, 12);
  b.cyl(p.copper, 0, 5.82, 0, 0.88, 0.88, 0.17, 16);
  for (let i = 0; i < 5; i++)
    b.cyl(
      p.gold,
      0,
      6.05 + i * 0.22,
      0,
      0.66 - i * 0.045,
      0.66 - i * 0.045,
      0.075,
      16,
    );
  b.cyl(p.iron, 0, 6.65, 0, 0.09, 0.15, 0.9, 8);
  lit.sphere(0x76d9ef, 0, 7.1, 0, 0.25, 0.25, 0.25, 2);
  // Boiler, steam pipes, ladders and a sheltered doorway establish human scale.
  b.cyl(p.copper, 2.95, 1.6, 0.4, 0.5, 0.5, 2.2, 12);
  b.cyl(p.iron, 2.95, 2.8, 0.4, 0.27, 0.27, 0.3, 12);
  b.beam(p.copper, [2.9, 2.6, 0.4], [1.6, 3.4, 0.4], 0.12);
  b.box(0x252e29, 0, 1.3, 2.57, 0.85, 1.6, 0.12);
  lit.box(0xffab4e, 0, 1.65, 2.65, 0.56, 0.54, 0.025);
  for (let i = 0; i < 8; i++)
    b.box(p.wood, -1.9, 0.8 + i * 0.42, 2.35, 0.6, 0.08, 0.09);
  b.beam(p.iron, [-2.24, 0.5, 2.35], [-2.24, 4, 2.35], 0.04);
  b.beam(p.iron, [-1.56, 0.5, 2.35], [-1.56, 4, 2.35], 0.04);
  // Iron ribs, exposed copper busbars, ammunition crates and red signal pennants.
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      x = Math.sin(a) * 2.62,
      z = Math.cos(a) * 2.62;
    b.beam(0x2b3937, [x, 0.6, z], [x, 4, z], 0.105, 6);
    for (let j = 0; j < 4; j++)
      b.sphere(0xc49e61, x, 1 + j * 0.72, z, 0.14, 0.065, 0.14, 0);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.4,
      x = Math.sin(a) * 4.8,
      z = Math.cos(a) * 4.8;
    b.beam(p.copper, [x, 1.9, z], [x, 4.3, z], 0.045);
    b.box(0x803c30, x + 0.3, 3.85, z, 0.55, 0.65, 0.045, a);
    b.box(0xceab70, x + 0.3, 3.68, z + 0.03, 0.4, 0.05, 0.03, a);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + 0.2,
      x = Math.sin(a) * 3.15,
      z = Math.cos(a) * 3.15;
    b.box(0x675333, x, 0.92, z, 0.55, 0.6, 0.7, a);
    b.box(0xa78b52, x, 1.25, z, 0.6, 0.06, 0.75, a);
    b.beam(
      0x28372f,
      [x - 0.25, 0.75, z - 0.2],
      [x + 0.25, 1.2, z + 0.2],
      0.035,
    );
  }
  const base = b.mesh(stoneMaterial());
  base.castShadow = base.receiveShadow = true;
  scene.add(base);
  const lights = lit.mesh(
    new T.MeshStandardMaterial({
      vertexColors: true,
      emissive: 0xffc578,
      emissiveIntensity: 1.2,
      roughness: 0.5,
    }),
  );
  scene.add(lights);
  const coil = new Builder();
  for (let i = 0; i < 5; i++)
    coil.cyl(
      0x80e8f0,
      0,
      6.07 + i * 0.22,
      0,
      0.64 - i * 0.045,
      0.64 - i * 0.045,
      0.025,
      20,
    );
  const coilMesh = coil.mesh(new T.MeshBasicMaterial({ color: 0x86e5f8 }));
  scene.add(coilMesh);
  const turrets = [];
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4,
      x = Math.sin(a) * 3.9,
      z = Math.cos(a) * 3.9,
      pl = new Builder();
    pl.cyl(p.stone, x, 1.15, z, 0.83, 1.1, 1.55, 12);
    pl.cyl(p.iron, x, 2.02, z, 0.97, 0.97, 0.15, 16);
    const pm = pl.mesh(stoneMaterial());
    pm.castShadow = pm.receiveShadow = true;
    scene.add(pm);
    const gun = new Builder();
    gun.cyl(p.copper, 0, 0.1, 0, 0.57, 0.65, 0.3, 12);
    if (i < 2) {
      gun.box(p.iron, 0, 0.45, 0.12, 0.65, 0.5, 0.85);
      for (const side of [-1, 1])
        gun.beam(
          p.iron,
          [side * 0.17, 0.48, 0.4],
          [side * 0.17, 0.48, 1.45],
          0.09,
          8,
        );
      gun.box(p.copper, 0, 0.53, 0.35, 0.52, 0.16, 0.7);
    } else {
      gun.cyl(p.iron, 0, 0.4, 0, 0.46, 0.55, 0.58, 12);
      gun.beam(p.copper, [0, 0.5, 0], [0, 1.05, 1.05], 0.27, 12);
      gun.beam(p.iron, [0, 0.65, 0.28], [0, 1.17, 1.26], 0.2, 12);
    }
    const g = gun.mesh(stoneMaterial());
    g.position.set(x, 2.14, z);
    g.castShadow = true;
    scene.add(g);
    turrets.push(g);
  }
  const ballistas = [];
  for (const side of [-1, 1]) {
    const a = (side * Math.PI) / 2,
      g = new Builder();
    g.cyl(p.copper, 0, 0.05, 0, 0.5, 0.58, 0.22, 10);
    g.box(p.wood, 0, 0.38, 0.4, 0.19, 0.18, 1.75);
    g.box(p.iron, 0, 0.48, 0.55, 0.055, 0.06, 1.95);
    g.beam(p.wood, [-0.85, 0.4, 0.25], [0, 0.4, 0.6], 0.085);
    g.beam(p.wood, [0.85, 0.4, 0.25], [0, 0.4, 0.6], 0.085);
    g.beam(0xd6c9a0, [-0.85, 0.4, 0.25], [0, 0.4, -0.1], 0.014, 3);
    g.beam(0xd6c9a0, [0.85, 0.4, 0.25], [0, 0.4, -0.1], 0.014, 3);
    const mesh = g.mesh(stoneMaterial());
    mesh.position.set(Math.sin(a) * 4.7, 2.05, Math.cos(a) * 4.7);
    mesh.castShadow = true;
    scene.add(mesh);
    ballistas.push(mesh);
  }
  return { base, lights, turrets, ballistas };
}

// Small, deliberately painted texel clusters; one reusable GPU texture.
export function retroGroundTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#286243";
  ctx.fillRect(0, 0, 128, 128);
  let seed = 173;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const colors = ["#2b6546", "#265e40", "#2d6847", "#296345", "#2f6847"];
  for (let i = 0; i < 380; i++) {
    ctx.fillStyle = colors[(random() * colors.length) | 0];
    ctx.fillRect(
      (random() * 128) | 0,
      (random() * 128) | 0,
      3 + ((random() * 9) | 0),
      1 + ((random() * 3) | 0),
    );
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.magFilter = texture.minFilter = T.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(5, 5);
  return texture;
}

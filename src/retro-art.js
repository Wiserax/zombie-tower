import * as T from "three";
import { Builder, stoneMaterial } from "./art.js";

// A single world-aligned color map, rather than a repeating noise swatch.
// All marks are deterministic and stay still as the camera moves.
export function battlefieldTexture() {
  const size = 512,
    canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d"),
    image = ctx.createImageData(size, size);
  const palette = [
    "#25563f",
    "#2a6044",
    "#306949",
    "#35704d",
    "#3b7650",
    "#416d4a",
    "#526e4b",
    "#646e4c",
    "#777451",
    "#827957",
    "#8a7f5c",
  ];
  const colors = palette.map((c) => [
    parseInt(c.slice(1, 3), 16),
    parseInt(c.slice(3, 5), 16),
    parseInt(c.slice(5, 7), 16),
  ]);
  const hash = (x, y) => {
    let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ 173;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const ix = Math.floor(x),
      iy = Math.floor(y),
      tx = smooth(x - ix),
      ty = smooth(y - iy);
    return (
      (hash(ix, iy) * (1 - tx) + hash(ix + 1, iy) * tx) * (1 - ty) +
      (hash(ix, iy + 1) * (1 - tx) + hash(ix + 1, iy + 1) * tx) * ty
    );
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const wx = (x / size - 0.5) * 130,
        wz = (y / size - 0.5) * 130,
        r = Math.hypot(wx, wz);
      const n = noise(wx * 0.16, wz * 0.16),
        fine = hash(x >> 1, y >> 1);
      const angle = Math.atan2(wx, wz) + Math.sin(r * 0.13) * 0.11;
      const lane = (Math.abs(Math.sin(angle * 3)) * r) / 3;
      const path =
        Math.max(0, 1 - lane / (1.15 + n * 1.5)) *
        Math.max(0, 1 - Math.max(0, r - 24) / 14);
      const clearing = Math.max(
        0,
        Math.min(1, (10.2 - r + (n - 0.5) * 2.4) / 3),
      );
      const wear = Math.max(path * 0.85, clearing);
      let index = Math.min(4, Math.floor(n * 4.5 + fine * 0.65));
      if (wear > 0.16 + fine * 0.28)
        index = Math.min(10, 5 + Math.floor(wear * 3.8 + n * 1.4));
      const c = colors[index],
        i = (y * size + x) * 4;
      image.data.set([...c, 255], i);
    }
  ctx.putImageData(image, 0, 0);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.magFilter = texture.minFilter = T.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

export function retroLandmarks(scene) {
  const group = new T.Group();
  group.name = "Retro battlefield dressing";
  const b = new Builder();
  // Mossy stone slabs give the bastion a grounded, worn apron.
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2,
      r = 6.25 + (i % 3) * 0.21;
    b.box(
      i % 3 === 0 ? 0x768b76 : 0x697971,
      Math.sin(a) * r,
      0.035,
      Math.cos(a) * r,
      0.58,
      0.06,
      0.8,
      a,
    );
  }
  // Low plant clusters are deliberately confined between approach streams.
  let seed = 487;
  const rand = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 100; i++) {
    const a = (((i % 6) + 0.5) / 6) * Math.PI * 2 + (rand() - 0.5) * 0.32,
      r = 13 + rand() * 24;
    const x = Math.sin(a) * r,
      z = Math.cos(a) * r;
    for (let j = 0; j < 4; j++) {
      const angle = (j / 4) * Math.PI * 2 + rand();
      const length = 0.35 + rand() * 0.45;
      b.beam(
        j % 2 ? 0x315c4b : 0x507754,
        [x, 0.03, z],
        [
          x + Math.sin(angle) * length,
          0.35 + rand() * 0.2,
          z + Math.cos(angle) * length,
        ],
        0.06,
        3,
      );
    }
    if (i % 5 === 0) {
      b.cyl(0xb4b19a, x + 0.2, 0.14, z, 0.035, 0.055, 0.28, 5);
      b.sphere(0x9b694c, x + 0.2, 0.28, z, 0.22, 0.09, 0.18, 0);
    }
  }
  // Broken fence remnants sit outside the fort, low enough not to conceal units.
  for (const [x, z, a] of [
    [-15, 9, 0.4],
    [15, -11, 0.1],
    [-10, -22, 0.8],
  ]) {
    for (let j = 0; j < 4; j++) {
      const px = x + Math.cos(a) * j * 0.75,
        pz = z - Math.sin(a) * j * 0.75;
      b.box(0x554936, px, 0.32, pz, 0.16, 0.65, 0.16, a);
      if (j < 3)
        b.beam(
          0x71603f,
          [px, 0.35, pz],
          [px + Math.cos(a) * 0.75, 0.26, pz - Math.sin(a) * 0.75],
          0.055,
          4,
        );
    }
  }
  const mesh = b.mesh(stoneMaterial());
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  scene.add(group);
  return group;
}

export function retroFortress(scene) {
  const group = new T.Group();
  group.name = "Retro bastion silhouette";
  const b = new Builder();
  const copper = 0xc28648,
    dark = 0x253647,
    brass = 0xe1b76a;
  // Heavy copper shoulders and black seams replace sub-pixel trim with readable masses.
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      x = Math.sin(a) * 2.75,
      z = Math.cos(a) * 2.75;
    b.box(dark, x, 3.43, z, 0.54, 1.15, 0.36, a);
    b.box(copper, x, 3.52, z, 0.36, 0.98, 0.42, a);
    b.box(brass, x, 4.0, z, 0.44, 0.16, 0.46, a);
  }
  // Four upturned conductor horns create an unmistakable Tesla crown.
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const p = (r, y) => [Math.sin(a) * r, y, Math.cos(a) * r];
    b.beam(dark, p(1.1, 4.45), p(1.6, 5.4), 0.16, 6);
    b.beam(copper, p(1.6, 5.4), p(1.42, 6.9), 0.13, 6);
    b.beam(brass, p(1.42, 6.9), p(0.98, 7.45), 0.105, 6);
    for (let j = 0; j < 3; j++) {
      const [x, y, z] = p(1.52 - j * 0.025, 5.65 + j * 0.29);
      b.cyl(0x334659, x, y, z, 0.24, 0.24, 0.13, 8);
    }
  }
  // Bold red pennants echo a defended outpost instead of an anonymous cylinder.
  for (const [x, z] of [
    [-4.5, 1.5],
    [3.8, -3.3],
  ]) {
    b.beam(brass, [x, 1.8, z], [x, 4.8, z], 0.055, 6);
    b.sphere(brass, x, 4.85, z, 0.1, 0.1, 0.1, 0);
  }
  const metal = b.mesh(stoneMaterial());
  metal.castShadow = metal.receiveShadow = true;
  group.add(metal);
  const core = new T.Mesh(
    new T.IcosahedronGeometry(0.39, 0),
    new T.MeshBasicMaterial({ color: 0xc1ffff }),
  );
  core.position.y = 7.12;
  group.add(core);
  const halo = new T.Mesh(
    new T.TorusGeometry(0.72, 0.045, 4, 12),
    new T.MeshBasicMaterial({ color: 0x5dd9e6 }),
  );
  halo.position.y = 7.12;
  halo.rotation.x = Math.PI / 2;
  group.add(halo);
  // Banner vertices are animated in a shared shader, never by CPU per-vertex work.
  const flags = new T.Group();
  const time = { value: 0 };
  const bannerCanvas = document.createElement("canvas");
  bannerCanvas.width = 32;
  bannerCanvas.height = 32;
  const context = bannerCanvas.getContext("2d");
  context.fillStyle = "#b94745";
  context.fillRect(0, 0, 32, 32);
  context.fillStyle = "#e7b56b";
  context.fillRect(0, 0, 32, 3);
  context.fillRect(0, 29, 32, 3);
  context.beginPath();
  context.moveTo(19, 6);
  context.lineTo(9, 18);
  context.lineTo(15, 18);
  context.lineTo(12, 26);
  context.lineTo(24, 13);
  context.lineTo(17, 13);
  context.closePath();
  context.fill();
  const bannerTexture = new T.CanvasTexture(bannerCanvas);
  bannerTexture.colorSpace = T.SRGBColorSpace;
  bannerTexture.magFilter = T.NearestFilter;
  const flagMaterial = new T.MeshStandardMaterial({
    map: bannerTexture,
    roughness: 1,
    side: T.DoubleSide,
  });
  flagMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\nfloat freeEdge=clamp(position.x+.55,0.,1.); transformed.z+=sin(position.x*6.-uTime*3.8+position.y)*.12*freeEdge;`,
      );
  };
  for (const [x, z] of [
    [-4.5, 1.5],
    [3.8, -3.3],
  ]) {
    const flag = new T.Mesh(new T.PlaneGeometry(1.1, 0.85, 5, 2), flagMaterial);
    flag.position.set(x + 0.54, 4.26, z);
    flags.add(flag);
  }
  group.add(flags);
  scene.add(group);
  return { group, core, halo, time };
}

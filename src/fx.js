import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Cloud } from "./cloud.js";
const N = 2400,
  dummy = new T.Object3D(),
  col = new T.Color();
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.cursor = 0;
    this.p = Array.from({ length: N }, () => ({ life: 0 }));
    this.smoke = new Cloud(scene, false, 350);
    this.glow = new Cloud(scene, true, 240);
    this.scale = 20;
    this.mesh = new T.InstancedMesh(
      new T.IcosahedronGeometry(1, 0),
      new T.MeshBasicMaterial({ vertexColors: false }),
      N,
    );
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.lines = [];
    this.rings = [];
    this.corpses = [];
    this.lineGeo = new T.BufferGeometry();
    this.linePos = new Float32Array(16000 * 3);
    this.lineCol = new Float32Array(16000 * 3);
    this.lineGeo.setAttribute(
      "position",
      new T.BufferAttribute(this.linePos, 3).setUsage(T.DynamicDrawUsage),
    );
    this.lineGeo.setAttribute(
      "color",
      new T.BufferAttribute(this.lineCol, 3).setUsage(T.DynamicDrawUsage),
    );
    this.lineGeo.setDrawRange(0, 0);
    this.lineMesh = new T.Mesh(
      this.lineGeo,
      new T.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: T.AdditiveBlending,
        depthWrite: false,
        side: T.DoubleSide,
      }),
    );
    this.lineMesh.frustumCulled = false;
    scene.add(this.lineMesh);
    this.ringMesh = new T.InstancedMesh(
      new T.RingGeometry(0.965, 1, 64),
      new T.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
        side: T.DoubleSide,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
      64,
    );
    this.ringMesh.frustumCulled = false;
    scene.add(this.ringMesh);
    this.ringMesh.count = 0;
    this.scorch = new T.InstancedMesh(
      new T.CircleGeometry(1, 16),
      new T.MeshBasicMaterial({
        color: 0x1a2119,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
      160,
    );
    const scorchAlpha = new T.InstancedBufferAttribute(
      new Float32Array(160).fill(1),
      1,
    );
    this.scorch.geometry.setAttribute("aOpacity", scorchAlpha);
    this.scorch.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute float aOpacity;varying float vOpacity;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvOpacity=aOpacity;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying float vOpacity;",
        )
        .replace(
          "#include <color_fragment>",
          "#include <color_fragment>\ndiffuseColor.a*=vOpacity;",
        );
    };
    this.scorch.frustumCulled = false;
    this.scorch.count = 0;
    scene.add(this.scorch);
    this.scorches = [];
    this.mesh.setColorAt(0, new T.Color(1, 1, 1));
    this.ringMesh.setColorAt(0, new T.Color(1, 1, 1));
    const arcs = [];
    for (let i = 0; i < 4; i++)
      arcs.push(
        new T.RingGeometry(1.45, 1.55, 10, 1, (i * Math.PI) / 2 + 0.25, 1.05),
      );
    const reticle = mergeGeometries(arcs);
    arcs.forEach((g) => g.dispose());
    this.focusMarker = new T.Mesh(
      reticle,
      new T.MeshBasicMaterial({
        color: 0xffdf86,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        toneMapped: false,
        fog: false,
        side: T.DoubleSide,
      }),
    );
    this.focusMarker.rotation.x = -Math.PI / 2;
    this.focusMarker.visible = false;
    scene.add(this.focusMarker);
  }
  focus(point, time) {
    this.focusMarker.visible = !!point && time > 0;
    if (!this.focusMarker.visible) return;
    this.focusMarker.position.set(point.x, 0.07, point.z);
    this.focusMarker.rotation.z = time * 0.4;
    this.focusMarker.material.opacity = Math.min(1, time * 2) * 0.7;
    this.focusMarker.scale.setScalar(1 + Math.sin(time * 5) * 0.055);
  }
  particle(x, y, z, vx, vy, vz, size, color, life = 0.6, gravity = 9) {
    const p = this.p[this.cursor++ % N];
    Object.assign(p, {
      x,
      y,
      z,
      vx,
      vy,
      vz,
      size,
      color,
      life,
      max: life,
      gravity,
    });
  }
  burst(x, y, z, count, color, force = 5) {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * 6.28,
        s = Math.random() * force;
      this.particle(
        x,
        y,
        z,
        Math.sin(a) * s,
        Math.random() * force * 0.8,
        Math.cos(a) * s,
        0.04 + Math.random() * 0.12,
        color,
        0.3 + Math.random() * 0.65,
      );
    }
  }
  line(a, b, color = 0xffd077, life = 0.1, width = 0.025) {
    if (this.lines.length < 900)
      this.lines.push({ a: [...a], b: [...b], color, life, max: life, width });
  }
  lightning(a, b, seed = 0) {
    this.glow.emit(...b, 1.6, 0x49d5ff, 0.28, 0, 0, 0, 0.9);
    this.glow.emit(...a, 2, 0x5ce7ff, 0.22, 0, 0, 0, 0.5);
    let last = a;
    const n = 8;
    for (let k = 1; k <= n; k++) {
      const f = k / n,
        j = k === n ? 0 : 0.45;
      const p = [
        a[0] + (b[0] - a[0]) * f + (Math.random() - 0.5) * j,
        a[1] + (b[1] - a[1]) * f + (Math.random() - 0.5) * j,
        a[2] + (b[2] - a[2]) * f + (Math.random() - 0.5) * j,
      ];
      this.line(last, p, 0x88eaff, 0.2, 0.085);
      this.line([last[0] + 0.025, last[1], last[2]], p, 0xffffff, 0.12, 0.025);
      last = p;
    }
    this.burst(...b, 7, 0x82dcff, 3);
  }
  ring(x, z, r, color = 0xffad42, life = 0.5) {
    if (this.rings.length < 64)
      this.rings.push({ x, z, r, color, life, max: life });
  }
  explosion(x, z, r = 3) {
    this.glow.emit(x, 0.7, z, r * 2, 0xff7f20, 0.28, 0, 0, 0, 1.2, 0.6);
    this.glow.emit(x, 1, z, r, 0xffeac0, 0.2, 0, 0, 0, 1.5, 0.5);
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * 6.28,
        d = Math.random() * r * 0.5;
      this.smoke.emit(
        x + Math.sin(a) * d,
        0.3 + Math.random() * 0.8,
        z + Math.cos(a) * d,
        1.4,
        0x5f5b4b,
        1.5 + Math.random(),
        Math.sin(a) * 1.3,
        1,
        Math.cos(a) * 1.3,
        0.6,
        1.7,
      );
    }
    this.burst(x, 0.4, z, 44, 0xffb442, 9);
    this.burst(x, 0.6, z, 18, 0xffebaf, 11);
    this.burst(x, 0.5, z, 22, 0x4a493d, 6);
    this.ring(x, z, r, 0xfac06b, 0.42);
    this.scorches.push({ x, z, r: r * 0.8, life: 15 });
    if (this.scorches.length > 160) this.scorches.shift();
  }
  update(dt) {
    this.smoke.update(dt, this.scale);
    this.glow.update(dt, this.scale);
    let count = 0;
    for (const p of this.p) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.05) {
        p.y = 0.05;
        p.vy *= -0.2;
        p.vx *= 0.8;
        p.vz *= 0.8;
      }
      const s = p.size * Math.min(1, p.life / 0.18);
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(s);
      dummy.rotation.set(p.life * 3, p.life * 5, 0);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(count, dummy.matrix);
      this.mesh.setColorAt(count, col.setHex(p.color));
      count++;
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    let v = 0;
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const l = this.lines[i];
      l.life -= dt;
      if (l.life <= 0) {
        this.lines.splice(i, 1);
        continue;
      }
      col.setHex(l.color).multiplyScalar(Math.min(1, (l.life / l.max) * 2));
      const dx = l.b[0] - l.a[0],
        dy = l.b[1] - l.a[1],
        dz = l.b[2] - l.a[2];
      let nx = dy * 0.58 - dz * 0.7,
        ny = dz * 0.48 - dx * 0.58,
        nz = dx * 0.7 - dy * 0.48;
      const inv = l.width / (Math.hypot(nx, ny, nz) || 1);
      nx *= inv;
      ny *= inv;
      nz *= inv;
      for (const [p, sign] of [
        [l.a, 1],
        [l.a, -1],
        [l.b, 1],
        [l.b, 1],
        [l.a, -1],
        [l.b, -1],
      ]) {
        this.linePos.set(
          [p[0] + nx * sign, p[1] + ny * sign, p[2] + nz * sign],
          v * 3,
        );
        this.lineCol.set([col.r, col.g, col.b], v * 3);
        v++;
      }
    }
    this.lineGeo.setDrawRange(0, v);
    this.lineGeo.attributes.position.needsUpdate = true;
    this.lineGeo.attributes.color.needsUpdate = true;
    count = 0;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.rings.splice(i, 1);
        continue;
      }
      const f = 1 - r.life / r.max,
        s = r.r * (0.3 + f * 0.7);
      dummy.position.set(r.x, 0.08, r.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(s, s, 1);
      dummy.updateMatrix();
      this.ringMesh.setMatrixAt(count, dummy.matrix);
      this.ringMesh.setColorAt(
        count,
        col.setHex(r.color).multiplyScalar((1 - f) * 1.5),
      );
      count++;
    }
    this.ringMesh.count = count;
    this.ringMesh.instanceMatrix.needsUpdate = true;
    if (this.ringMesh.instanceColor)
      this.ringMesh.instanceColor.needsUpdate = true;
    count = 0;
    for (let i = this.scorches.length - 1; i >= 0; i--) {
      const s = this.scorches[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.scorches.splice(i, 1);
        continue;
      }
      dummy.position.set(s.x, 0.019, s.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(s.r, s.r, 1);
      dummy.updateMatrix();
      this.scorch.setMatrixAt(count, dummy.matrix);
      this.scorch.geometry.attributes.aOpacity.array[count++] = Math.min(
        1,
        s.life / 3,
      );
    }
    this.scorch.count = count;
    this.scorch.instanceMatrix.needsUpdate = true;
    this.scorch.geometry.attributes.aOpacity.needsUpdate = true;
  }
}

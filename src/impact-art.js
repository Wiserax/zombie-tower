import * as T from "three";
const transform = new T.Object3D(),
  color = new T.Color(),
  up = new T.Vector3(0, 1, 0),
  direction = new T.Vector3();

// Small bounded pools: visible shapes supply the impact, soft light only supports them.
export class ImpactArt {
  constructor(scene) {
    this.enabled = true;
    this.blasts = [];
    this.muzzles = [];
    this.flames = new T.InstancedMesh(
      new T.IcosahedronGeometry(1, 0),
      new T.MeshBasicMaterial({
        color: 0xffffff,
        toneMapped: false,
        fog: false,
        transparent: true,
        depthWrite: false,
      }),
      96,
    );
    this.flames.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.flames.frustumCulled = false;
    this.flames.count = 0;
    this.flames.renderOrder = 4;
    scene.add(this.flames);
    const cone = new T.ConeGeometry(1, 1, 5);
    cone.translate(0, 0.5, 0);
    this.muzzleMesh = new T.InstancedMesh(
      cone,
      new T.MeshBasicMaterial({
        color: 0xffffff,
        toneMapped: false,
        fog: false,
        transparent: true,
        depthWrite: false,
      }),
      48,
    );
    this.muzzleMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.muzzleMesh.frustumCulled = false;
    this.muzzleMesh.count = 0;
    this.muzzleMesh.renderOrder = 4;
    scene.add(this.muzzleMesh);
    const vertices = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2,
        b = ((i + 1) / 24) * Math.PI * 2;
      const lengths = [
        1, 0.74, 0.95, 0.66, 0.9, 1, 0.8, 0.7, 1, 0.84, 0.6, 0.9,
      ];
      const r = i % 2 ? 0.43 : lengths[i / 2],
        s = (i + 1) % 2 ? 0.43 : lengths[((i + 1) / 2) % 12];
      vertices.push(
        0,
        0,
        0,
        Math.cos(a) * r,
        Math.sin(a) * r,
        0,
        Math.cos(b) * s,
        Math.sin(b) * s,
        0,
      );
    }
    const star = new T.BufferGeometry();
    star.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
    this.burstMesh = new T.InstancedMesh(
      star,
      new T.MeshBasicMaterial({
        color: 0xffffff,
        toneMapped: false,
        fog: false,
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
      }),
      32,
    );
    this.burstMesh.frustumCulled = false;
    this.burstMesh.count = 0;
    scene.add(this.burstMesh);
    for (const mesh of [this.flames, this.burstMesh, this.muzzleMesh])
      mesh.setColorAt(0, new T.Color(1, 1, 1));
  }
  explosion(x, z, r) {
    if (!this.enabled) return;
    if (this.blasts.length >= 32) this.blasts.shift();
    this.blasts.push({ x, z, r, age: 0, spin: Math.random() * Math.PI });
  }
  muzzle(x, y, z, angle, large = false) {
    if (!this.enabled) return;
    if (this.muzzles.length >= 24) this.muzzles.shift();
    this.muzzles.push({ x, y, z, angle, age: 0, large });
  }
  setEnabled(enabled) {
    this.enabled = enabled;
    this.flames.visible =
      this.muzzleMesh.visible =
      this.burstMesh.visible =
        enabled;
    if (!enabled) {
      this.blasts.length = 0;
      this.muzzles.length = 0;
    }
  }
  update(dt) {
    let n = 0,
      stars = 0;
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];
      b.age += dt;
      if (b.age > 0.36) {
        this.blasts.splice(i, 1);
        continue;
      }
      const f = b.age / 0.36,
        grow = 1 - Math.pow(1 - f, 3),
        fade = Math.max(0, 1 - f);
      for (let j = 0; j < 3; j++) {
        const a = b.spin + (j * Math.PI * 2) / 3,
          spread = b.r * 0.19 * grow;
        transform.position.set(
          b.x + Math.cos(a) * spread,
          0.3 + (j === 0 ? 0.45 : 0.25) * grow,
          b.z + Math.sin(a) * spread,
        );
        transform.rotation.set(b.spin, j * 0.7, b.spin * 0.3);
        const s =
          b.r *
          (0.13 + 0.24 * grow) *
          Math.pow(fade, 0.65) *
          (j === 0 ? 1 : 0.78);
        transform.scale.set(s, s * (j === 0 ? 1.4 : 1), s);
        transform.updateMatrix();
        this.flames.setMatrixAt(n, transform.matrix);
        color.setHex(
          f < 0.18
            ? 0xffffd5
            : f < 0.45
              ? 0xffdb65
              : f < 0.72
                ? 0xfaa441
                : 0xdb6938,
        );
        this.flames.setColorAt(n++, color);
      }
      if (f < 0.35) {
        transform.position.set(b.x, 0.09, b.z);
        transform.rotation.set(-Math.PI / 2, 0, b.spin);
        transform.scale.setScalar(b.r * (0.4 + grow * 0.65));
        transform.updateMatrix();
        this.burstMesh.setMatrixAt(stars, transform.matrix);
        this.burstMesh.setColorAt(
          stars++,
          color.setHex(f < 0.12 ? 0xffffe1 : 0xffcc62),
        );
      }
    }
    this.flames.count = n;
    this.burstMesh.count = stars;
    n = 0;
    for (let i = this.muzzles.length - 1; i >= 0; i--) {
      const m = this.muzzles[i];
      m.age += dt;
      const duration = m.large ? 0.13 : 0.075;
      if (m.age > duration) {
        this.muzzles.splice(i, 1);
        continue;
      }
      const f = m.age / duration;
      direction
        .set(Math.sin(m.angle), m.large ? 0.55 : 0, Math.cos(m.angle))
        .normalize();
      transform.quaternion.setFromUnitVectors(up, direction);
      transform.position.set(m.x, m.y, m.z);
      const size = (m.large ? 0.45 : 0.22) * (1 - f * 0.65),
        length = (m.large ? 1.5 : 0.85) * (1 - f * 0.5);
      for (let j = 0; j < 2; j++) {
        transform.scale.set(
          size * (j ? 0.55 : 1),
          length * (j ? 0.72 : 1),
          size * (j ? 0.55 : 1),
        );
        transform.updateMatrix();
        this.muzzleMesh.setMatrixAt(n, transform.matrix);
        this.muzzleMesh.setColorAt(n++, color.setHex(j ? 0xffffde : 0xffb844));
      }
    }
    this.muzzleMesh.count = n;
    for (const mesh of [this.flames, this.burstMesh, this.muzzleMesh]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
}

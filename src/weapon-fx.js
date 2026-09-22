import * as T from "three";
import { Builder } from "./art.js";
const d = new T.Object3D(),
  up = new T.Vector3(0, 1, 0),
  dir = new T.Vector3();
export class WeaponFX {
  constructor(scene, fx) {
    this.fx = fx;
    this.combat = null;
    this.time = 0;
    this.charge = 0;
    this.surge = 0;
    this.surgeClock = 0;
    this.shellClock = 0;
    const bolt = new Builder();
    bolt.cyl(0xc69c58, 0, -0.17, 0, 0.045, 0.045, 1.1, 5);
    bolt.add(new T.ConeGeometry(0.17, 0.4, 4), 0xf2e6bd, 0, 0.53, 0);
    bolt.box(0xe1d7ad, 0, -0.54, 0, 0.36, 0.22, 0.025);
    bolt.box(0xb29c77, 0, -0.54, 0, 0.025, 0.22, 0.36);
    this.bolts = new T.InstancedMesh(
      bolt.build(),
      new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
      192,
    );
    this.shells = new T.InstancedMesh(
      new T.IcosahedronGeometry(0.24, 1),
      new T.MeshStandardMaterial({
        color: 0x403229,
        emissive: 0xff801f,
        emissiveIntensity: 0.4,
        roughness: 0.6,
        metalness: 0.55,
      }),
      16,
    );
    for (const m of [this.bolts, this.shells]) {
      m.count = 0;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(T.DynamicDrawUsage);
      scene.add(m);
    }
    this.lanterns = new T.InstancedMesh(
      new T.ConeGeometry(1, 1, 5),
      new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      14,
    );
    this.lanterns.frustumCulled = false;
    this.lanterns.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.lanterns.setColorAt(0, new T.Color(1, 1, 1));
    this.lanternColor = new T.Color();
    scene.add(this.lanterns);
    const geo = new T.TorusGeometry(1, 0.022, 3, 32);
    this.chargeRings = [];
    for (let i = 0; i < 3; i++) {
      const m = new T.Mesh(
        geo,
        new T.MeshBasicMaterial({
          color: i === 0 ? 0xe6ffff : 0x55daff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: T.AdditiveBlending,
          toneMapped: false,
          fog: false,
        }),
      );
      m.position.y = 6.4 + i * 0.4;
      m.rotation.x = Math.PI / 2;
      m.visible = false;
      scene.add(m);
      this.chargeRings.push(m);
    }
    // A translucent dome rim after overcharge supplies volume without a full-screen flash.
    this.dome = new T.Mesh(
      new T.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new T.ShaderMaterial({
        uniforms: { uFade: { value: 0 } },
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
        blending: T.AdditiveBlending,
        toneMapped: false,
        vertexShader: `varying vec3 vNormal;varying vec3 vView;varying vec3 vPosition;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-p.xyz);vPosition=position;gl_Position=projectionMatrix*p;}`,
        fragmentShader: `uniform float uFade;varying vec3 vNormal;varying vec3 vView;varying vec3 vPosition;void main(){float fresnel=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),3.);float band=pow(max(0.,1.-abs(vPosition.y-.08)*18.),2.);gl_FragColor=vec4(.24,.72,1.,(fresnel*.12+band*.32)*uFade);}`,
      }),
    );
    this.dome.visible = false;
    scene.add(this.dome);
  }
  discharge() {
    this.surge = 1;
    this.surgeClock = 0;
  }
  update(dt) {
    this.time += dt;
    const c = this.combat;
    if (!c) return;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2,
        flicker =
          Math.sin(this.time * 13 + i * 3) * 0.14 +
          Math.sin(this.time * 21 + i) * 0.07;
      for (let layer = 0; layer < 2; layer++) {
        d.position.set(
          Math.sin(a) * 5.5,
          2.48 + layer * 0.015,
          Math.cos(a) * 5.5,
        );
        d.rotation.set(
          Math.sin(this.time * 5 + i) * 0.1,
          a,
          Math.cos(this.time * 7 + i) * 0.14,
        );
        d.scale.set(
          0.14 * (layer ? 0.55 : 1),
          (0.37 + flicker) * (layer ? 0.65 : 1),
          0.14 * (layer ? 0.55 : 1),
        );
        d.updateMatrix();
        this.lanterns.setMatrixAt(i * 2 + layer, d.matrix);
        this.lanterns.setColorAt(
          i * 2 + layer,
          this.lanternColor.setHex(layer ? 0xfff3b0 : 0xff9d3a),
        );
      }
    }
    this.lanterns.instanceMatrix.needsUpdate = true;
    this.lanterns.instanceColor.needsUpdate = true;
    let n = 0;
    for (const b of c.bolts) {
      if (n >= 192) break;
      d.position.set(b.x, b.y, b.z);
      dir.set(b.dx, -0.06, b.dz).normalize();
      d.quaternion.setFromUnitVectors(up, dir);
      d.scale.setScalar(1);
      d.updateMatrix();
      this.bolts.setMatrixAt(n++, d.matrix);
    }
    this.bolts.count = n;
    this.bolts.instanceMatrix.needsUpdate = true;
    n = 0;
    for (const s of c.shells) {
      if (n >= 16) break;
      const f = Math.min(1, s.time / s.max),
        x = s.sx + (s.x - s.sx) * f,
        z = s.sz + (s.z - s.sz) * f,
        y = 3 * (1 - f) + Math.sin(f * Math.PI) * 8;
      d.position.set(x, y, z);
      d.rotation.set(this.time * 9, s.time * 5, 0);
      d.scale.setScalar(1 + Math.sin(f * Math.PI) * 0.25);
      d.updateMatrix();
      this.shells.setMatrixAt(n++, d.matrix);
    }
    this.shells.count = n;
    this.shells.instanceMatrix.needsUpdate = true;
    const target = c.enabled.tesla ? Math.max(0, 1 - c.tesla / 0.32) : 0;
    this.charge += (target - this.charge) * Math.min(1, dt * 22);
    for (let i = 0; i < 3; i++) {
      const ring = this.chargeRings[i];
      ring.visible = this.charge > 0.02 || this.surge > 0;
      ring.material.opacity = Math.max(this.charge * 0.55, this.surge * 0.8);
      ring.scale.setScalar(
        (1.2 - i * 0.2) * (1 - 0.22 * this.charge) + this.surge * (1 + i * 0.2),
      );
      ring.rotation.z = this.time * (i % 2 ? 2 : -2);
    }
    if (this.surge > 0) {
      this.surge = Math.max(0, this.surge - dt / 1.1);
      this.surgeClock += dt;
      const f = 1 - this.surge,
        r = 5 + 21 * (1 - Math.pow(1 - f, 2));
      this.dome.visible = true;
      this.dome.scale.set(r, r * 0.24, r);
      this.dome.material.uniforms.uFade.value = this.surge;
      if (this.surgeClock > 0.055) {
        this.surgeClock = 0;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + this.time * 0.4;
          this.fx.glow.emit(
            Math.sin(a) * r,
            0.25,
            Math.cos(a) * r,
            1.4,
            0x61ddff,
            0.22,
            0,
            0.35,
            0,
            0.42,
            0.1,
          );
        }
      }
    } else this.dome.visible = false;
  }
}

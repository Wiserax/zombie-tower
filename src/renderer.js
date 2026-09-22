import * as T from "three";
import { zombieGeometry, environment, fortress } from "./art.js";
import { CAP } from "./sim.js";
import { Effects } from "./fx.js";
const dummy = new T.Object3D(),
  color = new T.Color();
export class Battlefield {
  constructor(canvas, horde) {
    this.horde = horde;
    this.time = 0;
    this.zoom = 1;
    this.quality = "high";
    this.shake = 0;
    this.shakeEnabled = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.visible = 0;
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x283c37);
    this.scene.fog = new T.FogExp2(0x465544, 0.009);
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.camera = new T.OrthographicCamera(-30, 30, 22, -22, 0.1, 180);
    this.camera.position.set(30, 43, 36);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new T.HemisphereLight(0xd3e7e7, 0x4b422e, 2.1));
    const sun = new T.DirectionalLight(0xffe0a0, 3.4);
    sun.position.set(-20, 38, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -42,
      right: 42,
      top: 42,
      bottom: -42,
      near: 1,
      far: 100,
    });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.08;
    this.scene.add(sun);
    this.sun = sun;
    const terrain = environment(this.scene);
    horde.setObstacles(terrain.obstacles);
    this.fort = fortress(this.scene);
    this.fx = new Effects(this.scene);
    this.units = [];
    this.corpses = [];
    this.dead = [];
    this.deadCursor = 0;
    for (let type = 0; type < 3; type++) {
      const geo = zombieGeometry(type);
      geo.setAttribute(
        "aPhase",
        new T.InstancedBufferAttribute(new Float32Array(CAP), 1),
      );
      geo.setAttribute(
        "aHit",
        new T.InstancedBufferAttribute(new Float32Array(CAP), 1),
      );
      const mat = new T.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.96,
      });
      geo.setAttribute(
        "aAttack",
        new T.InstancedBufferAttribute(new Float32Array(CAP), 1),
      );
      mat.customProgramCacheKey = () => `zombie-gait-${type}`;
      const time = { value: 0 };
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = time;
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nattribute float limb; attribute vec3 pivot; attribute float aPhase; attribute float aHit; attribute float aAttack; uniform float uTime; varying float vHit;",
          )
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
    float gait=sin(uTime*${type === 1 ? "10.5" : "6.8"}+aPhase);float ang=0.;
    if(limb>0.5&&limb<2.5)ang=gait*(limb<1.5?0.48:-0.48);
    if(limb>2.5)ang=gait*(limb<3.5?-0.19:0.19);
    if(aAttack>.5){if(limb>.5&&limb<2.5)ang*=.12;if(limb>2.5)ang=-.9+sin(uTime*7.+aPhase+(limb<3.5?0.:1.4))*.65;}
    vec3 q=transformed-pivot;transformed=pivot+vec3(q.x,q.y*cos(ang)-q.z*sin(ang),q.y*sin(ang)+q.z*cos(ang));
    transformed.y+=abs(gait)*0.035;transformed.z+=aAttack*max(0.,gait)*.08;vHit=aHit;`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying float vHit;",
          )
          .replace(
            "#include <color_fragment>",
            "#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.,.86,.55),vHit*.8);",
          );
      };
      const mesh = new T.InstancedMesh(geo, mat, CAP);
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.scene.add(mesh);
      this.units.push({ mesh, time });
      const corpse = new T.InstancedMesh(
        zombieGeometry(type),
        new T.MeshStandardMaterial({
          vertexColors: true,
          roughness: 1,
          color: 0x888478,
        }),
        180,
      );
      corpse.frustumCulled = false;
      corpse.count = 0;
      this.scene.add(corpse);
      this.corpses.push(corpse);
    }
    this.shadow = new T.InstancedMesh(
      new T.CircleGeometry(0.34, 8),
      new T.MeshBasicMaterial({
        color: 0x15241c,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
      CAP,
    );
    this.shadow.frustumCulled = false;
    this.scene.add(this.shadow);
    this.frustum = new T.Frustum();
    this.proj = new T.Matrix4();
    this.vec = new T.Vector3();
    this.steam = 0;
    this.resize();
  }
  resize() {
    const w = innerWidth,
      h = innerHeight;
    this.renderer.setSize(w, h);
    const aspect = w / h,
      half = (aspect < 0.85 ? 30 : 24) / this.zoom;
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
  }
  death(i, element, knock) {
    const h = this.horde;
    this.dead.push({
      x: h.x[i],
      z: h.z[i],
      a: h.angle[i] + (Math.random() - 0.5),
      type: h.type[i],
      time: 0,
      v: Math.min(knock, 5),
      phase: Math.random(),
    });
    if (this.dead.length > 400) this.dead.shift();
    this.fx.burst(
      h.x[i],
      0.7,
      h.z[i],
      element === 1 ? 5 : 7,
      element === 1 ? 0x9feeff : 0x87543c,
      3,
    );
  }
  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 3);
    this.camera.position.x =
      30 +
      Math.sin(this.time * 57) *
        this.shake *
        0.12 *
        (this.shakeEnabled ? 1 : 0);
    this.camera.position.z =
      36 +
      Math.cos(this.time * 47) *
        this.shake *
        0.12 *
        (this.shakeEnabled ? 1 : 0);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    this.proj.multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse,
    );
    this.frustum.setFromProjectionMatrix(this.proj);
    const counts = [0, 0, 0],
      h = this.horde;
    let shadows = 0;
    this.visible = 0;
    for (let i = 0; i < CAP; i++)
      if (h.hp[i] > 0) {
        const t = h.type[i],
          u = this.units[t],
          n = counts[t]++,
          s =
            (t === 2 ? 1.55 : t === 1 ? 0.95 : 1) * (0.91 + h.phase[i] * 0.025);
        dummy.position.set(h.x[i], 0, h.z[i]);
        dummy.rotation.set(0, h.angle[i], 0);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        u.mesh.setMatrixAt(n, dummy.matrix);
        u.mesh.geometry.attributes.aPhase.array[n] = h.phase[i];
        u.mesh.geometry.attributes.aHit.array[n] = h.hit[i];
        u.mesh.geometry.attributes.aAttack.array[n] =
          h.x[i] * h.x[i] + h.z[i] * h.z[i] < 43.56 ? 1 : 0;
        this.vec.set(h.x[i], 0.7, h.z[i]);
        if (this.frustum.containsPoint(this.vec)) this.visible++;
        dummy.position.set(h.x[i] + 0.12, 0.025, h.z[i] + 0.13);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(s, s * 1.4, 1);
        dummy.updateMatrix();
        this.shadow.setMatrixAt(shadows++, dummy.matrix);
      }
    this.shadow.count = shadows;
    this.shadow.instanceMatrix.needsUpdate = true;
    for (let t = 0; t < 3; t++) {
      const u = this.units[t];
      u.mesh.count = counts[t];
      u.time.value = this.time;
      u.mesh.instanceMatrix.needsUpdate = true;
      u.mesh.geometry.attributes.aPhase.needsUpdate = true;
      u.mesh.geometry.attributes.aHit.needsUpdate = true;
      u.mesh.geometry.attributes.aAttack.needsUpdate = true;
    }
    const dc = [0, 0, 0];
    for (let i = this.dead.length - 1; i >= 0; i--) {
      const d = this.dead[i];
      d.time += dt;
      if (d.time > 12) {
        this.dead.splice(i, 1);
        continue;
      }
      if (dc[d.type] >= 180) continue;
      d.x -= Math.sin(d.a) * d.v * dt;
      d.z -= Math.cos(d.a) * d.v * dt;
      d.v *= Math.exp(-dt * 4);
      const f = Math.min(1, d.time * 5),
        s = d.type === 2 ? 1.55 : 0.97;
      dummy.position.set(
        d.x,
        0.11 + Math.sin(f * Math.PI) * 0.55 - Math.max(0, d.time - 10) * 0.13,
        d.z,
      );
      dummy.rotation.set(-Math.PI * 0.48 * f, d.a, d.phase * 0.25);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      this.corpses[d.type].setMatrixAt(dc[d.type]++, dummy.matrix);
    }
    for (let t = 0; t < 3; t++) {
      this.corpses[t].count = dc[t];
      this.corpses[t].instanceMatrix.needsUpdate = true;
    }
    this.fx.scale =
      (innerHeight * this.renderer.getPixelRatio()) /
      (this.camera.top - this.camera.bottom);
    this.steam -= dt;
    if (this.steam <= 0) {
      this.steam = 0.14;
      this.fx.smoke.emit(
        2.95,
        3.1,
        0.4,
        0.5,
        0xb8b8a2,
        2.4,
        0.15,
        0.8,
        0.12,
        0.25,
        2,
      );
      this.fx.glow.emit(0, 7.1, 0, 1.8, 0x76dcff, 0.4, 0, 0, 0, 0.7, 0.1);
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        this.fx.glow.emit(
          Math.sin(a) * 5.5,
          2.35,
          Math.cos(a) * 5.5,
          1.2,
          0xffa13d,
          0.4,
          0,
          0,
          0,
          0.3,
          0.1,
        );
      }
    }
    this.fort.lights.material.emissiveIntensity =
      1.2 + Math.sin(this.time * 4) * 0.2;
    this.fx.update(dt);
  }
  render() {
    this.renderer.render(this.scene, this.camera);
  }
  point(clientX, clientY) {
    const ray = new T.Raycaster();
    ray.setFromCamera(
      new T.Vector2(
        (clientX / innerWidth) * 2 - 1,
        (-clientY / innerHeight) * 2 + 1,
      ),
      this.camera,
    );
    const p = new T.Vector3();
    return ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), p);
  }
}

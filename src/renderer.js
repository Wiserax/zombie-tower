import * as T from "three";
import { zombieGeometry, environment, fortress } from "./art.js";
import { CAP } from "./sim.js";
import { Effects } from "./fx.js";
import {
  battlefieldTexture,
  retroLandmarks,
  retroFortress,
} from "./retro-art.js";
const dummy = new T.Object3D(),
  color = new T.Color();
export class Battlefield {
  constructor(canvas, horde) {
    this.horde = horde;
    this.canvas = canvas;
    this.style = "retro";
    this.pixelFilter = false;
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
    this.ambient = new T.HemisphereLight(0xd3e7e7, 0x4b422e, 2.1);
    this.scene.add(this.ambient);
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
    this.terrain = terrain;
    this.originalGround = terrain.ground.material.map;
    this.retroGround = battlefieldTexture();
    this.retroScenery = retroLandmarks(this.scene);
    horde.setObstacles(terrain.obstacles);
    this.fort = fortress(this.scene);
    this.retroFort = retroFortress(this.scene);
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
      const retro = { value: 1 };
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = time;
        shader.uniforms.uRetro = retro;
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
            "#include <common>\nvarying float vHit; uniform float uRetro;",
          )
          .replace(
            "#include <color_fragment>",
            "#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb, pow(diffuseColor.rgb,vec3(.72))*vec3(.88,1.08,1.12),uRetro); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.,.96,.75),vHit*.9);",
          );
      };
      const mesh = new T.InstancedMesh(geo, mat, CAP);
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.scene.add(mesh);
      const retroGeo = zombieGeometry(type, true);
      for (const name of ["aPhase", "aHit", "aAttack"])
        retroGeo.setAttribute(name, geo.getAttribute(name));
      this.units.push({ mesh, time, retro, originalGeo: geo, retroGeo });
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
      corpse.userData.originalGeo = corpse.geometry;
      corpse.userData.retroGeo = zombieGeometry(type, true);
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
    this.setStyle("retro");
  }
  setStyle(style) {
    this.style = style === "original" ? "original" : "retro";
    const retro = this.style === "retro";
    this.canvas.classList.toggle("retro", retro && this.pixelFilter);
    this.retroScenery.visible = retro;
    this.retroFort.group.visible = retro;
    this.ambient.color.setHex(retro ? 0xb9e5ff : 0xd3e7e7);
    this.ambient.groundColor.setHex(retro ? 0x39345e : 0x4b422e);
    this.ambient.intensity = retro ? 2.6 : 2.1;
    this.sun.color.setHex(retro ? 0xffe4ab : 0xffe0a0);
    this.sun.intensity = retro ? 3.8 : 3.4;
    this.scene.fog.color.setHex(retro ? 0x273e51 : 0x465544);
    this.terrain.ground.material.map = retro
      ? this.retroGround
      : this.originalGround;
    this.terrain.ground.material.color.setHex(retro ? 0xffffff : 0xb8ba92);
    this.renderer.toneMappingExposure = retro ? 1.3 : 1.35;
    this.units.forEach((u) => {
      u.retro.value = retro ? 1 : 0;
      u.mesh.geometry = retro ? u.retroGeo : u.originalGeo;
    });
    this.corpses.forEach((m) => {
      m.geometry = retro ? m.userData.retroGeo : m.userData.originalGeo;
    });
    this.resize();
  }
  resize() {
    const w = this.canvas.parentElement.clientWidth,
      h = this.canvas.parentElement.clientHeight;
    const pixelated = this.style === "retro" && this.pixelFilter;
    this.canvas.classList.toggle("retro", pixelated);
    this.renderer.setPixelRatio(
      pixelated ? 1 : Math.min(devicePixelRatio, 1.6),
    );
    const width = pixelated ? Math.min(320, Math.round(w)) : Math.round(w);
    this.renderer.setSize(
      width,
      pixelated ? Math.round((width * h) / w) : Math.round(h),
      false,
    );
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
    this.retroFort.time.value = this.time;
    this.retroFort.core.rotation.set(this.time * 0.4, this.time * 0.7, 0);
    this.retroFort.halo.rotation.z = this.time * 0.6;
    this.retroFort.core.scale.setScalar(1 + Math.sin(this.time * 3) * 0.08);
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
    this.fx.scale = this.canvas.height / (this.camera.top - this.camera.bottom);
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
    const rect = this.canvas.getBoundingClientRect();
    ray.setFromCamera(
      new T.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        (-(clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    const p = new T.Vector3();
    return ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), p);
  }
}

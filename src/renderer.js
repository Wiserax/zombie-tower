import * as T from "three";
import {
  zombieGeometry,
  environment,
  fortress,
  fallenGeometry,
} from "./art.js";
import { CAP } from "./sim.js";
import { Effects } from "./fx.js";
import {
  battlefieldTexture,
  retroLandmarks,
  retroFortress,
} from "./retro-art.js";
import { unitMaterial } from "./unit-material.js";
import { ImpactArt } from "./impact-art.js";
import { EnemyHealth, CombatNumbers } from "./combat-feedback.js";
import { SiegeLighting } from "./siege-lighting.js";
import { WeaponFX } from "./weapon-fx.js";
import { ShockArcs } from "./shock-arcs.js";
import { HitSparks } from "./impact-sparks.js";
import { BastionFeedback } from "./bastion-feedback.js";
import { corpseMaterial } from "./corpse-material.js";
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
    this.impacts = new ImpactArt(this.scene);
    this.healthBars = new EnemyHealth(this.scene);
    this.numbers = new CombatNumbers(this.scene);
    this.lighting = new SiegeLighting(this.scene);
    this.weaponFX = new WeaponFX(this.scene, this.fx);
    this.hitSparks = new HitSparks(this.scene);
    this.shockArcs = new ShockArcs(this.scene);
    this.bastionFeedback = new BastionFeedback(this.fx, this.hitSparks);
    this.recoil = new Float32Array(4);
    this.energy = 0;
    this.fort.turrets.forEach((g) => {
      g.userData.anchor = g.position.clone();
    });
    this.fort.ballistas.forEach((g) => {
      g.userData.anchor = g.position.clone();
      g.userData.kick = 0;
    });
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
      geo.setAttribute(
        "aAttack",
        new T.InstancedBufferAttribute(new Float32Array(CAP), 1),
      );
      geo.setAttribute(
        "aElement",
        new T.InstancedBufferAttribute(new Float32Array(CAP), 1),
      );
      geo.setAttribute(
        "aShock",
        new T.InstancedBufferAttribute(new Float32Array(CAP), 1),
      );
      const { material: mat, time, retro } = unitMaterial(type);
      const mesh = new T.InstancedMesh(geo, mat, CAP);
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.scene.add(mesh);
      const retroGeo = zombieGeometry(type, true);
      for (const name of ["aPhase", "aHit", "aAttack", "aElement", "aShock"])
        retroGeo.setAttribute(name, geo.getAttribute(name));
      this.units.push({ mesh, time, retro, originalGeo: geo, retroGeo });
      const corpse = new T.InstancedMesh(
        zombieGeometry(type),
        corpseMaterial(),
        400,
      );
      corpse.frustumCulled = false;
      corpse.count = 0;
      this.scene.add(corpse);
      corpse.userData.originalGeo = corpse.geometry;
      corpse.userData.retroGeo = fallenGeometry(type, true);
      const opacity = new T.InstancedBufferAttribute(
        new Float32Array(400).fill(1),
        1,
      );
      corpse.userData.originalGeo.setAttribute("aFade", opacity);
      corpse.userData.retroGeo.setAttribute("aFade", opacity);
      corpse.setColorAt(0, new T.Color(1, 1, 1));
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
    this.unitBounds = new T.Sphere(new T.Vector3(), 2.8);
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
    this.impacts.setEnabled(retro);
    this.ambient.color.setHex(retro ? 0xb9e5ff : 0xd3e7e7);
    this.ambient.groundColor.setHex(retro ? 0x39345e : 0x4b422e);
    this.ambient.intensity = retro ? 1.7 : 2.1;
    this.sun.color.setHex(retro ? 0xffe4ab : 0xffe0a0);
    this.sun.intensity = retro ? 2.7 : 3.4;
    this.scene.fog.color.setHex(retro ? 0x273e51 : 0x465544);
    this.scene.fog.density = retro ? 0.004 : 0.009;
    this.terrain.ground.material.map = retro
      ? this.retroGround
      : this.originalGround;
    this.terrain.ground.material.color.setHex(retro ? 0xffffff : 0xb8ba92);
    this.renderer.toneMappingExposure = retro ? 1.25 : 1.35;
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
    this.displayDpr = devicePixelRatio;
    const w = Math.max(1, this.canvas.parentElement.clientWidth),
      h = Math.max(1, this.canvas.parentElement.clientHeight);
    this.canvas.parentElement.classList.toggle("compact", h < 660);
    this.canvas.parentElement.classList.toggle("short", h < 500);
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
    this.healthBars.resize(w, h);
    this.numbers.resize(w, h);
    const aspect = w / h,
      half = (aspect < 0.85 ? 30 : 24) / this.zoom;
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
    // Resizing clears the drawing buffer even while gameplay is paused.
    this.update(0);
    this.render();
  }
  feedbackVisible(x, y, z, radius = 1) {
    this.unitBounds.center.set(x, y, z);
    this.unitBounds.radius = radius;
    return this.frustum.intersectsSphere(this.unitBounds);
  }
  death(i, element, knock) {
    const h = this.horde;
    const onScreen = this.feedbackVisible(
      h.x[i],
      1,
      h.z[i],
      h.type[i] === 2 ? 2.5 : 1.5,
    );
    if (onScreen)
      this.dead.push({
        x: h.x[i],
        z: h.z[i],
        a: h.angle[i] + (Math.random() - 0.5),
        type: h.type[i],
        element,
        time: 0,
        v: Math.min(knock, 5),
        phase: Math.random(),
        landed: false,
      });
    if (this.dead.length > 400) this.dead.shift();
    if (onScreen)
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
    this.energy = Math.max(0, this.energy - dt * 3.5);
    this.retroFort.core.scale.setScalar(
      1 + Math.sin(this.time * 3) * 0.08 + this.energy * 0.35,
    );
    this.retroFort.halo.scale.setScalar(1 + this.energy * 0.3);
    this.impacts.update(dt);
    this.weaponFX.update(dt);
    this.lighting.update(dt, this.energy, this.style === "retro");
    for (let i = 0; i < 4; i++) {
      const gun = this.fort.turrets[i],
        kick = this.recoil[i];
      gun.position.copy(gun.userData.anchor);
      gun.position.x -= Math.sin(gun.rotation.y) * kick * 0.24;
      gun.position.z -= Math.cos(gun.rotation.y) * kick * 0.24;
      gun.rotation.x = -kick * 0.06;
      this.recoil[i] = Math.max(0, kick - dt * 9);
    }
    for (const b of this.fort.ballistas) {
      const k = b.userData.kick;
      b.position.copy(b.userData.anchor);
      b.position.x -= Math.sin(b.rotation.y) * k * 0.3;
      b.position.z -= Math.cos(b.rotation.y) * k * 0.3;
      b.rotation.x = -k * 0.075;
      b.userData.kick = Math.max(0, k - dt * 4);
    }
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
    this.bastionFeedback.update(dt, this.horde);
    this.hitSparks.update(dt, this.camera);
    this.proj.multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse,
    );
    this.frustum.setFromProjectionMatrix(this.proj);
    const counts = [0, 0, 0],
      h = this.horde;
    this.shockArcs.begin(this.time, this.camera);
    let shadows = 0;
    this.visible = 0;
    for (let i = 0; i < CAP; i++)
      if (h.hp[i] > 0) {
        const t = h.type[i],
          u = this.units[t],
          s =
            (t === 2 ? 1.55 : t === 1 ? 0.95 : 1) * (0.91 + h.phase[i] * 0.025);
        // Keep an oversized animated-body bound at the edge: off-screen heads/arms
        // must not vanish just because the unit's feet have left the viewport.
        this.unitBounds.center.set(h.x[i], 1, h.z[i]);
        this.unitBounds.radius = 1.8 * s;
        if (!this.frustum.intersectsSphere(this.unitBounds)) continue;
        const n = counts[t]++;
        this.shockArcs.add(h.x[i], h.z[i], s, h.slow[i], h.phase[i]);
        if (
          t === 2 &&
          this.style === "retro" &&
          dt > 0 &&
          Math.floor((this.time * 6.8 + h.phase[i]) / Math.PI) !==
            Math.floor(((this.time - dt) * 6.8 + h.phase[i]) / Math.PI)
        ) {
          this.fx.smoke.emit(
            h.x[i],
            0.08,
            h.z[i],
            0.65,
            0x9b9675,
            0.55,
            0,
            0.1,
            0,
            0.13,
            1.3,
          );
        }
        dummy.position.set(h.x[i], 0, h.z[i]);
        dummy.rotation.set(0, h.angle[i], 0);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        u.mesh.setMatrixAt(n, dummy.matrix);
        u.mesh.geometry.attributes.aPhase.array[n] = h.phase[i];
        u.mesh.geometry.attributes.aHit.array[n] = h.hit[i];
        u.mesh.geometry.attributes.aElement.array[n] = h.element[i];
        u.mesh.geometry.attributes.aShock.array[n] = h.slow[i] > 0 ? 1 : 0;
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
    this.shockArcs.finish();
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
      u.mesh.geometry.attributes.aElement.needsUpdate = true;
      u.mesh.geometry.attributes.aShock.needsUpdate = true;
    }
    const dc = [0, 0, 0];
    for (let i = this.dead.length - 1; i >= 0; i--) {
      const d = this.dead[i];
      d.time += dt;
      if (d.time > 7) {
        this.dead.splice(i, 1);
        continue;
      }
      d.x -= Math.sin(d.a) * d.v * dt;
      d.z -= Math.cos(d.a) * d.v * dt;
      d.v *= Math.exp(-dt * 4);
      this.unitBounds.center.set(d.x, 0.5, d.z);
      this.unitBounds.radius = d.type === 2 ? 3.2 : 2;
      if (!this.frustum.intersectsSphere(this.unitBounds) || dc[d.type] >= 400)
        continue;
      const stylized = this.style === "retro";
      const fallTime = stylized
        ? d.element === 2
          ? 0.4
          : d.element === 1
            ? 0.32
            : 0.25
        : 0.2;
      if (!d.landed && d.time >= fallTime) {
        d.landed = true;
        if (d.element === 2 || d.type === 2)
          this.fx.smoke.emit(
            d.x,
            0.1,
            d.z,
            d.type === 2 ? 1.4 : 0.8,
            0xa89974,
            0.48,
            0,
            0.25,
            0,
            0.28,
            1.8,
          );
      }
      const f = Math.min(1, d.time / fallTime),
        s = d.type === 2 ? 1.55 : 0.97;
      const lift =
        (d.type === 2 ? 0.68 : 1) *
        (stylized
          ? d.element === 2
            ? 0.9
            : d.element === 1
              ? 0.24
              : 0.38
          : 0.55);
      dummy.position.set(
        d.x,
        0.11 + Math.sin(f * Math.PI) * lift - Math.max(0, d.time - 4) * 0.04,
        d.z,
      );
      dummy.rotation.set(
        -Math.PI * 0.48 * f,
        d.a,
        (d.phase - 0.5) * (stylized ? 0.85 : 0.5) * f,
      );
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      const slot = dc[d.type]++;
      this.corpses[d.type].setMatrixAt(slot, dummy.matrix);
      this.corpses[d.type].geometry.attributes.aFade.array[slot] = Math.min(
        1,
        (7 - d.time) / 0.8,
      );
      if (stylized && d.element === 1 && d.time < 0.2)
        color.setRGB(0.6, 1.8, 2.4);
      else if (stylized && d.element === 2) color.setRGB(0.7, 0.57, 0.46);
      else color.setRGB(1, 1, 1);
      this.corpses[d.type].setColorAt(slot, color);
    }
    for (let t = 0; t < 3; t++) {
      this.corpses[t].count = dc[t];
      this.corpses[t].instanceMatrix.needsUpdate = true;
      this.corpses[t].instanceColor.needsUpdate = true;
      this.corpses[t].geometry.attributes.aFade.needsUpdate = true;
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
      for (let k = 0; k < 7; k++) {
        const a = (k * Math.PI * 2) / 7;
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
    this.healthBars.update(h, dt, this.frustum, this.vec);
    this.numbers.update(dt, this.camera);
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

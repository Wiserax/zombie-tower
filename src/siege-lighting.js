import * as T from "three";
const transform = new T.Object3D(),
  color = new T.Color();

// Three fixed, shadow-free lights. Events reuse them; no per-explosion lights/program variants.
export class SiegeLighting {
  constructor(scene) {
    this.enabled = true;
    this.time = 0;
    this.events = [];
    this.maxEvents = 24;
    this.surge = 0;
    this.core = new T.PointLight(0x68dfff, 35, 17, 2);
    this.core.position.set(0, 6.8, 0);
    scene.add(this.core);
    this.lights = Array.from({ length: 2 }, () => {
      const l = new T.PointLight(0xffaa52, 0, 15, 2);
      scene.add(l);
      return l;
    });
    this.rim = new T.DirectionalLight(0x8ccbf9, 0.5);
    this.rim.position.set(16, 12, -24);
    scene.add(this.rim);
    const geometry = new T.PlaneGeometry(2, 2);
    geometry.setAttribute(
      "aTint",
      new T.InstancedBufferAttribute(new Float32Array(24 * 4), 4),
    );
    const material = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: T.AdditiveBlending,
      toneMapped: false,
      vertexShader: `attribute vec4 aTint;varying vec2 vUv;varying vec4 vTint;void main(){vUv=uv;vTint=aTint;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 vUv;varying vec4 vTint;void main(){float r=length(vUv*2.-1.);float a=pow(max(0.,1.-r*r),2.)*vTint.a;gl_FragColor=vec4(vTint.rgb,a);}`,
    });
    this.glows = new T.InstancedMesh(geometry, material, 24);
    this.glows.frustumCulled = false;
    this.glows.count = 0;
    this.glows.renderOrder = 1;
    this.glows.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(this.glows);
  }
  flash(x, z, kind = "shell", strength = 1) {
    if (!this.enabled) return;
    const spec =
      kind === "surge"
        ? [0x80edff, 22, 1.05, 230, 9]
        : kind === "electric"
          ? [0x42cfff, 4.5, 0.28, 100, 3]
          : kind === "gun"
            ? [0xffc56a, 2.2, 0.07, 32, 1]
            : [0xffa044, 6.5, 0.52, 220, 5];
    if (this.events.length >= 24) this.events.shift();
    this.events.push({
      x,
      z,
      color: spec[0],
      radius: spec[1],
      life: spec[2],
      max: spec[2],
      power: spec[3] * strength,
      priority: spec[4],
    });
    if (kind === "surge") this.surge = 1;
  }
  update(dt, energy, retro = true) {
    this.time += dt;
    this.surge = Math.max(0, this.surge - dt * 2);
    this.core.intensity = this.enabled
      ? 24 + energy * 24 + Math.sin(this.time * 3) * 4
      : 0;
    this.rim.intensity = this.enabled && retro ? 0.58 : 0;
    let n = 0;
    let first = null,
      second = null,
      firstScore = -1,
      secondScore = -1;
    for (let i = this.events.length - 1; i >= 0; i--) {
      const e = this.events[i];
      e.life -= dt;
      if (e.life <= 0) {
        this.events.splice(i, 1);
        continue;
      }
      const f = e.life / e.max,
        envelope = Math.pow(f, 1.8);
      const score = e.priority * envelope;
      if (score > firstScore) {
        second = first;
        secondScore = firstScore;
        first = e;
        firstScore = score;
      } else if (score > secondScore) {
        second = e;
        secondScore = score;
      }
      transform.position.set(e.x, 0.035, e.z);
      transform.rotation.set(-Math.PI / 2, 0, 0);
      transform.scale.set(e.radius, e.radius, 1);
      transform.updateMatrix();
      this.glows.setMatrixAt(n, transform.matrix);
      color.setHex(e.color);
      this.glows.geometry.attributes.aTint.setXYZW(
        n,
        color.r,
        color.g,
        color.b,
        (e.priority === 1 ? 0.2 : 0.55) * envelope,
      );
      n++;
    }
    for (let i = 0; i < 2; i++) {
      const l = this.lights[i],
        event = i === 0 ? first : second;
      if (!this.enabled || !event) {
        l.intensity = 0;
        continue;
      }
      l.position.set(event.x, event.priority >= 9 ? 5 : 2.3, event.z);
      l.color.setHex(event.color);
      l.distance = event.radius * 2.1;
      l.intensity = event.power * Math.pow(event.life / event.max, 1.8);
    }
    this.glows.count = this.enabled ? n : 0;
    this.glows.instanceMatrix.needsUpdate = true;
    this.glows.geometry.attributes.aTint.needsUpdate = true;
  }
}

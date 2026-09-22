import * as T from "three";
import { CAP } from "./sim.js";
const NUMBER_COLORS = {
  hit: [1, 0.97, 0.84],
  electric: [0.46, 0.92, 1],
  blast: [1, 0.67, 0.3],
  pack: [1, 0.83, 0.32],
  surge: [1, 0.83, 0.32],
};

// All health bars share one draw call. Pixel dimensions are independent of camera zoom.
export class EnemyHealth {
  constructor(scene) {
    this.mode = "damaged";
    this.trail = new Float32Array(CAP);
    this.previous = new Float32Array(CAP);
    this.hold = new Float32Array(CAP);
    this.version = new Uint32Array(CAP);
    this.geo = new T.InstancedBufferGeometry();
    const plane = new T.PlaneGeometry(1, 1);
    this.geo.index = plane.index;
    this.geo.attributes.position = plane.attributes.position;
    this.geo.attributes.uv = plane.attributes.uv;
    for (const [name, size] of [
      ["aAnchor", 3],
      ["aValues", 4],
      ["aShape", 3],
    ])
      this.geo.setAttribute(
        name,
        new T.InstancedBufferAttribute(
          new Float32Array(CAP * size),
          size,
        ).setUsage(T.DynamicDrawUsage),
      );
    this.viewport = { value: new T.Vector2(390, 844) };
    this.material = new T.ShaderMaterial({
      uniforms: { uViewport: this.viewport },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      vertexShader: `attribute vec3 aAnchor;attribute vec4 aValues;attribute vec3 aShape;uniform vec2 uViewport;varying vec2 vUv;varying vec4 vValues;varying vec3 vShape;
      void main(){vUv=uv;vValues=aValues;vShape=aShape;vec4 p=projectionMatrix*viewMatrix*vec4(aAnchor,1.);p.xy+=position.xy*aShape.xy/uViewport*2.*p.w;gl_Position=p;}`,
      fragmentShader: `varying vec2 vUv;varying vec4 vValues;varying vec3 vShape;
      void main(){vec2 q=abs((vUv-.5)*vShape.xy)-(vShape.xy*.5-vec2(1.));float edge=length(max(q,0.))+min(max(q.x,q.y),0.)-1.;float alpha=1.-smoothstep(-.5,.5,edge);if(alpha<.01)discard;
      vec3 c=vec3(.045,.065,.065);float inset=1./vShape.x;float x=(vUv.x-inset)/(1.-2.*inset);bool inner=vUv.y>1./vShape.y&&vUv.y<1.-1./vShape.y&&x>0.&&x<1.;
      if(inner){c=vec3(.15,.16,.15);if(x<vValues.y)c=vec3(.99,.85,.59);if(x<vValues.x){c=vShape.z>.5?vec3(1.,.48,.16):vec3(.96,.22,.27);if(vValues.z>.01)c=mix(c,vec3(.22,.9,1.),.8);c*=mix(.82,1.15,vUv.y);}}
      gl_FragColor=vec4(c,alpha*vValues.w);
      }`,
      toneMapped: false,
    });
    this.mesh = new T.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 12;
    this.geo.instanceCount = 0;
    scene.add(this.mesh);
  }
  resize(w, h) {
    this.viewport.value.set(w, h);
  }
  update(h, dt, frustum, vec) {
    let n = 0;
    const a = this.geo.attributes;
    for (let i = 0; i < CAP; i++) {
      if (h.hp[i] <= 0) {
        this.previous[i] = 0;
        continue;
      }
      const ratio = h.hp[i] / h.maxHp[i];
      if (this.version[i] !== h.generation[i]) {
        this.version[i] = h.generation[i];
        this.previous[i] = ratio;
        this.trail[i] = ratio;
        this.hold[i] = 0;
      }
      if (ratio < this.previous[i] - 0.001) this.hold[i] = 0.19;
      this.previous[i] = ratio;
      this.hold[i] = Math.max(0, this.hold[i] - dt);
      if (this.hold[i] === 0)
        this.trail[i] = Math.max(ratio, this.trail[i] - dt * 1.65);
      if (this.mode === "off" || (this.mode === "damaged" && ratio >= 0.999))
        continue;
      const scale =
        (h.type[i] === 2 ? 1.55 : h.type[i] === 1 ? 0.95 : 1) *
        (0.91 + h.phase[i] * 0.025);
      vec.set(h.x[i], 2.02 * scale + 0.23, h.z[i]);
      if (!frustum.containsPoint(vec)) continue;
      a.aAnchor.setXYZ(n, vec.x, vec.y, vec.z);
      a.aValues.setXYZW(n, ratio, this.trail[i], h.slow[i], 1);
      a.aShape.setXYZ(
        n,
        h.type[i] === 2 ? 25 : 17,
        h.type[i] === 2 ? 5.5 : 4,
        h.type[i] === 2 ? 1 : 0,
      );
      n++;
    }
    this.geo.instanceCount = n;
    for (const attr of Object.values(a))
      if (attr.isInstancedBufferAttribute) attr.needsUpdate = true;
  }
}

// One numeric atlas and one instanced glyph draw call, independent of enemy count.
export class CombatNumbers {
  constructor(scene) {
    this.enabled = true;
    this.events = [];
    this.time = 0;
    this.maxLabels = 32;
    this.lastSmall = -Infinity;
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 128;
    const c = canvas.getContext("2d");
    const symbols = "0123456789+!";
    this.columns = 16;
    const drawAtlas = (font) => {
      c.clearRect(0, 0, 1024, 128);
      c.font = font;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.lineJoin = "round";
      for (let i = 0; i < symbols.length; i++) {
        const x = i * 64 + 32;
        c.strokeStyle = "#152627";
        c.lineWidth = 9;
        c.strokeText(symbols[i], x, 66);
        c.fillStyle = "#fff";
        c.fillText(symbols[i], x, 66);
      }
    };
    drawAtlas("900 76px Arial, sans-serif");
    this.texture = new T.CanvasTexture(canvas);
    this.texture.colorSpace = T.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = T.LinearFilter;
    // Match the HUD lettering once its local font is decoded; retain the same GPU texture.
    document.fonts
      .load("76px Lilita")
      .then(() => {
        drawAtlas("76px Lilita, Arial, sans-serif");
        this.texture.needsUpdate = true;
      })
      .catch(() => {});
    this.geo = new T.InstancedBufferGeometry();
    const plane = new T.PlaneGeometry(1, 1);
    this.geo.index = plane.index;
    this.geo.attributes.position = plane.attributes.position;
    this.geo.attributes.uv = plane.attributes.uv;
    this.capacity = 192;
    for (const [name, size] of [
      ["aAnchor", 3],
      ["aOffset", 2],
      ["aStyle", 4],
      ["aColor", 3],
    ])
      this.geo.setAttribute(
        name,
        new T.InstancedBufferAttribute(
          new Float32Array(this.capacity * size),
          size,
        ).setUsage(T.DynamicDrawUsage),
      );
    this.viewport = { value: new T.Vector2(390, 844) };
    this.material = new T.ShaderMaterial({
      uniforms: { uMap: { value: this.texture }, uViewport: this.viewport },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      vertexShader: `attribute vec3 aAnchor;attribute vec2 aOffset;attribute vec4 aStyle;attribute vec3 aColor;uniform vec2 uViewport;varying vec2 vUv;varying vec4 vStyle;varying vec3 vColor;
      void main(){vUv=uv;vStyle=aStyle;vColor=aColor;vec4 p=projectionMatrix*viewMatrix*vec4(aAnchor,1.);p.xy+=(position.xy*vec2(aStyle.y*.64,aStyle.y)+aOffset)/uViewport*2.*p.w;gl_Position=p;}`,
      fragmentShader: `uniform sampler2D uMap;varying vec2 vUv;varying vec4 vStyle;varying vec3 vColor;void main(){vec4 tex=texture2D(uMap,vec2((vUv.x+vStyle.x)/16.,vUv.y));vec3 rgb=mix(tex.rgb,tex.rgb*vColor,step(.25,tex.r));gl_FragColor=vec4(rgb,tex.a*vStyle.z);if(gl_FragColor.a<.01)discard;}`,
    });
    this.mesh = new T.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 13;
    this.geo.instanceCount = 0;
    scene.add(this.mesh);
    this.project = new T.Vector3();
    this.occupied = [];
    this.rectangles = Array.from({ length: this.maxLabels }, () => ({
      x: 0,
      y: 0,
      w: 0,
      h: 0,
    }));
  }
  resize(w, h) {
    this.viewport.value.set(w, h);
  }
  clearPacks() {
    this.events = this.events.filter(
      (e) => e.kind !== "pack" && e.kind !== "surge",
    );
  }
  add(x, y, z, value, kind = "hit", key = -1) {
    if (!this.enabled || !Number.isFinite(value) || value <= 0) return;
    const big = kind === "pack" || kind === "surge";
    // Coalesce rapid damage on one living enemy, but never across recycled slots.
    const existing = !big
      ? this.events.find(
          (e) => e.key === key && e.age < 0.13 && e.kind === kind,
        )
      : null;
    if (existing) {
      existing.value += value;
      existing.text = String(Math.round(existing.value));
      return;
    }
    if (!big && this.time - this.lastSmall < 0.065) return;
    if (!big) this.lastSmall = this.time;
    if (this.events.length >= this.maxLabels) {
      const remove = this.events.findIndex(
        (e) => e.kind !== "pack" && e.kind !== "surge",
      );
      if (remove < 0) return;
      this.events.splice(remove, 1);
    }
    this.events.push({
      x,
      y,
      z,
      value,
      text: (big ? "+" : "") + Math.round(value),
      kind,
      key,
      age: 0,
      life: big ? 1.2 : 0.72,
      drift: (Math.random() - 0.5) * 16,
    });
  }
  update(dt, camera) {
    this.time += dt;
    let count = 0;
    this.occupied.length = 0;
    const a = this.geo.attributes;
    for (let i = this.events.length - 1; i >= 0; i--) {
      const e = this.events[i];
      e.age += dt;
      if (e.age >= e.life) {
        this.events.splice(i, 1);
        continue;
      }
    }
    // Large pack totals reserve their space first; a new tiny hit cannot hide a surge.
    for (let pass = 0; pass < 2; pass++)
      for (let i = this.events.length - 1; i >= 0; i--) {
        const e = this.events[i],
          big = e.kind === "pack" || e.kind === "surge";
        if (!this.enabled || (pass === 0) !== big) continue;
        this.project.set(e.x, e.y, e.z).project(camera);
        if (
          Math.abs(this.project.x) > 1.08 ||
          Math.abs(this.project.y) > 1.02 ||
          this.project.z > 1
        )
          continue;
        const f = e.age / e.life;
        const size =
          (big ? 27 : e.kind === "electric" ? 17 : 15) *
          (1 + Math.sin(Math.min(1, f * 5) * Math.PI) * (big ? 0.24 : 0.12));
        const color = NUMBER_COLORS[e.kind] || NUMBER_COLORS.hit;
        const alpha = Math.min(1, e.age / 0.035) * Math.min(1, (1 - f) * 3.7),
          rise = (1 - Math.pow(1 - f, 2)) * 31;
        const w = this.viewport.value.x,
          h = this.viewport.value.y;
        const px = ((this.project.x + 1) * w) / 2 + e.drift * f;
        const py = ((1 - this.project.y) * h) / 2 - rise;
        const halfWidth = ((e.text.length * 0.46 + 0.2) * size) / 2;
        // Keep numerical feedback out of the HUD and avoid overlapping labels.
        if (
          py < (this.safeTop ?? (h < 660 ? 182 : 242)) ||
          py > h - (this.safeBottom ?? 125) ||
          px < halfWidth ||
          px > w - halfWidth
        )
          continue;
        if (
          this.occupied.some(
            (r) =>
              Math.abs(px - r.x) < halfWidth + r.w + 4 &&
              Math.abs(py - r.y) < (size + r.h) * 0.4,
          )
        )
          continue;
        const rect = this.rectangles[this.occupied.length];
        rect.x = px;
        rect.y = py;
        rect.w = halfWidth;
        rect.h = size;
        this.occupied.push(rect);
        for (let j = 0; j < e.text.length && count < this.capacity; j++) {
          const ch = e.text[j],
            glyph = ch === "+" ? 10 : Number(ch);
          if (!Number.isFinite(glyph)) continue;
          a.aAnchor.setXYZ(count, e.x, e.y, e.z);
          a.aOffset.setXY(
            count,
            (j - (e.text.length - 1) / 2) * size * 0.46 + e.drift * f,
            rise,
          );
          a.aStyle.setXYZW(count, glyph, size, alpha, 0);
          a.aColor.setXYZ(count, ...color);
          count++;
        }
      }
    this.geo.instanceCount = count;
    for (const attr of Object.values(a))
      if (attr.isInstancedBufferAttribute) attr.needsUpdate = true;
  }
}

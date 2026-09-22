import * as T from "three";
// Fixed-capacity billboard particles. One draw for smoke, one for additive light.
export class Cloud {
  constructor(scene, additive = false, capacity = 360) {
    this.cap = capacity;
    this.cursor = 0;
    this.items = Array.from({ length: capacity }, () => ({ life: 0 }));
    const g = new T.BufferGeometry();
    this.pos = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.alphas = new Float32Array(capacity);
    g.setAttribute(
      "position",
      new T.BufferAttribute(this.pos, 3).setUsage(T.DynamicDrawUsage),
    );
    g.setAttribute(
      "color",
      new T.BufferAttribute(this.colors, 3).setUsage(T.DynamicDrawUsage),
    );
    g.setAttribute(
      "size",
      new T.BufferAttribute(this.sizes, 1).setUsage(T.DynamicDrawUsage),
    );
    g.setAttribute(
      "alpha",
      new T.BufferAttribute(this.alphas, 1).setUsage(T.DynamicDrawUsage),
    );
    g.setDrawRange(0, 0);
    this.material = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? T.AdditiveBlending : T.NormalBlending,
      uniforms: { uScale: { value: 20 } },
      vertexShader: `attribute float size;attribute float alpha;attribute vec3 color;varying float vAlpha;varying vec3 vColor;uniform float uScale;void main(){vAlpha=alpha;vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=size*uScale;}`,
      fragmentShader: `varying float vAlpha;varying vec3 vColor;void main(){vec2 uv=gl_PointCoord-.5;float r=length(uv)*2.;float a=pow(max(0.,1.-r*r),2.)*vAlpha;gl_FragColor=vec4(vColor,a);}`,
    });
    this.mesh = new T.Points(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 3 : 2;
    scene.add(this.mesh);
    this.c = new T.Color();
  }
  emit(
    x,
    y,
    z,
    size,
    color,
    life = 1,
    vx = 0,
    vy = 0.5,
    vz = 0,
    opacity = 0.6,
    growth = 1,
  ) {
    const p = this.items[this.cursor++ % this.cap];
    Object.assign(p, {
      x,
      y,
      z,
      size,
      color,
      life,
      max: life,
      vx,
      vy,
      vz,
      opacity,
      growth,
    });
  }
  update(dt, scale) {
    let n = 0;
    for (const p of this.items) {
      p.life -= dt;
      if (p.life <= 0) continue;
      const f = 1 - p.life / p.max;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      this.pos.set([p.x, p.y, p.z], n * 3);
      this.c.setHex(p.color);
      this.colors.set([this.c.r, this.c.g, this.c.b], n * 3);
      this.sizes[n] = p.size * (1 + f * p.growth);
      this.alphas[n] =
        p.opacity * Math.min(1, f * 12) * Math.min(1, (1 - f) * 3);
      n++;
    }
    this.mesh.geometry.setDrawRange(0, n);
    for (const a of Object.values(this.mesh.geometry.attributes))
      a.needsUpdate = true;
    this.material.uniforms.uScale.value = scale;
  }
}

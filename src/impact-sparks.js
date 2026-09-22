import * as T from "three";
const temp = new T.Object3D(),
  c = new T.Color();
// Directional hit slashes, bright fragments and ground contact dust, all bounded.
export class HitSparks {
  constructor(scene) {
    this.events = [];
    this.capacity = 120;
    this.time = 0;
    const geometry = new T.PlaneGeometry(1, 1);
    geometry.setAttribute(
      "aTint",
      new T.InstancedBufferAttribute(new Float32Array(this.capacity * 4), 4),
    );
    const material = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: T.DoubleSide,
      blending: T.AdditiveBlending,
      toneMapped: false,
      vertexShader: `attribute vec4 aTint;varying vec2 vUv;varying vec4 vTint;void main(){vUv=uv;vTint=aTint;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 vUv;varying vec4 vTint;void main(){vec2 p=abs(vUv*2.-1.);float horizontal=pow(max(0.,1.-p.y*7.),2.)*(1.-p.x);float vertical=pow(max(0.,1.-p.x*7.),2.)*(1.-p.y);float core=pow(max(0.,1.-length(p)*2.),2.);float a=max(core,max(horizontal,vertical))*vTint.a;gl_FragColor=vec4(vTint.rgb,a);}`,
    });
    this.mesh = new T.InstancedMesh(geometry, material, this.capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(this.mesh);
  }
  hit(x, y, z, element = 0, large = false) {
    if (this.events.length >= this.capacity) this.events.shift();
    this.events.push({
      x,
      y,
      z,
      color: element === 1 ? 0x8fefff : element === 2 ? 0xffcd65 : 0xfff2ba,
      size: large ? 0.85 : 0.55,
      age: 0,
      life: element === 1 ? 0.2 : 0.13,
      angle: Math.random() * Math.PI,
    });
  }
  update(dt, camera) {
    let n = 0;
    for (let i = this.events.length - 1; i >= 0; i--) {
      const e = this.events[i];
      e.age += dt;
      if (e.age >= e.life) {
        this.events.splice(i, 1);
        continue;
      }
      const f = e.age / e.life;
      temp.position.set(e.x, e.y, e.z);
      temp.quaternion.copy(camera.quaternion);
      temp.rotateZ(e.angle);
      const s = e.size * (0.45 + Math.sin(Math.PI * f) * 0.65);
      temp.scale.set(s * 1.35, s, 1);
      temp.updateMatrix();
      this.mesh.setMatrixAt(n, temp.matrix);
      c.setHex(e.color);
      this.mesh.geometry.attributes.aTint.setXYZW(
        n,
        c.r,
        c.g,
        c.b,
        (1 - f) * 1.25,
      );
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.geometry.attributes.aTint.needsUpdate = true;
  }
}

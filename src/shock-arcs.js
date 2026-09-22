import * as T from "three";
import { CAP } from "./sim.js";
const transform = new T.Object3D();

// A single instanced draw adds short-lived electrical filaments to surviving targets.
// It reads the real slow timer; no extra status, damage or per-enemy scene objects.
export class ShockArcs {
  constructor(scene) {
    this.count = 0;
    const geometry = new T.PlaneGeometry(1, 1);
    geometry.setAttribute(
      "aCharge",
      new T.InstancedBufferAttribute(new Float32Array(CAP * 2), 2).setUsage(
        T.DynamicDrawUsage,
      ),
    );
    this.time = { value: 0 };
    this.material = new T.ShaderMaterial({
      uniforms: { uTime: this.time },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: T.AdditiveBlending,
      toneMapped: false,
      vertexShader: `attribute vec2 aCharge;varying vec2 vCharge;varying vec2 vUv;void main(){vCharge=aCharge;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float uTime;varying vec2 vCharge;varying vec2 vUv;
      void main(){float seed=vCharge.y;float y=vUv.y;float tick=floor(uTime*16.+seed);float path=.29+sin(floor(y*11.)*2.1+seed*9.+tick*2.7)*.07;float d=abs(abs(vUv.x-.5)-path);
      float core=1.-smoothstep(.006,.024,d);float halo=(1.-smoothstep(.02,.075,d))*.27;
      float ends=smoothstep(.03,.17,y)*(1.-smoothstep(.8,.98,y));float broken=step(.18,fract(y*2.4+seed*.7+tick*.17));float fade=min(1.,vCharge.x*6.);
      gl_FragColor=vec4(mix(vec3(.14,.62,1.),vec3(.68,.96,1.),core),(core+halo)*ends*broken*fade*.72);}`,
    });
    this.mesh = new T.InstancedMesh(geometry, this.material, CAP);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 5;
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(this.mesh);
  }
  begin(time, camera) {
    this.count = 0;
    this.time.value = time;
    transform.quaternion.copy(camera.quaternion);
  }
  add(x, z, scale, charge, phase) {
    if (charge <= 0 || this.count >= CAP) return;
    transform.position.set(x, 1.08 * scale, z);
    transform.scale.set(1.45 * scale, 2.25 * scale, 1);
    transform.updateMatrix();
    this.mesh.setMatrixAt(this.count, transform.matrix);
    this.mesh.geometry.attributes.aCharge.setXY(this.count, charge, phase);
    this.count++;
  }
  finish() {
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.geometry.attributes.aCharge.needsUpdate = true;
  }
}

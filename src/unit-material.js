import * as T from "three";
// Limb motion and limb normals share one angle function. GPU instancing means
// hundreds of independent phases without per-zombie scene nodes or CPU bones.
export function unitMaterial(type) {
  const material = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
  });
  const time = { value: 0 },
    retro = { value: 1 };
  material.customProgramCacheKey = () => `zombie-gait-normal-v2-${type}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.uniforms.uRetro = retro;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute float limb;attribute vec3 pivot;attribute float aPhase;attribute float aHit;attribute float aAttack;
uniform float uTime;varying float vHit;
float gait(){return sin(uTime*${type === 1 ? "10.5" : "6.8"}+aPhase);}
float limbAngle(){
  float angle=0.;
  if(limb>.5&&limb<2.5)angle=gait()*(limb<1.5?.48:-.48);
  if(limb>2.5)angle=gait()*(limb<3.5?-.19:.19);
  if(aAttack>.5){
    if(limb>.5&&limb<2.5)angle*=.12;
    if(limb>2.5)angle=-.9+sin(uTime*7.+aPhase+(limb<3.5?0.:1.4))*.65;
  }
  return angle;
}
vec3 rotateLimb(vec3 v){float a=limbAngle();return vec3(v.x,v.y*cos(a)-v.z*sin(a),v.y*sin(a)+v.z*cos(a));}`,
      )
      .replace(
        "#include <beginnormal_vertex>",
        "#include <beginnormal_vertex>\nobjectNormal=rotateLimb(objectNormal);",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
transformed=pivot+rotateLimb(transformed-pivot);
transformed.y+=abs(gait())*.035;transformed.z+=aAttack*max(0.,gait())*.08;vHit=aHit;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vHit;uniform float uRetro;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(1.,.86,.55),vec3(1.,.96,.75),uRetro),vHit*mix(.8,.9,uRetro));`,
      );
  };
  return { material, time, retro };
}

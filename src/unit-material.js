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
  material.customProgramCacheKey = () => `zombie-gait-reaction-v3-${type}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.uniforms.uRetro = retro;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute float limb;attribute vec3 pivot;attribute float aPhase;attribute float aHit;attribute float aAttack;attribute float aElement;attribute float aShock;
uniform float uTime;varying float vHit;varying float vElement;varying float vShock;
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
transformed.y+=abs(gait())*.035+aHit*.045;transformed.z-=aHit*.11;transformed.x+=sin(uTime*58.+aPhase)*aShock*.018;transformed.z+=aAttack*max(0.,gait())*.08;vHit=aHit;vElement=aElement;vShock=aShock;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vHit;varying float vElement;varying float vShock;uniform float uRetro;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
vec3 flash=vElement>.5&&vElement<1.5?vec3(.4,.94,1.):vec3(1.,.93,.68);
diffuseColor.rgb=mix(diffuseColor.rgb,flash,vHit*.9);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.75,1.),vShock*.14);`,
      );
  };
  return { material, time, retro };
}

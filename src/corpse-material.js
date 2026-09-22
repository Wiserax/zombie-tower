import * as T from "three";
// Ordered dissolve preserves opaque depth and avoids sorting hundreds of bodies.
export function corpseMaterial() {
  const m = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    color: 0xaaa899,
  });
  m.customProgramCacheKey = () => "fallen-body-dissolve-v1";
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float aFade;varying float vFade;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvFade=aFade;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vFade;")
      .replace(
        "#include <clipping_planes_fragment>",
        "#include <clipping_planes_fragment>\nfloat noise=fract(sin(dot(floor(gl_FragCoord.xy/1.5),vec2(12.9898,78.233)))*43758.5453);if(noise>vFade)discard;",
      );
  };
  return m;
}

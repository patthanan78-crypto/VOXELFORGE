import * as THREE from 'three';

export type ShaderPackId =
  | 'vanilla'
  | 'complementary'
  | 'solstice'
  | 'luminous'
  | 'retro_crt';

export interface ShaderPackDefinition {
  id: ShaderPackId;
  name: string;
  tagline: string;
  windStrength: number;
  waterWaveStrength: number;
  waterFresnelTint: number;
  emissiveBoost: number;
  sunWarmth: number;
  shadowContrast: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  saturation: number;
  contrast: number;
  vignette: number;
  scanlines: number;
  auroraStrength: number;
  exposure: number;
}

export const SHADER_PACKS: ShaderPackDefinition[] = [
  {
    id: 'complementary',
    name: 'Complementary Warm',
    tagline: 'Wind-swaying foliage, rippled reflective water & warm sunlight',
    windStrength: 1.0,
    waterWaveStrength: 1.0,
    waterFresnelTint: 0.42,
    emissiveBoost: 1.35,
    sunWarmth: 0.14,
    shadowContrast: 0.18,
    bloomStrength: 0.28,
    bloomRadius: 0.45,
    bloomThreshold: 0.82,
    saturation: 1.12,
    contrast: 1.04,
    vignette: 0.14,
    scanlines: 0.0,
    auroraStrength: 0.25,
    exposure: 1.08,
  },
  {
    id: 'solstice',
    name: 'Solstice Atmospheric',
    tagline: 'High-contrast golden rays, deep twilight shadows & crisp water',
    windStrength: 1.25,
    waterWaveStrength: 1.2,
    waterFresnelTint: 0.58,
    emissiveBoost: 1.5,
    sunWarmth: 0.22,
    shadowContrast: 0.3,
    bloomStrength: 0.36,
    bloomRadius: 0.55,
    bloomThreshold: 0.78,
    saturation: 1.18,
    contrast: 1.1,
    vignette: 0.26,
    scanlines: 0.0,
    auroraStrength: 0.35,
    exposure: 1.1,
  },
  {
    id: 'luminous',
    name: 'Luminous Aurora',
    tagline: 'Vibrant night auroras, glowing torches/ores & jewel water sheen',
    windStrength: 0.9,
    waterWaveStrength: 0.95,
    waterFresnelTint: 0.5,
    emissiveBoost: 2.25,
    sunWarmth: 0.08,
    shadowContrast: 0.24,
    bloomStrength: 0.46,
    bloomRadius: 0.62,
    bloomThreshold: 0.72,
    saturation: 1.22,
    contrast: 1.06,
    vignette: 0.2,
    scanlines: 0.0,
    auroraStrength: 1.0,
    exposure: 1.06,
  },
  {
    id: 'retro_crt',
    name: 'Nostalgic Retro',
    tagline: 'Analog color film warmth with crisp scanline frame finish',
    windStrength: 0.35,
    waterWaveStrength: 0.5,
    waterFresnelTint: 0.25,
    emissiveBoost: 1.1,
    sunWarmth: 0.18,
    shadowContrast: 0.2,
    bloomStrength: 0.22,
    bloomRadius: 0.35,
    bloomThreshold: 0.84,
    saturation: 0.94,
    contrast: 1.14,
    vignette: 0.34,
    scanlines: 0.16,
    auroraStrength: 0.0,
    exposure: 1.04,
  },
  {
    id: 'vanilla',
    name: 'Vanilla Classic',
    tagline: 'Original crisp block lighting with dynamic day/night skybox',
    windStrength: 0.0,
    waterWaveStrength: 0.0,
    waterFresnelTint: 0.08,
    emissiveBoost: 0.4,
    sunWarmth: 0.0,
    shadowContrast: 0.0,
    bloomStrength: 0.0,
    bloomRadius: 0.0,
    bloomThreshold: 1.0,
    saturation: 1.0,
    contrast: 1.0,
    vignette: 0.0,
    scanlines: 0.0,
    auroraStrength: 0.0,
    exposure: 1.02,
  },
];

export function getShaderPack(id: ShaderPackId | undefined): ShaderPackDefinition {
  return SHADER_PACKS.find((p) => p.id === id) ?? SHADER_PACKS[0];
}

export interface SharedShaderUniforms {
  uTime: { value: number };
  uWindStrength: { value: number };
  uWaterWaveStrength: { value: number };
  uWaterFresnelTint: { value: number };
  uEmissiveBoost: { value: number };
  uSunWarmth: { value: number };
  uNightFactor: { value: number };
  uSkyHorizonColor: { value: THREE.Color };
  uSunColor: { value: THREE.Color };
}

export function createSharedShaderUniforms(): SharedShaderUniforms {
  return {
    uTime: { value: 0 },
    uWindStrength: { value: 1.0 },
    uWaterWaveStrength: { value: 1.0 },
    uWaterFresnelTint: { value: 0.42 },
    uEmissiveBoost: { value: 1.35 },
    uSunWarmth: { value: 0.14 },
    uNightFactor: { value: 0.0 },
    uSkyHorizonColor: { value: new THREE.Color('#98ceff') },
    uSunColor: { value: new THREE.Color('#fff5e0') },
  };
}

export function attachTerrainShader(
  material: THREE.MeshStandardMaterial,
  shared: SharedShaderUniforms,
): void {
  material.customProgramCacheKey = () => 'voxelforge-terrain-v1';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uWindStrength = shared.uWindStrength;
    shader.uniforms.uEmissiveBoost = shared.uEmissiveBoost;
    shader.uniforms.uSunWarmth = shared.uSunWarmth;
    shader.uniforms.uNightFactor = shared.uNightFactor;

    shader.vertexShader =
      `
attribute vec2 aBlockFlags;
uniform float uTime;
uniform float uWindStrength;
varying float vEmissiveFlag;
` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
#include <begin_vertex>
vEmissiveFlag = aBlockFlags.y;
if (aBlockFlags.x > 0.01 && uWindStrength > 0.01) {
  vec4 wp = modelMatrix * vec4(transformed, 1.0);
  float gust = sin(uTime * 1.9 + wp.x * 0.65 + wp.z * 0.55) * 0.055;
  float flutter = cos(uTime * 3.1 + wp.y * 1.4 + wp.z * 0.9) * 0.025;
  transformed.x += (gust + flutter) * aBlockFlags.x * uWindStrength;
  transformed.z += (gust * 0.6 - flutter) * aBlockFlags.x * uWindStrength;
}
`,
      );

    shader.fragmentShader =
      `
uniform float uEmissiveBoost;
uniform float uSunWarmth;
uniform float uNightFactor;
varying float vEmissiveFlag;
` +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `
#include <color_fragment>
if (uSunWarmth > 0.001) {
  float warmBlend = uSunWarmth * (1.0 - uNightFactor * 0.75);
  diffuseColor.rgb = mix(
    diffuseColor.rgb,
    diffuseColor.rgb * vec3(1.06, 1.01, 0.93),
    clamp(warmBlend * 2.4, 0.0, 0.65)
  );
}
`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `
#include <emissivemap_fragment>
if (vEmissiveFlag > 0.01) {
  float nightBoost = 0.65 + 0.95 * uNightFactor;
  totalEmissiveRadiance += diffuseColor.rgb * vEmissiveFlag * uEmissiveBoost * nightBoost;
}
`,
        );
  };
}

export function attachWaterShader(
  material: THREE.MeshStandardMaterial,
  shared: SharedShaderUniforms,
): void {
  material.customProgramCacheKey = () => 'voxelforge-water-v1';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uWaterWaveStrength = shared.uWaterWaveStrength;
    shader.uniforms.uWaterFresnelTint = shared.uWaterFresnelTint;
    shader.uniforms.uNightFactor = shared.uNightFactor;
    shader.uniforms.uSkyHorizonColor = shared.uSkyHorizonColor;
    shader.uniforms.uSunColor = shared.uSunColor;

    shader.vertexShader =
      `
uniform float uTime;
uniform float uWaterWaveStrength;
varying vec3 vWaterWorldPos;
varying float vWaveCrest;
` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
#include <begin_vertex>
vec4 waterWp = modelMatrix * vec4(transformed, 1.0);
float waveA = sin(waterWp.x * 1.35 + uTime * 2.2) * cos(waterWp.z * 1.15 + uTime * 1.7);
float waveB = sin((waterWp.x + waterWp.z) * 2.1 - uTime * 2.8);
float waveH = (waveA * 0.045 + waveB * 0.025) * uWaterWaveStrength;
transformed.y += waveH;
vWaterWorldPos = waterWp.xyz;
vWaveCrest = waveA * 0.5 + waveB * 0.5;
`,
      );

    shader.fragmentShader =
      `
uniform float uTime;
uniform float uWaterWaveStrength;
uniform float uWaterFresnelTint;
uniform float uNightFactor;
uniform vec3 uSkyHorizonColor;
uniform vec3 uSunColor;
varying vec3 vWaterWorldPos;
varying float vWaveCrest;
` +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `
#include <color_fragment>
if (uWaterWaveStrength > 0.01) {
  float ripple = sin(vWaterWorldPos.x * 4.5 + uTime * 2.6) * sin(vWaterWorldPos.z * 4.5 - uTime * 2.1);
  float caustic = smoothstep(0.45, 0.95, ripple * 0.5 + 0.5) * 0.14 * uWaterWaveStrength;
  diffuseColor.rgb += vec3(caustic * 0.7, caustic * 0.9, caustic);
}
`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `
#include <emissivemap_fragment>
if (uWaterFresnelTint > 0.001) {
  vec3 viewDirW = normalize(cameraPosition - vWaterWorldPos);
  float fresnel = pow(1.0 - max(0.0, abs(viewDirW.y)), 3.0);
  float sparkle = smoothstep(0.65, 1.0, vWaveCrest) * (1.0 - uNightFactor * 0.6) * 0.18;
  totalEmissiveRadiance += uSkyHorizonColor * fresnel * uWaterFresnelTint * 0.65;
  totalEmissiveRadiance += uSunColor * sparkle * uWaterFresnelTint;
}
`,
        );
  };
}

export function createDynamicSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenithColor: { value: new THREE.Color('#6bb8ff') },
      uHorizonColor: { value: new THREE.Color('#98ceff') },
      uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
      uSunGlowColor: { value: new THREE.Color('#ffcf86') },
      uSunGlowIntensity: { value: 0.45 },
      uStarVisibility: { value: 0.0 },
      uAuroraStrength: { value: 0.0 },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uZenithColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunGlowColor;
      uniform float uSunGlowIntensity;
      uniform float uStarVisibility;
      uniform float uAuroraStrength;
      uniform float uTime;

      varying vec3 vWorldDir;

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y, 0.0, 1.0);
        float horizonBlend = pow(1.0 - h, 2.2);
        vec3 sky = mix(uZenithColor, uHorizonColor, horizonBlend);

        // Solar atmospheric scattering halo near horizon & sun direction
        float sunDot = max(0.0, dot(dir, normalize(uSunDir)));
        float sunHalo = pow(sunDot, 5.0) * 0.55 + pow(sunDot, 36.0) * 0.45;
        sky += uSunGlowColor * sunHalo * uSunGlowIntensity;

        // Crisp procedural night starfield
        if (uStarVisibility > 0.01 && dir.y > 0.02) {
          vec3 grid = floor(dir * 190.0);
          float starSeed = hash31(grid);
          if (starSeed > 0.992) {
            float twinkle = 0.65 + 0.35 * sin(uTime * 2.4 + starSeed * 628.0);
            float elevMask = smoothstep(0.02, 0.28, dir.y);
            float brightness = (starSeed - 0.992) / 0.008;
            sky += vec3(0.82, 0.9, 1.0) * brightness * twinkle * elevMask * uStarVisibility * 1.15;
          }
        }

        // Subtle animated night aurora ribbons when enabled by shader pack
        if (uStarVisibility > 0.15 && uAuroraStrength > 0.01 && dir.y > 0.08) {
          float wave1 = sin(dir.x * 6.0 + uTime * 0.18 + sin(dir.z * 4.0) * 1.5);
          float wave2 = cos(dir.z * 5.0 - uTime * 0.14);
          float band = smoothstep(0.15, 0.85, wave1 * 0.5 + 0.5) * smoothstep(0.0, 0.55, wave2 * 0.5 + 0.5);
          float heightFade = smoothstep(0.08, 0.35, dir.y) * (1.0 - smoothstep(0.45, 0.85, dir.y));
          vec3 auroraCol = mix(vec3(0.16, 0.85, 0.62), vec3(0.28, 0.58, 0.98), dir.x * 0.5 + 0.5);
          sky += auroraCol * band * heightFade * uStarVisibility * uAuroraStrength * 0.36;
        }

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });
}

export const AtmosphereGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSaturation: { value: 1.1 },
    uContrast: { value: 1.04 },
    uVignette: { value: 0.14 },
    uWarmth: { value: 0.1 },
    uScanlines: { value: 0.0 },
    uNightFactor: { value: 0.0 },
    uResolution: { value: new THREE.Vector2(1280, 720) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uVignette;
    uniform float uWarmth;
    uniform float uScanlines;
    uniform float uNightFactor;
    uniform vec2 uResolution;
    varying vec2 vUv;

    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 col = tex.rgb;

      // Contrast around mid-gray
      col = (col - 0.5) * uContrast + 0.5;

      // Saturation adjustment
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(luma), col, uSaturation);

      // Subtle warm/cool atmospheric tint
      vec3 warmMul = vec3(1.0 + uWarmth * 0.18, 1.0 + uWarmth * 0.04, 1.0 - uWarmth * 0.14);
      vec3 nightMul = vec3(0.92, 0.96, 1.08);
      col *= mix(warmMul, nightMul, uNightFactor * 0.65);

      // Optional subtle retro scanlines
      if (uScanlines > 0.001) {
        float line = sin(vUv.y * uResolution.y * 1.15);
        col *= 1.0 - (line * 0.5 + 0.5) * uScanlines;
      }

      // Soft edge vignette
      if (uVignette > 0.001) {
        vec2 distVec = vUv - 0.5;
        float dist = dot(distVec, distVec) * 2.2;
        col *= 1.0 - clamp(dist * uVignette, 0.0, 0.55);
      }

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), tex.a);
    }
  `,
};

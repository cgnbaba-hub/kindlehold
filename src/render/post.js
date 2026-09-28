// Post-processing: the scene renders into a multisampled HDR target, then one final pass does
// tone mapping, a soft miniature focus (tilt-shift), colour grading, vignette and dithering.
// Bloom (quarter resolution) lets lanterns, windows and fires glow at night. Ambient occlusion
// (High): a half-resolution SAO pass from the depth buffer alone — soft contact shadows in corners,
// under eaves, between trees — without drawing the scene a second time.
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/** Debug switches from the address bar: ?gfx=noibl,noclouds,noao,nobloom,notilt (comparisons). */
export function gfxFlags() {
  try { return new Set((new URLSearchParams(location.search).get('gfx') || '').split(',').filter(Boolean)); } catch { return new Set(); }
}

const FINAL_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// scalable ambient obscurance from depth only (normals from depth derivatives)
const AO_FRAG = `
uniform sampler2D tDepth; uniform mat4 uInvProj; uniform vec2 uProjScale; uniform float uRadius; uniform float uIntensity; uniform vec2 uDepthTexel;
varying vec2 vUv;
vec3 viewPos(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return v.xyz / v.w;
}
void main() {
  // work at depth texel centres (this pass runs at half resolution)
  vec2 uv = (floor(vUv / uDepthTexel) + 0.5) * uDepthTexel;
  float d = texture2D(tDepth, uv).x;
  if (d >= 0.99999) { gl_FragColor = vec4(1.0); return; }
  vec3 p = viewPos(uv);
  // normal from the neighbouring depths, taking the smoother side at each edge
  vec3 nr = viewPos(uv + vec2(uDepthTexel.x, 0.0)) - p, nl = p - viewPos(uv - vec2(uDepthTexel.x, 0.0));
  vec3 nt = viewPos(uv + vec2(0.0, uDepthTexel.y)) - p, nb = p - viewPos(uv - vec2(0.0, uDepthTexel.y));
  vec3 n = normalize(cross(abs(nr.z) < abs(nl.z) ? nr : nl, abs(nt.z) < abs(nb.z) ? nt : nb));
  vec2 rUV = uRadius * uProjScale / max(0.5, -p.z);
  float ang = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831853;
  float occ = 0.0;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float a = ang + fi * 2.39996;
    float r = (fi + 0.5) / 12.0;
    vec3 v = viewPos(uv + vec2(cos(a), sin(a)) * r * rUV) - p;
    float vv = dot(v, v);
    float falloff = 1.0 - smoothstep(0.0, uRadius * uRadius, vv);
    occ += max(0.0, dot(v, n) * inversesqrt(vv + 1e-4) - 0.15) * falloff;
  }
  float ao = clamp(1.0 - uIntensity * occ / 12.0, 0.0, 1.0);
  gl_FragColor = vec4(vec3(max(0.25, ao * ao)), 1.0);
}`;

const FINAL_FRAG = `
uniform sampler2D tScene; uniform vec2 uTexel; uniform sampler2D tAO; uniform vec2 uAOTexel; uniform float uAO; uniform float uExposure;
uniform float uTilt; uniform float uFocus; uniform float uVignette; uniform float uSat; uniform float uContrast;
uniform vec3 uShadowTint; uniform vec3 uHighTint; uniform float uTime;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  // miniature focus: the band around the view centre is sharp, top and bottom soften
  float blur = uTilt * smoothstep(0.2, 0.55, abs(vUv.y - uFocus));
  if (blur > 0.05) {
    vec3 acc = c; float n = 1.0;
    for (int i = 0; i < 12; i++) {
      float a = float(i) * 2.39996;
      float r = sqrt((float(i) + 0.5) / 12.0) * blur;
      acc += texture2D(tScene, vUv + vec2(cos(a), sin(a)) * r * uTexel).rgb; n += 1.0;
    }
    c = acc / n;
  }
  if (uAO > 0.0) {
    // half-resolution occlusion, softened with a small cross while upsampling
    float ao = texture2D(tAO, vUv).r * 0.4
      + (texture2D(tAO, vUv + vec2(uAOTexel.x, 0.0)).r + texture2D(tAO, vUv - vec2(uAOTexel.x, 0.0)).r
      + texture2D(tAO, vUv + vec2(0.0, uAOTexel.y)).r + texture2D(tAO, vUv - vec2(0.0, uAOTexel.y)).r) * 0.15;
    c *= mix(1.0, ao, uAO);
    if (uAO > 1.5) c = vec3(ao);
  }
  gl_FragColor = vec4(c * uExposure, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  vec3 g = gl_FragColor.rgb;
  // grading in display space: a little more colour and contrast, warm lights, cool shadows
  float l = dot(g, vec3(0.2126, 0.7152, 0.0722));
  g = mix(vec3(l), g, uSat);
  g = (g - 0.5) * uContrast + 0.5;
  g *= mix(uShadowTint, uHighTint, smoothstep(0.08, 0.85, l));
  vec2 d = vUv - 0.5;
  g *= 1.0 - dot(d, d) * uVignette;
  // dithering against banding in the sky and the fog
  g += (fract(sin(dot(gl_FragCoord.xy + uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(g, 0.0, 1.0), 1.0);
}`;

/**
 * @param {{ renderer: THREE.WebGLRenderer, scene: THREE.Scene, getCamera: () => THREE.Camera, cfg: { samples: number, bloom: boolean, tilt: boolean, ao: boolean } }} o
 */
export function createPost({ renderer, scene, getCamera, cfg }) {
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: cfg.samples || 0, depthBuffer: true });
  target.texture.name = 'kh-post-scene';
  // ambient occlusion reads the (resolved) depth of the scene buffer at half resolution
  let aoTarget = null, aoMat = null, aoScene = null;
  if (cfg.ao) {
    target.depthTexture = new THREE.DepthTexture(size.x, size.y, THREE.FloatType); // 32-bit: no banding on the flat ground
    aoTarget = new THREE.WebGLRenderTarget(Math.ceil(size.x / 2), Math.ceil(size.y / 2), { depthBuffer: false });
    aoTarget.texture.name = 'kh-post-ao';
    aoMat = new THREE.ShaderMaterial({
      uniforms: { tDepth: { value: target.depthTexture }, uInvProj: { value: new THREE.Matrix4() }, uProjScale: { value: new THREE.Vector2() }, uRadius: { value: 2.4 }, uIntensity: { value: 2.0 }, uDepthTexel: { value: new THREE.Vector2(1 / size.x, 1 / size.y) } },
      vertexShader: FINAL_VERT, fragmentShader: AO_FRAG, depthTest: false, depthWrite: false,
    });
    const aoQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), aoMat);
    aoQuad.frustumCulled = false;
    aoScene = new THREE.Scene();
    aoScene.add(aoQuad);
  }
  const bloom = cfg.bloom ? new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.35, 0.5, 0.92) : null;

  const uniforms = {
    tScene: { value: target.texture },
    uTexel: { value: new THREE.Vector2(1 / size.x, 1 / size.y) },
    uTilt: { value: 0 }, uFocus: { value: 0.5 },
    uVignette: { value: 0.55 }, uSat: { value: 1.2 }, uContrast: { value: 1.08 },
    uShadowTint: { value: new THREE.Color(0.97, 0.985, 1.03) }, uHighTint: { value: new THREE.Color(1.03, 1.0, 0.96) },
    uTime: { value: 0 }, uExposure: { value: 1.1 }, // occlusion and grading darken a little: give it back
    tAO: { value: aoTarget ? aoTarget.texture : null }, uAOTexel: { value: new THREE.Vector2(2 / size.x, 2 / size.y) }, uAO: { value: aoTarget ? (typeof location !== 'undefined' && /[?&]post=ao\b/.test(location.search) ? 2 : 1) : 0 },
  };
  const finalMat = new THREE.ShaderMaterial({ uniforms, vertexShader: FINAL_VERT, fragmentShader: FINAL_FRAG, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), finalMat);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let tiltWanted = cfg.tilt ? 1 : 0;
  return {
    target,
    setSize() {
      renderer.getDrawingBufferSize(size);
      target.setSize(size.x, size.y);
      uniforms.uTexel.value.set(1 / size.x, 1 / size.y);
      if (bloom) bloom.setSize(size.x / 2, size.y / 2);
      if (aoTarget) { aoTarget.setSize(Math.ceil(size.x / 2), Math.ceil(size.y / 2)); uniforms.uAOTexel.value.set(2 / size.x, 2 / size.y); aoMat.uniforms.uDepthTexel.value.set(1 / size.x, 1 / size.y); }
    },
    /** Per frame look: night makes lights bloom harder; closer zoom focuses harder. */
    setLook({ night = 0, zoom = 60, tilt = true } = {}) {
      tiltWanted = cfg.tilt && tilt ? 1 : 0;
      // strong at close range (the diorama look), gone in the wide overview
      uniforms.uTilt.value = tiltWanted * THREE.MathUtils.clamp((110 - zoom) / 70, 0, 1) * 3.5;
      if (bloom) { bloom.strength = 0.08 + night * 0.7; bloom.threshold = 1.1 - night * 0.4; }
      uniforms.uVignette.value = 0.5 + night * 0.25;
    },
    render() {
      const camera = getCamera();
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      if (aoTarget) {
        const u = aoMat.uniforms;
        u.uInvProj.value.copy(camera.projectionMatrixInverse);
        u.uProjScale.value.set(camera.projectionMatrix.elements[0] * 0.5, camera.projectionMatrix.elements[5] * 0.5);
        renderer.setRenderTarget(aoTarget);
        renderer.render(aoScene, quadCam);
      }
      if (bloom) bloom.render(renderer, null, target, 0, false);
      uniforms.uTime.value = (uniforms.uTime.value + 1.618) % 97;
      renderer.setRenderTarget(null);
      renderer.render(quadScene, quadCam);
    },
    dispose() {
      target.dispose();
      if (target.depthTexture) target.depthTexture.dispose();
      if (aoTarget) { aoTarget.dispose(); aoMat.dispose(); }
      if (bloom) bloom.dispose();
      finalMat.dispose(); quad.geometry.dispose();
    },
  };
}

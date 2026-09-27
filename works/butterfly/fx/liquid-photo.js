// «Живое фото» — фотография течёт за курсором, как вода.
// Курсор оставляет след в маленькой «карте течения» (два буфера по очереди), фото сдвигается по этой карте.
import * as THREE from 'three';
import { loop, watchSize, pointer, unsplash, damp } from './core.js';
import { makeRenderer, texture, release } from './gl.js';

const QUAD_VS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export function mount(stage, opts = {}) {
  const url = opts.photo || unsplash('photo-1517931465348-90458682a9a6', 2000);
  const renderer = makeRenderer(stage, { antialias: false });
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.PlaneGeometry(2, 2);

  // карта течения: xy — направление, z — сила следа
  const SIZE = 128;
  const rtOpts = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  let rtA = new THREE.WebGLRenderTarget(SIZE, SIZE, rtOpts);
  let rtB = new THREE.WebGLRenderTarget(SIZE, SIZE, rtOpts);
  const flowMat = new THREE.ShaderMaterial({
    uniforms: {
      tMap: { value: rtA.texture }, uMouse: { value: new THREE.Vector2(-1, -1) }, uVel: { value: new THREE.Vector2() },
      uAspect: { value: 1 }, uFalloff: { value: 0.22 }, uAlpha: { value: 1 }, uFade: { value: 0.965 },
    },
    vertexShader: QUAD_VS,
    fragmentShader: /* glsl */`
      uniform sampler2D tMap; uniform vec2 uMouse; uniform vec2 uVel; uniform float uAspect, uFalloff, uAlpha, uFade;
      varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tMap, vUv) * uFade;
        vec2 d = vUv - uMouse; d.x *= uAspect;
        vec3 stamp = vec3(uVel, 1.0 - pow(1.0 - min(1.0, length(uVel)), 3.0));
        float f = smoothstep(uFalloff, 0.0, length(d)) * uAlpha;
        c.rgb = mix(c.rgb, stamp, vec3(f));
        gl_FragColor = c;
      }`,
  });
  const flowScene = new THREE.Scene();
  flowScene.add(new THREE.Mesh(quad, flowMat));

  const img = texture(url, (t) => { imgAspect = t.image.width / t.image.height; fit(); });
  let imgAspect = 1.5, W = 1, H = 1;
  const showMat = new THREE.ShaderMaterial({
    uniforms: { tImage: { value: img }, tFlow: { value: rtB.texture }, uCover: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 } },
    vertexShader: QUAD_VS,
    fragmentShader: /* glsl */`
      uniform sampler2D tImage; uniform sampler2D tFlow; uniform vec2 uCover; uniform float uTime;
      varying vec2 vUv;
      void main(){
        vec3 flow = texture2D(tFlow, vUv).rgb;
        float zoom = 1.0 - 0.025 * (0.5 + 0.5 * sin(uTime * 0.25));      // фото медленно «дышит»
        vec2 uv = (vUv - 0.5) * uCover * zoom + 0.5;
        vec2 off = flow.xy * flow.z * 0.12;
        vec3 col;
        col.r = texture2D(tImage, uv - off * 1.25).r;                    // края расходятся на цвета
        col.g = texture2D(tImage, uv - off).g;
        col.b = texture2D(tImage, uv - off * 0.75).b;
        col *= 1.0 + flow.z * 0.12;                                      // след чуть светлее
        float vig = smoothstep(1.25, 0.35, length(vUv - 0.5) * 1.6);
        gl_FragColor = vec4(col * mix(0.55, 1.0, vig), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const showScene = new THREE.Scene();
  showScene.add(new THREE.Mesh(quad, showMat));

  function fit() {
    const a = W / H;
    showMat.uniforms.uCover.value.set(a > imgAspect ? 1 : a / imgAspect, a > imgAspect ? imgAspect / a : 1);
    flowMat.uniforms.uAspect.value = a;
  }
  const unwatch = watchSize(stage, (w, h) => { W = w; H = h; renderer.setSize(w, h, false); fit(); });

  const ptr = pointer(stage);
  const last = new THREE.Vector2(0.5, 0.5), vel = new THREE.Vector2();
  let idleT = 0;
  const lp = loop((t, dt) => {
    showMat.uniforms.uTime.value = t;
    // без курсора след рисует мягкая «ладонь» по восьмёрке
    const idle = !ptr.active || performance.now() - ptr.moved > 1800;
    if (idle) idleT += dt;
    const u = idle ? 0.5 + Math.sin(idleT * 1.1) * 0.32 : ptr.u;
    const v = idle ? 0.5 + Math.sin(idleT * 2.2) * 0.2 : ptr.v;
    if (dt > 0) {
      const k = idle ? 0.55 : 0.12;               // медленной «ладони» — усиление, чтобы след был виден
      const vx = (u - last.x) / dt * k, vy = (v - last.y) / dt * k;
      vel.set(damp(vel.x, vx, 12, dt), damp(vel.y, vy, 12, dt));
    }
    last.set(u, v);
    flowMat.uniforms.uMouse.value.set(u, v);
    flowMat.uniforms.uVel.value.copy(vel).clampLength(0, 1);
    flowMat.uniforms.tMap.value = rtA.texture;
    renderer.setRenderTarget(rtB);
    renderer.render(flowScene, cam);
    renderer.setRenderTarget(null);
    showMat.uniforms.tFlow.value = rtB.texture;
    renderer.render(showScene, cam);
    [rtA, rtB] = [rtB, rtA];
  });

  return {
    start: lp.start, stop: lp.stop,
    destroy() {
      lp.stop(); unwatch(); rtA.dispose(); rtB.dispose(); img.dispose(); flowMat.dispose(); showMat.dispose();
      release(renderer);
    },
  };
}

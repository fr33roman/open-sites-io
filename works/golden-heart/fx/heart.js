// «Золотое сердце» — объёмное сердце из золота для блока фирменного ритуала Golden Heart.
// Сделано на основе «Жидкого металла» с полки (№10): та же «студия» для отражений и тот же цикл кадров,
// только вместо капли — сердце, которое медленно покачивается, бьётся и поворачивается за пальцем.
import * as THREE from 'three';
import { loop, watchSize, pointer, damp, IS_MOBILE } from './core.js';
import { makeRenderer, release } from './gl.js';

/** «Студия» для отражений: тёплая комната, мягкий свет сверху и спереди, яркие полосы по бокам.
 *  В тёмной комнате золото выходит почти чёрным посередине — поэтому стены тёплые, а не зелёные */
function studio(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ color: 0x8a6f3c, side: THREE.BackSide })));
  const panel = (color, w, h, pos, rot, k = 1) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.rotation.set(...rot);
    env.add(m);
  };
  panel('#fff4d6', 16, 12, [0, 8, 2], [Math.PI / 2, 0, 0], 1.6);         // большой мягкий свет сверху
  panel('#ffffff', 10, 1.1, [0, 6.5, -2], [Math.PI / 2, 0, 0], 4);       // узкий блик
  panel('#ffe9b8', 14, 9, [0, 1, 9.5], [0, 0, 0], 1.05);                 // мягкий свет со стороны зрителя
  panel('#ffffff', 1.6, 9, [-8, 1, 2], [0, Math.PI / 2, 0], 3.4);        // яркая полоса слева
  panel('#fff3d0', 1.3, 9, [8, 0, -1], [0, -Math.PI / 2, 0], 2.8);       // светлая справа
  panel('#123524', 18, 14, [0, -7, 2], [Math.PI / 2, 0, 0], 1);          // тёмно-зелёный пол — цвет студии, даёт глубину снизу
  panel('#2a1f0c', 3.2, 9, [-3.6, 0, 9.4], [0, 0, 0], 1);                // тёмные «шторки» спереди: без них блик плоский
  panel('#2a1f0c', 3.2, 9, [3.6, 0, 9.4], [0, 0, 0], 1);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.03).texture;
  pm.dispose();
  return tex;
}

/** Сердце: классическая кривая в сечении, спереди и сзади — купол (как у линзы), поэтому оно пухлое и без швов */
function heartGeometry(U, V, depth) {
  const pos = [], idx = [];
  for (let j = 0; j <= V; j++) {
    const v = (j / V) * Math.PI, sv = Math.sin(v), z = Math.cos(v) * depth;
    for (let i = 0; i <= U; i++) {
      const u = (i / U) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(u), 3);
      const hy = 13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u) + 2.4;
      pos.push((hx / 16) * sv, (hy / 16) * sv, z);
    }
  }
  const row = U + 1;
  for (let j = 0; j < V; j++) {
    for (let i = 0; i < U; i++) {
      const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function mount(stage, opts = {}) {
  const renderer = makeRenderer(stage, { alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  const scene = new THREE.Scene();
  scene.environment = studio(renderer);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 6.4);

  const geo = heartGeometry(IS_MOBILE ? 96 : 144, IS_MOBILE ? 40 : 56, 0.5);
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(opts.gold || '#e2bd62'), metalness: 1, roughness: 0.2, clearcoat: 0.7, clearcoatRoughness: 0.18,
    side: THREE.DoubleSide,
  });
  const heart = new THREE.Mesh(geo, mat);
  const rig = new THREE.Group();
  rig.add(heart);
  scene.add(rig);

  const ptr = pointer(stage);
  const unwatch = watchSize(stage, (w, h) => {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  // удар сердца: два толчка подряд и пауза
  const pulse = (x, w) => Math.exp(-(x * x) / (w * w));
  let rx = 0, ry = 0;
  const lp = loop((t, dt) => {
    const k = dt || 0.016;
    const ph = t % 2.6;
    const beat = 0.055 * pulse(ph - 0.18, 0.085) + 0.038 * pulse(ph - 0.5, 0.1);
    heart.scale.setScalar(1.42 * (1 + beat));
    rig.position.y = Math.sin(t * 0.8) * 0.05 + 0.02;
    const tx = ptr.active ? -ptr.y * 0.35 : Math.sin(t * 0.45) * 0.08;
    const ty = ptr.active ? ptr.x * 0.75 : Math.sin(t * 0.33) * 0.62;
    rx = damp(rx, tx, 4, k);
    ry = damp(ry, ty, 4, k);
    rig.rotation.set(rx, ry, Math.sin(t * 0.5) * 0.035);
    renderer.render(scene, camera);
  });

  return {
    start: lp.start, stop: lp.stop,
    destroy() { lp.stop(); unwatch(); geo.dispose(); mat.dispose(); scene.environment.dispose(); release(renderer); },
  };
}

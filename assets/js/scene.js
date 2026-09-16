// Scroll-driven 3D stacking door: charcoal aluminium frames, real glass, opens as you scroll.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const section = document.querySelector('[data-system]');
const canvas = section?.querySelector('canvas');
const steps = [...section.querySelectorAll('[data-steps] li')];
const bar = section.querySelector('[data-bar]');
const hint = section.querySelector('.system__hint');

const small = matchMedia('(max-width: 760px)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  section.classList.add('no-webgl');
}

if (renderer) init();

function init() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !small;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0e0e0f, 16, 36);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(small ? 42 : 30, 1, 0.1, 60);

  /* ---------- Materials ---------- */
  const alu = new THREE.MeshStandardMaterial({ color: 0x2b2e33, metalness: 0.85, roughness: 0.38 });
  const plaster = new THREE.MeshStandardMaterial({ color: 0xb9b5ae, roughness: 0.95 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.85 });
  const roomMat = new THREE.MeshStandardMaterial({ color: 0x4a423b, roughness: 1 });
  const orange = new THREE.MeshBasicMaterial({ color: 0xec621f, toneMapped: false });
  // Plain transparent glass: transmission glass flickers when panes stack behind each other
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xd6e6ea, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.2,
    envMapIntensity: 1.5, depthWrite: false, side: THREE.DoubleSide
  });

  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    return m;
  };

  /* ---------- Opening dimensions ---------- */
  const W = 4.4, H = 2.4, P = 4;       // opening width, height, panel count
  const t = 0.06;                      // profile face width
  const pw = W / P + t;                // panel width with overlap
  const house = new THREE.Group();
  scene.add(house);

  // Wall with the opening cut out
  const wallD = 0.24, wallW = 6.6, wallH = 3.5;
  house.add(box((wallW - W) / 2, wallH, wallD, plaster, -(W / 2 + (wallW - W) / 4), wallH / 2, 0));
  house.add(box((wallW - W) / 2, wallH, wallD, plaster, W / 2 + (wallW - W) / 4, wallH / 2, 0));
  house.add(box(W, wallH - H, wallD, plaster, 0, H + (wallH - H) / 2, 0));

  // Outer frame
  const fd = 0.16;
  house.add(box(W + t * 2, t, fd, alu, 0, H + t / 2, 0));
  house.add(box(W + t * 2, t * 0.6, fd, alu, 0, t * 0.3, 0));
  house.add(box(t, H, fd, alu, -W / 2 - t / 2, H / 2, 0));
  house.add(box(t, H, fd, alu, W / 2 + t / 2, H / 2, 0));

  // Panels: each on its own track
  const panels = [];
  for (let i = 0; i < P; i++) {
    const g = new THREE.Group();
    const ph = H - t * 0.6;
    g.add(box(pw, t, 0.04, alu, 0, ph - t / 2, 0));
    g.add(box(pw, t * 1.4, 0.04, alu, 0, t * 0.7, 0));
    g.add(box(t, ph, 0.04, alu, -pw / 2 + t / 2, ph / 2, 0));
    g.add(box(t, ph, 0.04, alu, pw / 2 - t / 2, ph / 2, 0));
    const pane = new THREE.Mesh(new THREE.BoxGeometry(pw - t * 2, ph - t * 2.4, 0.012), glass);
    pane.position.y = t * 1.4 + (ph - t * 2.4) / 2;
    pane.renderOrder = 1;
    g.add(pane);
    // slim handle on the lead panel
    if (i === P - 1) g.add(box(0.02, 0.36, 0.03, alu, -pw / 2 + t + 0.06, 1.05, 0.04));

    const closedX = -W / 2 + (W / P) * (i + 0.5);
    const openX = -W / 2 + pw / 2 + i * 0.1;
    const z = (i - (P - 1) / 2) * 0.065;
    g.position.set(closedX, t * 0.6, z);
    g.userData = { closedX, openX };
    house.add(g);
    panels.push(g);
  }

  // Brand roofline above the opening: long left rafter, short right one, like the logo
  const pitch = THREE.MathUtils.degToRad(38);
  const apex = new THREE.Vector3(0.8, H + 1.5, wallD / 2 + 0.08);
  const rafter = (len, dir) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.08), orange);
    m.rotation.z = dir * -pitch;
    m.position.set(apex.x + dir * Math.cos(pitch) * len / 2, apex.y - Math.sin(pitch) * len / 2, apex.z);
    return m;
  };
  house.add(rafter(2.3, -1), rafter(1.1, 1));

  // Floor fades into the section colour through the fog, so there is no visible edge
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // A warm room behind the opening, seen through the glass
  const room = new THREE.Group();
  const rw = wallW - 0.5, rh = wallH - 0.15, rd = 3.8;
  room.add(box(rw, rh, 0.1, roomMat, 0, rh / 2, -rd));
  room.add(box(0.1, rh, rd, roomMat, -rw / 2 + 0.05, rh / 2, -rd / 2));
  room.add(box(0.1, rh, rd, roomMat, rw / 2 - 0.05, rh / 2, -rd / 2));
  room.add(box(rw, 0.1, rd, roomMat, 0, rh, -rd / 2));
  scene.add(room);

  /* ---------- Lights ---------- */
  scene.add(new THREE.HemisphereLight(0xfff1e0, 0x111113, 0.35));
  const sun = new THREE.DirectionalLight(0xffe2c2, 2.4);
  sun.position.set(-6, 8, 7);
  sun.castShadow = !small;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -4, near: 1, far: 30 });
  scene.add(sun);
  const interior = new THREE.PointLight(0xffb36b, 28, 12, 1.6);
  interior.position.set(0.4, 2.2, -2.2);
  scene.add(interior);
  const glow = new THREE.PointLight(0xec621f, 4, 5, 2);
  glow.position.set(0.8, H + 1.2, 1);
  scene.add(glow);

  /* ---------- Sizing ---------- */
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  /* ---------- Animation ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const lerp = (a, b, k) => a + (b - a) * k;

  let target = 0, prog = 0, mx = 0, my = 0, active = false, activeStep = -1;

  const readScroll = () => {
    const r = section.getBoundingClientRect();
    target = clamp(-r.top / (r.height - innerHeight));
  };
  addEventListener('scroll', readScroll, { passive: true });
  readScroll();
  prog = target;

  if (matchMedia('(hover: hover)').matches) {
    section.addEventListener('pointermove', e => {
      mx = e.clientX / innerWidth - 0.5;
      my = e.clientY / innerHeight - 0.5;
    });
  }

  const lookAt = new THREE.Vector3();
  const clock = new THREE.Clock();

  const frame = () => {
    if (!active) return;
    requestAnimationFrame(frame);
    const time = clock.getElapsedTime();
    prog += (target - prog) * (reduced ? 1 : 0.08);

    // doors open across the middle of the scroll
    const open = ease(clamp((prog - 0.22) / 0.5));
    panels.forEach((g, i) => {
      const lag = clamp(open * 1.25 - (P - 1 - i) * 0.08);
      g.position.x = lerp(g.userData.closedX, g.userData.openX, ease(lag));
    });

    // camera: front three-quarter, glides round and steps inside
    const c = ease(prog);
    const dist = small ? 19 : 15;
    const angle = (small ? lerp(-0.35, 0.35, c) : lerp(-0.5, 0.5, c)) + mx * 0.1;
    const radius = lerp(dist, dist * 0.8, c);
    camera.position.set(
      Math.sin(angle) * radius,
      lerp(small ? 3 : 2.6, 1.8, c) - my * 0.3,
      Math.cos(angle) * radius
    );
    if (small) lookAt.set(-0.2, lerp(1.9, 1.8, c), 0);
    else lookAt.set(lerp(-2.6, -2.2, c), lerp(1.7, 1.5, c), 0);
    camera.lookAt(lookAt);

    glow.intensity = 3.5 + Math.sin(time * 1.6) * 0.8;

    bar.style.transform = `scaleX(${prog})`;
    if (hint) hint.style.opacity = prog > 0.05 ? 0 : 1;
    const s = Math.min(steps.length - 1, Math.floor(prog * steps.length * 0.999));
    if (s !== activeStep) {
      steps.forEach((li, i) => li.classList.toggle('is-active', i === s));
      activeStep = s;
    }

    renderer.render(scene, camera);
  };

  new IntersectionObserver(([e]) => {
    const was = active;
    active = e.isIntersecting;
    if (active && !was) {
      resize();
      frame();
    }
  }, { rootMargin: '200px 0px' }).observe(section);
}

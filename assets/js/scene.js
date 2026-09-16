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

  const camera = new THREE.PerspectiveCamera(small ? 42 : 30, 1, 0.5, 60);

  /* ---------- Textures ---------- */
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (file, color = false, repeat = 1) => {
    const t = loader.load(new URL(`../tex/${file}`, import.meta.url).href);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = maxAniso;
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  /* ---------- Materials ---------- */
  // Charcoal powder-coated aluminium with a fine orange-peel finish
  const alu = new THREE.MeshStandardMaterial({
    color: 0x2a2d31, metalness: 0.35, roughness: 0.42,
    normalMap: tex('powder_n.jpg', false, 3), normalScale: new THREE.Vector2(0.35, 0.35)
  });
  const plaster = new THREE.MeshStandardMaterial({
    map: tex('plaster.jpg', true), normalMap: tex('plaster_n.jpg'), normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.95, color: 0xf2efe9
  });
  const interiorPlaster = plaster.clone();
  interiorPlaster.color = new THREE.Color(0x9c8a78);
  const pavers = new THREE.MeshStandardMaterial({
    map: tex('pavers.jpg', true, 40), normalMap: tex('pavers_n.jpg', false, 40),
    roughness: 0.82, color: 0xbdbab4
  });
  const oak = new THREE.MeshStandardMaterial({
    map: tex('oak.jpg', true), normalMap: tex('oak_n.jpg'), normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.55
  });
  oak.map.repeat.set(2.2, 1.4);
  oak.normalMap.repeat.set(2.2, 1.4);
  const orange = new THREE.MeshBasicMaterial({ color: 0xec621f, toneMapped: false });
  // Plain transparent glass: transmission glass flickers when panes stack behind each other
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xd6e6ea, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16,
    envMapIntensity: 1.8, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false, side: THREE.DoubleSide
  });

  // Box UVs in world units (1 unit = 1 texture tile / scale) so textures don't stretch per face
  const worldUV = (geo, scale) => {
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (nx > 0.5) uv.setXY(i, z / scale, y / scale);
      else if (ny > 0.5) uv.setXY(i, x / scale, z / scale);
      else uv.setXY(i, x / scale, y / scale);
    }
    uv.needsUpdate = true;
    return geo;
  };

  const box = (w, h, d, mat, x = 0, y = 0, z = 0, uvScale = 0) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    if (uvScale) {
      geo.translate(x, y, z);
      worldUV(geo, uvScale);
      geo.translate(-x, -y, -z);
    }
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    return m;
  };

  /* ---------- Opening dimensions ---------- */
  const W = 4.4, H = 2.4, P = 4;       // clear opening inside the frame, panel count
  const t = 0.06;                      // profile face width
  const gap = 0.012;                   // sealant gap: frame never shares a face with the wall
  const pw = W / P + t;                // panel width with overlap
  const house = new THREE.Group();
  scene.add(house);

  // Wall with the opening cut out, sized around the frame
  const wallD = 0.24, wallW = 6.6, wallH = 3.5;
  const OW = W + (t + gap) * 2, OH = H + t + gap;
  // One extruded piece, so there are no seams where piers meet the lintel
  const outline = new THREE.Shape([
    [-wallW / 2, 0], [-OW / 2, 0], [-OW / 2, OH], [OW / 2, OH],
    [OW / 2, 0], [wallW / 2, 0], [wallW / 2, wallH], [-wallW / 2, wallH]
  ].map(([x, y]) => new THREE.Vector2(x, y)));
  const wallGeo = new THREE.ExtrudeGeometry(outline, { depth: wallD, bevelEnabled: false });
  wallGeo.translate(0, 0, -wallD / 2);
  wallGeo.computeVertexNormals();
  worldUV(wallGeo, 2.2);
  const wall = new THREE.Mesh(wallGeo, plaster);
  wall.castShadow = wall.receiveShadow = true;
  house.add(wall);

  // Outer frame, set back from the wall faces
  const fd = 0.14;
  house.add(box(W + t * 2, t, fd, alu, 0, H + t / 2, 0));
  house.add(box(W + t * 2, t * 0.6, fd, alu, 0, t * 0.3 + 0.002, 0));
  house.add(box(t, H - t * 0.6, fd, alu, -W / 2 - t / 2, (H + t * 0.6) / 2, 0));
  house.add(box(t, H - t * 0.6, fd, alu, W / 2 + t / 2, (H + t * 0.6) / 2, 0));

  // Panels: each on its own track, spaced so no faces touch
  const panels = [];
  const ph = H - t * 0.6 - 0.01;
  for (let i = 0; i < P; i++) {
    const g = new THREE.Group();
    g.add(box(pw, t, 0.036, alu, 0, ph - t / 2, 0));
    g.add(box(pw, t * 1.4, 0.036, alu, 0, t * 0.7, 0));
    g.add(box(t, ph - t * 2.4 - 0.002, 0.036, alu, -pw / 2 + t / 2, ph / 2 + t * 0.2, 0));
    g.add(box(t, ph - t * 2.4 - 0.002, 0.036, alu, pw / 2 - t / 2, ph / 2 + t * 0.2, 0));
    const pane = new THREE.Mesh(new THREE.BoxGeometry(pw - t * 2 - 0.004, ph - t * 2.4 - 0.004, 0.01), glass);
    pane.position.y = t * 1.4 + (ph - t * 2.4) / 2;
    pane.renderOrder = 1;
    g.add(pane);
    if (i === P - 1) g.add(box(0.022, 0.36, 0.03, alu, -pw / 2 + t + 0.06, 1.05, 0.035));

    const closedX = -W / 2 + (W / P) * (i + 0.5);
    const openX = -W / 2 + pw / 2 + i * 0.1;
    const z = (i - (P - 1) / 2) * 0.06;
    g.position.set(closedX, t * 0.6 + 0.004, z);
    g.userData = { closedX, openX };
    house.add(g);
    panels.push(g);
  }

  // Brand roofline above the opening: long left rafter, short right one, like the logo
  const pitch = THREE.MathUtils.degToRad(38);
  const apex = new THREE.Vector3(0.8, H + 1.5, wallD / 2 + 0.1);
  const rafter = (len, dir) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.08), orange);
    m.rotation.z = dir * -pitch;
    m.position.set(apex.x + dir * Math.cos(pitch) * len / 2, apex.y - Math.sin(pitch) * len / 2, apex.z);
    m.castShadow = true;
    return m;
  };
  house.add(rafter(2.3, -1), rafter(1.1, 1));

  // Paved stoep outside; fog fades it into the section colour so there's no visible edge
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(48, 48), pavers);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // A warm room behind the opening: oak floor, painted walls
  const room = new THREE.Group();
  const rw = wallW - 0.5, rh = wallH - 0.15, rd = 3.8;
  room.add(box(rw, rh + 0.12, 0.12, interiorPlaster, 0, (rh + 0.12) / 2, -rd, 2.2));
  room.add(box(0.12, rh, rd - wallD / 2, plaster, -rw / 2 + 0.06, rh / 2, -(rd + wallD / 2) / 2, 2.2));
  room.add(box(0.12, rh, rd - wallD / 2, plaster, rw / 2 - 0.06, rh / 2, -(rd + wallD / 2) / 2, 2.2));
  room.add(box(rw, 0.12, rd - wallD / 2, plaster, 0, rh + 0.06, -(rd + wallD / 2) / 2, 2.2));
  const oakFloor = new THREE.Mesh(new THREE.PlaneGeometry(rw - 0.2, rd - wallD / 2), oak);
  oakFloor.rotation.x = -Math.PI / 2;
  oakFloor.position.set(0, 0.006, -(rd + wallD / 2) / 2);
  oakFloor.receiveShadow = true;
  room.add(oakFloor);
  scene.add(room);

  /* ---------- Lights ---------- */
  scene.add(new THREE.HemisphereLight(0xfff1e0, 0x111113, 0.35));
  const sun = new THREE.DirectionalLight(0xffe2c2, 2.4);
  sun.position.set(-6, 8, 7);
  sun.castShadow = !small;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -4, near: 1, far: 30 });
  scene.add(sun);
  const interior = new THREE.PointLight(0xffb36b, 16, 12, 1.6);
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

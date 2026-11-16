// Dunia 3D: komponen sistem penyedia steam, pipa, partikel aliran, tangki proses.
import * as THREE from 'three';

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .45, metalness: .45, ...o });
const cyl = (r, h, m, seg = 36) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const sph = (r, m) => new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), m);
const hz = (mesh) => { mesh.rotation.z = Math.PI / 2; return mesh; }; // silinder horizontal sepanjang X
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

const M = {
  steel: mat(0x9aa7b5), dark: mat(0x3a4552), blue: mat(0x2f6fdb), teal: mat(0x1b9aa0), red: mat(0xc0392b),
  orange: mat(0xe07b25), cream: mat(0xdfe4ea), brass: mat(0xc9a227, { metalness: .8 }), green: mat(0x2e9e5b),
  fire: mat(0xff7a1a, { emissive: 0xff5a00, emissiveIntensity: .8 }),
};

export const COMPS = [
  { id: 'makeup', name: 'Tangki Air Umpan (Make-up)', pos: [-6, 0, -2], medium: 'air',
    clue: 'Menampung air baku yang sudah diolah (demineralisasi) sebagai sumber air pengganti.',
    info: 'Menampung air olahan (make-up water) untuk menggantikan steam yang hilang. Semakin banyak kondensat kembali, semakin sedikit air make-up (hemat air demin).',
    build() { const g = new THREE.Group(); g.add(at(cyl(.95, 2.2, M.cream), 0, 1.1, 0), at(cyl(.97, .25, M.blue), 0, .7, 0), at(sph(.95, M.cream), 0, 2.2, 0)); g.children[2].scale.y = .3; for (const a of [0, 2.1, 4.2]) g.add(at(cyl(.07, .5, M.dark), Math.cos(a) * .8, .25, Math.sin(a) * .8)); return g; } },
  { id: 'deaerator', name: 'Deaerator', pos: [-3, 0, -2], medium: 'air',
    clue: 'Membuang oksigen & gas terlarut dari air umpan agar pipa dan boiler tidak berkarat.',
    info: 'Menghilangkan O₂ dan gas terlarut (CO₂) yang menyebabkan korosi. Kondensat balik dari proses masuk ke sini bersama air make-up.',
    build() { const g = new THREE.Group(); g.add(at(hz(cyl(.6, 2.4, M.steel)), 0, 1.15, 0), at(sph(.6, M.steel), -1.2, 1.15, 0), at(sph(.6, M.steel), 1.2, 1.15, 0), at(cyl(.32, .8, M.steel), 0, 2.0, 0), at(sph(.32, M.steel), 0, 2.4, 0), at(box(.3, .45, 1.1, M.dark), -.7, .22, 0), at(box(.3, .45, 1.1, M.dark), .7, .22, 0)); return g; } },
  { id: 'pump', name: 'Pompa Air Umpan (Feed Water Pump)', pos: [0, 0, -2], medium: 'air',
    clue: 'Menaikkan tekanan air umpan agar bisa masuk ke boiler yang bertekanan tinggi.',
    info: 'Memompa air umpan ke tekanan lebih tinggi dari tekanan boiler. Dilengkapi kontrol otomatis level air (automatic feed control).',
    build() { const g = new THREE.Group(); g.add(at(box(1.6, .2, .9, M.dark), 0, .1, 0), at(hz(cyl(.36, .95, M.blue)), -.35, .62, 0), at(cyl(.46, .45, M.steel), .55, .55, 0), at(cyl(.12, .5, M.steel), .55, 1.0, 0)); return g; } },
  { id: 'economizer', name: 'Economizer', pos: [3, 0, -2], medium: 'air',
    clue: 'Memanaskan awal air umpan dengan memanfaatkan panas gas buang boiler.',
    info: 'Pemanas awal air umpan memakai panas gas buang cerobong. Mengurangi bahan bakar karena air masuk boiler sudah hangat.',
    build() { const g = new THREE.Group(); g.add(at(box(2.2, 1.5, 1.3, M.orange), 0, .85, 0)); for (let i = -4; i <= 4; i++) g.add(at(box(.05, 1.3, 1.34, M.dark), i * .24, .85, 0)); return g; } },
  { id: 'boiler', name: 'Boiler (Ketel Uap)', pos: [6, 0, -2], medium: 'steam',
    clue: 'Alat utama pembangkit uap: membakar bahan bakar untuk mengubah air menjadi steam.',
    info: 'Alat utama produksi steam: panas pembakaran mengubah air umpan menjadi uap. Dilengkapi safety valve, pressure gauge, dan kontrol level.',
    build() {
      const g = new THREE.Group(); g.add(at(hz(cyl(1.1, 3.4, M.red)), 0, 1.6, 0), at(sph(1.1, M.red), -1.7, 1.6, 0), at(sph(1.1, M.red), 1.7, 1.6, 0), at(box(3.4, .4, 1.8, M.dark), 0, .2, 0), at(cyl(.25, 2.4, M.dark), 1.0, 3.7, 0));
      const fire = box(.9, .6, .1, M.fire); fire.position.set(-.6, .85, 1.1); fire.name = 'fire'; g.add(fire);
      const gauge = cyl(.28, .08, M.cream); gauge.rotation.x = Math.PI / 2; gauge.position.set(-.3, 2.5, .15); g.add(gauge);
      const needle = box(.03, .22, .02, M.red); needle.geometry.translate(0, .11, 0); needle.position.set(-.3, 2.5, .22); needle.name = 'needle'; g.add(needle);
      g.add(at(cyl(.09, .5, M.brass), .4, 2.95, 0)); // safety valve
      return g; } },
  { id: 'header', name: 'Steam Header', pos: [6, 0, 3], medium: 'steam',
    clue: 'Pipa induk yang menampung steam dari boiler lalu membaginya ke berbagai pemakai.',
    info: 'Pipa induk distribusi steam. Harus diisolasi dengan baik agar kehilangan panas kecil; dilengkapi steam separator untuk menjaga kualitas uap.',
    build() { const g = new THREE.Group(); g.add(at(hz(cyl(.35, 2.8, M.steel)), 0, 1, 0)); for (const x of [-.9, 0, .9]) g.add(at(cyl(.12, .6, M.steel), x, .5, 0)); g.add(at(box(.2, .7, .5, M.dark), -1.1, .35, 0), at(box(.2, .7, .5, M.dark), 1.1, .35, 0)); return g; } },
  { id: 'prv', name: 'Pressure Reducing Valve (PRV)', pos: [3, 0, 3], medium: 'steam',
    clue: 'Menurunkan tekanan steam dari header agar sesuai kebutuhan proses.',
    info: 'Menyesuaikan (menurunkan) tekanan steam sesuai kebutuhan proses, sehingga tidak overpressure dan lebih aman.',
    build() { const g = new THREE.Group(); g.add(at(hz(cyl(.22, 1.5, M.green)), 0, .95, 0), at(hz(cyl(.35, .15, M.dark)), -.7, .95, 0), at(hz(cyl(.35, .15, M.dark)), .7, .95, 0), at(cyl(.17, .8, M.green), 0, 1.5, 0)); const w = new THREE.Mesh(new THREE.TorusGeometry(.32, .04, 8, 24), M.red); w.rotation.x = Math.PI / 2; w.position.y = 2; g.add(w); g.add(at(sph(.28, M.green), 0, 1.95, 0)); g.children[g.children.length - 1].scale.y = .5; return g; } },
  { id: 'hx', name: 'Heat Exchanger (Pemanas Proses)', pos: [0, 0, 3], medium: 'steam',
    clue: 'Tempat steam melepas panas latennya ke fluida proses sehingga steam mengembun.',
    info: 'Steam melepas panas laten (hfg) ke fluida proses dan mengembun menjadi kondensat. Contoh: reboiler, evaporator, heat exchanger pemanas.',
    build() { const g = new THREE.Group(); g.add(at(hz(cyl(.6, 2.4, M.teal)), 0, 1.1, 0), at(hz(cyl(.66, .2, M.dark)), -1.25, 1.1, 0), at(hz(cyl(.66, .2, M.dark)), 1.25, 1.1, 0), at(box(.3, .5, 1.2, M.dark), -.7, .25, 0), at(box(.3, .5, 1.2, M.dark), .7, .25, 0), at(cyl(.12, .45, M.steel), -.5, 1.85, 0), at(cyl(.12, .45, M.steel), .5, 1.85, 0)); return g; } },
  { id: 'trap', name: 'Steam Trap', pos: [-3, 0, 3], medium: 'kondensat',
    clue: 'Memisahkan kondensat dari steam: hanya air yang dilepas, steam tertahan (cegah water hammer).',
    info: 'Membuang kondensat tetapi menahan steam. Pemasangan yang tepat mencegah water hammer dan kehilangan steam.',
    build() { const g = new THREE.Group(); g.add(at(cyl(.32, .7, M.brass), 0, .6, 0), at(sph(.32, M.brass), 0, .95, 0), at(hz(cyl(.1, 1.0, M.steel)), 0, .65, 0), at(box(.5, .1, .5, M.dark), 0, .05, 0)); return g; } },
  { id: 'condtank', name: 'Tangki Kondensat', pos: [-6, 0, 3], medium: 'kondensat',
    clue: 'Menampung kondensat panas untuk dikembalikan ke deaerator (hemat energi 15–20%).',
    info: 'Menampung kondensat panas yang dikembalikan ke deaerator/tangki umpan: hemat energi panas 15–20%, hemat air demin, dan kurangi bahan bakar boiler.',
    build() { const g = new THREE.Group(); g.add(at(cyl(.85, 1.8, M.teal), 0, .9, 0), at(sph(.85, M.teal), 0, 1.8, 0), at(box(.7, .5, .6, M.dark), 1.2, .25, 0)); g.children[1].scale.y = .3; return g; } },
];

const Y = .9; // tinggi pipa
const p3 = (c) => new THREE.Vector3(c.pos[0], Y, c.pos[2]);
const C = Object.fromEntries(COMPS.map(c => [c.id, c]));
// Jalur (waypoint) untuk partikel & pipa
export const PATHS = {
  water: [p3(C.makeup), p3(C.deaerator), p3(C.pump), p3(C.economizer), p3(C.boiler)],
  steam: [p3(C.boiler), p3(C.header), p3(C.prv), p3(C.hx)],
  cond: [p3(C.hx), p3(C.trap), p3(C.condtank), new THREE.Vector3(-6, Y, .5), new THREE.Vector3(-3, Y, .5), p3(C.deaerator)],
};
const COL = { air: 0x3b82f6, steam: 0xdfe6ee, kondensat: 0x22b8cf };

export function label(text, { w = 3.2, size = 54, bg = 'rgba(8,14,20,.78)', fg = '#fff' } = {}) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const x = cv.getContext('2d'); x.fillStyle = bg; x.beginPath(); x.roundRect(4, 4, 504, 120, 28); x.fill();
  x.fillStyle = fg; x.font = `bold ${size}px system-ui,Arial`; x.textAlign = 'center'; x.textBaseline = 'middle';
  const words = text.split(' '); let lines = [text];
  if (x.measureText(text).width > 470) { const h = Math.ceil(words.length / 2); lines = [words.slice(0, h).join(' '), words.slice(h).join(' ')]; x.font = `bold ${size * .72}px system-ui,Arial`; }
  lines.forEach((l, i) => x.fillText(l, 256, 64 + (i - (lines.length - 1) / 2) * size * .72));
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(w, w / 4, 1); s.renderOrder = 10; s.userData.isLabel = true; return s;
}
export function setLabel(sprite, text, opts) { const n = label(text, opts); sprite.material.map.dispose(); sprite.material.map = n.material.map; sprite.material.needsUpdate = true; }

function pipeSeg(a, b, r, m) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), m);
  mesh.position.copy(a).addScaledVector(d, .5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return mesh;
}
function pipePoly(pts, r, m) { const g = new THREE.Group(); for (let i = 0; i < pts.length - 1; i++) g.add(pipeSeg(pts[i], pts[i + 1], r, m)); for (const p of pts) { const s = sph(r, m); s.position.copy(p); g.add(s); } return g; }

export class World {
  constructor() {
    this.group = new THREE.Group();
    this.comps = {}; this.slots = {}; this.pipes = {}; this.placed = new Set();
    const ground = new THREE.Mesh(new THREE.CircleGeometry(14, 64), mat(0x1b2530, { roughness: .9, metalness: 0 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.position.y = -.01; this.group.add(ground);
    const grid = new THREE.GridHelper(26, 26, 0x2e4256, 0x223244); grid.position.y = 0; this.group.add(grid);

    COMPS.forEach((c, i) => {
      const m = c.build(); m.position.set(...c.pos); m.userData = { compId: c.id }; m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      const lab = label(c.name, { w: 3.4 }); lab.position.set(c.pos[0], 3.9, c.pos[2]); lab.visible = false;
      const ghost = new THREE.Group(); ghost.position.set(...c.pos); ghost.userData = { slotId: c.id };
      const ring = new THREE.Mesh(new THREE.RingGeometry(.9, 1.15, 40), new THREE.MeshBasicMaterial({ color: 0xffa24d, side: THREE.DoubleSide, transparent: true, opacity: .9 }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = .03;
      const pillar = cyl(1.0, 2, new THREE.MeshBasicMaterial({ color: 0xffa24d, transparent: true, opacity: .1, depthWrite: false })); pillar.position.y = 1;
      const num = label(String(i + 1), { w: 1.3, size: 80, bg: 'rgba(255,138,61,.95)', fg: '#2a1100' }); num.position.y = 2.4;
      ghost.add(ring, pillar, num); ghost.visible = false;
      this.group.add(m, lab, ghost);
      this.comps[c.id] = { def: c, mesh: m, label: lab }; this.slots[c.id] = ghost;
    });

    // Pipa (terlihat saat kedua ujungnya terpasang)
    const mw = mat(0x2f6fdb, { roughness: .35 }), ms = mat(0xb4472f, { roughness: .6 }), mc = mat(0x22b8cf, { roughness: .35 });
    const order = COMPS.map(c => c.id);
    const mk = (id, pts, m, ends) => { const g = pipePoly(pts, .13, m); g.userData.ends = ends; g.visible = false; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); this.pipes[id] = g; this.group.add(g); };
    for (let i = 0; i < order.length - 1; i++) {
      const a = C[order[i]], b = C[order[i + 1]];
      const m = i < 4 ? mw : (i < 7 ? ms : mc);
      mk('p' + i, [p3(a), p3(b)], m, [a.id, b.id]);
    }
    mk('ret', [p3(C.condtank), new THREE.Vector3(-6, Y, .5), new THREE.Vector3(-3, Y, .5), p3(C.deaerator)], mc, ['condtank', 'deaerator']);
    // isolasi pipa boiler→header (muncul setelah diperbaiki)
    this.lagging = pipeSeg(p3(C.boiler), p3(C.header), .24, mat(0xe9edf2, { roughness: .8, metalness: 0 })); this.lagging.visible = false; this.group.add(this.lagging);

    // Partikel aliran
    this.flows = Object.entries(PATHS).map(([k, pts]) => {
      const lens = [0]; for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
      const medium = k === 'water' ? 'air' : k === 'steam' ? 'steam' : 'kondensat';
      const n = k === 'steam' ? 36 : 28;
      const im = new THREE.InstancedMesh(new THREE.SphereGeometry(k === 'steam' ? .17 : .12, 10, 8), new THREE.MeshBasicMaterial({ color: COL[medium], transparent: true, opacity: k === 'steam' ? .75 : .95 }), n);
      im.visible = false; im.frustumCulled = false; this.group.add(im);
      return { pts, lens, total: lens[lens.length - 1], im, n, speed: k === 'steam' ? 3.2 : 2.0 };
    });

    // Sorotan (marker) untuk tahap efisiensi
    this.markers = {};
    // Tangki proses (tahap 3)
    this.tank = this._tank(); this.tank.visible = false; this.group.add(this.tank);
    this.puffs = []; this.t = 0; this.flowOn = false; this.pressure = 3; this.puffing = false;
    this._puffGroup = new THREE.Group(); this.group.add(this._puffGroup);
    this.pickables = [];
    this.setAssembled(true);
  }

  _tank() {
    const g = new THREE.Group(); g.position.set(0, 0, 8);
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 2.4, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0xbfd2e3, transparent: true, opacity: .25, side: THREE.DoubleSide, metalness: .2, roughness: .1 }));
    shell.position.y = 1.2; g.add(shell, at(cyl(1.7, .12, M.dark), 0, .06, 0));
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.62, 1.7, 40), new THREE.MeshStandardMaterial({ color: 0x2f7fd8, transparent: true, opacity: .75, roughness: .2 }));
    water.position.y = .95; water.name = 'water'; g.add(water);
    const helix = new THREE.CatmullRomCurve3(Array.from({ length: 70 }, (_, i) => { const t = i / 69, a = t * Math.PI * 8; return new THREE.Vector3(Math.cos(a) * .9, .35 + t * 1.2, Math.sin(a) * .9); }));
    const coil = new THREE.Mesh(new THREE.TubeGeometry(helix, 160, .07, 8), new THREE.MeshStandardMaterial({ color: 0xb0b8c2, emissive: 0xff6a00, emissiveIntensity: 0, metalness: .7, roughness: .3 })); coil.name = 'coil'; g.add(coil);
    const inlet = pipeSeg(new THREE.Vector3(0, 3.4, -1.3), new THREE.Vector3(.9, .35, 0), .1, mat(0xb4472f)); g.add(inlet);
    const therm = box(.18, 2.2, .18, mat(0x222a33)); therm.position.set(2.1, 1.3, 0); g.add(therm);
    const mercury = box(.1, 1, .1, mat(0xff3b3b, { emissive: 0xff0000, emissiveIntensity: .4 })); mercury.geometry.translate(0, .5, 0); mercury.position.set(2.1, .25, .1); mercury.name = 'merc'; g.add(mercury);
    const lab = label('30 °C', { w: 1.8, size: 70 }); lab.position.set(2.1, 3.0, 0); lab.name = 'tlabel'; g.add(lab);
    const title = label('Tangki Proses', { w: 2.4 }); title.position.set(0, 3.6, 0); title.name = 'ttitle'; g.add(title);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  setTank(T, fillPct = .7, T0 = 30) {
    const t = this.tank; const k = Math.min(1, Math.max(0, (T - 20) / 90));
    const w = t.getObjectByName('water'); w.material.color.setHSL(.6 - .6 * k * .9, .75, .5);
    t.getObjectByName('merc').scale.y = Math.max(.05, Math.min(2, (T - 10) / 60));
    t.getObjectByName('coil').material.emissiveIntensity = this._heating ? 1.1 : 0;
    setLabel(t.getObjectByName('tlabel'), `${T.toFixed(0)} °C`, { size: 70 });
  }
  setTankHeating(v) { this._heating = v; }

  setAssembled(all) {
    for (const id in this.comps) { this.comps[id].mesh.visible = all; this.slots[id].visible = false; this.comps[id].label.visible = false; }
    this.placed = new Set(all ? COMPS.map(c => c.id) : []);
    this.refreshPipes();
  }
  showSlots(v) { for (const id in this.slots) this.slots[id].visible = v && !this.placed.has(id); }
  place(id) { this.placed.add(id); this.comps[id].mesh.visible = true; this.slots[id].visible = false; this.refreshPipes(); this.comps[id].label.visible = true; }
  refreshPipes() { for (const k in this.pipes) { const [a, b] = this.pipes[k].userData.ends; this.pipes[k].visible = this.placed.has(a) && this.placed.has(b); } }
  setFlow(v) { this.flowOn = v; this.flows.forEach(f => f.im.visible = v); }
  setLabelsVisible(v) { for (const id in this.comps) this.comps[id].label.visible = v && this.placed.has(id); }
  setBoiler(P) { // visual tekanan: jarum & api
    this.pressure = P; const b = this.comps.boiler.mesh;
    const n = b.getObjectByName('needle'); n.rotation.z = -(P / 50) * Math.PI * 1.5 + Math.PI * .75;
    const f = b.getObjectByName('fire'); f.material.emissiveIntensity = .3 + P / 50 * 2.2; f.scale.y = .6 + P / 50;
  }
  setPuff(v) { this.puffing = v; }
  setMarker(id, pos, state) { // state: 'bad' | 'ok' | null
    let m = this.markers[id];
    if (!m) { m = new THREE.Group(); const s = sph(.38, new THREE.MeshBasicMaterial({ color: 0xff3b4d, transparent: true, opacity: .85 })); const l = label('!', { w: 1, size: 90, bg: 'rgba(0,0,0,0)', fg: '#fff' }); l.position.y = .0; m.add(s, l); m.userData = { marker: id }; m.position.copy(pos); this.group.add(m); this.markers[id] = m; }
    m.visible = !!state; m.children[0].material.color.set(state === 'ok' ? 0x3ddc97 : 0xff3b4d);
    m.children[1].visible = state !== 'ok';
  }

  update(dt) {
    this.t += dt;
    const d = new THREE.Object3D();
    if (this.flowOn) for (const f of this.flows) {
      for (let i = 0; i < f.n; i++) {
        let s = ((i / f.n) * f.total + this.t * f.speed) % f.total, k = 1;
        while (k < f.lens.length - 1 && s > f.lens[k]) k++;
        const a = f.pts[k - 1], b = f.pts[k], u = (s - f.lens[k - 1]) / (f.lens[k] - f.lens[k - 1]);
        d.position.lerpVectors(a, b, u); d.position.y += Math.sin(this.t * 6 + i) * .04;
        d.updateMatrix(); f.im.setMatrixAt(i, d.matrix);
      }
      f.im.instanceMatrix.needsUpdate = true;
    }
    for (const id in this.slots) { const g = this.slots[id]; if (g.visible) g.children[0].material.opacity = .55 + .4 * Math.sin(this.t * 4); }
    for (const id in this.markers) { const m = this.markers[id]; if (m.visible) m.scale.setScalar(1 + .12 * Math.sin(this.t * 6)); }
    // semburan safety valve
    if (this.puffing && Math.random() < .5) {
      const s = sph(.13, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9 }));
      s.position.set(6.4, 3.2, -2); s.userData.v = new THREE.Vector3((Math.random() - .5) * .8, 2 + Math.random(), (Math.random() - .5) * .8); s.userData.life = 1; this._puffGroup.add(s);
    }
    for (const s of [...this._puffGroup.children]) { s.position.addScaledVector(s.userData.v, dt); s.userData.life -= dt * .9; s.material.opacity = Math.max(0, s.userData.life); s.scale.multiplyScalar(1 + dt * 1.5); if (s.userData.life <= 0) { this._puffGroup.remove(s); s.material.dispose(); } }
    if (this.tank.visible && this._heating) this.tank.getObjectByName('coil').material.emissiveIntensity = .8 + .4 * Math.sin(this.t * 8);
  }
}

export function findTag(obj) { while (obj) { const u = obj.userData; if (u && (u.compId || u.slotId || u.marker)) return u; obj = obj.parent; } return null; }

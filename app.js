import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { World, COMPS, findTag } from './scene.js';
import { sat, steamState, steamNeed, LECTURE_CASE, generateProblem, tutorFeedback, aiCfg, CP_WATER } from './steam.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (x, d = 1) => Number(x).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
const rp = x => 'Rp ' + Math.round(x).toLocaleString('id-ID');

/* ---------------- Three.js dasar ---------------- */
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0e141b);
const camera = new THREE.PerspectiveCamera(50, 1, .1, 200);
camera.position.set(2, 11, 17);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * .49; controls.minDistance = 4; controls.maxDistance = 40;
controls.target.set(0, 1, 1.2);
scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x1a2430, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 2.1); sun.position.set(8, 16, 10); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 }); scene.add(sun);
const world = new World(); scene.add(world.group);

function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; if (!renderer.xr.isPresenting) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } }
addEventListener('resize', resize); new ResizeObserver(resize).observe(canvas); resize();

const VIEWS = {
  overview: [[2, 14, 22], [0, 1, 1.2]], boiler: [[11, 6, 5], [6, 1.6, -1.5]], tank: [[6, 6.5, 17], [0, 1.4, 8]],
  assemble: [[0, 17, 16], [0, 0, .5]],
};
let tween = null;
function focus(name) { const [p, t] = VIEWS[name]; tween = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...p), t1: new THREE.Vector3(...t) }; }

/* ---------------- Picking ---------------- */
const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2();
function pick(raycaster) { for (const h of raycaster.intersectObjects(world.group.children, true)) { if (h.object.isSprite && h.object.userData.isLabel && !h.object.parent.userData.slotId && !h.object.parent.userData.marker) continue; const t = findTag(h.object); if (t) return t; } return null; }
let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || performance.now() - down.t > 500) return;
  const r = canvas.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera); const t = pick(ray); if (t) onPick(t);
});

/* ---------------- State ---------------- */
const STAGES = ['Jelajah', 'Rakit', 'Boiler', 'Hitung', 'Efisiensi', 'Ringkasan'];
const S = {
  stage: 0, t0: Date.now(), pts: {}, explored: new Set(), sel: null, shuffled: null, wrong: 0,
  sc: [ // skenario boiler
    { id: 'A', title: 'Sterilisasi makanan & minuman', need: 'Steam jenuh bersuhu 120–150 °C.', ok: (st) => st.kind === 'jenuh' && st.Ts >= 120 && st.Ts <= 150, why: 'Sterilisasi memerlukan saturated steam: kaya panas laten (hfg) dan suhunya tepat.' , done: false },
    { id: 'B', title: 'Pengeringan pabrik tekstil', need: 'Steam jenuh ≈ 150 °C (toleransi ±5 °C).', ok: (st) => st.kind === 'jenuh' && Math.abs(st.Ts - 150) <= 5, why: 'Tekstil memakai steam jenuh ±150 °C; tekanan sekitar 4,6–5,4 bar (abs).', done: false },
    { id: 'C', title: 'Penggerak turbin pabrik pupuk', need: 'Steam SUPERPANAS ≥ 340 °C pada tekanan 35–45 bar.', ok: (st) => st.kind === 'superpanas' && st.P >= 35 && st.P <= 45 && st.T >= 340, why: 'Turbin butuh superheated steam (±350 °C, 40 bar): tanpa tetesan air yang merusak sudu.', done: false },
  ], scIdx: 0, bP: 3, bSuper: false, bT: 200,
  p3: { case: null, hints: 0, wrong: 0, solved: [], extra: 0, loading: false, fb: null, prev: [], solvedCur: false },
  fix: { insul: null, trap: null, cond: null, blow: null }, quiz: null, quizAns: {},
};
const ptsTotal = () => Object.values(S.pts).reduce((a, b) => a + b, 0);
const MAXPTS = 140;
function addPts(k, v) { S.pts[k] = Math.max(0, v); $('#score').textContent = ptsTotal() + ' poin'; }
let toastT; function toast(m, k = '') { const t = $('#toast'); t.textContent = m; t.className = 'show ' + k; clearTimeout(toastT); toastT = setTimeout(() => t.className = '', 4200); }

/* ---------------- Tahap & render HUD ---------------- */
function drawSteps() { $('#steps').innerHTML = STAGES.map((n, i) => `<li class="${i < S.stage ? 'done' : i === S.stage ? 'cur' : ''}" title="${n}">${i < S.stage ? '✓' : i + 1}</li>`).join(''); }
function go(n) {
  S.stage = n; drawSteps(); world.lagging.visible = S.fix.insul === 'ok' && n !== 1; world.setTankHeating(false); world.tank.visible = n === 3; world.setPuff(false);
  Object.keys(world.markers).forEach(k => world.markers[k].visible = n === 4);
  if (n === 0) { world.setAssembled(true); world.setFlow(true); world.setLabelsVisible(false); focus('overview'); }
  if (n === 1) { world.setAssembled(false); world.setFlow(false); world.showSlots(true); S.sel = null; S.shuffled = [...COMPS].sort(() => Math.random() - .5); S.wrong = 0; focus('assemble'); }
  if (n === 2) { world.setAssembled(true); world.setFlow(true); world.setLabelsVisible(false); focus('boiler'); updBoiler(); }
  if (n === 3) { world.setAssembled(true); world.setFlow(true); focus('tank'); if (!S.p3.case) { S.p3.case = LECTURE_CASE; } world.setTank(S.p3.case.T1); }
  if (n === 4) { world.setAssembled(true); world.setFlow(true); world.setLabelsVisible(false); focus('overview'); setupMarkers(); }
  if (n === 5) { focus('overview'); world.setFlow(true); if (!S.quiz) S.quiz = pickQuiz(); }
  $('#hud').scrollTop = 0; render();
}
function render() { ([s0, s1, s2, s3, s4, s5][S.stage])(); }
const body = $('#hudBody');
const next = (ok, label = 'Lanjut ▶') => `<div class="row" style="margin-top:14px"><button class="primary" data-act="next" ${ok ? '' : 'disabled'}>${label}</button>${ok ? '' : '<span class="muted">Selesaikan tantangan dulu.</span>'}</div>`;

/* ----- Tahap 0: Jelajah ----- */
function s0() {
  const n = S.explored.size, ok = n >= 5;
  body.innerHTML = `
  <span class="tag">Tahap 1 / 6 · ±3 menit</span>
  <h2>Selamat datang, Insinyur Utilitas!</h2>
  <p class="muted">Kamu bertugas di pabrik biodiesel. Seluruh panas proses berasal dari <b>sistem penyedia steam</b> ini. Putar (seret), zoom (cubit/scroll), lalu <b>ketuk komponen</b> untuk mempelajarinya.</p>
  <div class="card"><b>Misi:</b> inspeksi minimal <b>5 komponen</b> (${n}/5).
    <div class="bar" style="margin-top:8px"><i style="width:${Math.min(100, n / 5 * 100)}%"></i></div></div>
  <div class="chips">${COMPS.map(c => `<span class="chip ${S.explored.has(c.id) ? 'done' : ''}" data-act="info" data-id="${c.id}">${esc(c.name.split(' (')[0])}</span>`).join('')}</div>
  <div id="info" class="card" style="display:${S.lastInfo ? 'block' : 'none'}">${S.lastInfo || ''}</div>
  <div class="card"><b>Jalur fluida:</b> <span style="color:#6aa6ff">● air umpan</span> → boiler → <span style="color:#dfe6ee">● steam</span> → proses → <span style="color:#22b8cf">● kondensat</span> kembali ke deaerator.</div>
  <p class="muted">Tombol <b>AR</b> menaruh sistem ini di mejamu lewat kamera ponsel; tombol <b>VR</b> membawamu masuk ke dalam pabrik (butuh headset/browser WebXR).</p>
  ${next(ok)}`;
}
function inspect(id) {
  const c = COMPS.find(x => x.id === id); S.explored.add(id);
  world.setLabelsVisible(false); world.comps[id].label.visible = true;
  S.lastInfo = `<b>${esc(c.name)}</b><br>${esc(c.info)}`;
  addPts('explore', Math.min(10, S.explored.size * 2)); if (S.stage === 0) render();
  toast(c.name + ' ✓', 'ok');
}

/* ----- Tahap 1: Rakit ----- */
function s1() {
  const done = world.placed.size === COMPS.length;
  body.innerHTML = `
  <span class="tag">Tahap 2 / 6 · ±4 menit</span>
  <h2>Rakit Sistem Penyedia Steam</h2>
  <p class="muted">Pasang 10 komponen sesuai urutan aliran. <b>1)</b> pilih komponen di bawah, <b>2)</b> ketuk slot bernomor di 3D (atau barisnya di sini). Baca petunjuk fungsi tiap slot!</p>
  <h3>Komponen (${world.placed.size}/10)</h3>
  <div class="chips">${S.shuffled.map(c => `<span class="chip ${world.placed.has(c.id) ? 'done' : S.sel === c.id ? 'sel' : ''}" data-act="sel" data-id="${c.id}">${esc(c.name.split(' (')[0])}</span>`).join('')}</div>
  <h3>Slot aliran</h3>
  ${COMPS.map((c, i) => `<div class="slotrow ${world.placed.has(c.id) ? 'filled' : ''}" data-act="slot" data-id="${c.id}"><span class="n">${i + 1}</span><span>${world.placed.has(c.id) ? '<b>' + esc(c.name) + '</b>' : esc(c.clue)}</span></div>`).join('')}
  ${done ? `<div class="card ok">✅ Sistem tertutup! Lihat kondensat kembali ke deaerator. Kesalahan: ${S.wrong}.</div>` : ''}
  ${next(done)}`;
}
function tryPlace(slotId) {
  if (S.stage !== 1 || world.placed.has(slotId)) return;
  if (!S.sel) { toast('Pilih dulu komponen dari daftar.', 'bad'); return; }
  if (S.sel === slotId) {
    world.place(slotId); S.sel = null; toast('Tepat! ✓ ' + world.comps[slotId].def.name, 'ok');
    addPts('assemble', Math.max(5, 30 - S.wrong * 2) * world.placed.size / 10 | 0);
    if (world.placed.size === COMPS.length) { world.setFlow(true); world.setLabelsVisible(true); addPts('assemble', Math.max(8, 30 - S.wrong * 2)); }
  } else {
    S.wrong++; const s = COMPS.find(c => c.id === slotId), p = COMPS.find(c => c.id === S.sel);
    toast(`Belum tepat: ${p.name.split(' (')[0]} bukan untuk fungsi “${s.clue.slice(0, 60)}…”`, 'bad');
  }
  render();
}

/* ----- Tahap 2: Boiler ----- */
function s2() {
  const sc = S.sc[S.scIdx], allDone = S.sc.every(x => x.done);
  body.innerHTML = `
  <span class="tag">Tahap 3 / 6 · ±3 menit</span>
  <h2>Operasikan Boiler</h2>
  <p class="muted">Atur tekanan & jenis steam agar sesuai kebutuhan proses. Batas aman boiler: <b>45 bar</b> (di atas itu safety valve membuka!).</p>
  <div class="chips">${S.sc.map((x, i) => `<span class="chip ${x.done ? 'done' : i === S.scIdx ? 'sel' : ''}" data-act="sc" data-i="${i}">${x.id}. ${esc(x.title.split(' ')[0])}</span>`).join('')}</div>
  <div class="card"><b>${esc(sc.title)}</b><br><span class="muted">Syarat: ${esc(sc.need)}</span></div>
  <label class="muted">Tekanan steam: <b id="lP"></b> bar (abs)</label>
  <input type="range" id="rP" min="1" max="50" step="0.5" value="${S.bP}">
  <div class="row" style="margin:8px 0"><button data-act="mode" data-v="0" id="m0">Steam jenuh</button><button data-act="mode" data-v="1" id="m1">Steam superpanas</button></div>
  <div id="boxT" style="display:none"><label class="muted">Suhu superpanas: <b id="lT"></b> °C</label><input type="range" id="rT" min="100" max="500" step="5" value="${S.bT}"></div>
  <div class="card"><div class="kv" id="tbl"></div><div class="formula" id="eq" style="margin-top:8px"></div></div>
  <div class="row"><button class="primary" data-act="chk">Periksa pilihan</button></div>
  <div id="fb"></div>
  ${next(allDone)}`;
  syncBoilerUI();
}
function stateNow() { return steamState(S.bP, S.bSuper, S.bT); }
function syncBoilerUI() {
  if (S.stage !== 2) return; const st = stateNow();
  $('#lP').textContent = fmt(S.bP, 1); $('#boxT').style.display = S.bSuper ? 'block' : 'none'; $('#lT').textContent = S.bT;
  $('#m0').classList.toggle('primary', !S.bSuper); $('#m1').classList.toggle('primary', S.bSuper);
  $('#tbl').innerHTML = `<span>Suhu jenuh Ts</span><b>${fmt(st.Ts)} °C</b><span>hf (panas sensibel)</span><b>${fmt(st.hf)} kJ/kg</b><span>hfg (panas laten)</span><b>${fmt(st.hfg)} kJ/kg</b><span>hg = hf + hfg</span><b>${fmt(st.hg)} kJ/kg</b><span>Jenis steam</span><b>${st.kind}</b><span>Entalpi steam h</span><b>${fmt(st.h)} kJ/kg</b>`;
  $('#eq').textContent = st.kind === 'jenuh' ? `hg = hf + hfg = ${fmt(st.hf)} + ${fmt(st.hfg)} = ${fmt(st.hg)} kJ/kg` : `h = hg + Cp·(T − Ts)\n  = ${fmt(st.hg)} + 2,1·(${fmt(st.T, 0)} − ${fmt(st.Ts)}) = ${fmt(st.h)} kJ/kg`;
  updBoiler();
}
function updBoiler() { world.setBoiler(S.bP); const over = S.bP > 45; world.setPuff(over && S.stage === 2); if (over && S.stage === 2) toast('⚠ Overpressure! Safety valve membuka. Turunkan tekanan.', 'bad'); }
function checkBoiler() {
  const sc = S.sc[S.scIdx], st = stateNow(), fb = $('#fb');
  if (S.bP > 45) { fb.innerHTML = `<div class="card bad">Tekanan melewati batas aman boiler (45 bar). Operator tidak boleh mengoperasikan boiler seperti ini.</div>`; return; }
  if (sc.ok(st)) {
    const first = !sc.done; sc.done = true; if (first) addPts('boiler', S.sc.filter(x => x.done).length * 10);
    fb.innerHTML = `<div class="card ok">✅ Benar! ${esc(sc.why)}<br><span class="muted">Ts = ${fmt(st.Ts)} °C, h = ${fmt(st.h)} kJ/kg.</span></div>`;
    const nx = S.sc.findIndex(x => !x.done); if (nx >= 0) setTimeout(() => { S.scIdx = nx; render(); }, 1400); else setTimeout(render, 900);
  } else {
    let hint = sc.id === 'C' ? (st.kind !== 'superpanas' ? 'Turbin butuh steam SUPERPANAS (aktifkan mode superpanas).' : 'Naikkan tekanan ke 35–45 bar dan suhu ≥ 340 °C.') : (st.kind !== 'jenuh' ? 'Skenario ini memakai steam jenuh.' : `Ts sekarang ${fmt(st.Ts)} °C; cari tekanan yang memberi suhu jenuh sesuai syarat (lihat tabel).`);
    fb.innerHTML = `<div class="card bad">Belum sesuai. ${esc(hint)}</div>`;
  }
}

/* ----- Tahap 3: Hitung (GenAI) ----- */
function s3() {
  const p = S.p3, c = p.case, k = steamNeed(c), st = sat(c.P);
  const solvedN = p.solved.length, ok = solvedN >= 2;
  body.innerHTML = `
  <span class="tag">Tahap 4 / 6 · ±6 menit</span> ${c.source === 'gemini' ? '<span class="tag ai">dibuat Gemini</span>' : c.source === 'offline' ? '<span class="tag ai">mesin generatif bawaan</span>' : '<span class="tag">soal materi kuliah</span>'}
  <h2>Hitung Kebutuhan Steam</h2>
  <div class="card">${esc(c.story)}</div>
  <div class="card"><div class="kv"><span>Massa fluida m</span><b>${fmt(c.mass, 0)} kg</b><span>cp fluida</span><b>${c.cp} kJ/kg·K</b><span>T awal → T akhir</span><b>${c.T1} → ${c.T2} °C</b><span>Steam jenuh</span><b>${c.P} bar abs (Ts ${fmt(st.Ts)} °C)</b><span>hg pada ${c.P} bar</span><b>${fmt(st.hg)} kJ/kg</b></div></div>
  <div class="row"><button data-act="hint" data-n="1">💡 Q</button><button data-act="hint" data-n="2">💡 h kondensat</button><button data-act="hint" data-n="3">💡 Rumus</button><span class="muted">Bantuan mengurangi poin</span></div>
  <div id="hints">${hintHtml(p, c, k)}</div>
  <label class="muted">Jawabanmu: massa steam (kg)</label>
  <div class="row"><input type="text" id="ans" inputmode="decimal" placeholder="mis. 534" style="flex:1" ${p.solvedCur ? 'disabled' : ''}><button class="primary" data-act="ans" ${p.solvedCur ? 'disabled' : ''}>Periksa & simulasikan ▶</button></div>
  <div id="fb">${p.fb || ''}</div>
  <h3>Generative AI</h3>
  <div class="row"><button data-act="gen" ${p.loading ? 'disabled' : ''}>${p.loading ? '⏳ AI sedang menyusun…' : '✦ Buat soal variasi baru'}</button><span class="muted">${aiCfg.key ? 'Gemini aktif' : 'mesin bawaan (atur Gemini lewat ✦ AI)'}</span></div>
  <p class="muted">Kunci jawaban selalu dihitung oleh program dari tabel uap, bukan oleh AI, sehingga soal dari AI tetap valid. Selesaikan soal materi + minimal 1 soal variasi (${solvedN}/2).</p>
  ${next(ok)}`;
}
function hintHtml(p, c, k) {
  const h = p.shown || [];
  return h.map(n => `<div class="formula" style="margin:6px 0">${n === 1 ? `Q = m·cp·(T2−T1) = ${fmt(c.mass, 0)}·${c.cp}·(${c.T2}−${c.T1}) = ${fmt(k.Q, 0)} kJ` : n === 2 ? `h kondensat = 4,18·T2 = ${fmt(k.hc)} kJ/kg\nhg − hc = ${fmt(k.hg)} − ${fmt(k.hc)} = ${fmt(k.dh)} kJ/kg` : `m_steam = Q / (hg − h kondensat)`}</div>`).join('');
}
async function checkAns() {
  const p = S.p3, c = p.case, k = steamNeed(c); const raw = $('#ans').value.replace(',', '.').trim(); const a = parseFloat(raw);
  if (!isFinite(a) || a <= 0) { toast('Isi jawaban berupa angka (kg).', 'bad'); return; }
  const err = Math.abs(a - k.ms) / k.ms, ok = err <= 0.04;
  // simulasi: pakai steam sebanyak jawaban mahasiswa
  const Tf = Math.min(125, c.T1 + a * k.dh / (c.mass * c.cp));
  animateTank(c.T1, Tf);
  const sim = `Simulasi: dengan ${fmt(a, 0)} kg steam, suhu akhir fluida = <b>${fmt(Tf, 0)} °C</b> (target ${c.T2} °C).`;
  if (ok) {
    p.solvedCur = true; if (!p.solved.includes(c.id)) p.solved.push(c.id);
    const gain = Math.max(4, 15 - p.hints * 2 - p.wrong * 2); const key = 'hitung' + p.solved.length; addPts(key, gain);
    p.fb = `<div class="card ok">✅ Benar! ≈ <b>${fmt(k.ms, 0)} kg</b> steam (selisih ${fmt(err * 100, 1)}%).<br>${sim}${c.id === 'kuliah' ? '<br><span class="muted">Catatan: kunci slide ±544 kg; selisih kecil berasal dari sumber data entalpi.</span>' : ''}<br><b>+${gain} poin</b></div>`;
    render();
  } else {
    p.wrong++; p.fb = `<div class="card bad">Belum tepat. ${sim}<br><span id="tut" class="muted">⏳ tutor menganalisis jawabanmu…</span></div>`; render();
    const fbk = await tutorFeedback(c, a);
    p.fb = `<div class="card bad">Belum tepat. ${sim}<br><b>Tutor ${fbk.via === 'gemini' ? '(Gemini)' : ''}:</b> ${esc(fbk.text)}</div>`; if (S.stage === 3 && S.p3 === p) { render(); }
  }
}
let tankAnim = 0;
function animateTank(T1, T2) { cancelAnimationFrame(tankAnim); const t0 = performance.now(); world.setTankHeating(true); const step = () => { const u = Math.min(1, (performance.now() - t0) / 3200), T = T1 + (T2 - T1) * (1 - Math.pow(1 - u, 2)); world.setTank(T); if (u < 1) tankAnim = requestAnimationFrame(step); else world.setTankHeating(false); }; step(); }
async function genNew() {
  const p = S.p3; p.loading = true; render();
  const r = await generateProblem(p.prev); p.loading = false; p.case = r.problem; p.prev.push(r.problem); p.hints = 0; p.wrong = 0; p.shown = []; p.solvedCur = false; p.fb = r.note ? `<div class="card">${esc(r.note)}</div>` : '';
  world.setTank(r.problem.T1); render(); toast(r.via === 'gemini' ? 'Soal baru dibuat oleh Gemini ✦' : 'Soal variasi baru dibuat ✦', 'ok');
}

/* ----- Tahap 4: Efisiensi ----- */
const BASE_COST = 15_000_000;
const FIX = {
  insul: { pos: [6, 1.9, .5], save: .05, title: 'Pipa boiler → header terasa sangat panas & tidak berisolasi', opts: [['Bungkus dengan isolasi termal', 1], ['Naikkan tekanan boiler agar steam tetap panas', 0], ['Cat pipa dengan warna terang', 0]], good: 'Isolasi termal pada pipa mengurangi kehilangan panas ke lingkungan.' },
  trap: { pos: [-3, 2.2, 3], save: .04, title: 'Terdengar dentuman (water hammer) & ada steam lolos di sekitar trap', opts: [['Perbaiki/ganti steam trap dan pasang di titik terendah', 1], ['Buka bypass trap permanen', 0], ['Lepas trap agar kondensat bebas keluar', 0]], good: 'Steam trap yang benar membuang kondensat tetapi menahan steam, mencegah water hammer.' },
  cond: { pos: [-6, 3.4, 3], save: .18, title: 'Kondensat panas (±90 °C) dibuang ke saluran drain', opts: [['Kembalikan ke deaerator / tangki umpan', 1], ['Tetap dibuang agar air selalu segar', 0], ['Campur dengan air pendingin lalu buang', 0]], good: 'Pengembalian kondensat menghemat energi panas 15–20% dan air demin (materi: condensate return).' },
  blow: { pos: [5, 1.0, -.6], save: .03, title: 'Blowdown boiler dibuang langsung padahal bersuhu tinggi', opts: [['Pasang blowdown heat recovery (flash tank / penukar panas)', 1], ['Hentikan blowdown sama sekali', 0], ['Perbesar blowdown agar air lebih bersih', 0]], good: 'Blowdown heat recovery memanfaatkan panas buangan; blowdown tetap perlu untuk mengontrol TDS.' },
};
function setupMarkers() { for (const k in FIX) world.setMarker(k, new THREE.Vector3(...FIX[k].pos), S.fix[k] === 'ok' ? 'ok' : 'bad'); }
const saving = () => Object.entries(FIX).reduce((a, [k, f]) => a + (S.fix[k] === 'ok' ? f.save : 0), 0);
function s4() {
  const sv = saving(), cost = BASE_COST * (1 - sv), n = Object.values(S.fix).filter(v => v === 'ok').length;
  const cur = S.curFix;
  body.innerHTML = `
  <span class="tag">Tahap 5 / 6 · ±3 menit</span>
  <h2>Audit Efisiensi Plant</h2>
  <p class="muted">Ada 4 titik <span style="color:#ff5d6c">merah ●</span> bermasalah di plant. Ketuk titik di 3D (atau tombol di bawah), pilih tindakan yang tepat, lalu lihat penghematan bahan bakar.</p>
  <div class="card"><div class="kv"><span>Biaya bahan bakar / hari*</span><b>${rp(cost)}</b><span>Penghematan</span><b>${fmt(sv * 100, 0)}% (${rp(BASE_COST * sv)})</b></div>
    <div class="bar" style="margin-top:8px"><i style="width:${sv / .3 * 100}%"></i></div>
    <div class="muted" style="margin-top:6px">*Angka ilustrasi pembelajaran (basis ${rp(BASE_COST)}/hari); persen hemat kondensat 15–20% dari materi.</div></div>
  <div class="chips">${Object.keys(FIX).map(k => `<span class="chip ${S.fix[k] === 'ok' ? 'done' : cur === k ? 'sel' : ''}" data-act="fix" data-k="${k}">${{ insul: 'Isolasi pipa', trap: 'Steam trap', cond: 'Kondensat', blow: 'Blowdown' }[k]}</span>`).join('')}</div>
  ${cur ? `<div class="card"><b>${esc(FIX[cur].title)}</b>${S.fix[cur] === 'ok' ? `<div class="card ok">✅ ${esc(FIX[cur].good)}</div>` : FIX[cur].opts.map((o, i) => `<button class="opt ${S.fixBad === cur + i ? 'wrong' : ''}" data-act="opt" data-k="${cur}" data-i="${i}">${esc(o[0])}</button>`).join('')}${S.fixMsg ? `<div class="muted">${esc(S.fixMsg)}</div>` : ''}</div>` : ''}
  ${next(n === 4, n === 4 ? 'Ke ringkasan ▶' : 'Lanjut ▶')}`;
}
function openFix(k) { S.curFix = k; S.fixMsg = ''; S.fixBad = null; render(); }
function chooseFix(k, i) {
  const f = FIX[k]; if (S.fix[k] === 'ok') return;
  if (f.opts[i][1]) {
    S.fix[k] = 'ok'; S.fixMsg = ''; addPts('fix', Object.values(S.fix).filter(v => v === 'ok').length * 5);
    if (k === 'insul') world.lagging.visible = true; world.setMarker(k, new THREE.Vector3(...f.pos), 'ok'); toast('Perbaikan tepat ✓ hemat ' + fmt(f.save * 100, 0) + '%', 'ok');
  } else { S.fixBad = k + i; S.fixMsg = 'Kurang tepat, coba opsi lain. Ingat: tujuannya menurunkan kehilangan energi tanpa merusak keselamatan.'; toast('Kurang tepat', 'bad'); }
  render();
}

/* ----- Tahap 5: Ringkasan & kuis ----- */
const QBANK = [
  ['Fungsi utama deaerator pada sistem steam adalah…', ['Menaikkan tekanan air umpan', 'Menghilangkan oksigen dan gas terlarut', 'Memisahkan kondensat dari steam', 'Mengubah steam menjadi superpanas'], 1],
  ['Keuntungan pengembalian kondensat ke deaerator adalah…', ['Menghemat energi panas 15–20% dan air demin', 'Menaikkan tekanan boiler', 'Mengurangi kebutuhan isolasi', 'Menghilangkan blowdown'], 0],
  ['Steam yang paling sesuai untuk menggerakkan turbin adalah…', ['Steam basah', 'Steam jenuh bertekanan rendah', 'Steam superpanas', 'Kondensat panas'], 2],
  ['Steam trap berfungsi untuk…', ['Menurunkan tekanan steam', 'Menahan steam dan membuang kondensat', 'Memanaskan air umpan', 'Mengukur aliran steam'], 1],
  ['Rumus kebutuhan steam untuk pemanasan (kondensat keluar pada T2) adalah…', ['Q / hfg saja', 'Q / (hg − h kondensat)', 'Q × hg', 'm·cp / hf'], 1],
  ['Panas laten (hfg) adalah energi untuk…', ['Menaikkan suhu air sampai titik didih', 'Mengubah air menjadi uap pada suhu tetap', 'Memanaskan uap lewat jenuh', 'Mendinginkan kondensat'], 1],
  ['Economizer memanfaatkan…', ['Panas gas buang untuk memanaskan awal air umpan', 'Steam bertekanan rendah', 'Panas kondensat', 'Listrik'], 0],
];
function pickQuiz() { return [...QBANK].sort(() => Math.random() - .5).slice(0, 4); }
function s5() {
  const q = S.quiz, answered = Object.keys(S.quizAns).length, qpts = Object.values(S.quizAns).filter(x => x.ok).length * 5;
  addPts('kuis', qpts);
  const fin = answered === q.length, tot = ptsTotal(), pct = Math.min(100, Math.round(tot / MAXPTS * 100)), mins = Math.round((Date.now() - S.t0) / 60000);
  body.innerHTML = `
  <span class="tag">Tahap 6 / 6 · ±2 menit</span>
  <h2>Kuis Penguat & Ringkasan</h2>
  ${q.map((x, qi) => `<div class="card"><b>${qi + 1}. ${esc(x[0])}</b>${x[1].map((o, oi) => { const a = S.quizAns[qi]; const cls = a ? (oi === x[2] ? 'right' : (a.pick === oi ? 'wrong' : '')) : ''; return `<button class="opt ${cls}" data-act="qa" data-q="${qi}" data-o="${oi}" ${a ? 'disabled' : ''}>${esc(o)}</button>`; }).join('')}</div>`).join('')}
  ${fin ? `<div class="card ok"><h3 style="margin-top:0">Hasil belajarmu</h3><div class="kv"><span>Skor</span><b>${tot} / ${MAXPTS} (${pct}%)</b><span>Waktu</span><b>${mins} menit</b><span>Kesalahan perakitan</span><b>${S.wrong}</b><span>Soal hitung diselesaikan</span><b>${S.p3.solved.length}</b><span>Penghematan bahan bakar</span><b>${fmt(saving() * 100, 0)}%</b></div>
    <p class="muted">${pct >= 80 ? 'Sangat baik! Kamu menguasai sistem penyedia steam.' : pct >= 60 ? 'Baik. Ulangi tahap Hitung untuk memantapkan.' : 'Ulangi tahap yang kurang dan coba soal variasi AI.'}</p>
    <div class="row"><button data-act="copy">Salin ringkasan</button><button data-act="again">Ulangi dari awal</button></div></div>` : '<p class="muted">Jawab semua soal untuk melihat hasil.</p>'}`;
}

/* ---------------- Event HUD ---------------- */
body.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act, d = el.dataset;
  if (a === 'next') { go(S.stage + 1); }
  else if (a === 'info') { inspect(d.id); }
  else if (a === 'sel') { if (!world.placed.has(d.id)) { S.sel = d.id; render(); } }
  else if (a === 'slot') { tryPlace(d.id); }
  else if (a === 'sc') { S.scIdx = +d.i; render(); }
  else if (a === 'mode') { S.bSuper = d.v === '1'; if (S.bSuper) S.bT = Math.max(S.bT, Math.ceil(sat(S.bP).Ts / 5) * 5 + 5); syncBoilerUI(); }
  else if (a === 'chk') { checkBoiler(); }
  else if (a === 'hint') { const p = S.p3; p.shown = p.shown || []; if (!p.shown.includes(+d.n)) { p.shown.push(+d.n); p.hints++; } render(); }
  else if (a === 'ans') { checkAns(); }
  else if (a === 'gen') { genNew(); }
  else if (a === 'fix') { openFix(d.k); }
  else if (a === 'opt') { chooseFix(d.k, +d.i); }
  else if (a === 'qa') { const q = S.quiz[+d.q]; S.quizAns[+d.q] = { pick: +d.o, ok: +d.o === q[2] }; render(); }
  else if (a === 'copy') { const t = `SteamLab – skor ${ptsTotal()}/${MAXPTS}, penghematan ${fmt(saving() * 100, 0)}%, waktu ${Math.round((Date.now() - S.t0) / 60000)} menit`; navigator.clipboard?.writeText(t); toast('Ringkasan disalin', 'ok'); }
  else if (a === 'again') { location.reload(); }
});
body.addEventListener('input', e => {
  if (e.target.id === 'rP') { S.bP = +e.target.value; if (S.bSuper) S.bT = Math.max(S.bT, Math.ceil(sat(S.bP).Ts / 5) * 5 + 5); const r = $('#rT'); if (r) r.value = S.bT; syncBoilerUI(); }
  else if (e.target.id === 'rT') { S.bT = +e.target.value; syncBoilerUI(); }
});
body.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'ans') checkAns(); });

function onPick(t) {
  if (t.compId) { if (S.stage === 0) inspect(t.compId); else { world.setLabelsVisible(false); world.comps[t.compId].label.visible = true; toast(world.comps[t.compId].def.name); } }
  else if (t.slotId) tryPlace(t.slotId);
  else if (t.marker && S.stage === 4) openFix(t.marker);
}

/* ---------------- Dialog AI ---------------- */
$('#btnAI').onclick = () => { $('#aiKey').value = aiCfg.key; $('#aiModel').value = aiCfg.model; $('#dlgAI').showModal(); };
$('#aiSave').onclick = () => { aiCfg.set($('#aiKey').value.trim(), $('#aiModel').value.trim()); toast(aiCfg.key ? 'Gemini aktif ✦' : 'Memakai mesin generatif bawaan', 'ok'); if (S.stage === 3) setTimeout(render, 50); };

/* ---------------- WebXR (AR/VR) + fallback model-viewer ---------------- */
let xr = { mode: null, session: null, reticle: null, placed: false, src: null, hitSpace: null, viewerSpace: null };
const ctrls = [0, 1].map(i => { const c = renderer.xr.getController(i); c.addEventListener('select', () => onXRSelect(c)); scene.add(c); return c; });
function onXRSelect(c) {
  if (xr.mode === 'ar' && !xr.placed) { if (xr.reticle.visible) { world.group.position.setFromMatrixPosition(xr.reticle.matrix); world.group.visible = true; xr.placed = true; xr.reticle.visible = false; toast('Sistem diletakkan. Ketuk komponen untuk info/memasang.'); } return; }
  const m = new THREE.Matrix4().identity().extractRotation(c.matrixWorld); ray.ray.origin.setFromMatrixPosition(c.matrixWorld); ray.ray.direction.set(0, 0, -1).applyMatrix4(m);
  const t = pick(ray); if (t) onPick(t);
}
const reticle = new THREE.Mesh(new THREE.RingGeometry(.12, .16, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffa24d }));
reticle.matrixAutoUpdate = false; reticle.visible = false; scene.add(reticle); xr.reticle = reticle;

async function xrSupported(mode) { try { return !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-' + mode)); } catch { return false; } }
async function startXR(mode) {
  const init = mode === 'ar' ? { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: $('#app') } } : { optionalFeatures: ['local-floor', 'bounded-floor'] };
  try {
    const session = await navigator.xr.requestSession('immersive-' + mode, init);
    xr.mode = mode; xr.session = session; xr.placed = false;
    scene.background = mode === 'ar' ? null : new THREE.Color(0x0e141b);
    renderer.xr.setReferenceSpaceType('local'); await renderer.xr.setSession(session);
    const g = world.group; xr.saved = { s: g.scale.clone(), p: g.position.clone() };
    if (mode === 'ar') {
      document.body.classList.add('xr-ar'); g.scale.setScalar(.04); g.visible = false;
      xr.viewerSpace = await session.requestReferenceSpace('viewer'); xr.hitSource = await session.requestHitTestSource({ space: xr.viewerSpace });
      toast('Arahkan kamera ke meja/lantai lalu ketuk untuk meletakkan sistem.');
    } else { g.scale.setScalar(.55); g.position.set(0, 0, -5); toast('Mode VR: arahkan controller ke komponen lalu tekan trigger.'); }
    session.addEventListener('end', () => { const g = world.group; g.scale.copy(xr.saved.s); g.position.copy(xr.saved.p); g.visible = true; document.body.classList.remove('xr-ar'); scene.background = new THREE.Color(0x0e141b); xr.mode = null; xr.hitSource = null; reticle.visible = false; resize(); });
  } catch (err) { toast('Gagal memulai ' + mode.toUpperCase() + ': ' + err.message, 'bad'); }
}
function xrFrame(frame) {
  if (xr.mode !== 'ar' || xr.placed || !xr.hitSource) return;
  const hits = frame.getHitTestResults(xr.hitSource);
  if (hits.length) { const pose = hits[0].getPose(renderer.xr.getReferenceSpace()); reticle.visible = true; reticle.matrix.fromArray(pose.transform.matrix); } else reticle.visible = false;
}
async function openARFallback() {
  const dlg = $('#dlgAR'), host = $('#arHost'); host.innerHTML = '<p class="muted">Menyiapkan model 3D…</p>'; $('#arNote').textContent = ''; dlg.showModal();
  try {
    const [{ GLTFExporter }] = await Promise.all([import('three/addons/exporters/GLTFExporter.js'), import('https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js')]);
    const hide = []; world.group.traverse(o => { if (o.isSprite || o.isInstancedMesh || (o.isMesh && o.geometry.type === 'RingGeometry')) { if (o.visible) { hide.push(o); o.visible = false; } } });
    const keepScale = world.group.scale.clone(); world.group.scale.setScalar(.12);
    const buf = await new GLTFExporter().parseAsync(world.group, { binary: true, onlyVisible: true });
    world.group.scale.copy(keepScale); hide.forEach(o => o.visible = true);
    if (xr.src) URL.revokeObjectURL(xr.src); xr.src = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' }));
    host.innerHTML = `<model-viewer src="${xr.src}" alt="Sistem penyedia steam" ar ar-modes="webxr scene-viewer quick-look" ar-scale="auto" camera-controls auto-rotate shadow-intensity="1" exposure="1.1"><button slot="ar-button" class="primary" style="position:absolute;bottom:12px;left:50%;transform:translateX(-50%)">📱 Lihat di ruanganmu (AR)</button></model-viewer>`;
    $('#arNote').textContent = 'Di ponsel yang mendukung, tekan “Lihat di ruanganmu” (Android: Scene Viewer/WebXR, iPhone: AR Quick Look). Model berisi komponen yang sudah kamu pasang.';
  } catch (e) { host.innerHTML = '<p class="muted">Gagal menyiapkan AR: ' + esc(e.message) + '</p>'; }
}
$('#arClose').onclick = () => $('#dlgAR').close();
$('#btnAR').onclick = async () => { if (await xrSupported('ar')) startXR('ar'); else openARFallback(); };
$('#btnVR').onclick = async () => { if (await xrSupported('vr')) startXR('vr'); else toast('Browser/perangkat ini belum mendukung WebXR VR. Pakai headset (Quest Browser) atau mode jelajah 3D.', 'bad'); };

/* ---------------- Loop ---------------- */
const clock = new THREE.Clock();
renderer.setAnimationLoop((_, frame) => {
  const dt = Math.min(.05, clock.getDelta());
  if (tween) { tween.t = Math.min(1, tween.t + dt / 1.1); const k = 1 - Math.pow(1 - tween.t, 3); camera.position.lerpVectors(tween.p0, tween.p1, k); controls.target.lerpVectors(tween.t0, tween.t1, k); if (tween.t >= 1) tween = null; }
  if (!renderer.xr.isPresenting) controls.update();
  world.update(dt); if (frame) xrFrame(frame);
  renderer.render(scene, camera);
});
setInterval(() => { const s = Math.floor((Date.now() - S.t0) / 1000); $('#clock').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }, 1000);
(async () => { if (!(await xrSupported('vr'))) $('#btnVR').title = 'VR: perlu headset/WebXR'; })();

drawSteps(); go(0); setTimeout(() => $('#loading').classList.add('gone'), 600);
window.__S = S; window.__world = world; window.__go = go; // untuk pengujian

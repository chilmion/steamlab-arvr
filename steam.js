// Fisika steam + mesin generatif soal (offline) + konektor Gemini (opsional).
// Semua kunci jawaban SELALU dihitung oleh kode ini, bukan oleh AI, supaya valid.

// Tabel uap jenuh (tekanan absolut bar): Ts [°C], hf, hfg, hg [kJ/kg]
export const SAT = [
  [1.0, 99.6, 417.5, 2257.5, 2675.0],
  [1.5, 111.4, 467.1, 2226.5, 2693.6],
  [2.0, 120.2, 504.7, 2201.6, 2706.3],
  [3.0, 133.5, 561.5, 2163.5, 2725.3],
  [4.0, 143.6, 604.7, 2133.8, 2738.6],
  [5.0, 151.8, 640.1, 2108.5, 2748.7],
  [6.0, 158.8, 670.4, 2085.0, 2756.8],
  [8.0, 170.4, 721.1, 2048.0, 2769.1],
  [10., 179.9, 762.8, 2015.3, 2778.1],
  [15., 198.3, 844.9, 1947.3, 2792.2],
  [20., 212.4, 908.8, 1890.7, 2799.5],
  [30., 233.9, 1008.4, 1795.7, 2804.2],
  [40., 250.4, 1087.3, 1714.1, 2801.4],
  [50., 263.9, 1154.2, 1640.1, 2794.3],
];
export const CP_STEAM = 2.1;   // kJ/kg.K (materi kuliah)
export const CP_WATER = 4.18;  // kJ/kg.K

export function sat(P) {
  P = Math.min(50, Math.max(1, P));
  let i = 0;
  while (i < SAT.length - 2 && P > SAT[i + 1][0]) i++;
  const a = SAT[i], b = SAT[i + 1], f = (P - a[0]) / (b[0] - a[0]);
  const L = k => a[k] + (b[k] - a[k]) * f;
  return { P, Ts: L(1), hf: L(2), hfg: L(3), hg: L(4) };
}
export function steamState(P, superheat, T) {
  const s = sat(P);
  if (!superheat) return { ...s, T: s.Ts, h: s.hg, kind: 'jenuh' };
  const Tt = Math.max(T, s.Ts);
  return { ...s, T: Tt, h: s.hg + CP_STEAM * (Tt - s.Ts), kind: Tt > s.Ts + 0.5 ? 'superpanas' : 'jenuh' };
}

// Kebutuhan steam untuk memanaskan m kg fluida (cp) dari T1 ke T2; kondensat keluar pada T2.
export function steamNeed({ mass, cp, T1, T2, P }) {
  const s = sat(P);
  const Q = mass * cp * (T2 - T1);              // kJ
  const hc = CP_WATER * T2;                     // entalpi kondensat pada T2
  const dh = s.hg - hc;
  return { Q, hc, hg: s.hg, dh, ms: Q / dh, Ts: s.Ts, hfg: s.hfg };
}

export const FLUIDS = [
  { name: 'air proses', cp: 4.18 },
  { name: 'minyak nabati (CPO)', cp: 2.0 },
  { name: 'larutan gula 30%', cp: 3.7 },
  { name: 'susu segar', cp: 3.9 },
  { name: 'larutan NaOH 20%', cp: 3.4 },
  { name: 'metanol–minyak (reaktan biodiesel)', cp: 2.3 },
];
const PRESS = [2, 3, 4, 5, 6, 8];
const rnd = (a, b, step = 1) => Math.round((a + Math.random() * (b - a)) / step) * step;
const pick = a => a[Math.floor(Math.random() * a.length)];

export const LECTURE_CASE = {
  id: 'kuliah', fluid: 'air', cp: 4.18, mass: 5000, T1: 30, T2: 90, P: 3,
  story: 'Sebuah unit proses membutuhkan pemanasan 5.000 kg air dari 30 °C menjadi 90 °C dengan steam jenuh 3 bar. Kondensat keluar pada 90 °C. (Contoh soal materi kuliah.)',
  source: 'materi',
};

// Mesin generatif bawaan: menyusun variasi soal acak + cerita kasus industri.
export function offlineProblem() {
  const f = pick(FLUIDS), P = pick(PRESS), s = sat(P);
  const T1 = rnd(20, 50, 5);
  const T2 = Math.min(rnd(T1 + 30, 120, 5), Math.floor((s.Ts - 8) / 5) * 5);
  const mass = rnd(800, 12000, 100);
  const ctx = pick([
    'Pabrik biodiesel perlu menaikkan suhu', 'Unit pasteurisasi pabrik makanan memanaskan',
    'Tangki pencampur pabrik tekstil memanaskan', 'Reboiler pabrik oleokimia memanaskan',
    'Pabrik pupuk cair memanaskan'
  ]);
  return {
    id: 'g' + Date.now(), fluid: f.name, cp: f.cp, mass, T1, T2: Math.max(T2, T1 + 20), P,
    story: `${ctx} ${mass.toLocaleString('id-ID')} kg ${f.name} (cp = ${f.cp} kJ/kg·K) dari ${T1} °C menjadi ${Math.max(T2, T1 + 20)} °C memakai steam jenuh ${P} bar (abs). Kondensat keluar pada suhu akhir proses. Berapa kg steam yang dibutuhkan?`,
    source: 'offline',
  };
}

// Validasi/sanitasi keluaran AI → selalu aman dipakai
export function sanitize(p) {
  const n = x => Number(x);
  const P = PRESS.includes(n(p.P)) ? n(p.P) : null;
  if (!P) return null;
  const o = { id: 'ai' + Date.now(), fluid: String(p.fluid || 'fluida proses').slice(0, 60), cp: n(p.cp), mass: n(p.mass), T1: n(p.T1), T2: n(p.T2), P, story: String(p.story || '').slice(0, 600), source: 'gemini' };
  if (!(o.cp >= 1 && o.cp <= 5 && o.mass >= 500 && o.mass <= 20000 && o.T1 >= 10 && o.T1 <= 60)) return null;
  if (!(o.T2 >= o.T1 + 15 && o.T2 <= sat(P).Ts - 5)) return null;
  if (o.story.length < 30) o.story = `Panaskan ${o.mass} kg ${o.fluid} (cp ${o.cp}) dari ${o.T1} ke ${o.T2} °C dengan steam jenuh ${P} bar. Hitung kebutuhan steam.`;
  return o;
}

export const aiCfg = {
  get key() { try { return localStorage.getItem('sl_key') || ''; } catch { return ''; } },
  get model() { try { return localStorage.getItem('sl_model') || 'gemini-2.5-flash'; } catch { return 'gemini-2.5-flash'; } },
  set(k, m) { try { localStorage.setItem('sl_key', k); localStorage.setItem('sl_model', m || 'gemini-2.5-flash'); } catch {} },
};

async function gemini(prompt, json = false) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(aiCfg.model)}:generateContent`;
  const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9, ...(json ? { responseMimeType: 'application/json' } : {}) } };
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': aiCfg.key }, body: JSON.stringify(body), signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    return j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  } finally { clearTimeout(to); }
}

// Mengembalikan {problem, via:'gemini'|'offline', note}
export async function generateProblem(prev = []) {
  if (aiCfg.key) {
    try {
      const prompt = `Kamu adalah asisten dosen Utilitas Industri (Teknik Kimia). Buat SATU variasi soal baru tentang kebutuhan steam untuk memanaskan fluida proses dengan steam jenuh, kondensat keluar pada suhu akhir.
Balas HANYA JSON dengan kunci: fluid (string, nama fluida di industri Indonesia), cp (kJ/kg.K, angka realistis fluida itu), mass (kg, 800-12000), T1 (C, 20-50), T2 (C, minimal T1+20), P (tekanan steam bar absolut, HARUS salah satu dari 2,3,4,5,6,8; T2 harus <= suhu jenuh pada P dikurangi 8), story (cerita kasus 2-3 kalimat bahasa Indonesia yang kontekstual di pabrik nyata, tanpa menyebut jawaban). Hindari mengulang: ${prev.map(p => p.fluid).join(', ') || '-'}.`;
      const txt = await gemini(prompt, true);
      const p = sanitize(JSON.parse(txt.replace(/^```json|```$/g, '').trim()));
      if (p) return { problem: p, via: 'gemini' };
      throw new Error('keluaran AI tidak valid');
    } catch (e) {
      return { problem: offlineProblem(), via: 'offline', note: 'Gemini gagal (' + e.message + '), memakai mesin generatif bawaan.' };
    }
  }
  return { problem: offlineProblem(), via: 'offline' };
}

// Diagnosis miskonsepsi (aturan) – selalu tersedia
export function diagnose(p, ans) {
  const k = steamNeed(p);
  const cands = [
    [k.Q / k.hfg, 'Kamu memakai panas laten (hfg) saja. Kondensat keluar masih panas (hc = cp·T2), jadi pembagi harus hg − hc.'],
    [k.Q / k.hg, 'Kamu membagi dengan hg saja. Lupa mengurangi entalpi kondensat yang keluar (hc = 4,18 × T2).'],
    [k.ms * 1000, 'Satuan keliru: hasilmu 1000× terlalu besar. Cek kg vs ton.'],
    [k.ms / 1000, 'Satuan keliru: hasilmu 1000× terlalu kecil. Cek kg vs ton.'],
    [p.mass * (p.T2 - p.T1) / k.dh, 'Kamu lupa mengalikan dengan cp fluida saat menghitung Q = m·cp·ΔT.'],
    [k.Q / (k.hg - CP_WATER * p.T1), 'Entalpi kondensat memakai T awal. Kondensat keluar pada T2 (suhu akhir proses).'],
  ];
  for (const [v, msg] of cands) if (Math.abs(ans - v) / v < 0.04) return msg;
  if (ans < k.ms) return 'Jawabanmu lebih kecil dari kebutuhan: steam yang ada tidak cukup mencapai suhu target.';
  return 'Jawabanmu lebih besar dari kebutuhan: ada energi yang tidak perlu (overheating). Periksa lagi Q dan selisih entalpi.';
}

export async function tutorFeedback(p, ans) {
  const k = steamNeed(p), rule = diagnose(p, ans);
  if (!aiCfg.key) return { text: rule, via: 'aturan' };
  try {
    const prompt = `Kamu tutor Utilitas Industri yang sabar. Mahasiswa menjawab ${ans.toFixed(1)} kg steam untuk soal: "${p.story}". Kunci (dihitung program, jangan diubah): Q=${k.Q.toFixed(0)} kJ, hg=${k.hg.toFixed(1)}, hc=${k.hc.toFixed(1)}, steam=${k.ms.toFixed(1)} kg. Dugaan sistem: ${rule}
Beri umpan balik Socratic maksimal 3 kalimat bahasa Indonesia: tunjuk langkah yang kemungkinan keliru dan beri satu pertanyaan pemandu. JANGAN langsung menyebut angka jawaban benar.`;
    const t = await gemini(prompt, false);
    return { text: t.trim() || rule, via: 'gemini' };
  } catch { return { text: rule, via: 'aturan' }; }
}

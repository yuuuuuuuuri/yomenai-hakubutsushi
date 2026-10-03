// glyphs.js — 座標を文字にする規則
//
// 生き物の「座標」（語彙空間の主成分座標）を、決まった規則で文字列に変換する。
//
//   - 1文字は座標の 8 次元ぶんを受け持つ。
//   - 名前は「属名 2 文字（主成分 1–16）＋ 種名 1–5 文字（主成分 17–56）」。
//     主成分は番号が若いほど語彙全体の大きな違いを表すので、属名は大まかな位置、
//     種名は細かな位置を書き表すことになる。近い生き物は属名を共有しやすい。
//   - 字形は座標の連続関数として決まる。座標が少し動けば、字形も少しだけ動く。
//     （線の太さ・曲がり・格子点のずれはすべて滑らかに変化し、急に切り替わらない）
//   - 規則（投影行列）は固定の種から一度だけ作られる。つまりこの本全体で一つの文字体系。
//
// ブラウザでは window.Glyphs、Node では module.exports として使える。

(function (global) {
  'use strict';

  const DIMS = 8;               // 1文字が受け持つ次元数
  const GENUS_LEN = 2;          // 属名の文字数
  const MAX_SPECIES = 5;        // 種名の最大文字数
  const STROKES = 4;            // 1文字あたりのおおよその画数
  const GAIN = 9;               // 画の現れ方の鋭さ（大きいほどくっきり、ただし連続性は保たれる）
  const SCRIPT_SEED = 0x5eed1e; // 文字体系の種。変えると別の文字体系になる

  // 3×3 の格子点と、その間に引ける 20 本の画の候補
  const NODES = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) NODES.push([c / 2, r / 2]);
  const SEGMENTS = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      if (c < 2) SEGMENTS.push([i, i + 1]);
      if (r < 2) SEGMENTS.push([i, i + 3]);
      if (r < 2 && c < 2) {
        SEGMENTS.push([i, i + 4]);
        SEGMENTS.push([i + 1, i + 3]);
      }
    }
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gaussian(rng) {
    const u = Math.max(rng(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  }

  function unitRows(rng, rows, cols) {
    const m = [];
    for (let r = 0; r < rows; r++) {
      const row = Array.from({ length: cols }, () => gaussian(rng));
      const n = Math.hypot(...row);
      m.push(row.map((v) => v / n));
    }
    return m;
  }

  const rng = mulberry32(SCRIPT_SEED);
  const W_STROKE = unitRows(rng, SEGMENTS.length, DIMS);
  const W_BEND = unitRows(rng, SEGMENTS.length, DIMS);
  const W_DOT = unitRows(rng, NODES.length, DIMS);
  const W_JITTER = unitRows(rng, NODES.length * 2, DIMS);

  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const sigmoid = (x) => 1 / (1 + Math.exp(-x));
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  // 8 次元のかたまり → 1 文字
  // 向きが字形を決め、大きさが墨の濃さを決める。
  function glyphFromChunk(chunk) {
    const c = Array.from({ length: DIMS }, (_, i) => chunk[i] || 0);
    const norm = Math.hypot(...c);
    const scale = Math.sqrt(DIMS) / Math.max(norm, 1e-6);
    const u = c.map((v) => v * scale);
    const ink = clamp(0.8 + 0.2 * Math.tanh(norm / Math.sqrt(DIMS) - 1), 0.6, 1);

    // 画の閾値は「4番目と5番目に強い候補の中間」。順位統計量は入力の連続関数なので、
    // 画数をほぼ一定に保ちながら、字形が急に切り替わることはない。
    const scores = W_STROKE.map((w) => dot(w, u));
    const sorted = [...scores].sort((a, b) => b - a);
    const tau = (sorted[STROKES - 1] + sorted[STROKES]) / 2;

    const nodes = NODES.map(([x, y], k) => [
      x + 0.075 * Math.tanh(dot(W_JITTER[2 * k], u)),
      y + 0.075 * Math.tanh(dot(W_JITTER[2 * k + 1], u)),
    ]);

    const strokes = [];
    scores.forEach((s, i) => {
      const t = sigmoid(GAIN * (s - tau));
      if (t < 0.04) return;
      strokes.push({ a: SEGMENTS[i][0], b: SEGMENTS[i][1], t, bend: 0.26 * Math.tanh(dot(W_BEND[i], u)) });
    });

    const dots = [];
    W_DOT.forEach((w, k) => {
      const r = sigmoid(GAIN * (dot(w, u) - 1.75));
      if (r > 0.06) dots.push({ n: k, r });
    });

    return { nodes, strokes, dots, ink };
  }

  // 座標 → 名前（属名と種名の字形の並び）
  function nameFromCoords(coords, speciesLen) {
    const len = clamp(Math.round(speciesLen), 1, MAX_SPECIES);
    const chunk = (k) => coords.slice(k * DIMS, (k + 1) * DIMS);
    const genus = Array.from({ length: GENUS_LEN }, (_, k) => glyphFromChunk(chunk(k)));
    const species = Array.from({ length: len }, (_, k) => glyphFromChunk(chunk(GENUS_LEN + k)));
    return { genus, species };
  }

  // 既知からの遠さ（0–1 に正規化済み）→ 種名の文字数。遠いほど長い名前になる。
  function speciesLengthFor(farness01) {
    return 2 + Math.round(clamp(farness01, 0, 1) * (MAX_SPECIES - 2));
  }

  // ---- 描画 ----

  // 1 画を、筆のように中央が太く両端が細い輪郭として描く
  function strokeOutline(p0, p1, bend, width) {
    const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const len = Math.hypot(dx, dy) || 1;
    const cx = mx - (dy / len) * bend * len, cy = my + (dx / len) * bend * len;
    const N = 18, left = [], right = [];
    for (let i = 0; i <= N; i++) {
      const s = i / N, is = 1 - s;
      const x = is * is * p0[0] + 2 * is * s * cx + s * s * p1[0];
      const y = is * is * p0[1] + 2 * is * s * cy + s * s * p1[1];
      const tx = 2 * is * (cx - p0[0]) + 2 * s * (p1[0] - cx);
      const ty = 2 * is * (cy - p0[1]) + 2 * s * (p1[1] - cy);
      const tl = Math.hypot(tx, ty) || 1;
      const w = (width / 2) * (0.5 + 0.5 * Math.sin(Math.PI * s));
      left.push([x - (ty / tl) * w, y + (tx / tl) * w]);
      right.push([x + (ty / tl) * w, y - (tx / tl) * w]);
    }
    const pts = left.concat(right.reverse());
    const f = (v) => v.toFixed(2);
    return 'M' + pts.map((p) => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z';
  }

  // 1 文字を SVG の <g> として返す。(x, y) は文字枠の左上、size は一辺。
  function glyphSVG(g, x, y, size, color) {
    const pad = size * 0.16, span = size - 2 * pad;
    const P = (n) => [x + pad + g.nodes[n][0] * span, y + pad + g.nodes[n][1] * span];
    const baseW = size * 0.115 * g.ink;
    let out = `<g fill="${color}">`;
    for (const s of g.strokes) {
      const w = baseW * (0.3 + 0.7 * s.t);
      const p0 = P(s.a), p1 = P(s.b);
      out += `<path d="${strokeOutline(p0, p1, s.bend, w)}" opacity="${clamp(s.t * 1.5, 0, 1).toFixed(3)}"/>`;
      // 起筆と終筆
      out += `<circle cx="${p0[0].toFixed(2)}" cy="${p0[1].toFixed(2)}" r="${(w * 0.34).toFixed(2)}" opacity="${clamp(s.t * 1.5, 0, 1).toFixed(3)}"/>`;
      out += `<circle cx="${p1[0].toFixed(2)}" cy="${p1[1].toFixed(2)}" r="${(w * 0.26).toFixed(2)}" opacity="${clamp(s.t * 1.5, 0, 1).toFixed(3)}"/>`;
    }
    for (const d of g.dots) {
      const p = P(d.n);
      out += `<circle cx="${p[0].toFixed(2)}" cy="${p[1].toFixed(2)}" r="${(baseW * 0.62 * d.r).toFixed(2)}" opacity="${clamp(d.r * 1.4, 0, 1).toFixed(3)}"/>`;
    }
    return out + '</g>';
  }

  // 名前全体を SVG 文字列として返す。
  // opts: { size, color, vertical, gap (属名と種名の間), tracking (文字間) }
  function nameSVG(name, opts = {}) {
    const size = opts.size || 48;
    const color = opts.color || 'currentColor';
    const tracking = (opts.tracking ?? 0.04) * size;
    const gap = (opts.gap ?? 0.55) * size;
    const glyphs = [...name.genus.map((g) => [g, 0]), ...name.species.map((g) => [g, 1])];
    let pos = 0, body = '';
    glyphs.forEach(([g, part], i) => {
      if (i > 0) pos += tracking + (part === 1 && glyphs[i - 1][1] === 0 ? gap : 0);
      body += opts.vertical ? glyphSVG(g, 0, pos, size, color) : glyphSVG(g, pos, 0, size, color);
      pos += size;
    });
    const w = opts.vertical ? size : pos, h = opts.vertical ? pos : size;
    const cls = opts.className ? ` class="${opts.className}"` : '';
    return `<svg${cls} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" role="img" aria-label="読めない名前">${body}</svg>`;
  }

  const api = {
    DIMS, GENUS_LEN, MAX_SPECIES, COORD_DIMS: DIMS * (GENUS_LEN + MAX_SPECIES),
    glyphFromChunk, nameFromCoords, speciesLengthFor, glyphSVG, nameSVG,
    mulberry32, gaussian,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Glyphs = api;
})(typeof window !== 'undefined' ? window : globalThis);

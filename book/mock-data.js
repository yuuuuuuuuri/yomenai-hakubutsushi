// mock-data.js — 試作用のダミーデータ
//
// Colab ノートブック（colab/01_generate_specimens.ipynb）が書き出す data/specimens.js と
// 同じ形をしている。本物のデータが data/specimens.js にあれば、そちらが優先される。
// ここでの座標・否定語・近傍語はすべて乱数で作った仮のもので、意味はない。

(function () {
  if (window.HAKUBUTSUSHI) return;
  const { mulberry32, gaussian, COORD_DIMS } = window.Glyphs;
  const rng = mulberry32(20261004);
  const randn = (n, s = 1) => Array.from({ length: n }, () => gaussian(rng) * s);
  const pick = (arr, k) => [...arr].sort(() => rng() - 0.5).slice(0, k);

  const NEG_POOL = ['猫', 'ハムスター', 'フクロウ', 'カエル', 'トカゲ', 'ウサギ', 'アザラシ', 'ナマケモノ',
    'カメレオン', 'ハリネズミ', 'イモリ', 'コウモリ', 'カワウソ', 'ヤモリ', 'タヌキ', 'ペンギン',
    'イルカ', 'カタツムリ', 'クラゲ', 'ムササビ', 'アルマジロ', 'オコジョ', 'サンショウウオ', 'カピバラ'];
  const WORD_POOL = ['moss', 'lantern', 'velvet', 'tide', 'ember', 'fern', 'pebble', 'hollow', 'quill',
    'marsh', 'shell', 'thorn', 'mist', 'antler', 'resin', 'burrow', 'feather', 'lichen', 'coral', 'dusk'];

  // 部（章）ごとに属名の領域（主成分 1–16）を共有させ、近縁らしさを再現する
  const chapters = [
    { key: 'creature', title: '第一部　生きもの', base: randn(16, 1.0) },
    { key: 'plant', title: '第二部　草木', base: randn(16, 1.0) },
    { key: 'insect', title: '第三部　虫', base: randn(16, 1.0) },
  ];

  const specimens = [];
  let id = 1;
  for (const ch of chapters) {
    for (let k = 0; k < 6; k++) {
      const coords = [...ch.base.map((v) => v + gaussian(rng) * 0.35), ...randn(COORD_DIMS - 16)];
      specimens.push({
        id: id++, seed: k, chapter: ch.key,
        coords,
        farness: 0.25 + 0.6 * rng(),
        negatives: pick(NEG_POOL, 8 + Math.floor(rng() * 5)),
        neighbors: pick(WORD_POOL, 12).map((w) => ({ word: w, cos: 0.1 + 0.25 * rng(), coords: randn(COORD_DIMS) })),
        images: [],
        parents: null,
      });
    }
  }
  // 交配種（両親の座標の中間に少し揺らぎを加えたもの）
  for (const [a, b] of [[1, 2], [3, 8], [13, 15]]) {
    const pa = specimens[a - 1], pb = specimens[b - 1];
    specimens.push({
      id: id++, seed: 100 + a, chapter: pa.chapter,
      coords: pa.coords.map((v, i) => 0.5 * v + 0.5 * pb.coords[i] + gaussian(rng) * 0.15),
      farness: (pa.farness + pb.farness) / 2,
      negatives: [],
      neighbors: pick(WORD_POOL, 12).map((w) => ({ word: w, cos: 0.1 + 0.25 * rng(), coords: randn(COORD_DIMS) })),
      images: [], parents: [a, b],
    });
  }

  const ROSETTA = ['human', 'cat', 'dog', 'bird', 'fish', 'tree', 'flower', 'stone', 'water', 'moon', 'hand', 'eye'];

  window.HAKUBUTSUSHI = {
    mock: true,
    meta: { model: '（試作データ）', created: '2026-10-04' },
    chapters: chapters.map(({ key, title }) => ({ key, title })),
    specimens,
    rosetta: ROSETTA.map((word) => ({ word, coords: randn(COORD_DIMS) })),
  };
})();

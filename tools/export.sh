#!/bin/bash
# 応募画像 4 枚と図鑑の PDF を、Google Chrome のヘッドレスモードで書き出す。
#
#   bash tools/export.sh        # 主役は 1 番の標本
#   bash tools/export.sh 3      # 主役を 3 番の標本にする
#
# 出力：
#   entry/out/icon_1x1.png      1024×1024（文字なし）
#   entry/out/cover_16x9.png    1920×1080 カバーアート
#   entry/out/clean_16x9.png    1920×1080 文字なし版
#   entry/out/poster_2x3.png    1000×1500
#   book/yomenai-hakubutsushi.pdf  B5 の PDF（公開時にウェブ版と同じ場所に置く）
#   book/cover_16x9.png         共有用のプレビュー画像（og:image）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
LEAD="${1:-}"
OUT="$ROOT/entry/out"
mkdir -p "$OUT"

uri() { python3 -c 'import pathlib, sys; print(pathlib.Path(sys.argv[1]).resolve().as_uri())' "$1"; }
VISUALS="$(uri "$ROOT/entry/visuals.html")"
BOOK="$(uri "$ROOT/book/index.html")"

shot() { # name width height file
  local q="v=$1"
  [ -n "$LEAD" ] && q="$q&id=$LEAD"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="$2,$3" --virtual-time-budget=8000 \
    --screenshot="$OUT/$4" "$VISUALS?$q" >/dev/null 2>&1
  echo "  $4"
}

echo "応募画像："
shot icon 1024 1024 icon_1x1.png
shot cover 1920 1080 cover_16x9.png
shot clean 1920 1080 clean_16x9.png
shot poster 1000 1500 poster_2x3.png
cp "$OUT/cover_16x9.png" "$ROOT/book/cover_16x9.png"

echo "PDF："
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=10000 \
  --print-to-pdf="$ROOT/book/yomenai-hakubutsushi.pdf" "$BOOK" >/dev/null 2>&1
echo "  book/yomenai-hakubutsushi.pdf"

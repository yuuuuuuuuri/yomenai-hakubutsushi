#!/bin/bash
# 図鑑の PDF・共有用カバーと、応募画像を、Google Chrome のヘッドレスモードで書き出す。
#
#   bash tools/export.sh             # サイトの最新版（book/）の PDF と共有用カバー
#   bash tools/export.sh entry       # 応募画像 4 枚（応募時点の版 book/2026-10-04/ のデータから）
#   bash tools/export.sh entry 3     # 応募画像の主役を 3 番の標本にする
#
# 出力：
#   book/yomenai-hakubutsushi.pdf  B5 の PDF（応募フォームの「試し読み」URL と同じ名前）
#   book/cover_16x9.png            共有用のプレビュー画像（og:image。各部の 1 体目を並べたもの）
#   entry/out/icon_1x1.png         1024×1024（文字なし。既定はカバーと同じ銅版画の標本箱）
#   entry/out/cover_16x9.png       1920×1080 カバーアート
#   entry/out/clean_16x9.png       1920×1080 文字なし版
#   entry/out/poster_2x3.png       1000×1500
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
MODE="${1:-site}"
LEAD="${2:-}"
OUT="$ROOT/entry/out"

uri() { python3 -c 'import pathlib, sys; print(pathlib.Path(sys.argv[1]).resolve().as_uri())' "$1"; }
VISUALS="$(uri "$ROOT/entry/visuals.html")"
BOOK="$(uri "$ROOT/book/index.html")"

if [ "$MODE" = site ]; then
  echo "サイトの最新版："
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=1920,1080 --virtual-time-budget=8000 \
    --screenshot="$ROOT/book/cover_16x9.png" "$VISUALS?v=cover_parts" >/dev/null 2>&1
  echo "  book/cover_16x9.png"
  "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=15000 \
    --print-to-pdf="$ROOT/book/yomenai-hakubutsushi.pdf" "$BOOK" >/dev/null 2>&1
  echo "  book/yomenai-hakubutsushi.pdf"
  exit 0
fi

mkdir -p "$OUT"
shot() { # name width height file
  local q="v=$1&data=submitted"
  # 1:1 は「文字を入れない」規定なので、既定はカバーと同じ銅版画の標本箱（書き込みを避けて切り抜いた 4 体）。
  # ICON_STYLE=icon_box で 8 体の接写、icon_full で主役の接写を全面、icon で余白つき
  [ "$1" = icon ] && q="v=${ICON_STYLE:-icon_engraving}&img=${ICON_IMG:-3}&data=submitted"
  [ -n "$LEAD" ] && q="$q&id=$LEAD"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="$2,$3" --virtual-time-budget=8000 \
    --screenshot="$OUT/$4" "$VISUALS?$q" >/dev/null 2>&1
  echo "  $4"
}

echo "応募画像（応募時点の版から）："
shot icon 1024 1024 icon_1x1.png
shot cover 1920 1080 cover_16x9.png
shot clean 1920 1080 clean_16x9.png
shot poster 1000 1500 poster_2x3.png

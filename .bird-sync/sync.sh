#!/bin/bash
set -u

PHOTO_ROOT="$HOME/BirdWebPublish"
SITE_ROOT="$HOME/Sites/bird-photo-site"
SYNC_DIR="$SITE_ROOT/.bird-sync"
LOG_DIR="$HOME/Library/Logs/BirdPhotoSync"
LOG_FILE="$LOG_DIR/sync.log"
LOCK_DIR="$LOG_DIR/sync.lock"
MANIFEST="$LOG_DIR/manifest.tsv"

mkdir -p "$LOG_DIR" "$SITE_ROOT/photos" "$SITE_ROOT/data"
exec >>"$LOG_FILE" 2>&1
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 開始同步（資料夾優先分類）"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "另一個同步程序仍在執行，略過"
  exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

if [ ! -d "$PHOTO_ROOT" ] || [ ! -d "$SITE_ROOT/.git" ]; then
  echo "找不到照片或網站資料夾"
  exit 1
fi

/usr/bin/git -C "$SITE_ROOT" pull --rebase origin main || {
  echo "GitHub 下載失敗"
  exit 1
}

# 只清除網站內由同步程式產生的照片副本，不碰 BirdWebPublish 原始照片。
/usr/bin/find "$SITE_ROOT/photos" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) -delete
: > "$MANIFEST"

while IFS= read -r -d '' file; do
  relative="${file#$PHOTO_ROOT/}"
  directory="${relative%/*}"
  filename="${relative##*/}"
  base="${filename%.*}"
  extension="${filename##*.}"
  extension="$(printf '%s' "$extension" | /usr/bin/tr '[:upper:]' '[:lower:]')"

  category="flight"
  case "$relative" in
    02-猛禽神采/*) category="raptors" ;;
    03-海岸與濕地/*) category="wetlands" ;;
  esac

  species=""
  location=""
  IFS='/' read -r -a parts <<< "$directory"
  for ((i=0;i<${#parts[@]};i++)); do
    if [ "${parts[$i]}" = "地區" ] && [ $((i+1)) -lt ${#parts[@]} ]; then
      location="${parts[$((i+1))]}"
    fi
    if [ "${parts[$i]}" = "鳥種" ] && [ $((i+1)) -lt ${#parts[@]} ]; then
      species="${parts[$((i+1))]}"
    fi
  done

  # 檔名只用作作品標題；舊有 __ 欄位不再決定分類。
  title="${base%%__*}"
  id="$(/usr/bin/shasum -a 256 "$file" | /usr/bin/awk '{print substr($1,1,14)}')"
  output_name="${category}-${id}.${extension}"
  /bin/cp "$file" "$SITE_ROOT/photos/$output_name"
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$id" "$category" "photos/$output_name" "$title" "$species" "$location" >> "$MANIFEST"
done < <(/usr/bin/find "$PHOTO_ROOT" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) -print0)

/usr/bin/osascript -l JavaScript "$SYNC_DIR/build-catalog.js" "$MANIFEST" "$SYNC_DIR/site-config.json" "$SITE_ROOT/data/photos.json"

/usr/bin/git -C "$SITE_ROOT" add index.html assets data photos .bird-sync/site-config.json .bird-sync/build-catalog.js .bird-sync/sync.sh
if /usr/bin/git -C "$SITE_ROOT" diff --cached --quiet; then
  echo "網站內容沒有變更"
else
  /usr/bin/git -C "$SITE_ROOT" commit -m "Sync bird photos from folder collections"
  if /usr/bin/git -C "$SITE_ROOT" push origin main; then
    echo "網站內容已推送，Netlify 將自動更新"
  else
    echo "GitHub 上傳失敗"
    exit 1
  fi
fi
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 同步完成"

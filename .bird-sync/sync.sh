#!/bin/bash
set -u

PHOTO_ROOT="$HOME/BirdWebPublish"
SITE_ROOT="$HOME/Sites/bird-photo-site"
SYNC_DIR="$SITE_ROOT/.bird-sync"
LOG_DIR="$HOME/Library/Logs/BirdPhotoSync"
LOG_FILE="$LOG_DIR/sync.log"
LOCK_DIR="$LOG_DIR/sync.lock"
MANIFEST="$LOG_DIR/manifest.tsv"
DESIRED="$LOG_DIR/desired-files.txt"
MANIFEST_HASH_FILE="$SYNC_DIR/manifest.sha256"

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

: > "$MANIFEST"
: > "$DESIRED"

make_variant() {
  local source="$1"
  local stem="$2"
  local size="$3"
  local quality="$4"
  local fallback_extension="$5"
  local jpeg_name="${stem}-${size}.jpg"
  local jpeg_path="$SITE_ROOT/photos/$jpeg_name"

  if [ ! -f "$jpeg_path" ]; then
    if ! /usr/bin/sips -s format jpeg -s formatOptions "$quality" -Z "$size" "$source" --out "$jpeg_path" >/dev/null 2>&1; then
      local fallback_name="${stem}-${size}.${fallback_extension}"
      /bin/cp "$source" "$SITE_ROOT/photos/$fallback_name"
      printf '%s\n' "$fallback_name"
      return
    fi
  fi
  printf '%s\n' "$jpeg_name"
}

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
  stem="${category}-${id}"
  small_name="$(make_variant "$file" "$stem" 640 78 "$extension")"
  medium_name="$(make_variant "$file" "$stem" 1400 82 "$extension")"
  large_name="$(make_variant "$file" "$stem" 2400 86 "$extension")"
  printf '%s\n%s\n%s\n' "$small_name" "$medium_name" "$large_name" >> "$DESIRED"
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$id" "$category" "photos/$small_name" "photos/$medium_name" "photos/$large_name" "$title" "$species" "$location" >> "$MANIFEST"
done < <(/usr/bin/find "$PHOTO_ROOT" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) -print0)

# 清除已從 BirdWebPublish 移除或換版的網站副本，原始照片不受影響。
while IFS= read -r -d '' generated; do
  generated_name="${generated##*/}"
  if ! /usr/bin/grep -Fqx "$generated_name" "$DESIRED"; then
    /bin/rm -f "$generated"
  fi
done < <(/usr/bin/find "$SITE_ROOT/photos" -type f -print0)

new_manifest_hash="$(/usr/bin/shasum -a 256 "$MANIFEST" | /usr/bin/awk '{print $1}')"
old_manifest_hash=""
if [ -f "$MANIFEST_HASH_FILE" ]; then
  old_manifest_hash="$(/bin/cat "$MANIFEST_HASH_FILE")"
fi

if [ "$new_manifest_hash" = "$old_manifest_hash" ] && [ -f "$SITE_ROOT/data/photos.json" ]; then
  echo "照片與資料夾分類沒有變更，不重複發布"
  exit 0
fi
printf '%s\n' "$new_manifest_hash" > "$MANIFEST_HASH_FILE"

/usr/bin/osascript -l JavaScript "$SYNC_DIR/build-catalog.js" "$MANIFEST" "$SYNC_DIR/site-config.json" "$SITE_ROOT/data/photos.json"

/usr/bin/git -C "$SITE_ROOT" add index.html assets data photos .bird-sync/site-config.json .bird-sync/build-catalog.js .bird-sync/sync.sh .bird-sync/manifest.sha256
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

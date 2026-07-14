#!/usr/bin/env bash
set -Eeuo pipefail

export PATH=/opt/alt/alt-nodejs22/root/usr/bin:$PATH
export NITRO_PRESET=node-server
export NPM_CONFIG_AUDIT=false
export NPM_CONFIG_FUND=false
export NPM_CONFIG_PROGRESS=false
export NPM_CONFIG_UPDATE_NOTIFIER=false

CACHE_DIR=".cpanel-cache"
INSTALL_HASH_FILE="$CACHE_DIR/install.hash"
BUILD_HASH_FILE="$CACHE_DIR/build.hash"
DEPLOYPATH="${DEPLOYPATH:-$HOME/public_html}"

mkdir -p "$CACHE_DIR" node_modules dist "$DEPLOYPATH"

run_limited() {
  local seconds="$1"
  shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$seconds" "$@"
  else
    "$@"
  fi
}

hash_files() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$@" 2>/dev/null | sha256sum | awk '{print $1}'
  else
    shasum -a 256 "$@" 2>/dev/null | shasum -a 256 | awk '{print $1}'
  fi
}

echo "▶ cPanel deploy started: $(date)"

INSTALL_HASH="$(hash_files package.json package-lock.json 2>/dev/null || hash_files package.json)"
if [ -x node_modules/.bin/vite ] && [ -f "$INSTALL_HASH_FILE" ] && [ "$(cat "$INSTALL_HASH_FILE")" = "$INSTALL_HASH" ]; then
  echo "✔ Dependencies unchanged — skipping npm install"
else
  echo "▶ Installing dependencies with a 20 minute safety timeout"
  run_limited 1200 npm install --prefer-offline --no-audit --no-fund --legacy-peer-deps --loglevel=error
  printf '%s' "$INSTALL_HASH" > "$INSTALL_HASH_FILE"
fi

BUILD_HASH="$(
  {
    test -d src && find src -type f | sort
    test -d public && find public -type f | sort
    printf '%s\n' package.json package-lock.json vite.config.ts tsconfig.json components.json
  } | xargs sha256sum 2>/dev/null | sha256sum | awk '{print $1}'
)"

if [ -f "$BUILD_HASH_FILE" ] && [ "$(cat "$BUILD_HASH_FILE")" = "$BUILD_HASH" ] && [ -n "$(ls -A dist 2>/dev/null | head -1)" ]; then
  echo "✔ Source unchanged — skipping build"
else
  echo "▶ Building app with a 15 minute safety timeout"
  run_limited 900 npm run build
  printf '%s' "$BUILD_HASH" > "$BUILD_HASH_FILE"
fi

# Vite clears dist before build; keep the tracked placeholder restored so cPanel Git stays clean.
touch dist/.gitkeep

echo "▶ Publishing dist/ to $DEPLOYPATH"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete --exclude='.gitkeep' dist/ "$DEPLOYPATH"/
else
  rm -rf "$DEPLOYPATH"/*
  cp -R dist/. "$DEPLOYPATH"/
fi

# Passenger/cPanel restart marker; ignored by Git via .gitignore.
mkdir -p tmp
touch tmp/restart.txt

echo "✔ cPanel deploy finished: $(date)"
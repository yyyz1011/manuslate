#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
PROJECT_DIR="${SCRIPT_DIR:h}"
APP_PATH="$PROJECT_DIR/src-tauri/target/release/bundle/macos/PatchMark.app"
OUTPUT_DIR="$PROJECT_DIR/src-tauri/target/release/bundle/dmg"
VERSION="$(cd "$PROJECT_DIR" && node -p "require('./package.json').version")"
ARCHITECTURE="$(uname -m)"
OUTPUT_PATH="$OUTPUT_DIR/PatchMark_${VERSION}_${ARCHITECTURE}.dmg"
STAGING_DIR="$(mktemp -d /tmp/patchmark-dmg.XXXXXX)"

cleanup() {
  rm -rf "$STAGING_DIR"
}
trap cleanup EXIT

"$SCRIPT_DIR/build-app.sh"
mkdir -p "$OUTPUT_DIR"
ditto "$APP_PATH" "$STAGING_DIR/PatchMark.app"
ln -s /Applications "$STAGING_DIR/Applications"

# Tauri's styled DMG helper uses Finder automation, which may wait forever when
# Automation permission is unavailable. hdiutil creates the same installable
# image without launching Finder or requiring AppleScript permissions.
hdiutil create \
  -volname "PatchMark" \
  -srcfolder "$STAGING_DIR" \
  -ov \
  -format UDZO \
  "$OUTPUT_PATH"

hdiutil verify "$OUTPUT_PATH"
echo "PatchMark.dmg: $OUTPUT_PATH"

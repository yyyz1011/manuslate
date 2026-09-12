#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
PROJECT_DIR="${SCRIPT_DIR:h}"
APP_PATH="$PROJECT_DIR/src-tauri/target/release/bundle/macos/PatchMark.app"

cd "$PROJECT_DIR"
./node_modules/.bin/tauri build --bundles app

# Local development builds do not have an Apple Developer certificate. Apply a
# complete ad-hoc signature so macOS can validate the whole bundle consistently.
codesign --force --deep --sign - "$APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

echo "PatchMark.app: $APP_PATH"

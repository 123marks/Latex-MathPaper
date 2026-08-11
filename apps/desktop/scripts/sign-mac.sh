#!/usr/bin/env bash
# macOS: notarize + staple the Paper OS .dmg/.app produced by `cargo tauri build`.
# Requirements (run once on the build host):
#   xcode-select --install
#   brew install tauri-cli
#   Apple Developer ID Application Certificate in Keychain
#   App Store Connect API key: ~/.privatekeys/AuthKey_XXXXXX.p8
#   xcrun notarytool store-credentials <...>
#
# Usage:
#   export PAPER_OS_SIGNING_TEAM=ABCDE12345
#   export PAPER_OS_BUNDLE_ID=dev.paper-os.desktop
#   ./sign-mac.sh path/to/Paper\ OS_0.4.0_aarch64.dmg

set -euo pipefail

DMG="${1:?usage: sign-mac.sh <path-to-dmg>}"
TEAM="${PAPER_OS_SIGNING_TEAM:?set PAPER_OS_SIGNING_TEAM}"
BUNDLE_ID="${PAPER_OS_BUNDLE_ID:-dev.paper-os.desktop}"

# 1. Sign the inner .app and nested binaries
APP_DIR=$(mktemp -d)
echo "→ mounting $DMG to $APP_DIR"
hdiutil attach -nobrowse -readonly -mountpoint "$APP_DIR" "$DMG"

APP_PATH=$(find "$APP_DIR" -maxdepth 2 -name "*.app" | head -1)
echo "→ signing $APP_PATH"

# Sign nested binaries first (deep)
find "$APP_PATH" -type f \( -perm +111 -o -name "*.dylib" \) | while read -r BIN; do
  codesign --force --sign "Developer ID Application: ${TEAM}" --timestamp --options runtime "$BIN"
done

# Sign the .app
codesign --force --sign "Developer ID Application: ${TEAM}" --timestamp --options runtime "$APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

# 2. Convert to a new .dmg with the signed bundle (re-create dmg)
OUT_DMG="${DMG%.dmg}-signed.dmg"
echo "→ writing $OUT_DMG"
hdiutil detach "$APP_DIR" 2>/dev/null || true
hdiutil create -volname "Paper OS" -srcfolder "$APP_PATH" -ov -format UDZO "$OUT_DMG"

# 3. Notarize + staple
echo "→ uploading for notarization"
xcrun notarytool submit "$OUT_DMG" \
  --key ~/.privatekeys/AuthKey_${TEAM}.p8 \
  --issuer "${TEAM}" \
  --key-id "${PAPER_OS_SIGNING_KEY_ID:-}" \
  --wait

xcrun notarytool staple "$OUT_DMG"
xcrun notarytool validate "$OUT_DMG"

echo "✓ signed + notarized: $OUT_DMG"

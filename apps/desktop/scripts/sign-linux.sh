#!/usr/bin/env bash
# Linux: sign the .AppImage / .deb / .rpm produced by `cargo tauri build`.
# Requirements (run once on the build host):
#   - GPG key (paper-os-release@paper-os.dev) with a long-lived signing subkey
#   - gpg2 in PATH
#   - For .deb: dpkg-sig in PATH
#   - For .rpm: rpmsign in PATH
#
# Usage:
#   export PAPER_OS_GPG_KEY=paper-os-release@paper-os.dev
#   ./sign-linux.sh path/to/bundle/

set -euo pipefail

DIR="${1:?usage: sign-linux.sh <bundle-dir>}"
KEY="${PAPER_OS_GPG_KEY:?set PAPER_OS_GPG_KEY}"
GPG="gpg2"
[ -x "$(command -v gpg)" ] && GPG="gpg"

sign_deb() {
  local f="$1"
  echo "→ signing $f (dpkg-sig)"
  dpkg-sig --sign builder -k "$KEY" "$f"
}

sign_rpm() {
  local f="$1"
  echo "→ signing $f (rpmsign)"
  local RPMMACRO=$(mktemp)
  cat > "$RPMMACRO" <<EOF
%_gpg_name $KEY
%_gpg_path $(which gpg2 2>/dev/null || which gpg)
EOF
  rpmsign --define "_gpg_name $KEY" --addsign "$f"
  rm -f "$RPMMACRO"
}

sign_appimage() {
  local f="$1"
  echo "→ signing $f (gpg --detach-sign)"
  $GPG --armor --detach-sign --local-user "$KEY" --output "${f}.sig" "$f"
  # AppImage's optional AIS signature: produce a sidecar .sig file
  echo "  wrote ${f}.sig"
}

for f in "$DIR"/*.deb; do [ -e "$f" ] || continue; sign_deb "$f"; done
for f in "$DIR"/*.rpm; do [ -e "$f" ] || continue; sign_rpm "$f"; done
for f in "$DIR"/*.AppImage; do [ -e "$f" ] || continue; sign_appimage "$f"; done

echo "✓ signed everything in $DIR"

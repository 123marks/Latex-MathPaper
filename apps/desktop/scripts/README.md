# Paper OS · Code Signing

Each platform has its own signing flow. All three scripts accept the
build artifact directory from `cargo tauri build` (or the path of a
single artifact) and apply the platform-appropriate signature.

## Quick reference

| Platform | Script | Prerequisites | Output |
| --- | --- | --- | --- |
| macOS    | `scripts/sign-mac.sh <dmg>`     | Apple Developer ID Application cert · App Store Connect API key · `xcrun notarytool` | `* -signed.dmg` (notarized + stapled) |
| Windows  | `scripts/sign-windows.ps1 <path>` | Authenticode EV cert (hardware token) · Windows SDK `signtool.exe` | signed `.msi` / `.exe` / `.dll` |
| Linux    | `scripts/sign-linux.sh <dir>`    | GPG key · `dpkg-sig` · `rpmsign` | signed `.deb` / `.rpm` + `.AppImage.sig` |

## CI suggestion

Wire all three into a single release pipeline:

```yaml
# .github/workflows/release.yml (excerpt)
- run: cargo tauri build
- if: matrix.os == 'macos-latest'
  run: ./apps/desktop/scripts/sign-mac.sh "src-tauri/target/release/bundle/dmg/"
- if: matrix.os == 'windows-latest'
  run: pwsh ./apps/desktop/scripts/sign-windows.ps1 "src-tauri/target/release/bundle/msi/"
- if: matrix.os == 'ubuntu-latest'
  run: ./apps/desktop/scripts/sign-linux.sh "src-tauri/target/release/bundle/"
```

Required CI secrets:

- `MACOS_SIGNING_TEAM`            — Apple Developer ID Team ID
- `MACOS_SIGNING_KEY_ID`          — App Store Connect API Key ID
- `MACOS_SIGNING_P8_BASE64`       — base64-encoded .p8 (decoded to disk at runtime)
- `WINDOWS_CSC_NAME`              — subject name of the EV cert
- `WINDOWS_TIMESTAMP_URL`         — RFC 3161 timestamp server
- `LINUX_GPG_PRIVATE_KEY`         — ASCII-armored GPG private key
- `LINUX_GPG_PASSPHRASE`          — if the key is passphrase-protected

## SmartScreen reputation

Windows SmartScreen shows a warning for newly signed binaries for ~2 weeks
while reputation builds. Two options:

1. **Wait**: each download adds to the reputation pool.
2. **Submit to Microsoft**: <https://www.microsoft.com/en-us/wdsi/filesubmission>
   → choose "Misrepresented file" → upload your signed `.exe`/`msi` → mark as
   "software I made" → submit. SmartScreen clears it within 1-2 days.

## Apple notarization

`sign-mac.sh` handles both `codesign` and `notarytool`. For continuous
delivery, prefer **App Store Connect API keys** over Apple ID passwords —
they're revocable, scoped, and don't require 2FA on the build host.

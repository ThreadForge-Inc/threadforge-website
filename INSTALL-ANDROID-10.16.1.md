# ThreadForge 10.16.1 for Android — Installation & Verification Guide

ThreadForge 10.16.1 for Android (`com.methodology.threadforge`) is a **verified development prerelease** of the same private business suite as the Windows app, including the Business workspace, Projects, the 57-calculator Trade desk, Supplier due diligence, App builder planning, and the offline Mentor. It runs ThreadForge's own 10.16.1 Python 3.13 backend on the phone itself at `127.0.0.1`. It needs no PC, server, or cloud account, and your records stay on the phone.

## 1. Check your phone

- **Operating System:** Android 7.0 (API 24) or later, targeting Android 16 (API 36), on a 64-bit phone (`arm64-v8a`) or a 64-bit emulator (`x86_64`).
- **Storage:** About 42 MB for the APK installer plus free space for the embedded Python 3.13 runtime unpacked on first start.

## 2. Download and verify

Download `ThreadForge-10.16.1-android.apk` from the official release (`v10.16.1-android-dev` / `v10.16.1-moonwalk-v17`) or `https://threadforgeofficial.com/android/`.

Its **APK SHA-256** checksum must be:

```text
1c8d10d9e19efc4fdf534f5baf4f566e4408de839bfc13f496fd4e909644579d
```

To verify it on a Windows PC before copying it to the phone:

```powershell
Get-FileHash .\ThreadForge-10.16.1-android.apk -Algorithm SHA256
```

The APK is signed with a CI development certificate (APK Signature Scheme v2). Its **Signer Certificate SHA-256** fingerprint is:

```text
05428107431fb6b9b5e94f4fd7f0b2d1e95956df7a2c983f59c25adb4a52bf37
```

Do not install a file whose SHA-256 hash differs.

## 3. Install

1. Open `ThreadForge-10.16.1-android.apk` from your browser's downloads or your Android file manager.
2. If Android asks, allow that app to **Install unknown apps** for this installation.
3. Google Play Protect may warn that the app is from an unrecognised developer because this development certificate is not yet registered in Play App Signing. Proceed only after confirming the SHA-256 hash above.

## 4. First start

Open **ThreadForge**. The first start unpacks the embedded Python 3.13 backend and sets up your private SQLite workspace (about 20 seconds on the CI Pixel 6 API 35 emulator; slower phones may take slightly longer).
You are signed in automatically; the owner token never leaves the app's private storage.

- **Exports** (CSV, Excel, PDF reports, quotations, purchase orders, briefs) open Android's native "Save as" dialog so you choose where each file goes.
- **Imports** (inventory CSV, Excel workbooks, documents, brand images) use Android's native file picker.

## 5. What works on the phone

| Works on Android (`10.16.1`) | Not available on a phone |
| --- | --- |
| Inventory, orders, invoices, Projects, the 57-calculator Trade desk, Capital projects BOQ/schedule/risk, analytics, campaigns, and every business desk | PC care (Windows only) |
| Excel workbook import and Excel/PDF export with Unicode (`m²`, `€`, `±`, `×`, `–`) | Engineering code execution and isolated Docker app builds |
| The Mentor (offline how-to guide and glossary on every desk) and Connect a model (local/HTTPS Ollama or your own API provider, tested before saving) | MCP servers that start local desktop programs |
| Supplier due diligence, including refreshing official sanctions lists over HTTPS | Outbound email campaign delivery and payment webhooks |
| Multiple organizations and role-scoped access tokens | Command-line workspace backup and restore tools |

## 6. Updating and uninstalling

- This build is signed with a one-off CI key (`05428107431fb6b9b5e94f4fd7f0b2d1e95956df7a2c983f59c25adb4a52bf37`). Android will refuse to install it directly over an earlier APK signed with a different key: export your records first, uninstall the old app (which deletes ThreadForge's local storage on the phone), then install `ThreadForge-10.16.1-android.apk`.
- Android cloud backup and device-to-device transfer are disabled (`allowBackup=false`) because the local workspace stores owner tokens.

## 7. Security and verification provenance

- **Local Loopback Isolation:** The embedded backend listens only on `127.0.0.1` on a random ephemeral port at each start. Cleartext traffic is permitted only to `127.0.0.1`; all external connections require HTTPS.
- **CI Provenance:** Built and verified in GitHub Actions Run `40674599590` (`ThreadForge-Inc/SO`) from commit `f54e8d87344f1a0c58fa690b109d4c4937000cf5`. All 106 bundled Python files match `HEAD` byte-for-byte, and all 6 automated Android 15 (API 35) emulator checks (`emulator_install`, `backend_process_separate`, `unauthenticated_api_refused`, `signed_in_suite_visible`, `download_bridge_ready`, `relaunch_signed_in`) passed.

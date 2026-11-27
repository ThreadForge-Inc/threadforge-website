# STORE_SUBMISSION_PACK.md — Microsoft Partner Center & Google Play Console Checklists

**Release:** `ThreadForge Quartz 10.21.0 — Pioneer Legacy Build`
**Publisher:** Threadforge Inc. (President & Founder: Bilal Ahmed Khan)

---

## 1. Microsoft Partner Center (Windows 10/11 — x64 & ARM64)

### Package Metadata Verification
- **Package Identity Name:** `ThreadforgeInc.ThreadForgeQuartz`
- **Version:** `10.21.0.0` ([AppxManifest.x64.xml](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/packaging/windows-msix/AppxManifest.x64.xml), [AppxManifest.arm64.xml](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/packaging/windows-msix/AppxManifest.arm64.xml))
- **Architectures Included in MSIXBundle:** `x64`, `arm64` (`.NET 10` Windows Desktop + WebView2 Runtime)
- **Declared Capabilities:** `internetClient`, `privateNetworkClientServer`, `rescap:runFullTrust` (justified for loopback `127.0.0.1:4173` Forgecore Gateway & `127.0.0.1:11434` Ollama integration)

### Submission Checklist
- [x] Version bumped to `10.21.0.0` across `AppxManifest.x64.xml`, `AppxManifest.arm64.xml`, `ThreadForgeQuartz.Desktop.csproj`, and `ThreadForgeQuartzSetup.csproj`.
- [x] Store visual assets generated (`StoreLogo.png` 50x50, `Square44x44Logo.png` 44x44, `Square150x150Logo.png` 150x150, `Wide310x150Logo.png` 310x150, `SplashScreen.png` 620x300).
- [x] `MakeAppx unpack` / `unbundle` pre-flight check passed (`packaging/scripts/run_wack_preflight.ps1`).
- [ ] Run full interactive WACK in Elevated Administrator PowerShell (`appcert.exe test ...`) on target test VM before upload.
- [ ] Apply official Microsoft Partner Center / OV-EV Authenticode certificate (follow [`SIGN_FOR_STORE.md`](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/SIGN_FOR_STORE.md)) to `ThreadForge-Quartz-10.21.0.0-unsigned.msixbundle` (or configure Store-managed signing).
- [ ] Attach privacy policy URL (`https://threadforgeofficial.com/privacy`) and note zero silent telemetry (`TRUST_AND_COMPLIANCE.md`).

---

## 2. Google Play Console (Android `.aab`)

### Package Metadata Verification
- **Application ID / Package:** `com.threadforge.quartz`
- **Version:** `versionName "10.21.0"`, `versionCode 10210` ([AndroidManifest.xml](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/packaging/android/AndroidManifest.xml), [build.gradle.kts](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/packaging/android/build.gradle.kts))
- **SDK Levels:** `minSdkVersion="26"`, `targetSdkVersion="35"` (Android 15 API 35 compliant)
- **Security Hardening:** `android:usesCleartextTraffic="false"`, `android:allowBackup="false"`, R8 full-mode minification & ProGuard obfuscation rules enabled.

### Submission Checklist
- [x] `versionCode` incremented from `10201` -> `10210`; `versionName` bumped from `10.20.0` -> `10.21.0`.
- [x] R8 release shrinking & obfuscation applied, emitting `ThreadForge-Quartz-10.21.0-proguard-mapping.txt`.
- [x] Google Play App Bundle validated via `bundletool validate`.
- [x] Native debug symbols archive packaged (`ThreadForge-Quartz-10.21.0-native-debug-symbols.zip`) for Play Console symbolication.
- [x] Play Data Safety worksheet generated ([`play-data-safety.json`](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/packaging/android/play-data-safety.json)).
- [ ] Sign `ThreadForge-Quartz-10.21.0-unsigned.aab` with official Play Upload Keystore via `$ANDROID_KEYSTORE_PATH` using instructions in [`SIGN_FOR_STORE.md`](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/SIGN_FOR_STORE.md).
- [ ] Upload signed `.aab`, ProGuard `mapping.txt`, and debug symbols ZIP in Google Play Console Production / Closed Testing track.

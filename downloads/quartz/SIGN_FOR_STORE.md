# SIGN_FOR_STORE.md — Production Store Signing Runbook (ThreadForge Quartz 10.21.0)

**Build:** `ThreadForge Quartz 10.21.0 — Pioneer Legacy Build`
**Publisher:** Threadforge Inc. (President & Founder: Bilal Ahmed Khan)

## 1. Signing Guardrail & Provenance Notice

In accordance with ThreadForge's Pioneer-Class Strict Signing Policy:
- This build environment did **NOT** have `$WIN_SIGN_PFX` or `$ANDROID_KEYSTORE_PATH` production store secrets exported.
- Therefore, **no Microsoft Authenticode OV/EV certificate or Google Play Upload Key certificate has been fabricated**.
- Unsigned release store packages (`*-unsigned.msix`, `*-unsigned.msixbundle`, `*-unsigned.aab`) AND clearly labeled local developer test-signed builds (`*-dev-signed.*`) are emitted separately.
- **Do NOT upload `*-dev-signed.*` packages to Microsoft Partner Center or Google Play Console.** Apply your official store certificates to the `*-unsigned.*` packages using either Section 2 or Section 3 below.

---

## 2. Re-Running Automated Build With Environment-Injected Secrets

If you export your real store credentials in PowerShell before invoking the packaging script, `packaging/scripts/build_all_packages.ps1` automatically signs the release binaries, `.msixbundle`, and `.aab` with your official credentials:

```powershell
# Windows Store / Authenticode PFX (or Azure Trusted Signing)
$env:WIN_SIGN_PFX = "C:\secure\threadforge-authenticode.pfx"
$env:WIN_SIGN_PASSWORD = "<PFX_PASSWORD>"

# Google Play Upload Keystore
$env:ANDROID_KEYSTORE_PATH = "C:\secure\threadforge-play-upload.jks"
$env:ANDROID_KEY_ALIAS = "upload"
$env:ANDROID_KEYSTORE_PASS = "<KEYSTORE_PASSWORD>"
$env:ANDROID_KEY_PASS = "<KEY_PASSWORD>"

powershell -NoProfile -ExecutionPolicy Bypass -File packaging\scripts\build_all_packages.ps1
```

---

## 3. Manual Official Store Signing Commands (Pre-Built Unsigned Artifacts)

### A. Windows Desktop Executables, MSIX Packages & MSIXBundle (Microsoft Partner Center)

Replace `$env:WIN_SIGN_PFX` and timestamp server as needed (`http://timestamp.digicert.com` or `http://timestamp.sectigo.com`):

```powershell
$SignTool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe"

# 1. Sign Setup Installers & Individual Arch MSIX Packages (SHA-256 + RFC 3161 Timestamp)
& $SignTool sign /fd SHA256 /f "$env:WIN_SIGN_PFX" /p "$env:WIN_SIGN_PASSWORD" `
  /tr http://timestamp.digicert.com /td SHA256 `
  /d "ThreadForge Quartz 10.21.0 — Pioneer Legacy Build" /du "https://threadforgeofficial.com" `
  dist\10.21.0\windows\ThreadForge-Quartz-Setup-10.21.0-win-x64-unsigned.exe `
  dist\10.21.0\windows\ThreadForge-Quartz-10.21.0.0-x64-unsigned.msix `
  dist\10.21.0\windows\ThreadForge-Quartz-10.21.0.0-arm64-unsigned.msix

# 2. Rebuild or Directly Sign Combined MSIXBundle
& $SignTool sign /fd SHA256 /f "$env:WIN_SIGN_PFX" /p "$env:WIN_SIGN_PASSWORD" `
  /tr http://timestamp.digicert.com /td SHA256 `
  dist\10.21.0\windows\ThreadForge-Quartz-10.21.0.0-unsigned.msixbundle

# 3. Verify Signature Chain
& $SignTool verify /pa /v dist\10.21.0\windows\ThreadForge-Quartz-10.21.0.0-unsigned.msixbundle
```

*(Note: For Microsoft Partner Center Store distribution, ensure `<Identity Publisher="CN=..." />` in `packaging/windows-msix/AppxManifest.*.xml` matches the Subject DN assigned to Threadforge Inc. in Partner Center, or let Microsoft Store re-sign on submission if distributing solely through the Microsoft Store.)*

#### Alternative: Azure Trusted Signing (`TrustedSigningClientTools`)

```powershell
Invoke-TrustedSigning `
  -Endpoint "https://eus.codesigning.azure.net" `
  -CodeSigningAccountName "threadforge-signing" `
  -CertificateProfileName "threadforge-quartz-pub" `
  -Files "dist\10.21.0\windows\ThreadForge-Quartz-10.21.0.0-unsigned.msixbundle" `
  -FileDigest "SHA256" `
  -TimestampRfc3161Url "http://timestamp.acs.microsoft.com"
```

### B. Android App Bundle (`.aab`) & Sideload `.apk` (Google Play Console)

```powershell
$JdkBin = "C:\Program Files\Android\openjdk\jdk-21.0.8\bin"
$ApkSigner = "$env:LOCALAPPDATA\Android\Sdk\build-tools\36.0.0\apksigner.bat"

# 1. Sign Google Play App Bundle (.aab) using jarsigner with SHA256withRSA / SHA-256
Copy-Item dist\10.21.0\android\ThreadForge-Quartz-10.21.0-unsigned.aab `
          dist\10.21.0\android\ThreadForge-Quartz-10.21.0-store-signed.aab -Force

& "$JdkBin\jarsigner.exe" -verbose `
  -sigalg SHA256withRSA -digestalg SHA-256 `
  -keystore "$env:ANDROID_KEYSTORE_PATH" `
  -storepass "$env:ANDROID_KEYSTORE_PASS" `
  -keypass "$env:ANDROID_KEY_PASS" `
  dist\10.21.0\android\ThreadForge-Quartz-10.21.0-store-signed.aab `
  "$env:ANDROID_KEY_ALIAS"

& "$JdkBin\jarsigner.exe" -verify -verbose -certs dist\10.21.0\android\ThreadForge-Quartz-10.21.0-store-signed.aab

# 2. Sign Standalone Distribution APK (v2 + v3 scheme via apksigner)
& $ApkSigner sign `
  --ks "$env:ANDROID_KEYSTORE_PATH" `
  --ks-key-alias "$env:ANDROID_KEY_ALIAS" `
  --ks-pass "env:ANDROID_KEYSTORE_PASS" `
  --key-pass "env:ANDROID_KEY_PASS" `
  --v2-signing-enabled true --v3-signing-enabled true `
  --out dist\10.21.0\android\ThreadForge-Quartz-10.21.0-store-signed.apk `
  dist\10.21.0\android\ThreadForge-Quartz-10.21.0-unsigned.apk

& $ApkSigner verify --print-certs dist\10.21.0\android\ThreadForge-Quartz-10.21.0-store-signed.apk
```

After signing the `.aab`, upload alongside:
- `dist\10.21.0\android\ThreadForge-Quartz-10.21.0-proguard-mapping.txt` (R8 obfuscation mapping)
- `dist\10.21.0\android\ThreadForge-Quartz-10.21.0-native-debug-symbols.zip` (debug symbols package)
- `packaging\android\play-data-safety.json` (Play Data Safety answers)

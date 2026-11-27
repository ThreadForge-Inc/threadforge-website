# ARCHITECTURE_10.21.0.md — Technical Architecture & API Specification

**Release:** `ThreadForge Quartz 10.21.0 — Pioneer Legacy Build`
**Publisher:** Threadforge Inc.
**Founder & President:** Bilal Ahmed Khan
**Kernel Protocol:** Titanium-Rust `v1.100`
**Windows MSIX Version:** `10.21.0.0`
**Android Release Version:** `versionName "10.21.0"` / `versionCode 10210`

---

## 1. Ecosystem Architecture Unification

Release `10.21.0` consolidates the three ThreadForge product surfaces cleanly under [`src/surfaces/`](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/src/surfaces/index.ts) backed by shared deterministic, cryptographic, and governance primitives under [`src/core/`](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/src/core/fixedPoint.ts):

### Surface 1 — `threadforgeofficial.com` Core Suite (`src/surfaces/official/`)
- **Operational Desks ([desksAndTemplates.ts](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/src/surfaces/official/desksAndTemplates.ts)):** All **20 Core Operational Desks** (`overview` through `policy_log`) plus 6 backward-compatible Dev/SysOps extended desks (`app_builder`, `pc_care`, `access_tokens`, `ai_connectors`, `mentor`, `engineering_agents`).
- **57 Deterministic Calculators ([calculators57.ts](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/src/surfaces/official/calculators57.ts)):** Categorized across TradeMath Shipment & Incoterms (01–14), FX Hedge & Customs (15–23), Capital Projects / BOQ / MRP (24–35), Double-Entry Ledgers (36–45), Clinical & GMP Pharma/Biotech CoA Math (46–52), and Moonwalk HRBP / Supplier Diligence / SLA (53–57). Computed solely via `bigint` cents & `SCALE_12` (`10n ** 12n`).
- **18 Industry Templates & Institutional Tenancy:** Air-gapped clinical ward ledgers, GMP pharmaceutical & biotech API/CoA batch release workflows, manufacturing, banking, and government tenancy supporting **1–100 isolated orgs/plants** and up to **10,000 SHA-256 role-scoped credentials** (`InstitutionalTenancyCluster`).
- **Integrated Toolkits:** Moonwalk v17 HRBP Toolkit (`MoonwalkHrbpToolkitV17` + [`moonwalk_v17.py`](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/services/sovereign-core/moonwalk_v17.py)), Supplier Due Diligence, Document & Stamp Studio, Read-Only-First PC Care, Local Ollama (`http://127.0.0.1:11434`), and owner-allowlisted MCP bridges.

### Surface 2 — `threadforge.cloud` Open-Core Kernel (`src/surfaces/cloud/`)
- **Titanium-Rust Kernel (`v1.100`) ([crates/](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/Cargo.toml)):**
  - `tf` (`apps/threadforge-cli`): `version`, `preflight`, `hash`, `check-secrets`, `gate`, `verify-owner-policy`.
  - `titanium-mcp` (`apps/titanium-mcp`): Both stdio JSON-RPC 2.0 and loopback HTTP JSON-RPC 2.0 (`127.0.0.1`) with strict prompt-injection boundary tagging (`sanitize_mcp_output`).
  - `forgecore-server` (`apps/forgecore-server`): Loopback HTTP API & embedded Studio UI (`127.0.0.1:4173`).
- **$0 Browser WebContainers (`WASM-0-BURN`) ([openCoreKernel.ts](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/src/surfaces/cloud/openCoreKernel.ts)):** COOP (`same-origin`) / COEP (`credentialless`) isolated browser sandboxes paired with `ByokZeroMarkupVault` (AES-256-GCM 0% platform markup).
- **Craft Forge UI Registry ([registry/seed/catalog.json](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/registry/seed/catalog.json)):** All **63 WCAG 2.2 AA** components (50 UI blocks, 10 skills, 3 starters) with 85/15 integer-cent creator revenue split.
- **ACID PostgreSQL 18 Memory Layer ([0002_upgrade_10_21_0_pg18.sql](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/packages/db/migrations/0002_upgrade_10_21_0_pg18.sql)):** `pgvector`, `pg_trgm`, `ENABLE/FORCE ROW LEVEL SECURITY`, `pg_advisory_xact_lock`, Mem0 conflict-resolving triplets, and Letta sleep-time consolidation (`AcidWorkspaceMemoryEngine`).

### Surface 3 — `threadforge.live` Commercial & Edge OS (`src/surfaces/live/`)
- **Single-Core Multi-Tenancy & AaaS ([commercialEdgeOs.ts](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/src/surfaces/live/commercialEdgeOs.ts)):** Multi-model router (`forgecore-spark-1` through `forgecore-titan-1`), deterministic micro-USD / cent metering (`AaasControlPlane` & [`billing-mor`](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/packages/billing-mor/src/index.mjs)), versioned Prompt Vault, and DLP/constitutional guardrails.
- **Relay AI & Omni Viral:** Autonomous omnichannel communications with HITL-8-Rule escalation (`processRelayOmnichannelTurn`) plus position-based integer-cent revenue attribution (`attributeOmniViralRevenueCents`).
- **Global IoT (`edge.threadforge.live`, 300+ PoPs) ([services/iot-edge-worker/](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/services/iot-edge-worker/src/index.ts)):** `tf_dev_` SHA-256 hardware tenancy, staged OTA (`canary_5pct` -> `ring_25pct` -> `ga_100pct`) with automatic health-score rollback + SHA-256 audit chain, Edge AI trigger escalation, No-Code Workflow Studio DAG, and immutable Real-Time Event Bus.

---

## 2. Cryptographic & Security Specifications

| Subsystem | Primitive / Standard | Implementation |
| :--- | :--- | :--- |
| Audit Hash Chains & Merkle Tree | RFC 6234 SHA-256 | [`src/core/auditChain.ts`](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/src/core/auditChain.ts), [`services/sovereign-core/ledger_guard.py`](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/services/sovereign-core/ledger_guard.py) |
| Owner Entitlements Policy Signature | RFC 8032 Ed25519 (Key ID `fecef81a7f13b2de`) | [`src/core/owner_entitlements/index.ts`](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/src/core/owner_entitlements/index.ts), [`crates/owner-entitlements/src/lib.rs`](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/crates/owner-entitlements/src/lib.rs) |
| Owner Sign-In Proofs | EdDSA OIDC JWT (`verified_email=true`) OR WebAuthn Passkey (`UP`+`UV` flags) | [`src/services/licenseService.ts`](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/src/services/licenseService.ts) |
| BYOK Vault Encryption | AES-256-GCM (random 96-bit IV, SHA-256 KEK) | [`src/core/cryptoPrimitives.ts`](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/src/core/cryptoPrimitives.ts) |
| Fixed-Point & Currency Math | `BigInt` Cents / `10^12` Fixed Decimal / Micro-USD | [`src/core/fixedPoint.ts`](file:///C:/Users/Mr.N0Buddy/OneDrive/Desktop/Forgex/src/core/fixedPoint.ts) |

---

## 3. Target Build & Toolchain Support Matrix

| Target / Artifact | Status in This Build Environment | Notes |
| :--- | :--- | :--- |
| Web Production Bundle (`dist/`) | Built (`tsc -b && vite build`) | Vite 6.4.6 + React 18 |
| Windows Desktop `.exe` + Portable (`win-x64`, `win-arm64`) | Built (`.NET 10.0.403`) | Both x64 and arm64 binaries compiled |
| Windows MSIX (`x64`, `arm64`) & `.msixbundle` | Built (`MakeAppx 10.0.26100.9457`) | Unsigned store + labeled `-dev-signed` local builds |
| Android `.aab` (R8 Minified) + ProGuard Mapping + `.apk` | Built (`R8 8.10.9-dev`, `aapt2`, `bundletool 1.18.3`) | `targetSdk=35`, `versionCode=10210`; unsigned + `-dev-signed` |
| Titanium-Rust Static (`x86_64-pc-windows-msvc`) | Compiled | Native MSVC release binaries |
| Titanium-Rust Static (`x86_64-unknown-linux-musl`, `aarch64-unknown-linux-musl`) | Cross-Compiled Static ELF | Linked with `rust-lld` |
| Titanium-Rust Windows ARM64 (`aarch64-pc-windows-msvc`) | Source Ready (Host VS ARM64 C++ CRT libs not installed) | Desktop UI/Installer `.NET win-arm64` built natively |
| Titanium-Rust macOS (`aarch64-apple-darwin`, `x86_64-apple-darwin`) | Source Ready (Requires Apple macOS SDK runner) | Cross-compile recipe provided in CI/Dockerfiles |
| OCI Multi-Arch Container (`linux/amd64` + `linux/arm64`) | Built Deterministic OCI Image Layout v1.0.0 `.oci.tar` | Live `docker` daemon unavailable on Windows host; `Dockerfile` & `docker-compose.yml` updated to `10.21.0` |
| PostgreSQL 18 Migrations | Validated SQL + Non-Destructive SQLite Parity Tested | Live `psql` daemon not installed on Windows host |

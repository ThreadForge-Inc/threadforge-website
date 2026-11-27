# TRUST_AND_COMPLIANCE.md — Legal, Privacy, Zero-Telemetry & Pioneer-Class Compliance Attestation

**Release:** `ThreadForge Quartz 10.21.0 — Pioneer Legacy Build`
**Publisher:** Threadforge Inc. (`threadforgeofficial.com`, `threadforge.cloud`, `threadforge.live`)
**President & Founder:** Bilal Ahmed Khan
**Notice Date:** 2026-11-27

---

## 1. Strict Honesty & Compliance Scope Disclaimer

**Threadforge Inc. explicitly affirms that NO third-party compliance certification (SOC 2 Type II, ISO/IEC 27001, HIPAA Business Associate Attestation, Microsoft Authenticode OV/EV, or Google Play Production Upload Key) is claimed or fabricated by this automated build.**
This document states the **implemented architectural controls** verifiable directly in source code and test suites, alongside the prerequisites required for independent external accreditation.

---

## 2. Pioneer-Class Principle Guarantees (Verified in Code & Tests)

1. **Local-First Sovereignty & Zero Silent Telemetry**
   - `forgecore-server`, `titanium-mcp`, and desktop IPC bind strictly to loopback `127.0.0.1` (`SO_REUSE` non-public).
   - `src/core/pioneerGovernance.ts` (`evaluateOutboundSovereignty`) unconditionally blocks `silent_telemetry` and `analytics_beacon` requests and blocks non-loopback network calls lacking explicit user/operator initiation.
   - `packaging/android/AndroidManifest.xml` disables automatic cloud backup (`android:allowBackup="false"`, explicit `@xml/data_extraction_rules`), prohibits cleartext HTTP traffic (`android:usesCleartextTraffic="false"`), and requests only minimal `INTERNET` and `ACCESS_NETWORK_STATE` permissions (no location, contacts, background mic, or camera).

2. **Prompt-Injection Isolation on MCP Tool Outputs**
   - `crates/owner-entitlements` / `apps/titanium-mcp` (`sanitize_mcp_output`) and `src/core/pioneerGovernance.ts` (`sanitizeMcpToolOutput`) strip control/BiDi spoofing codepoints (`U+202A..202E`, `U+2066..2069`), escape XML boundary closing attempts, quarantine detected instruction-override patterns, and compute SHA-256 digests on every MCP response envelope.

3. **Human-in-the-Loop (HITL-8-Rule) Circuit Breakers**
   - `crates/titanium-policy` (`evaluate_sovereign_gate`, `evaluate_financial_hitl_cents`) and `src/core/pioneerGovernance.ts` (`evaluateHitl8RuleGate`) enforce explicit human co-sign + approver identity before:
     - Refunds > \$50.00 (`5000` integer cents), daily ad spend > \$250.00, low-credit execution, 30-day overdue / unmatched settlement actions, angry sentiment escalations, regulated ad claims;
     - Protected actions: `git_merge`, `release_publish`, `sign_artifact`, `prod_deploy`, `gmp_batch_release`, `iot_ota_promote_100pct`, `pc_repair_mutation`.

4. **Deterministic Mathematical & Cryptographic Audit Rigor**
   - **Zero IEEE-754 float rounding drift:** `src/core/fixedPoint.ts`, `src/surfaces/official/calculators57.ts`, `packages/billing-mor/src/index.mjs`, and Python `services/sovereign-core/ledger_guard.py` compute currency in `bigint` integer cents / micro-USD and quantities in `10^12` fixed-point decimals, explicitly rejecting JS floating-point numbers and booleans (`FixedPointDriftError`).
   - **Tamper-evident hash chains:** `src/core/auditChain.ts` maintains append-only SHA-256 hash chains and binary Merkle roots for `gmp_batch_record`, `coa_release_log`, `clinical_ward_inventory`, and `institutional_procurement_ledger`.

5. **Cryptographically Verified Founder / Owner Entitlements (`owner_entitlements`)**
   - Policy manifest (`src/core/owner_entitlements/owner_policy.manifest.json`) is signed with Ed25519 (Key ID `fecef81a7f13b2de`) and verified in both TypeScript and pure-Rust (`crates/owner-entitlements`).
   - Lifetime Owner privileges unlock exclusively upon verified OIDC/OAuth2 (`verified_email=true`) or hardware WebAuthn passkey (`UP` + `UV` flags) authentication for the 5 allowlisted normalized identities (`bilal.ak993@gmail.com`, `owner@threadforgeofficial.com`, `kingwomen212@gmail.com`, `mistarn0baddy@outlook.com`, `bilal.nobody@gmail.com`). Raw unverified client headers (`x-user-email`, etc.) and raw unverified emails are strictly rejected.

6. **Secret Isolation & BYOK Zero-Markup Encryption**
   - `assert_no_secret_paths` / `checkSecretIsolationPaths` reject `.secret`, `.pfx`, `.jks`, `.pem`, and raw keystore files from VCS/MCP commits.
   - `src/surfaces/cloud/openCoreKernel.ts` (`ByokZeroMarkupVault`) seals user API keys with AES-256-GCM at 0% markup.

---

## 3. Data Handling & Institutional Air-Gap Controls

- **Clinical & GMP Pharma Mode (`InstitutionalTenancyCluster`):** Supports air-gapped operation across 1–100 isolated organizational plants/wards and up to 10,000 SHA-256 hashed role-scoped credentials (`tf_role_`), with dual-witness controlled-substance logging and QP co-signed Certificate of Analysis release gates.
- **PostgreSQL 18 Multi-Tenancy:** Enforces `ENABLE ROW LEVEL SECURITY` / `FORCE ROW LEVEL SECURITY` isolated on `app.current_workspace_id` and race-free advisory locking (`pg_advisory_xact_lock`).

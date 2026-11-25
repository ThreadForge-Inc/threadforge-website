"""Unit tests for ThreadForge Sovereign Core modules (`src/core/*`)."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.core import ledger_guard, license_signer, sku_registry  # noqa: E402


class TestSkuRegistry(unittest.TestCase):
    """Verify suite segregation across SKU_TRADE_ERP, SKU_OPS_AGENCY, SKU_DEV_SYSOPS."""

    def test_26_desks_sequential_order(self) -> None:
        self.assertEqual(len(sku_registry.DESKS), 26)
        orders = sorted(d.order for d in sku_registry.DESKS.values())
        self.assertEqual(orders, list(range(1, 27)))

    def test_trade_erp_excludes_pc_care_and_code_agents_by_default(self) -> None:
        for blocked in ("pc_care", "app_builder", "engineering_agents"):
            self.assertFalse(sku_registry.is_desk_enabled(sku_registry.SKU_TRADE_ERP, blocked))
            with self.assertRaises(sku_registry.DeskGateError):
                sku_registry.assert_desk_allowed(sku_registry.SKU_TRADE_ERP, blocked)

        self.assertFalse(
            sku_registry.is_capability_enabled(sku_registry.SKU_TRADE_ERP, "pc_repair_routines")
        )
        self.assertFalse(
            sku_registry.is_capability_enabled(sku_registry.SKU_TRADE_ERP, "system_clone_routines")
        )

    def test_trade_erp_allows_core_trade_and_ledger(self) -> None:
        for core_desk in ("business", "landed_accounting", "trade", "manufacturing_mrp", "diligence"):
            self.assertTrue(sku_registry.is_desk_enabled(sku_registry.SKU_TRADE_ERP, core_desk))

    def test_explicit_override_enables_segregated_desk(self) -> None:
        self.assertTrue(
            sku_registry.is_desk_enabled(
                sku_registry.SKU_TRADE_ERP,
                "pc_care",
                explicit_enable={"pc_care"},
            )
        )
        self.assertTrue(
            sku_registry.is_desk_enabled(sku_registry.SKU_DEV_SYSOPS, "pc_care")
        )
        self.assertTrue(
            sku_registry.is_desk_enabled(sku_registry.SKU_DEV_SYSOPS, "engineering_agents")
        )
        self.assertFalse(
            sku_registry.is_desk_enabled(sku_registry.SKU_OPS_AGENCY, "pc_care")
        )

    def test_manifest_uses_integer_cent_pricing(self) -> None:
        manifest = sku_registry.resolve_manifest(sku_registry.SKU_TRADE_ERP)
        for val in manifest["pricing_cents"].values():
            self.assertIsInstance(val, int)
        self.assertIn("pc_repair_routines", manifest["blocked_capabilities"])


class TestLedgerGuard(unittest.TestCase):
    """Verify exact integer-cent double-entry invariants and SHA-256 hash-chain tamper detection."""

    def test_rejects_floats_and_booleans(self) -> None:
        with self.assertRaises(TypeError):
            ledger_guard.PostingLine("1010", "DEBIT", 10.50)  # type: ignore[arg-type]
        with self.assertRaises(TypeError):
            ledger_guard.PostingLine("1010", "DEBIT", True)  # type: ignore[arg-type]
        with self.assertRaises(TypeError):
            ledger_guard.parse_cents(19.99)  # type: ignore[arg-type]

    def test_parse_and_format_cents(self) -> None:
        self.assertEqual(ledger_guard.parse_cents("$12,345.67"), 1234567)
        self.assertEqual(ledger_guard.parse_cents("0.05"), 5)
        self.assertEqual(ledger_guard.format_cents(1234567), "$12,345.67")

    def test_unbalanced_journal_entry_rejected(self) -> None:
        chain: list[ledger_guard.JournalEntry] = []
        with self.assertRaises(ValueError):
            ledger_guard.append_entry(
                chain,
                entry_id="JV-0001",
                recorded_at="2026-11-26T00:00:00Z",
                description="Imbalanced entry",
                lines=[
                    ledger_guard.PostingLine("1200", "DEBIT", 10000),
                    ledger_guard.PostingLine("2000", "CREDIT", 9999),
                ],
            )
        self.assertEqual(len(chain), 0)

    def test_hash_chain_and_tamper_detection(self) -> None:
        chain: list[ledger_guard.JournalEntry] = []
        ledger_guard.append_entry(
            chain,
            entry_id="JV-0001",
            recorded_at="2026-11-26T00:00:00Z",
            description="Receive FOB cotton lot",
            lines=[
                ledger_guard.PostingLine("1400-INV", "DEBIT", 500000),
                ledger_guard.PostingLine("2100-AP", "CREDIT", 500000),
            ],
        )
        ledger_guard.append_entry(
            chain,
            entry_id="JV-0002",
            recorded_at="2026-11-26T01:00:00Z",
            description="Capitalize ocean freight + duty",
            lines=[
                ledger_guard.PostingLine("1400-INV", "DEBIT", 84550),
                ledger_guard.PostingLine("1010-BANK", "CREDIT", 62000),
                ledger_guard.PostingLine("2200-CUSTOMS", "CREDIT", 22550),
            ],
        )

        ok_res = ledger_guard.verify_chain(chain)
        self.assertTrue(ok_res.valid)
        self.assertEqual(ok_res.checked_count, 2)
        self.assertEqual(ok_res.total_debits_cents, 584550)
        self.assertEqual(ok_res.total_credits_cents, 584550)
        self.assertNotEqual(ok_res.merkle_root, ledger_guard.GENESIS_HASH)

        # Mutate a historical entry by 1 cent while keeping balance mathematically equal
        e0 = chain[0]
        tampered_e0 = ledger_guard.JournalEntry(
            seq=e0.seq,
            entry_id=e0.entry_id,
            recorded_at=e0.recorded_at,
            description=e0.description,
            lines=(
                ledger_guard.PostingLine("1400-INV", "DEBIT", 500001),
                ledger_guard.PostingLine("2100-AP", "CREDIT", 500001),
            ),
            prev_hash=e0.prev_hash,
            entry_hash=e0.entry_hash,
            currency=e0.currency,
            actor=e0.actor,
        )
        bad_res = ledger_guard.verify_chain([tampered_e0, chain[1]])
        self.assertFalse(bad_res.valid)
        self.assertEqual(bad_res.failed_index, 0)
        self.assertEqual(bad_res.failed_entry_id, "JV-0001")
        self.assertIn("tamper", bad_res.reason.lower())


class TestLicenseSigner(unittest.TestCase):
    """Verify Ed25519 keygen, signing, offline verification, expiry, and SKU checks."""

    def test_ed25519_round_trip_and_tamper_resistance(self) -> None:
        kp = license_signer.generate_keypair()
        other_kp = license_signer.generate_keypair()
        now = datetime(2026, 11, 26, 12, 0, 0, tzinfo=timezone.utc)

        tfkey = license_signer.sign_tfkey(
            kp.private_pem,
            license_id="TF-2026-0001",
            org_name="Northgate Textile Mills",
            email="ops@northgate.example",
            tier="industrial",
            sku_ids=[sku_registry.SKU_TRADE_ERP],
            issued_at=(now - timedelta(days=1)).isoformat(),
            expires_at=None,
            maintenance_until=(now + timedelta(days=364)).isoformat(),
            seats=0,
            sites=1,
        )

        with tempfile.TemporaryDirectory() as tmp:
            tfkey_path = Path(tmp) / "mill.tfkey"
            tfkey_path.write_text(json.dumps(tfkey, indent=2), encoding="utf-8")

            ok = license_signer.verify_tfkey(
                tfkey_path,
                kp.public_pem,
                now=now,
                required_tier="industrial",
                required_sku=sku_registry.SKU_TRADE_ERP,
            )
            self.assertTrue(ok.valid, ok.reason)
            self.assertFalse(ok.expired)
            self.assertTrue(ok.maintenance_active)

            # Wrong SKU refused
            wrong_sku = license_signer.verify_tfkey(
                tfkey,
                kp.public_pem,
                now=now,
                required_sku=sku_registry.SKU_DEV_SYSOPS,
            )
            self.assertFalse(wrong_sku.valid)

            # Wrong public key refused
            wrong_key = license_signer.verify_tfkey(tfkey, other_kp.public_pem, now=now)
            self.assertFalse(wrong_key.valid)

            # Tampered tier refused cryptographically
            tampered = json.loads(json.dumps(tfkey))
            tampered["payload"]["tier"] = "industrial_park"
            bad_sig = license_signer.verify_tfkey(tampered, kp.public_pem, now=now)
            self.assertFalse(bad_sig.valid)
            self.assertIn("signature", bad_sig.reason.lower())

    def test_expired_license_rejected(self) -> None:
        kp = license_signer.generate_keypair()
        now = datetime(2026, 11, 26, 12, 0, 0, tzinfo=timezone.utc)
        tfkey = license_signer.sign_tfkey(
            kp.private_pem,
            license_id="TF-TRIAL-09",
            org_name="Pilot Site",
            email="pilot@site.example",
            tier="essentials",
            sku_ids=[sku_registry.SKU_TRADE_ERP],
            issued_at=(now - timedelta(days=20)).isoformat(),
            expires_at=(now - timedelta(days=1)).isoformat(),
        )
        res = license_signer.verify_tfkey(tfkey, kp.public_pem, now=now)
        self.assertFalse(res.valid)
        self.assertTrue(res.expired)

    def test_missing_dependency_message_clear(self) -> None:
        with mock.patch.object(license_signer, "_HAS_CRYPTO", False):
            with self.assertRaises(license_signer.MissingDependencyError) as ctx:
                license_signer.generate_keypair()
            self.assertIn("pip install cryptography", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()

"""ThreadForge Sovereign Core modules: SKU segregation, ledger guard, and .tfkey signing."""

from .ledger_guard import (
    GENESIS_HASH,
    JournalEntry,
    PostingLine,
    TamperDetectionResult,
    append_entry,
    compute_entry_hash,
    compute_merkle_root,
    parse_cents,
    verify_chain,
)
from .license_signer import (
    LicenseVerificationResult,
    MissingDependencyError,
    generate_keypair,
    sign_tfkey,
    verify_tfkey,
)
from .sku_registry import (
    DESKS,
    SKUS,
    SKU_DEV_SYSOPS,
    SKU_OPS_AGENCY,
    SKU_TRADE_ERP,
    DeskGateError,
    assert_desk_allowed,
    is_desk_enabled,
    resolve_manifest,
)

__all__ = [
    "DESKS",
    "GENESIS_HASH",
    "SKUS",
    "SKU_DEV_SYSOPS",
    "SKU_OPS_AGENCY",
    "SKU_TRADE_ERP",
    "DeskGateError",
    "JournalEntry",
    "LicenseVerificationResult",
    "MissingDependencyError",
    "PostingLine",
    "TamperDetectionResult",
    "append_entry",
    "assert_desk_allowed",
    "compute_entry_hash",
    "compute_merkle_root",
    "generate_keypair",
    "is_desk_enabled",
    "parse_cents",
    "resolve_manifest",
    "sign_tfkey",
    "verify_chain",
    "verify_tfkey",
]

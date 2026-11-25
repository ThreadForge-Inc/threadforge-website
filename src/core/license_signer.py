"""Self-contained Ed25519 keygen, ``.tfkey`` signer, and offline verifier.

Enforces cryptographic offline entitlement verification for ThreadForge
(``127.0.0.1`` sovereign deployment with zero mandatory license callbacks).

Requires the ``cryptography`` package for Ed25519 primitives and raises an
explicit, actionable ``MissingDependencyError`` if ``cryptography`` is not
installed.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, Optional, Sequence


_SIGNING_DOMAIN = b"THREADFORGE-TFKEY-V1\n"

try:
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ed25519

    _HAS_CRYPTO = True
except ImportError:  # pragma: no cover - verified explicitly via mock/import check
    InvalidSignature = Exception  # type: ignore[assignment,misc]
    serialization = None  # type: ignore[assignment]
    ed25519 = None  # type: ignore[assignment]
    _HAS_CRYPTO = False


class MissingDependencyError(RuntimeError):
    """Raised when ``cryptography`` is not installed in the runtime."""


def _require_crypto() -> None:
    if not _HAS_CRYPTO:
        raise MissingDependencyError(
            "ThreadForge Ed25519 .tfkey signing and offline verification requires the "
            "'cryptography' package (>=41.0). Install it with: pip install cryptography"
        )


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso_utc(raw: str, field_name: str) -> datetime:
    if not isinstance(raw, str) or not raw.strip():
        raise ValueError(f"{field_name} must be a non-empty ISO-8601 UTC timestamp.")
    text = raw.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    dt = datetime.fromisoformat(text)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _canonical_message(payload: Mapping[str, Any]) -> bytes:
    canonical = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    )
    return _SIGNING_DOMAIN + canonical.encode("utf-8")


def _compute_key_id(public_pem: str) -> str:
    return hashlib.sha256(public_pem.encode("utf-8")).hexdigest()[:16]


@dataclass(frozen=True)
class Ed25519Keypair:
    """Generated Ed25519 keypair in PEM PKCS8 / SubjectPublicKeyInfo format."""

    key_id: str
    private_pem: str
    public_pem: str


@dataclass(frozen=True)
class LicenseVerificationResult:
    """Outcome of offline ``.tfkey`` cryptographic and entitlement verification."""

    valid: bool
    reason: str
    key_id: str
    payload: Optional[dict[str, Any]] = None
    expired: bool = False
    maintenance_active: Optional[bool] = None


def generate_keypair() -> Ed25519Keypair:
    """Generate a fresh Ed25519 signing/verification keypair."""
    _require_crypto()
    priv = ed25519.Ed25519PrivateKey.generate()
    pub = priv.public_key()

    private_pem = priv.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("ascii")
    public_pem = pub.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("ascii")
    return Ed25519Keypair(
        key_id=_compute_key_id(public_pem),
        private_pem=private_pem,
        public_pem=public_pem,
    )


def sign_tfkey(
    private_pem: str,
    *,
    license_id: str,
    org_name: str,
    email: str,
    tier: str,
    sku_ids: Sequence[str],
    issued_at: Optional[str] = None,
    expires_at: Optional[str] = None,
    maintenance_until: Optional[str] = None,
    seats: int = 0,
    sites: int = 1,
    explicit_desks: Sequence[str] = (),
) -> dict[str, Any]:
    """Create and Ed25519-sign a ThreadForge ``.tfkey`` entitlement document.

    ``expires_at=None`` issues a perpetual version-locked license (no recurring
    lockout), while ``maintenance_until`` separately tracks optional AMR/relay renewal.
    """
    _require_crypto()
    if isinstance(seats, bool) or not isinstance(seats, int) or seats < 0:
        raise ValueError("seats must be a non-negative integer (0 = unlimited seats).")
    if isinstance(sites, bool) or not isinstance(sites, int) or sites < 1:
        raise ValueError("sites must be an integer >= 1.")
    if not sku_ids:
        raise ValueError("At least one SKU ID must be bound to the .tfkey.")

    priv = serialization.load_pem_private_key(private_pem.encode("ascii"), password=None)
    if not isinstance(priv, ed25519.Ed25519PrivateKey):
        raise TypeError("Private key must be an Ed25519 key.")

    pub_pem = priv.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("ascii")

    issued_iso = (
        _parse_iso_utc(issued_at, "issued_at").isoformat()
        if issued_at is not None
        else _utc_now().replace(microsecond=0).isoformat()
    )
    expires_iso = (
        _parse_iso_utc(expires_at, "expires_at").isoformat()
        if expires_at is not None
        else None
    )
    maint_iso = (
        _parse_iso_utc(maintenance_until, "maintenance_until").isoformat()
        if maintenance_until is not None
        else None
    )

    payload: dict[str, Any] = {
        "schema": "threadforge.tfkey.v1",
        "license_id": license_id.strip(),
        "org_name": org_name.strip(),
        "email": email.strip(),
        "tier": tier.strip().lower(),
        "sku_ids": sorted(set(str(s).strip() for s in sku_ids)),
        "explicit_desks": sorted(set(str(d).strip() for d in explicit_desks)),
        "seats": seats,
        "sites": sites,
        "issued_at": issued_iso,
        "expires_at": expires_iso,
        "maintenance_until": maint_iso,
    }

    message = _canonical_message(payload)
    signature = priv.sign(message)
    sig_b64 = base64.urlsafe_b64encode(signature).decode("ascii").rstrip("=")

    return {
        "alg": "Ed25519",
        "key_id": _compute_key_id(pub_pem),
        "payload": payload,
        "signature_b64": sig_b64,
    }


def _decode_b64url(text: str) -> bytes:
    padded = text + "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def verify_tfkey(
    tfkey: Mapping[str, Any] | str | Path,
    public_pem: str,
    *,
    now: Optional[datetime] = None,
    required_tier: Optional[str] = None,
    required_sku: Optional[str] = None,
) -> LicenseVerificationResult:
    """Verify ``.tfkey`` Ed25519 signature, timestamps, tier, and SKU offline."""
    _require_crypto()

    if isinstance(tfkey, Path):
        doc = json.loads(tfkey.read_text(encoding="utf-8"))
    elif isinstance(tfkey, str):
        stripped = tfkey.strip()
        if stripped.startswith("{"):
            doc = json.loads(stripped)
        else:
            doc = json.loads(Path(stripped).read_text(encoding="utf-8"))
    else:
        doc = dict(tfkey)

    expected_key_id = _compute_key_id(public_pem)
    doc_key_id = str(doc.get("key_id") or "")

    if doc.get("alg") != "Ed25519":
        return LicenseVerificationResult(
            valid=False,
            reason=f"Unsupported signature algorithm: {doc.get('alg')!r}",
            key_id=doc_key_id,
        )

    payload = doc.get("payload")
    sig_b64 = doc.get("signature_b64")
    if not isinstance(payload, Mapping) or not isinstance(sig_b64, str) or not sig_b64:
        return LicenseVerificationResult(
            valid=False,
            reason="Malformed .tfkey document: missing payload or signature_b64.",
            key_id=doc_key_id,
        )

    if doc_key_id and doc_key_id != expected_key_id:
        return LicenseVerificationResult(
            valid=False,
            reason=f"Key ID mismatch: .tfkey signed with {doc_key_id!r}, verifier holds {expected_key_id!r}.",
            key_id=doc_key_id,
        )

    try:
        pub = serialization.load_pem_public_key(public_pem.encode("ascii"))
        if not isinstance(pub, ed25519.Ed25519PublicKey):
            return LicenseVerificationResult(
                valid=False,
                reason="Public key is not an Ed25519 key.",
                key_id=expected_key_id,
            )
        sig_bytes = _decode_b64url(sig_b64)
        pub.verify(sig_bytes, _canonical_message(payload))
    except (InvalidSignature, ValueError) as exc:
        return LicenseVerificationResult(
            valid=False,
            reason=f"Cryptographic signature verification failed: {exc or 'invalid Ed25519 signature'}",
            key_id=expected_key_id,
        )

    check_time = (now or _utc_now()).astimezone(timezone.utc)
    try:
        issued_dt = _parse_iso_utc(str(payload.get("issued_at", "")), "issued_at")
    except ValueError as exc:
        return LicenseVerificationResult(
            valid=False,
            reason=f"Invalid issued_at timestamp: {exc}",
            key_id=expected_key_id,
            payload=dict(payload),
        )

    if check_time < issued_dt:
        return LicenseVerificationResult(
            valid=False,
            reason="License is not yet valid (issued_at is in the future).",
            key_id=expected_key_id,
            payload=dict(payload),
        )

    expires_raw = payload.get("expires_at")
    if expires_raw is not None:
        exp_dt = _parse_iso_utc(str(expires_raw), "expires_at")
        if check_time > exp_dt:
            return LicenseVerificationResult(
                valid=False,
                reason=f"License expired at {exp_dt.isoformat()}.",
                key_id=expected_key_id,
                payload=dict(payload),
                expired=True,
            )

    maint_raw = payload.get("maintenance_until")
    maintenance_active: Optional[bool] = None
    if maint_raw is not None:
        maint_dt = _parse_iso_utc(str(maint_raw), "maintenance_until")
        maintenance_active = check_time <= maint_dt

    tier = str(payload.get("tier") or "").lower()
    if required_tier and tier != required_tier.strip().lower():
        return LicenseVerificationResult(
            valid=False,
            reason=f"Tier mismatch: required {required_tier!r}, .tfkey grants {tier!r}.",
            key_id=expected_key_id,
            payload=dict(payload),
            maintenance_active=maintenance_active,
        )

    sku_list = [str(s) for s in payload.get("sku_ids", ())]
    if required_sku and required_sku not in sku_list:
        return LicenseVerificationResult(
            valid=False,
            reason=f"SKU {required_sku!r} is not entitled by this .tfkey ({sku_list}).",
            key_id=expected_key_id,
            payload=dict(payload),
            maintenance_active=maintenance_active,
        )

    return LicenseVerificationResult(
        valid=True,
        reason="OK",
        key_id=expected_key_id,
        payload=dict(payload),
        expired=False,
        maintenance_active=maintenance_active,
    )


def _main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="ThreadForge Ed25519 .tfkey utility")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_gen = sub.add_parser("keygen", help="Generate Ed25519 signing keypair")
    p_gen.add_argument("--out-dir", type=Path, required=True)

    p_ver = sub.add_parser("verify", help="Verify a .tfkey file offline")
    p_ver.add_argument("--tfkey", type=Path, required=True)
    p_ver.add_argument("--pub", type=Path, required=True)
    p_ver.add_argument("--sku", default=None)
    p_ver.add_argument("--tier", default=None)

    args = parser.parse_args(argv)
    if args.cmd == "keygen":
        kp = generate_keypair()
        args.out_dir.mkdir(parents=True, exist_ok=True)
        (args.out_dir / "tf_signing_private.pem").write_text(kp.private_pem, encoding="utf-8")
        (args.out_dir / "tf_verify_public.pem").write_text(kp.public_pem, encoding="utf-8")
        print(json.dumps({"key_id": kp.key_id, "out_dir": str(args.out_dir)}))
        return 0

    if args.cmd == "verify":
        pub_pem = args.pub.read_text(encoding="utf-8")
        res = verify_tfkey(
            args.tfkey,
            pub_pem,
            required_sku=args.sku,
            required_tier=args.tier,
        )
        print(json.dumps({"valid": res.valid, "reason": res.reason, "payload": res.payload}, indent=2))
        return 0 if res.valid else 2

    return 1


if __name__ == "__main__":
    raise SystemExit(_main())

"""Deterministic integer-cent double-entry ledger & SHA-256 hash-chain verifier.

Enforces ThreadForge's non-negotiable financial invariants:
1. **Exact-cent integer arithmetic**: floating-point values and booleans are
   strictly rejected everywhere.
2. **Double-entry balance**: every journal entry MUST contain >= 2 posting
   lines, all positive integer cents, with ``sum(debits_cents) == sum(credits_cents)``.
3. **Append-only cryptographic tamper detection**: entries form a sequential
   SHA-256 hash chain anchored at ``GENESIS_HASH`` (64 zero hex digits) and also
   support deterministic Merkle-tree root digests for independent checkpoints.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from typing import Iterable, List, Literal, Optional, Sequence


GENESIS_HASH = "0" * 64
_MONEY_RE = re.compile(r"^\s*([+-]?)\$?\s*(\d[\d,]*)(?:\.(\d{1,2}))?\s*$")


def _require_int_cents(value: int, field_name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise TypeError(
            f"{field_name} must be exact integer cents (int); got {type(value).__name__}."
        )
    return value


def parse_cents(text: str | int) -> int:
    """Parse a currency string (e.g. ``'1,234.50'``) into exact integer cents.

    Never converts through IEEE-754 binary floats.
    """
    if isinstance(text, int) and not isinstance(text, bool):
        return text
    if isinstance(text, (bool, float)):
        raise TypeError(
            f"Currency must be str or integer cents (int); float/bool forbidden ({type(text).__name__})."
        )
    if not isinstance(text, str):
        raise TypeError(f"Unsupported currency input type: {type(text).__name__}")

    cleaned = text.strip()
    m = _MONEY_RE.match(cleaned)
    if not m:
        raise ValueError(f"Invalid currency format: {text!r}")

    sign = -1 if m.group(1) == "-" else 1
    whole = int(m.group(2).replace(",", ""))
    frac_str = (m.group(3) or "").ljust(2, "0")
    cents = whole * 100 + int(frac_str)
    return sign * cents


def format_cents(cents: int, *, symbol: str = "$") -> str:
    """Format exact integer cents for human display without float math."""
    cents = _require_int_cents(cents, "cents")
    sign = "-" if cents < 0 else ""
    abs_cents = abs(cents)
    dollars, rem = divmod(abs_cents, 100)
    return f"{sign}{symbol}{dollars:,}.{rem:02d}"


@dataclass(frozen=True)
class PostingLine:
    """Single debit or credit line within a balanced journal entry."""

    account_code: str
    side: Literal["DEBIT", "CREDIT"]
    amount_cents: int
    memo: str = ""

    def __post_init__(self) -> None:
        if not self.account_code or not self.account_code.strip():
            raise ValueError("account_code must be a non-empty string.")
        if self.side not in ("DEBIT", "CREDIT"):
            raise ValueError(f"side must be 'DEBIT' or 'CREDIT'; got {self.side!r}")
        amt = _require_int_cents(self.amount_cents, "amount_cents")
        if amt <= 0:
            raise ValueError(f"amount_cents must be strictly positive (> 0); got {amt}")

    def to_canonical_dict(self) -> dict:
        return {
            "account_code": self.account_code.strip(),
            "side": self.side,
            "amount_cents": self.amount_cents,
            "memo": self.memo,
        }


@dataclass(frozen=True)
class JournalEntry:
    """Immutable, hash-chained double-entry ledger record."""

    seq: int
    entry_id: str
    recorded_at: str
    description: str
    lines: tuple[PostingLine, ...] = field(default_factory=tuple)
    prev_hash: str = GENESIS_HASH
    entry_hash: str = ""
    currency: str = "USD"
    actor: str = "system"

    def debits_cents(self) -> int:
        return sum(line.amount_cents for line in self.lines if line.side == "DEBIT")

    def credits_cents(self) -> int:
        return sum(line.amount_cents for line in self.lines if line.side == "CREDIT")

    def validate_balance(self) -> None:
        """Raise ValueError unless entry has >=2 lines and debits == credits."""
        if isinstance(self.seq, bool) or not isinstance(self.seq, int) or self.seq < 0:
            raise ValueError(f"seq must be a non-negative integer; got {self.seq!r}")
        if not self.entry_id or not self.entry_id.strip():
            raise ValueError("entry_id must be non-empty.")
        if not self.recorded_at or not self.recorded_at.strip():
            raise ValueError("recorded_at must be non-empty.")
        if len(self.lines) < 2:
            raise ValueError("Double-entry journal requires at least 2 posting lines.")

        debit_total = 0
        credit_total = 0
        for line in self.lines:
            amt = _require_int_cents(line.amount_cents, "line.amount_cents")
            if amt <= 0:
                raise ValueError(f"Posting line amount_cents must be > 0; got {amt}")
            if line.side == "DEBIT":
                debit_total += amt
            elif line.side == "CREDIT":
                credit_total += amt
            else:
                raise ValueError(f"Invalid line side: {line.side!r}")

        if debit_total != credit_total:
            raise ValueError(
                f"Unbalanced journal entry {self.entry_id!r}: "
                f"debits={debit_total} cents != credits={credit_total} cents"
            )

    def canonical_payload_dict(self) -> dict:
        return {
            "seq": self.seq,
            "entry_id": self.entry_id.strip(),
            "recorded_at": self.recorded_at.strip(),
            "description": self.description,
            "currency": self.currency,
            "actor": self.actor,
            "prev_hash": self.prev_hash,
            "lines": [line.to_canonical_dict() for line in self.lines],
        }


def compute_entry_hash(entry: JournalEntry) -> str:
    """Compute the deterministic SHA-256 hex digest linking ``prev_hash`` + payload."""
    canonical = json.dumps(
        entry.canonical_payload_dict(),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    )
    material = f"THREADFORGE-LEDGER-V1|{entry.prev_hash}|{canonical}".encode("utf-8")
    return hashlib.sha256(material).hexdigest()


def append_entry(
    chain: List[JournalEntry],
    *,
    entry_id: str,
    recorded_at: str,
    description: str,
    lines: Sequence[PostingLine],
    currency: str = "USD",
    actor: str = "operator",
) -> JournalEntry:
    """Validate double-entry balance and append a hash-chained ``JournalEntry``."""
    seq = len(chain)
    prev_hash = chain[-1].entry_hash if chain else GENESIS_HASH
    lines_tuple = tuple(lines)
    candidate = JournalEntry(
        seq=seq,
        entry_id=entry_id,
        recorded_at=recorded_at,
        description=description,
        lines=lines_tuple,
        prev_hash=prev_hash,
        entry_hash="",
        currency=currency,
        actor=actor,
    )
    candidate.validate_balance()
    digest = compute_entry_hash(candidate)
    sealed = JournalEntry(
        seq=candidate.seq,
        entry_id=candidate.entry_id,
        recorded_at=candidate.recorded_at,
        description=candidate.description,
        lines=candidate.lines,
        prev_hash=candidate.prev_hash,
        entry_hash=digest,
        currency=candidate.currency,
        actor=candidate.actor,
    )
    chain.append(sealed)
    return sealed


@dataclass(frozen=True)
class TamperDetectionResult:
    """Outcome of verifying an entire hash-chained ledger."""

    valid: bool
    checked_count: int
    total_debits_cents: int
    total_credits_cents: int
    merkle_root: str
    head_hash: str
    failed_index: Optional[int] = None
    failed_entry_id: Optional[str] = None
    reason: str = "OK"


def compute_merkle_root(hashes: Sequence[str]) -> str:
    """Compute deterministic SHA-256 binary Merkle root over entry hashes."""
    if not hashes:
        return GENESIS_HASH
    layer = list(hashes)
    while len(layer) > 1:
        if len(layer) % 2 == 1:
            layer.append(layer[-1])
        next_layer: list[str] = []
        for idx in range(0, len(layer), 2):
            pair = f"{layer[idx]}:{layer[idx + 1]}".encode("ascii")
            next_layer.append(hashlib.sha256(pair).hexdigest())
        layer = next_layer
    return layer[0]


def verify_chain(entries: Iterable[JournalEntry]) -> TamperDetectionResult:
    """Verify sequential numbering, integer-cent balance, and SHA-256 hash links.

    Returns a ``TamperDetectionResult`` identifying the exact entry index and
    cause if any historical entry or posting line has been mutated.
    """
    entry_list = list(entries)
    expected_prev = GENESIS_HASH
    total_debits = 0
    total_credits = 0
    valid_hashes: list[str] = []

    for idx, entry in enumerate(entry_list):
        if entry.seq != idx:
            return TamperDetectionResult(
                valid=False,
                checked_count=idx,
                total_debits_cents=total_debits,
                total_credits_cents=total_credits,
                merkle_root=compute_merkle_root(valid_hashes),
                head_hash=expected_prev,
                failed_index=idx,
                failed_entry_id=entry.entry_id,
                reason=f"Sequence gap or reorder: expected seq={idx}, got seq={entry.seq}.",
            )

        if entry.prev_hash != expected_prev:
            return TamperDetectionResult(
                valid=False,
                checked_count=idx,
                total_debits_cents=total_debits,
                total_credits_cents=total_credits,
                merkle_root=compute_merkle_root(valid_hashes),
                head_hash=expected_prev,
                failed_index=idx,
                failed_entry_id=entry.entry_id,
                reason=(
                    f"Hash-chain break at entry {idx}: expected prev_hash={expected_prev}, "
                    f"got prev_hash={entry.prev_hash}."
                ),
            )

        try:
            entry.validate_balance()
        except (TypeError, ValueError) as exc:
            return TamperDetectionResult(
                valid=False,
                checked_count=idx,
                total_debits_cents=total_debits,
                total_credits_cents=total_credits,
                merkle_root=compute_merkle_root(valid_hashes),
                head_hash=expected_prev,
                failed_index=idx,
                failed_entry_id=entry.entry_id,
                reason=f"Double-entry violation at entry {idx}: {exc}",
            )

        expected_digest = compute_entry_hash(entry)
        if entry.entry_hash != expected_digest:
            return TamperDetectionResult(
                valid=False,
                checked_count=idx,
                total_debits_cents=total_debits,
                total_credits_cents=total_credits,
                merkle_root=compute_merkle_root(valid_hashes),
                head_hash=expected_prev,
                failed_index=idx,
                failed_entry_id=entry.entry_id,
                reason=(
                    f"Historical payload tamper detected at entry {idx} ({entry.entry_id}): "
                    f"stored entry_hash={entry.entry_hash} != recomputed={expected_digest}."
                ),
            )

        total_debits += entry.debits_cents()
        total_credits += entry.credits_cents()
        valid_hashes.append(entry.entry_hash)
        expected_prev = entry.entry_hash

    return TamperDetectionResult(
        valid=True,
        checked_count=len(entry_list),
        total_debits_cents=total_debits,
        total_credits_cents=total_credits,
        merkle_root=compute_merkle_root(valid_hashes),
        head_hash=expected_prev,
        failed_index=None,
        failed_entry_id=None,
        reason="OK",
    )

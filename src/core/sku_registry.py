"""ThreadForge Sovereign SKU manifest & feature-gate registry.

Segregates ThreadForge's 26 operational desks cleanly across three commercial
product lines:

- ``SKU_TRADE_ERP``: Trade, Costing & Industrial ERP (accounting, inventory,
  TradeMath, MRP, warehouse, supplier due diligence, finance & treasury).
  Strictly excludes OS maintenance, disk/registry repair, and code-agent
  cloning routines unless explicitly enabled via typed overrides.
- ``SKU_OPS_AGENCY``: Operations, Projects & Agency Workspace (commerce,
  campaigns, document/stamp studio, image workshop, SOP toolkits, academy).
- ``SKU_DEV_SYSOPS``: Sovereign Developer & Windows SysAdmin Companion
  (engineering agents workspace, app/website builder, read-only-first PC Care,
  local Ollama & MCP connectors).

All money values stored in this module use integer cents (``int``) — never
floating-point currency values.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from typing import FrozenSet, Mapping, Optional, Tuple


SKU_TRADE_ERP = "SKU_TRADE_ERP"
SKU_OPS_AGENCY = "SKU_OPS_AGENCY"
SKU_DEV_SYSOPS = "SKU_DEV_SYSOPS"

# Explicit safety-isolated system/code capabilities that must never ship active
# inside industrial Trade & ERP deployments without explicit owner override.
ISOLATED_SYSOPS_DESKS: FrozenSet[str] = frozenset(
    {
        "pc_care",
        "app_builder",
        "engineering_agents",
    }
)

ISOLATED_CAPABILITIES: FrozenSet[str] = frozenset(
    {
        "pc_repair_routines",
        "system_clone_routines",
        "shell_code_agents",
        "startup_quarantine",
    }
)


@dataclass(frozen=True)
class DeskSpec:
    """Metadata for one of ThreadForge's 26 suite desks."""

    order: int
    key: str
    title: str
    route: str
    min_tier: str
    product_lines: Tuple[str, ...]
    safety_isolated: bool = False


@dataclass(frozen=True)
class SkuLineSpec:
    """Commercial product line definition."""

    sku_id: str
    name: str
    tagline: str
    primary_domain: str
    community_price_cents: int
    essentials_price_cents: int
    site_license_cents: int
    excluded_capabilities: FrozenSet[str]


# Ordered identically to the running ThreadForge 10.19.0 suite sidebar (01..26).
DESKS: Mapping[str, DeskSpec] = {
    "overview": DeskSpec(
        order=1,
        key="overview",
        title="Start Here · Executive Command Center",
        route="demo/",
        min_tier="community",
        product_lines=(SKU_TRADE_ERP, SKU_OPS_AGENCY, SKU_DEV_SYSOPS),
    ),
    "hr_payroll": DeskSpec(
        order=2,
        key="hr_payroll",
        title="HR & Attendance",
        route="hr/",
        min_tier="industrial",
        product_lines=(SKU_TRADE_ERP, SKU_OPS_AGENCY),
    ),
    "finance_treasury": DeskSpec(
        order=3,
        key="finance_treasury",
        title="Audit, Finance & Treasury",
        route="finance/",
        min_tier="industrial_park",
        product_lines=(SKU_TRADE_ERP,),
    ),
    "executive_approvals": DeskSpec(
        order=4,
        key="executive_approvals",
        title="Executive Approvals",
        route="governance/",
        min_tier="industrial_park",
        product_lines=(SKU_TRADE_ERP, SKU_OPS_AGENCY),
    ),
    "team_toolkits": DeskSpec(
        order=5,
        key="team_toolkits",
        title="Team Toolkits & SOPs",
        route="toolkits/",
        min_tier="industrial_park",
        product_lines=(SKU_TRADE_ERP, SKU_OPS_AGENCY, SKU_DEV_SYSOPS),
    ),
    "learning_paths": DeskSpec(
        order=6,
        key="learning_paths",
        title="Learning Paths & Academy",
        route="academy/",
        min_tier="industrial_park",
        product_lines=(SKU_OPS_AGENCY, SKU_DEV_SYSOPS),
    ),
    "image_workshop": DeskSpec(
        order=7,
        key="image_workshop",
        title="Image Workshop",
        route="media/",
        min_tier="industrial_park",
        product_lines=(SKU_OPS_AGENCY,),
    ),
    "document_studio": DeskSpec(
        order=8,
        key="document_studio",
        title="Document & Stamp Studio",
        route="documents/",
        min_tier="essentials",
        product_lines=(SKU_TRADE_ERP, SKU_OPS_AGENCY),
    ),
    "business": DeskSpec(
        order=9,
        key="business",
        title="Business & Commerce",
        route="business/",
        min_tier="essentials",
        product_lines=(SKU_TRADE_ERP, SKU_OPS_AGENCY),
    ),
    "landed_accounting": DeskSpec(
        order=10,
        key="landed_accounting",
        title="Landed Cost & Double-Entry Ledger",
        route="landed/",
        min_tier="essentials",
        product_lines=(SKU_TRADE_ERP,),
    ),
    "multichannel": DeskSpec(
        order=11,
        key="multichannel",
        title="Multichannel Hub",
        route="channels/",
        min_tier="essentials",
        product_lines=(SKU_TRADE_ERP, SKU_OPS_AGENCY),
    ),
    "manufacturing_mrp": DeskSpec(
        order=12,
        key="manufacturing_mrp",
        title="Manufacturing & Light MRP",
        route="mrp/",
        min_tier="essentials",
        product_lines=(SKU_TRADE_ERP,),
    ),
    "warehouse_barcode": DeskSpec(
        order=13,
        key="warehouse_barcode",
        title="Warehouse & Offline Barcode",
        route="warehouse/",
        min_tier="essentials",
        product_lines=(SKU_TRADE_ERP,),
    ),
    "insights": DeskSpec(
        order=14,
        key="insights",
        title="Data, Insights & AI Review",
        route="insights/",
        min_tier="essentials",
        product_lines=(SKU_TRADE_ERP, SKU_OPS_AGENCY, SKU_DEV_SYSOPS),
    ),
    "marketing": DeskSpec(
        order=15,
        key="marketing",
        title="Marketing & Campaigns",
        route="marketing/",
        min_tier="essentials",
        product_lines=(SKU_OPS_AGENCY,),
    ),
    "trade": DeskSpec(
        order=16,
        key="trade",
        title="Trade & TradeMath (57+ Calculators)",
        route="trademath/",
        min_tier="community",
        product_lines=(SKU_TRADE_ERP,),
    ),
    "diligence": DeskSpec(
        order=17,
        key="diligence",
        title="Supplier Due Diligence",
        route="diligence/",
        min_tier="essentials",
        product_lines=(SKU_TRADE_ERP,),
    ),
    "projects": DeskSpec(
        order=18,
        key="projects",
        title="Projects & Precision Kanban",
        route="projects/",
        min_tier="essentials",
        product_lines=(SKU_TRADE_ERP, SKU_OPS_AGENCY, SKU_DEV_SYSOPS),
    ),
    "capital_projects": DeskSpec(
        order=19,
        key="capital_projects",
        title="Capital Projects & BOQ",
        route="capital/",
        min_tier="industrial",
        product_lines=(SKU_TRADE_ERP,),
    ),
    "policy_log": DeskSpec(
        order=20,
        key="policy_log",
        title="Rate & Policy Log",
        route="policy-log/",
        min_tier="essentials",
        product_lines=(SKU_TRADE_ERP,),
    ),
    "app_builder": DeskSpec(
        order=21,
        key="app_builder",
        title="App & Website Builder",
        route="app-builder/",
        min_tier="professional",
        product_lines=(SKU_DEV_SYSOPS,),
        safety_isolated=True,
    ),
    "pc_care": DeskSpec(
        order=22,
        key="pc_care",
        title="Devices, Tools & PC Care",
        route="pc-care/",
        min_tier="professional",
        product_lines=(SKU_DEV_SYSOPS,),
        safety_isolated=True,
    ),
    "access_tokens": DeskSpec(
        order=23,
        key="access_tokens",
        title="People, Roles & Access Tokens",
        route="access/",
        min_tier="essentials",
        product_lines=(SKU_TRADE_ERP, SKU_OPS_AGENCY, SKU_DEV_SYSOPS),
    ),
    "ai_connectors": DeskSpec(
        order=24,
        key="ai_connectors",
        title="Local AI, Branding & MCP Connectors",
        route="connectors/",
        min_tier="professional",
        product_lines=(SKU_OPS_AGENCY, SKU_DEV_SYSOPS),
    ),
    "mentor": DeskSpec(
        order=25,
        key="mentor",
        title="Guides & The Mentor",
        route="mentor/",
        min_tier="essentials",
        product_lines=(SKU_TRADE_ERP, SKU_OPS_AGENCY, SKU_DEV_SYSOPS),
    ),
    "engineering_agents": DeskSpec(
        order=26,
        key="engineering_agents",
        title="Engineering Agents Workspace",
        route="app-builder/#engineering",
        min_tier="industrial",
        product_lines=(SKU_DEV_SYSOPS,),
        safety_isolated=True,
    ),
}

SKUS: Mapping[str, SkuLineSpec] = {
    SKU_TRADE_ERP: SkuLineSpec(
        sku_id=SKU_TRADE_ERP,
        name="ThreadForge Trade & Industrial ERP",
        tagline="Exact-cent ledger, Incoterms 2020 & TradeMath, MRP, WMS & supplier screening.",
        primary_domain="threadforgeofficial.com",
        community_price_cents=0,
        essentials_price_cents=4900,
        site_license_cents=49900,
        excluded_capabilities=ISOLATED_CAPABILITIES,
    ),
    SKU_OPS_AGENCY: SkuLineSpec(
        sku_id=SKU_OPS_AGENCY,
        name="ThreadForge Ops & Agency Workspace",
        tagline="Projects Kanban, CRM & consent-filtered campaigns, Document Studio & SOPs.",
        primary_domain="threadforge.live",
        community_price_cents=0,
        essentials_price_cents=4900,
        site_license_cents=14900,
        excluded_capabilities=frozenset({"pc_repair_routines", "startup_quarantine"}),
    ),
    SKU_DEV_SYSOPS: SkuLineSpec(
        sku_id=SKU_DEV_SYSOPS,
        name="ThreadForge Dev & SysAdmin Companion",
        tagline="Consent-gated PC Care, sandboxed PR engineering workspace, Ollama & MCP.",
        primary_domain="threadforge.cloud",
        community_price_cents=0,
        essentials_price_cents=4900,
        site_license_cents=29900,
        excluded_capabilities=frozenset(),
    ),
}


class DeskGateError(PermissionError):
    """Raised when an operation targets a desk/capability blocked for a SKU."""


def _validate_sku(sku_id: str) -> SkuLineSpec:
    if sku_id not in SKUS:
        raise KeyError(f"Unknown ThreadForge SKU: {sku_id!r}")
    return SKUS[sku_id]


def is_desk_enabled(
    sku_id: str,
    desk_key: str,
    *,
    explicit_enable: Optional[FrozenSet[str] | set[str] | tuple[str, ...] | list[str]] = None,
) -> bool:
    """Return True if ``desk_key`` is enabled for ``sku_id``.

    Safety-isolated desks (``pc_care``, ``app_builder``, ``engineering_agents``)
    remain disabled for ``SKU_TRADE_ERP`` unless explicitly named in
    ``explicit_enable``.
    """
    _validate_sku(sku_id)
    if desk_key not in DESKS:
        raise KeyError(f"Unknown desk key: {desk_key!r}")

    spec = DESKS[desk_key]
    overrides = set(explicit_enable or ())

    # Safety boundary: industrial ERP excludes PC Care & clone/code routines unless
    # explicitly opted in by the administrator.
    if sku_id == SKU_TRADE_ERP and desk_key in ISOLATED_SYSOPS_DESKS:
        return desk_key in overrides

    return (sku_id in spec.product_lines) or (desk_key in overrides)


def is_capability_enabled(
    sku_id: str,
    capability: str,
    *,
    explicit_enable: Optional[FrozenSet[str] | set[str] | tuple[str, ...] | list[str]] = None,
) -> bool:
    """Check whether a low-level capability (e.g. ``pc_repair_routines``) is permitted."""
    sku = _validate_sku(sku_id)
    overrides = set(explicit_enable or ())
    if capability in sku.excluded_capabilities and capability not in overrides:
        return False
    return True


def assert_desk_allowed(
    sku_id: str,
    desk_key: str,
    *,
    explicit_enable: Optional[FrozenSet[str] | set[str] | tuple[str, ...] | list[str]] = None,
) -> None:
    """Raise ``DeskGateError`` if ``desk_key`` is segregated out of ``sku_id``."""
    if not is_desk_enabled(sku_id, desk_key, explicit_enable=explicit_enable):
        raise DeskGateError(
            f"Desk {desk_key!r} is disabled in {sku_id} to maintain suite segregation "
            "(explicit opt-in override required)."
        )


def resolve_manifest(
    sku_id: str,
    *,
    explicit_enable: Optional[FrozenSet[str] | set[str] | tuple[str, ...] | list[str]] = None,
) -> dict:
    """Return an auditable JSON-serializable manifest for ``sku_id``."""
    sku = _validate_sku(sku_id)
    overrides = sorted(set(explicit_enable or ()))

    enabled = []
    disabled = []
    for spec in sorted(DESKS.values(), key=lambda d: d.order):
        item = {
            "order": spec.order,
            "key": spec.key,
            "title": spec.title,
            "route": spec.route,
            "min_tier": spec.min_tier,
            "safety_isolated": spec.safety_isolated,
        }
        if is_desk_enabled(sku_id, spec.key, explicit_enable=overrides):
            enabled.append(item)
        else:
            disabled.append(item)

    blocked_caps = sorted(
        cap for cap in sku.excluded_capabilities if cap not in overrides
    )

    return {
        "sku_id": sku.sku_id,
        "name": sku.name,
        "primary_domain": sku.primary_domain,
        "pricing_cents": {
            "community": sku.community_price_cents,
            "essentials": sku.essentials_price_cents,
            "site_license": sku.site_license_cents,
        },
        "explicit_overrides": overrides,
        "blocked_capabilities": blocked_caps,
        "enabled_desks": enabled,
        "disabled_desks": disabled,
    }


def _main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="ThreadForge SKU Registry inspector")
    parser.add_argument(
        "--sku",
        choices=sorted(SKUS.keys()),
        default=SKU_TRADE_ERP,
        help="Target SKU line to inspect",
    )
    parser.add_argument(
        "--enable",
        action="append",
        default=[],
        help="Optional explicit desk or capability override",
    )
    args = parser.parse_args(argv)
    manifest = resolve_manifest(args.sku, explicit_enable=args.enable)
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())

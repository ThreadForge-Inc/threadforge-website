/* International procurement and Capital projects for the public TradeMath desk.
   Same formulas, wording and rounding as threadforge/src/threadforge/trade_procurement.py and
   trade_board.py; website/tests/trade-intel.test.cjs holds results frozen from the Python.
   Every price, rate, duty and probability is one the visitor types. Nothing is looked up or sent. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TFIntel = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Input checks and rounding, matching trade_math._n, _opt, _text, _r and _g ------------------

  function fail(message) { var e = new Error(message); e.trade = true; throw e; }
  var DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)(?:[eE]([+-]?\d+))?$/;

  // Decimal places as trade_math._d counts them: none for a whole number, else -exponent.
  function decimalPlaces(raw) {
    var m = DECIMAL.exec(raw);
    var mant = m[1], exp = m[2] ? parseInt(m[2], 10) : 0;
    var dot = mant.indexOf(".");
    var digits = mant.replace(".", "");
    var places = (dot < 0 ? 0 : mant.length - dot - 1) - exp;
    if (places <= 0 || /^0*$/.test(digits.slice(Math.max(0, digits.length - places)))) return 0;
    return places;
  }

  function n(value, label, low, high, places, allowZero) {
    if (typeof value === "number" && Number.isInteger(value)) value = String(value);
    if (typeof value !== "string" || !value.trim() || value.length > 40) fail(label + " must be a decimal string or an integer.");
    var raw = value.trim();
    if (!DECIMAL.test(raw)) fail(label + " is not a decimal number.");
    if (decimalPlaces(raw) > (places == null ? 6 : places)) fail(label + " has more than " + (places == null ? 6 : places) + " decimal places.");
    var number = Number(raw);
    if (number < low) fail(label + " is below the allowed minimum.");
    if (number > high) fail(label + " is above the allowed maximum.");
    if (!allowZero && number === 0) fail(label + " must be greater than zero.");
    return number === 0 ? 0 : number;
  }

  function opt(inputs, key, label, low, high, places) {
    var value = inputs[key];
    return value == null || value === "" ? null : n(value, label, low, high, places, true);
  }

  function text(value, label, maximum) {
    if (typeof value !== "string" || !value.trim() || value.length > maximum) fail("Supply " + label + " (1–" + maximum + " characters).");
    if (/[\u0000-\u001f]/.test(value)) fail(label + " contains a control character.");
    return value.trim();
  }

  function unit(value, table, label) {
    if (typeof value !== "string" || table.indexOf(value) < 0) fail(label + " must be one of: " + table.join(", ") + ".");
    return value;
  }

  function choice(inputs, key, options, label, fallback) {
    return unit(inputs[key] || fallback, options, label);
  }

  // Exact decimal digits of a double: [negative, digit string, places after the point].
  function exact(x) {
    var neg = x < 0 || Object.is(x, -0);
    x = Math.abs(x);
    if (x === 0) return [neg, "0", 0];
    var view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, x);
    var bits = view.getBigUint64(0);
    var e = Number((bits >> 52n) & 0x7ffn), m = bits & 0xfffffffffffffn;
    if (e) m |= 1n << 52n; else e = 1;
    e -= 1075;
    if (e >= 0) return [neg, (m << BigInt(e)).toString(), 0];
    return [neg, (m * 5n ** BigInt(-e)).toString(), -e];
  }

  // The shortest repr of a double, as Python's repr gives it, split the same way.
  function shortest(x) {
    var neg = x < 0 || Object.is(x, -0);
    var s = Math.abs(x).toExponential();
    var parts = s.split("e"), digits = parts[0].replace(".", ""), exp = parseInt(parts[1], 10);
    var places = digits.length - 1 - exp;
    if (places < 0) { digits += "0".repeat(-places); places = 0; }
    return [neg, digits, places];
  }

  function roundDigits(parts, target, halfEven) {
    var neg = parts[0], digits = BigInt(parts[1]), places = parts[2];
    if (places > target) {
      var div = 10n ** BigInt(places - target), q = digits / div, rem = digits % div, twice = rem * 2n;
      if (twice > div || (twice === div && (!halfEven || q % 2n === 1n))) q += 1n;
      digits = q;
    } else digits *= 10n ** BigInt(target - places);
    var s = digits.toString().padStart(target + 1, "0");
    var out = target ? s.slice(0, -target) + "." + s.slice(-target) : s;
    return (neg ? "-" : "") + out;
  }

  // _r: Decimal(repr(value)).quantize(places, ROUND_HALF_UP).
  function r(value, places) { return roundDigits(shortest(value), places == null ? 2 : places, false); }
  function g(value, places) {
    var t = r(value, places == null ? 6 : places);
    return t.indexOf(".") >= 0 ? t.replace(/0+$/, "").replace(/\.$/, "") : t;
  }
  // Python's round(x, places) on a float: the exact binary value, ties to even.
  function pyRound(value, places) {
    if (!places) {
      var floor = Math.floor(value), diff = value - floor;
      return diff > 0.5 || (diff === 0.5 && floor % 2 !== 0) ? floor + 1 : floor;
    }
    return Number(roundDigits(exact(value), places, true));
  }
  function money(value) { return r(value, 2); }
  // Python 3.12+ sum() over floats uses Neumaier compensated summation.
  function sum(values) {
    var s = 0, c = 0;
    values.forEach(function (x) {
      var t = s + x;
      c += Math.abs(s) >= Math.abs(x) ? (s - t) + x : (x - t) + s;
      s = t;
    });
    return c && isFinite(c) ? s + c : s;
  }
  function fig(label, value, unitName) { return { label: label, value: String(value), unit: unitName || "" }; }
  function out(tool, summary, figures, formula, assumptions, warnings) {
    return { tool: tool, summary: summary, figures: figures, formula: formula, assumptions: assumptions, warnings: warnings || [] };
  }
  function rows(inputs, key, label, limit) {
    var list = inputs[key];
    if (!Array.isArray(list) || !list.length || list.length > limit) fail(label + " needs 1 to " + limit + " lines.");
    list.forEach(function (row) { if (!row || typeof row !== "object" || Array.isArray(row)) fail("Each line of " + label.toLowerCase() + " must be an object."); });
    return list;
  }
  function minBy(list, key) { return list.reduce(function (best, item) { return key(item) < key(best) ? item : best; }); }

  // International procurement -------------------------------------------------------------------

  var INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];
  var CARRIAGE_PAID = ["CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];
  var PAYMENT_TIMING = ["advance", "shipment", "credit"];
  var MAX_ORIGINS = 8;

  function originCost(row, index, common, fxShock, freightShock, price) {
    fxShock = fxShock || 0; freightShock = freightShock || 0;
    if (!row || typeof row !== "object" || Array.isArray(row)) fail("Each origin must be an object.");
    var tag = "Origin " + index;
    var name = text(row.name, tag.toLowerCase() + " name", 120);
    var currency = text(row.currency || common.home, name + " currency", 8).toUpperCase();
    var homePriced = currency === common.home;
    var fx = homePriced ? 1.0 : n(row.fx_rate, name + " exchange rate (" + common.home + " per 1 " + currency + ")", 0, 1e9, 8);
    fx *= 1 + (homePriced ? 0 : fxShock);
    var unitPrice = price != null ? price : n(row.unit_price, name + " unit price", 0, 1e9, 6);
    var incoterm = unit(row.incoterm || "FOB", INCOTERMS, name + " Incoterm");
    var freight = (opt(row, "freight", name + " freight per month", 0, 1e10, 2) || 0) * (1 + freightShock);
    var insuranceRate = (opt(row, "insurance_percent", name + " insurance %", 0, 20, 3) || 0) / 100;
    var local = opt(row, "local_charges", name + " clearing, port and inland per month", 0, 1e10, 2) || 0;
    var dutyRate = (opt(row, "duty_percent", name + " duty %", 0, 1000, 3) || 0) / 100;
    var extraRate = (opt(row, "extra_duty_percent", name + " additional duty %", 0, 1000, 3) || 0) / 100;
    if (dutyRate || extraRate) text(row.duty_source, "where " + name + "'s duty rates came from, with the date", 240);
    var taxRate = (opt(row, "tax_percent", name + " import VAT or sales tax %", 0, 100, 3) || 0) / 100;
    var recoverable = opt(row, "tax_recoverable_percent", name + " share of that tax you reclaim %", 0, 100, 2);
    recoverable = recoverable == null ? 1.0 : recoverable / 100;
    var drawback = (opt(row, "drawback_percent", name + " duty refunded on exported goods %", 0, 100, 2) || 0) / 100;
    var reject = (opt(row, "reject_percent", name + " rejected or lost %", 0, 90, 3) || 0) / 100;
    var lead = n(row.lead_days || "0", name + " production lead time (days)", 0, 730, 0, true);
    var transit = n(row.transit_days || "0", name + " transit time (days)", 0, 365, 0, true);
    var timing = unit(row.payment || "shipment", PAYMENT_TIMING, name + " payment timing");
    var credit = timing === "credit" ? n(row.credit_days || "0", name + " credit days", 0, 365, 0, true) : 0.0;
    var preference = !!row.preference;

    var quantity = common.quantity;
    var goods = quantity * unitPrice * fx;
    var insurance = goods * insuranceRate;
    var customs = goods + (common.basis === "cif" ? freight + insurance : 0);
    var duty = customs * dutyRate;
    var extra = customs * extraRate;
    var tax = (customs + duty + extra) * taxRate;
    var taxCost = tax * (1 - recoverable);
    var refund = (duty + extra) * common.export_share * drawback;
    var before = goods + freight + insurance + local;
    var inclusive = before + duty + extra + taxCost - refund;
    var tied = { advance: lead + transit, shipment: transit, credit: Math.max(0.0, transit - credit) }[timing];
    var finance = (goods + duty + extra + tax) * common.money_rate * tied / 365;
    var total = inclusive + finance;
    var goodUnits = quantity * (1 - reject);
    var warnings = [];
    if (CARRIAGE_PAID.indexOf(incoterm) >= 0 && freight && !freightShock)
      warnings.push(name + ": under " + incoterm + " the seller pays the main carriage, so freight is usually in the price. Enter only the charges you pay.");
    if (incoterm === "DDP" && (dutyRate || extraRate || taxRate))
      warnings.push(name + ": under DDP the seller pays import duty and tax. You also lose control of the customs value and may not be able to reclaim the VAT.");
    if (preference)
      warnings.push(name + ": a preferential rate (free trade agreement or GSP) holds only with valid proof of origin and goods that meet the agreement's rules of origin. Customs can claim the full duty back later.");
    if (extraRate)
      warnings.push(name + ": anti-dumping, countervailing, safeguard or retaliatory duties change by decision. Check the current notice before each contract.");
    return { name: name, currency: currency, home_priced: homePriced, unit_price: unitPrice, before: before, duty: duty + extra,
      tax: tax, tax_cost: taxCost, refund: refund, inclusive: inclusive, finance: finance, total: total,
      per_unit: total / goodUnits, before_unit: before / quantity, inclusive_unit: inclusive / quantity,
      days: lead + transit, good_units: goodUnits, warnings: warnings };
  }

  function sourcingCompare(inputs) {
    var home = text(inputs.home_currency || "USD", "Home currency", 8).toUpperCase();
    var common = {
      home: home,
      quantity: n(inputs.monthly_quantity, "Quantity bought per month", 0, 1e12, 3),
      basis: choice(inputs, "duty_basis", ["cif", "fob"], "Customs value basis", "cif"),
      export_share: (opt(inputs, "export_share_percent", "Share used in exported goods %", 0, 100, 2) || 0) / 100,
      money_rate: (opt(inputs, "money_rate_percent", "Your annual cost of money %", 0, 100, 3) || 0) / 100
    };
    var unitName = text(inputs.unit || "unit", "Unit", 20);
    var months = n(inputs.months || "12", "Months to plan", 1, 120, 0);
    var fxShock = (opt(inputs, "fx_shock_percent", "Currency shock %", 0, 100, 2) || 0) / 100;
    var freightShock = (opt(inputs, "freight_shock_percent", "Freight shock %", 0, 500, 2) || 0) / 100;
    var list = inputs.origins;
    if (!Array.isArray(list) || !list.length || list.length > MAX_ORIGINS) fail("Enter 1 to " + MAX_ORIGINS + " origins or suppliers to compare.");
    var base = list.map(function (row, i) { return originCost(row, i + 1, common); });
    var lower = base.map(function (o) { return o.name.toLowerCase(); });
    if (lower.some(function (x, i) { return lower.indexOf(x) !== i; })) fail("Give each origin a different name.");
    var stressed = list.map(function (row, i) { return originCost(row, i + 1, common, fxShock, freightShock); });
    var best = minBy(base, function (o) { return o.per_unit; });
    var bestStressed = minBy(stressed, function (o) { return o.per_unit; });
    var current = base[0];
    var figures = [fig("Best origin", best.name), fig("Best cost per good " + unitName, money(best.per_unit), home)];
    if (best !== current) {
      var saving = (current.per_unit - best.per_unit) * current.good_units * months;
      figures.push(fig("Saving against " + current.name + " over " + g(months, 0) + " months", money(saving), home));
    }
    base.forEach(function (o, i) {
      var s = stressed[i];
      figures.push(
        fig(o.name + ": cost per good " + unitName, money(o.per_unit), home),
        fig(o.name + ": per " + unitName + " before duties, taxes and rebates", money(o.before_unit), home),
        fig(o.name + ": per " + unitName + " with duties, non-recoverable tax and rebates", money(o.inclusive_unit), home),
        fig(o.name + ": duties per month", money(o.duty), home),
        fig(o.name + ": import tax paid per month (reclaimable part is cash, not cost)", money(o.tax), home),
        fig(o.name + ": duty refunded on exports per month", money(o.refund), home),
        fig(o.name + ": cost of cash tied up per month", money(o.finance), home),
        fig(o.name + ": total over " + g(months, 0) + " months", money(o.total * months), home),
        fig(o.name + ": cost per good " + unitName + " after the shocks", money(s.per_unit), home),
        fig(o.name + ": order to arrival", g(o.days, 0), "days"));
      if (o !== best) {
        var low = originCost(list[i], i + 1, common, 0, 0, 0.0).per_unit;
        var slope = o.unit_price ? (o.per_unit - low) / o.unit_price : 0;
        if (slope > 0) {
          var target = (best.per_unit - low) / slope;
          figures.push(fig(o.name + ": unit price that would match " + best.name,
            target > 0 ? r(target, 4) : "not reachable on price alone", target > 0 ? o.currency : ""));
        }
      }
    });
    var warnings = [];
    base.forEach(function (o) { warnings = warnings.concat(o.warnings); });
    if (bestStressed.name !== best.name)
      warnings.push("Fragile choice: after a " + g(fxShock * 100, 2) + "% currency shock and a " + g(freightShock * 100, 2) + "% freight shock, " + bestStressed.name + " becomes cheaper than " + best.name + ".");
    var summary = best.name + " has the lowest cost per good " + unitName + ": " + money(best.per_unit) + " " + home + ", including duties, tax you cannot reclaim, rebates, rejects and the cost of cash tied up.";
    if (bestStressed.name === best.name && base.length > 1) summary += " It stays cheapest after the currency and freight shocks.";
    return out("sourcing_compare", summary, figures,
      "Goods = quantity × unit price × exchange rate. Customs value = goods + freight + insurance (CIF basis) or goods only (FOB basis). " +
      "Duties = customs value × (duty % + additional duty %). Import tax = (customs value + duties) × tax %; only the share you cannot reclaim is a cost. " +
      "Rebate = duties × export share × refund %. Cash cost = (goods + duties + tax) × annual rate × days paid before arrival ÷ 365. " +
      "Cost per good unit = (before duties + duties + unreclaimable tax − rebate + cash cost) ÷ (quantity × (1 − reject %)).",
      ["Every price, exchange rate, duty, tax and refund rate is the one you entered. ThreadForge does not look up a tariff, a rate or a quote.",
        "The first origin is treated as your current supply, so savings are measured against it.",
        "The shocks weaken your currency against every foreign-priced origin and raise every freight figure, to show which choice survives a bad quarter.",
        "Duty refund schemes have different names and rules in each country (duty drawback, inward processing, bonded or export-oriented manufacturing). Confirm eligibility with customs or a licensed broker.",
        "This is a planning comparison, not a customs assessment."],
      warnings);
  }

  var EVIDENCE = [
    ["certificates", "supplier", "Certificates", [
      ["verified", 0, null],
      ["copy", 2, "Check each certificate number on the issuing body's own register; a PDF copy proves nothing on its own."],
      ["none", 3, "Require current certificates from an accredited body (for example ISO 9001, or the product standard) before the next order."]]],
    ["testing", "supplier", "Testing", [
      ["independent", 0, null],
      ["own", 2, "Have lots tested by an independent laboratory accredited to ISO/IEC 17025, at least on the first lots and then by sampling."],
      ["none", 3, "Write the test methods and limits into the contract and test every lot until the supplier earns a record."]]],
    ["inspection", "supplier", "Inspection before shipment", [
      ["third_party", 0, null],
      ["own", 1, "Your own staff visit is good; add an independent pre-shipment inspection with an AQL sampling plan (ISO 2859-1) for large lots."],
      ["none", 3, "Book a pre-shipment inspection with an AQL sampling plan and pay the balance only after a passed report."]]],
    ["consistency", "supplier", "Bulk against the approved sample", [
      ["matched", 0, null],
      ["some", 2, "Keep a sealed, signed approved sample at both ends and compare every bulk lot to it."],
      ["poor", 3, "Stop accepting deviations informally: issue a written non-conformance, claim against the contract and qualify a second source."]]],
    ["capacity", "supplier", "Capacity", [
      ["spare", 0, null],
      ["single", 2, "One plant is one fire, flood or strike away from stopping you. Hold extra stock or qualify a second plant."],
      ["unknown", 2, "Ask for capacity, current load and other plants, and verify them on a visit or an audit."]]],
    ["finance", "supplier", "Financial health", [
      ["reviewed", 0, null],
      ["partial", 1, "Get a credit report or audited accounts before increasing volume or paying deposits."],
      ["none", 3, "Do not pay large advances until you have a credit report; use a letter of credit or pay against documents."]]],
    ["export_controls", "country", "Export restrictions on this product", [
      ["none", 0, null],
      ["licensing", 2, "Ask the supplier for the export licence before each contract and allow for delays in the lead time."],
      ["volatile", 3, "Sudden bans or quotas have happened here. Keep a second origin qualified and hold extra stock."]]],
    ["trade_remedies", "country", "Anti-dumping or other trade remedies", [
      ["none", 0, null],
      ["investigation", 2, "An open investigation can end in duties, sometimes backdated. Price contracts so that new duties can be shared, and watch the notices."],
      ["in_force", 3, "Duties are in force on this origin. Include them in the comparison and check whether a supplier is excluded or has its own rate."]]],
    ["screening", "country", "Sanctions and restricted-party screening", [
      ["clear", 0, null],
      ["not_done", 2, "Screen the supplier, its owners and its bank on the Due diligence desk before paying."],
      ["concern", 5, "Stop: a possible match needs legal review before any payment or shipment."]]],
    ["currency", "country", "Currency and payments", [
      ["stable", 0, null],
      ["volatile", 2, "Agree prices in your currency, or hedge committed payments with forward contracts."],
      ["controls", 3, "Capital controls can block payments or refunds. Use a letter of credit and avoid prepayments."]]],
    ["logistics", "country", "Route", [
      ["reliable", 0, null],
      ["disrupted", 1, "Add buffer days to the lead time and agree an alternative port or carrier in advance."],
      ["chokepoint", 3, "The route depends on a chokepoint or a conflict zone. Hold extra stock and price an alternative route now."]]],
    ["standards", "country", "Reliability of certificates from this origin", [
      ["reliable", 0, null],
      ["mixed", 2, "Accept certificates only from bodies accredited under the IAF or ILAC agreements, and verify each one."],
      ["unreliable", 3, "There are reports of unreliable certificates or test results for this product. Test independently in your own country or at a lab you choose."]]],
    ["enforcement", "country", "Contract enforcement", [
      ["strong", 0, null],
      ["weak", 2, "An award is only worth what courts there enforce. Use payment security (letter of credit, retention) rather than relying on a claim."],
      ["none", 3, "Add an arbitration clause with a named institution and seat in a New York Convention country, or keep payment security."]]]
  ];
  var RED_FLAGS = [
    ["flag_bank_change", "Asked to pay a new or different bank account",
      "Treat as fraud until proven otherwise: confirm the change by calling a number you already held, never one in the email. Most of these losses are business email compromise."],
    ["flag_urgency", "Pressure to decide or pay unusually fast",
      "Urgency is a classic pressure tactic. Hold to your normal approval steps and timelines."],
    ["flag_low_price", "Price far below other quotes",
      "A price far below the market usually means a different grade, short weight or a deposit fraud. Ask why, test the first lot and pay against documents."],
    ["flag_spec_change", "Specification changed after the sample was approved",
      "Refuse silent substitutions: any change needs a new written approval and a new sample."],
    ["flag_refuses_inspection", "Refuses inspection or independent testing",
      "A supplier who refuses inspection should not be paid before arrival. Make inspection a condition of payment."],
    ["flag_documents", "Documents that do not agree with each other",
      "Check weights, descriptions, HS codes and names across the invoice, packing list and bill of lading. Mismatches are the commonest cause of customs penalties and frauds."],
    ["flag_gifts", "Gifts, side payments or pressure through officials",
      "Decline, record it and escalate. Anti-bribery laws apply to you as well as to them, and an order won this way rarely holds its quality."]
  ];
  var CONTROLS = [
    ["control_callback", "Bank details are confirmed by a call to a known number", "Confirm every bank detail change by calling a known number."],
    ["control_four_eyes", "Two people approve each payment", "Have two people approve each supplier payment."],
    ["control_golden_sample", "A sealed approved sample is kept", "Keep a sealed approved sample from each supplier."],
    ["control_spec", "A signed specification with tolerances and test methods", "Sign a specification with tolerances, test methods and an acceptance plan."]
  ];

  function supplierRisk(inputs) {
    var supplier = text(inputs.supplier || "Supplier", "Supplier", 120);
    var points = { supplier: 0, country: 0, behaviour: 0 };
    var worst = { supplier: 0, country: 0, behaviour: 0 };
    var actions = [];
    EVIDENCE.forEach(function (item) {
      var keys = item[3].map(function (o) { return o[0]; });
      var picked = choice(inputs, item[0], keys, item[2]);
      var option = item[3][keys.indexOf(picked)];
      points[item[1]] += option[1];
      worst[item[1]] += Math.max.apply(null, item[3].map(function (o) { return o[1]; }));
      if (option[2]) actions.push([option[1], item[2], option[2]]);
    });
    var onTime = opt(inputs, "on_time_percent", "On-time deliveries %", 0, 100, 1);
    worst.supplier += 3;
    if (onTime != null) {
      var late = onTime >= 95 ? 0 : onTime >= 85 ? 1 : 3;
      points.supplier += late;
      if (late) actions.push([late, "On-time deliveries", "Only " + g(onTime, 1) + "% arrived on time. Agree a delivery KPI with a remedy, and hold stock to cover the lateness."]);
    } else {
      points.supplier += 2;
      actions.push([2, "On-time deliveries", "Start recording promised and actual dates for each order; the Order scorecard below does it."]);
    }
    var flags = RED_FLAGS.filter(function (f) { return inputs[f[0]]; }).map(function (f) { return [f[1], f[2]]; });
    var controls = CONTROLS.filter(function (c) { return inputs[c[0]]; }).map(function (c) { return c[0]; });
    worst.behaviour = 3 * RED_FLAGS.length + CONTROLS.length;
    points.behaviour = 3 * flags.length + (CONTROLS.length - controls.length);
    flags.forEach(function (f) { actions.push([4, f[0], f[1]]); });
    CONTROLS.forEach(function (c) { if (controls.indexOf(c[0]) < 0) actions.push([1, "Missing control", c[2]]); });
    var share = { supplier: points.supplier / worst.supplier, country: points.country / worst.country, behaviour: points.behaviour / worst.behaviour };
    var overall = share.supplier * 0.4 + share.country * 0.35 + share.behaviour * 0.25;
    var critical = inputs.screening === "concern" || !!inputs.flag_bank_change;
    var level = critical ? "Critical" : overall >= 0.5 || flags.length >= 2 ? "High" : overall >= 0.25 || flags.length ? "Medium" : "Low";
    actions = actions.map(function (a, i) { return [a, i]; }).sort(function (x, y) { return y[0][0] - x[0][0] || x[1] - y[1]; }).map(function (x) { return x[0]; });
    var figures = [fig("Risk level", level),
      fig("Supplier evidence risk", r(share.supplier * 100, 0), "%"),
      fig("Country and policy risk", r(share.country * 100, 0), "%"),
      fig("Behaviour and control risk", r(share.behaviour * 100, 0), "%"),
      fig("Red flags seen", String(flags.length)),
      fig("Controls in place", controls.length + " of " + CONTROLS.length)];
    actions.slice(0, 12).forEach(function (a, i) { figures.push(fig("Action " + (i + 1) + " · " + a[1], a[2])); });
    var summary = supplier + ": " + level.toLowerCase() + " risk on the evidence you recorded. " +
      (actions.length ? "Act first on: " + actions[0][1].toLowerCase() + "." : "No weakness recorded; keep checking each order.");
    return out("supplier_risk", summary, figures,
      "Each answer scores 0 (evidence in hand) to 3 (no evidence or a known problem); a sanctions concern scores 5 and each red flag scores 3. " +
      "Area risk = points ÷ the worst possible points. Overall = 40 % supplier evidence + 35 % country and policy + 25 % behaviour and controls. " +
      "A sanctions concern or a bank-account change makes the level critical.",
      ["Scores come from your own answers and evidence. ThreadForge does not rate countries, governments or companies.",
        "Country answers describe this product from this origin, as you judge it from published notices and your own experience.",
        "Use the Due diligence desk for restricted-party lists, the company registry and trade statistics."],
      critical ? ["Do not pay or ship until the critical item is resolved."] : []);
  }

  function sourcingStrategy(inputs) {
    var home = text(inputs.home_currency || "USD", "Home currency", 8).toUpperCase();
    var spend = n(inputs.annual_spend, "Annual spend", 0, 1e13, 2);
    var spendShare = n(inputs.spend_share_percent || "0", "Share of your total purchasing %", 0, 100, 2, true) / 100;
    var criticality = choice(inputs, "criticality", ["stops", "slows", "easy"], "If supply stops", "stops");
    var market = choice(inputs, "supply_market", ["many", "few", "single"], "Qualified suppliers in the market", "few");
    var suppliers = Math.trunc(n(inputs.current_suppliers || "1", "Suppliers you use now", 1, 100, 0));
    var lead = n(inputs.lead_days, "Order-to-arrival days", 1, 730, 0);
    var variability = choice(inputs, "lead_variability", ["low", "medium", "high"], "Lead-time reliability", "medium");
    var demand = choice(inputs, "demand", ["stable", "seasonal", "volatile"], "Demand", "stable");
    var priceRisk = choice(inputs, "price_volatility", ["low", "medium", "high"], "Price volatility", "medium");
    var currency = choice(inputs, "currency_exposure", ["home", "stable", "volatile"], "Currency of the purchase", "stable");
    var countryRisk = choice(inputs, "country_risk", ["low", "medium", "high"], "Country and route risk", "medium");
    var exportShare = (opt(inputs, "export_share_percent", "Share used in exported goods %", 0, 100, 2) || 0) / 100;
    var dutyPaid = opt(inputs, "annual_duty", "Duty paid per year", 0, 1e13, 2) || 0;
    var cbm = opt(inputs, "monthly_cbm", "Volume shipped per month (m³)", 0, 1e6, 3) || 0;

    var impactHigh = criticality === "stops" || spendShare >= 0.1;
    var riskHigh = market !== "many" || variability === "high" || countryRisk === "high";
    var quadrant = impactHigh ? (riskHigh ? "Strategic" : "Leverage") : (riskHigh ? "Bottleneck" : "Routine");
    var plan = {
      Strategic: ["Partner and protect", "A long-term agreement (one to three years) with an agreed price formula, quality and delivery KPIs and a joint improvement plan, because both the money and the supply risk are high."],
      Bottleneck: ["Secure the supply", "Longer contracts and buffer stock, and work on alternative specifications or suppliers, because a small spend can still stop the plant."],
      Leverage: ["Use your buying power", "Competitive tenders, volume consolidation and annual contracts, and trial new origins, because many suppliers want this spend."],
      Routine: ["Simplify", "Fewer suppliers, framework orders and automatic reordering, because the effort to manage this should cost less than the item."]
    }[quadrant];
    var split;
    if (criticality === "stops" && suppliers === 1) split = "Qualify a second source in a different country within six months, then buy about 70/30 so both stay ready.";
    else if (quadrant === "Leverage") split = "Two or three suppliers, with volume awarded by tender; consolidate to win price breaks.";
    else if (quadrant === "Routine") split = "One preferred supplier on a framework order is enough; review it each year.";
    else split = "Keep at least two qualified sources; a 70/30 or 80/20 split keeps the second one active.";
    var cv = { low: 0.1, medium: 0.25, high: 0.4 }[variability];
    var z = { stops: 2.05, slows: 1.65, easy: 1.28 }[criticality];
    var safetyDays = z * cv * lead + { stable: 0, seasonal: 7, volatile: 14 }[demand];
    var figures = [fig("Category", quadrant + " (Kraljic matrix)"),
      fig("Strategy", plan[0] + ": " + plan[1]),
      fig("Sourcing split", split),
      fig("Safety stock", "About " + g(pyRound(safetyDays), 0) + " days of use: z " + g(z, 2) + " × lead-time variation " + g(cv, 2) + " × " + g(lead, 0) + " days" +
        (demand === "stable" ? "" : ", plus a margin for " + demand + " demand") + ".", "")];
    if (cbm) {
      var ship;
      if (cbm >= 25) ship = g(cbm, 1) + " m³ a month fills a 20-foot container (about 25–28 m³ usable). Ship full containers (FCL); compare 40-foot rates above about 50 m³.";
      else if (cbm >= 12) ship = g(cbm, 1) + " m³ a month is near the point where a full 20-foot container usually costs less than groupage (LCL). Get both quotes, or ship every " + g(Math.ceil(25 / cbm * 4.3), 0) + " weeks in a full container.";
      else ship = g(cbm, 1) + " m³ a month suits groupage (LCL). Filling a 20-foot container would take about " + g(Math.ceil(25 / cbm), 0) + " months of stock; weigh the freight saving against the cash tied up.";
      figures.push(fig("Shipping", ship));
    }
    figures.push(fig("Incoterm", spend >= 50000 ?
      "FCA or FOB with your own forwarder: you control freight, insurance, routing and customs value, and can reclaim import VAT. " +
      "Use CFR or CIF only if the supplier's freight is cheaper and you accept less visibility; avoid DDP for imports into your own country." :
      "CFR, CIF or CPT is simpler at this spend; move to FCA or FOB with your own forwarder as volume grows."));
    figures.push(fig("Price", {
      high: "Use an indexed price formula tied to a published index for the main raw material, with a review band, or buy forward in stages; a fixed price will be broken in a spike.",
      medium: "Fix prices for 3 to 6 months with an agreed review rule.",
      low: "Fixed annual prices with volume tiers."
    }[priceRisk]));
    figures.push(fig("Currency", {
      home: "You buy in your own currency, so the supplier carries the exchange risk; expect it in the price.",
      stable: "Hedge committed payments for the next 3 months with forward contracts, or agree prices in your currency.",
      volatile: "Hedge 50–80 % of the next 3 to 6 months of committed payments with forward contracts, and add a currency clause to the contract."
    }[currency]));
    if (exportShare) {
      var relief = g(exportShare * 100, 1) + " % of this input ends up in exports. Apply for duty drawback, inward processing, a bonded warehouse or an export-oriented scheme where your country has one";
      if (dutyPaid) relief += "; on the duty you entered that is worth up to " + r(dutyPaid * exportShare, 2) + " " + home + " a year";
      figures.push(fig("Duty relief", relief + ". Check preferential origin under free trade agreements too."));
    }
    var actions = [];
    if (criticality === "stops" && suppliers === 1) actions.push("Shortlist second sources in two other countries and order samples.");
    if (countryRisk === "high") actions.push("Price an alternative route and origin, and set a stock trigger for switching.");
    if (priceRisk === "high") actions.push("Agree an index-linked price clause at the next renewal.");
    if (currency === "volatile") actions.push("Open a forward-contract line with your bank and set a hedging rule.");
    if (exportShare) actions.push("Ask customs or a licensed broker which duty relief scheme fits and what records it needs.");
    actions.push("Compare origins on full cost in the Sourcing comparison, and score each supplier in Supplier and country risk.");
    actions.forEach(function (a, i) { figures.push(fig("Next 90 days · " + (i + 1), a)); });
    return out("sourcing_strategy", quadrant + " purchase: " + plan[0].toLowerCase() + ".", figures,
      "Kraljic matrix: profit impact is high when a stoppage halts production or the item is at least 10 % of purchasing; supply risk is high with few or one qualified suppliers, unreliable lead times or a high-risk country or route. " +
      "Safety days = z (by criticality: 2.05, 1.65 or 1.28) × lead-time coefficient of variation (0.1, 0.25 or 0.4) × lead days, plus 7 or 14 days for seasonal or volatile demand.",
      ["Recommendations follow published purchasing practice and your answers; they are not legal, tax or banking advice.",
        "Container capacities are typical usable volumes; your cargo, pallets and the carrier's rules decide the real figure.",
        "Duty relief schemes differ by country; customs or a licensed broker confirms which one applies."]);
  }

  // Capital projects ----------------------------------------------------------------------------

  var CLASSES = {
    "5": ["Class 5: concept screening, 0–2 % of design done", [-0.50, -0.20], [0.30, 1.00], 0.30],
    "4": ["Class 4: feasibility study, 1–15 % of design done", [-0.30, -0.15], [0.20, 0.50], 0.20],
    "3": ["Class 3: budget authorisation, 10–40 % of design done", [-0.20, -0.10], [0.10, 0.30], 0.12],
    "2": ["Class 2: control or bid check, 30–75 % of design done", [-0.15, -0.05], [0.05, 0.20], 0.08],
    "1": ["Class 1: bid or tender check, 65–100 % of design done", [-0.10, -0.03], [0.03, 0.15], 0.05]
  };

  function boqEstimate(inputs) {
    var currency = text(inputs.currency || "USD", "Currency", 8).toUpperCase();
    var klass = choice(inputs, "estimate_class", ["5", "4", "3", "2", "1"], "Estimate class", "3");
    var c = CLASSES[klass], label = c[0], lowBand = c[1], highBand = c[2], typical = c[3];
    var prelims = (opt(inputs, "preliminaries_percent", "Preliminaries and site overheads %", 0, 60, 2) || 0) / 100;
    var ohp = (opt(inputs, "overhead_profit_percent", "Contractor overhead and profit %", 0, 60, 2) || 0) / 100;
    var fees = (opt(inputs, "fees_percent", "Design and professional fees %", 0, 40, 2) || 0) / 100;
    var escalation = (opt(inputs, "escalation_percent", "Price escalation % a year", 0, 100, 2) || 0) / 100;
    var months = opt(inputs, "months_to_midpoint", "Months to the middle of construction", 0, 240, 1) || 0;
    var ownContingency = opt(inputs, "contingency_percent", "Contingency %", 0, 200, 2);
    var contingency = ownContingency == null ? typical : ownContingency / 100;
    var tax = (opt(inputs, "tax_percent", "Tax on the contract %", 0, 100, 2) || 0) / 100;
    var size = opt(inputs, "size", "Project size (for cost per unit)", 0, 1e12, 3);
    var sizeUnit = text(inputs.size_unit || "m²", "Size unit", 20);
    var benchmark = opt(inputs, "benchmark", "Benchmark cost per size unit", 0, 1e12, 2);

    var lines = [], categories = {}, order = [], unpriced = [];
    rows(inputs, "items", "The bill", 500).forEach(function (row, i) {
      var name = text(row.item, "the description on line " + (i + 1), 200);
      var quantity = n(row.quantity, name + " quantity", 0, 1e12, 4);
      if (row.rate == null || row.rate === "") { unpriced.push(name); return; }
      var rate = n(row.rate, name + " rate", 0, 1e12, 4, true);
      var waste = (opt(row, "wastage_percent", name + " wastage %", 0, 100, 2) || 0) / 100;
      var category = String(row.category || "General").trim().slice(0, 60) || "General";
      var cost = quantity * rate * (1 + waste);
      lines.push([cost, name, category]);
      if (!(category in categories)) { categories[category] = 0; order.push(category); }
      categories[category] = categories[category] + cost;
    });
    if (!lines.length) fail("Price at least one line: every line has a blank rate.");
    var direct = sum(lines.map(function (l) { return l[0]; }));
    var preliminaries = direct * prelims;
    var overhead = (direct + preliminaries) * ohp;
    var construction = direct + preliminaries + overhead;
    var professional = construction * fees;
    var base = construction + professional;
    var escalated = base * escalation * months / 12;
    var reserve = (base + escalated) * contingency;
    var beforeTax = base + escalated + reserve;
    var budget = beforeTax * (1 + tax);
    var figures = [fig("Budget to approve", money(budget), currency),
      fig("Estimate class", label),
      fig("Likely range", money(beforeTax * (1 + lowBand[1])) + " to " + money(beforeTax * (1 + highBand[0])), currency),
      fig("Widest range for this class", money(beforeTax * (1 + lowBand[0])) + " to " + money(beforeTax * (1 + highBand[1])), currency),
      fig("Direct cost of the priced lines", money(direct), currency)];
    order.slice().sort(function (a, b) { return categories[b] - categories[a] || order.indexOf(a) - order.indexOf(b); }).forEach(function (cat) {
      figures.push(fig("Direct · " + cat, money(categories[cat]) + " (" + g(categories[cat] / direct * 100, 1) + " %)", currency));
    });
    figures.push(fig("Preliminaries and site overheads", money(preliminaries), currency),
      fig("Contractor overhead and profit", money(overhead), currency),
      fig("Design and professional fees", money(professional), currency),
      fig("Escalation to mid-construction", money(escalated), currency),
      fig("Contingency (" + g(contingency * 100, 2) + " %" + (ownContingency == null ? ", typical for this class" : "") + ")", money(reserve), currency),
      fig("Tax", money(beforeTax * tax), currency));
    // Python sorts the (cost, name, category) tuples in reverse.
    var sorted = lines.slice().sort(function (a, b) {
      if (a[0] !== b[0]) return b[0] - a[0];
      if (a[1] !== b[1]) return a[1] < b[1] ? 1 : -1;
      return a[2] === b[2] ? 0 : a[2] < b[2] ? 1 : -1;
    });
    var running = 0, drivers = [];
    for (var i = 0; i < sorted.length; i++) {
      if (running >= direct * 0.8 || drivers.length >= 8) break;
      running += sorted[i][0];
      drivers.push(sorted[i]);
    }
    drivers.forEach(function (d) { figures.push(fig("Cost driver · " + d[1], money(d[0]) + " (" + g(d[0] / direct * 100, 1) + " % of direct cost)", currency)); });
    var warnings = [];
    if (size) {
      var per = budget / size;
      figures.push(fig("Cost per " + sizeUnit, money(per), currency));
      if (benchmark) {
        var gap = (per - benchmark) / benchmark * 100;
        figures.push(fig("Against your benchmark", g(gap, 1) + " %"));
        if (Math.abs(gap) > 15) warnings.push("The cost per " + sizeUnit + " is " + g(Math.abs(gap), 1) + " % " + (gap > 0 ? "above" : "below") + " your benchmark. Find out why before approving: scope, specification, site conditions or a missing or doubled item.");
      }
    }
    if (unpriced.length) warnings.push(unpriced.length + " line" + (unpriced.length === 1 ? "" : "s") + " with no rate " + (unpriced.length === 1 ? "is" : "are") + " left out of the budget: " + unpriced.slice(0, 8).join(", ") + (unpriced.length > 8 ? " …" : "") + ".");
    if (klass === "5" || klass === "4") warnings.push("A Class " + klass + " estimate is for screening, not for a fixed budget or a contract award. Approve design work to reach Class 3 first.");
    if (ownContingency != null && ownContingency / 100 < typical / 2) warnings.push("The contingency is less than half the typical figure for this class. Base it on the Risk register, not on hope.");
    return out("boq_estimate", "Budget " + money(budget) + " " + currency + " at " + label.split(":")[0] + "; it may fall between " + money(beforeTax * (1 + lowBand[1])) + " and " + money(beforeTax * (1 + highBand[0])) + ".", figures,
      "Line cost = quantity × rate × (1 + wastage). Preliminaries = direct × %; overhead and profit on direct + preliminaries; fees on the construction cost. " +
      "Escalation = base × annual % × months to mid-construction ÷ 12. Contingency on base + escalation. Range from the class's accuracy band (AACE 18R-97).",
      ["Quantities and rates are the ones in your bill. ThreadForge does not price items from an outside database.",
        "The accuracy bands are AACE International's published ranges for process and industrial projects; building work often uses similar bands.",
        "Typical contingency per class is a starting point; a risk-based figure from the Risk register is better.",
        "This is a cost plan for decisions, not a contract sum or a valuation."],
      warnings);
  }

  function bidCompare(inputs) {
    var currency = text(inputs.currency || "USD", "Currency", 8).toUpperCase();
    var estimate = opt(inputs, "estimate", "Your estimate for this package", 0, 1e13, 2);
    var priceWeight = n(inputs.price_weight_percent || "60", "Weight given to price %", 0, 100, 1, true) / 100;
    var passMark = n(inputs.pass_mark || "60", "Technical pass mark", 0, 100, 1, true);
    var lowFlag = n(inputs.abnormal_low_percent || "15", "Flag bids this far below the estimate or the average %", 1, 90, 1) / 100;
    var bids = rows(inputs, "bids", "The bids", 20).map(function (row, i) {
      var name = text(row.bidder, "the bidder on line " + (i + 1), 120);
      return { name: name, price: n(row.price, name + " price", 0, 1e13, 2),
        technical: n(row.technical_score, name + " technical score (0–100)", 0, 100, 1, true),
        months: opt(row, "duration_months", name + " duration (months)", 0, 600, 1) };
    });
    var qualified = bids.filter(function (b) { return b.technical >= passMark; });
    if (!qualified.length) fail("No bid reaches the technical pass mark of " + g(passMark, 1) + ".");
    var lowest = Math.min.apply(null, qualified.map(function (b) { return b.price; }));
    var average = sum(bids.map(function (b) { return b.price; })) / bids.length;
    qualified.forEach(function (b) { b.score = lowest / b.price * priceWeight * 100 + b.technical * (1 - priceWeight); });
    var ranked = qualified.slice().sort(function (a, b) { return b.score - a.score; });
    var best = ranked[0];
    var figures = [fig("Highest-scoring bid", best.name), fig("Its price", money(best.price), currency)];
    if (estimate) figures.push(fig("Its price against your estimate", g((best.price - estimate) / estimate * 100, 1) + " %"));
    var warnings = [];
    bids.forEach(function (b) {
      var isQualified = qualified.indexOf(b) >= 0;
      var status = isQualified ? "score " + g(pyRound(b.score || 0, 1), 1) : "fails the technical pass mark";
      var detail = money(b.price) + " " + currency + " · technical " + g(b.technical, 1) + " · " + status;
      if (b.months) detail += " · " + g(b.months, 1) + " months";
      figures.push(fig("Bid · " + b.name, detail));
      var reference = estimate || average;
      if (b.price < reference * (1 - lowFlag))
        warnings.push(b.name + " is more than " + g(lowFlag * 100, 1) + " % below the " + (estimate ? "estimate" : "average bid") + ". Ask for a written breakdown before award: abnormally low bids often lead to claims, variations or failure.");
      if (estimate && b.price > estimate * 1.1)
        warnings.push(b.name + " is more than 10 % over your estimate. Check whether the scope or the estimate is wrong before negotiating.");
    });
    if (qualified.length < 3) warnings.push("Fewer than three bids pass the technical mark, so competition is thin. Consider whether the price is a fair market test.");
    return out("bid_compare", best.name + " scores highest: " + money(best.price) + " " + currency + " with technical " + g(best.technical, 1) + ", out of " + qualified.length + " qualifying bid" + (qualified.length === 1 ? "" : "s") + ".", figures,
      "Score = lowest qualifying price ÷ bid price × price weight × 100 + technical score × (1 − price weight). Bids below the technical pass mark are not scored.",
      ["Technical scores are your evaluation panel's, made against criteria published to the bidders before the bids were opened.",
        "The highest score is a recommendation for negotiation and checks, not an award."],
      warnings);
  }

  function pertSchedule(inputs) {
    var list = rows(inputs, "activities", "The schedule", 120);
    var acts = {}, order = [];
    list.forEach(function (row, i) {
      var name = text(row.activity, "the activity on line " + (i + 1), 120);
      if (Object.prototype.hasOwnProperty.call(acts, name.toLowerCase())) fail("Two activities are called " + name + ". Give each a different name.");
      var o = n(row.optimistic, name + " optimistic days", 0, 10000, 1, true);
      var m = n(row.likely, name + " most likely days", 0, 10000, 1, true);
      var p = n(row.pessimistic, name + " pessimistic days", 0, 10000, 1, true);
      if (!(o <= m && m <= p)) fail(name + ": optimistic ≤ most likely ≤ pessimistic.");
      var after = String(row.after || "").replace(/;/g, ",").split(",").map(function (a) { return a.trim().toLowerCase(); }).filter(Boolean);
      acts[name.toLowerCase()] = { name: name, mean: (o + 4 * m + p) / 6, variance: Math.pow((p - o) / 6, 2), after: after };
      order.push(name.toLowerCase());
    });
    order.forEach(function (k) {
      acts[k].after.forEach(function (dep) { if (!Object.prototype.hasOwnProperty.call(acts, dep)) fail(acts[k].name + " comes after " + dep + ", which is not in the list."); });
    });
    var remaining = {}, done = {}, sequence = [];
    order.forEach(function (k) { remaining[k] = acts[k].after.slice(); });
    while (Object.keys(remaining).length) {
      var ready = order.filter(function (k) { return k in remaining && remaining[k].every(function (d) { return done[d]; }); });
      if (!ready.length) fail("The dependencies go round in a circle: " + order.filter(function (k) { return k in remaining; }).map(function (k) { return acts[k].name; }).join(", ") + ".");
      ready.forEach(function (k) { sequence.push(k); done[k] = true; delete remaining[k]; });
    }
    sequence.forEach(function (k) {
      var a = acts[k];
      a.es = a.after.length ? Math.max.apply(null, a.after.map(function (d) { return acts[d].ef; })) : 0.0;
      a.ef = a.es + a.mean;
    });
    var finish = Math.max.apply(null, order.map(function (k) { return acts[k].ef; }));
    sequence.slice().reverse().forEach(function (k) {
      var a = acts[k];
      var followers = sequence.filter(function (f) { return acts[f].after.indexOf(k) >= 0; }).map(function (f) { return acts[f]; });
      a.lf = followers.length ? Math.min.apply(null, followers.map(function (f) { return f.ls; })) : finish;
      a.ls = a.lf - a.mean;
      a.slack = a.ls - a.es;
    });
    var all = order.map(function (k) { return acts[k]; });
    var end = all.reduce(function (best, a) { return a.ef > best.ef ? a : best; });
    var path = [end];
    while (path[path.length - 1].after.length) {
      var last = path[path.length - 1];
      var prior = last.after.map(function (d) { return acts[d]; }).filter(function (a) { return Math.abs(a.ef - last.es) < 1e-9; });
      if (!prior.length) break;
      path.push(prior.reduce(function (best, a) { return a.variance > best.variance ? a : best; }));
    }
    path.reverse();
    var sd = Math.sqrt(sum(path.map(function (a) { return a.variance; })));
    var p50 = finish, p80 = finish + 0.8416 * sd, p90 = finish + 1.2816 * sd;
    var names = path.map(function (a) { return a.name; }).join(" → ");
    var figures = [fig("P80 duration", g(pyRound(p80, 1), 1), "days"),
      fig("P50 duration (expected)", g(pyRound(p50, 1), 1), "days"),
      fig("P90 duration", g(pyRound(p90, 1), 1), "days"),
      fig("Critical path", names)];
    var start = inputs.start_date;
    if (start) {
      var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(start));
      var day0 = match ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])) : null;
      if (!day0 || day0.getUTCMonth() !== +match[2] - 1 || day0.getUTCDate() !== +match[3]) fail("Start date must be YYYY-MM-DD.");
      [["P50 finish", p50], ["P80 finish", p80], ["P90 finish", p90]].forEach(function (pair) {
        var d = new Date(day0.getTime() + Math.ceil(pair[1]) * 86400000);
        figures.push(fig(pair[0], d.toISOString().slice(0, 10)));
      });
    }
    all.forEach(function (a) {
      figures.push(fig(a.name, "day " + g(pyRound(a.es, 1), 1) + " to " + g(pyRound(a.ef, 1), 1) + " · " + (a.slack < 1e-6 ? "critical" : g(pyRound(a.slack, 1), 1) + " days float")));
    });
    var warnings = [];
    var near = all.filter(function (a) { return 1e-6 < a.slack && a.slack < Math.max(5.0, finish * 0.05); }).map(function (a) { return a.name; });
    if (near.length) warnings.push("Nearly critical (little float): " + near.slice(0, 6).join(", ") + ". A small slip there moves the finish.");
    return out("pert_schedule", "Expected " + g(pyRound(p50, 1), 1) + " days; plan on " + g(pyRound(p80, 1), 1) + " days for 80 % confidence. Critical path: " + names + ".", figures,
      "PERT mean = (optimistic + 4 × most likely + pessimistic) ÷ 6; standard deviation = (pessimistic − optimistic) ÷ 6. " +
      "Forward and backward passes give float; P80 and P90 add 0.84 and 1.28 standard deviations of the critical path.",
      ["Durations are calendar days from your three-point estimates.",
        "The normal approximation along one critical path understates risk when several paths are nearly critical; plan on P80 or P90 for commitments."],
      warnings);
  }

  function riskRegister(inputs) {
    var currency = text(inputs.currency || "USD", "Currency", 8).toUpperCase();
    var budget = opt(inputs, "budget", "Project budget", 0, 1e13, 2);
    var risks = rows(inputs, "risks", "The register", 100).map(function (row, i) {
      var name = text(row.risk, "the risk on line " + (i + 1), 160);
      var p = n(row.probability_percent, name + " probability %", 0, 100, 2, true) / 100;
      var impact = n(row.cost_impact || "0", name + " cost if it happens", 0, 1e13, 2, true);
      var delay = n(row.delay_days || "0", name + " delay if it happens (days)", 0, 10000, 1, true);
      var cost = opt(row, "mitigation_cost", name + " mitigation cost", 0, 1e13, 2) || 0;
      var after = opt(row, "probability_after_percent", name + " probability after mitigation %", 0, 100, 2);
      after = after == null ? p : after / 100;
      if (after > p) fail(name + ": mitigation should not make the risk more likely.");
      return { name: name, p: p, impact: impact, delay: delay, cost: cost, after: after, before: p * impact, residual: after * impact, days: p * delay };
    });
    risks.forEach(function (x) { x.worth = (!!x.cost && x.before - x.residual > x.cost) || (!x.cost && x.after < x.p); });
    var exposure = sum(risks.map(function (x) { return x.before; }));
    var residual = sum(risks.map(function (x) { return x.worth ? x.residual : x.before; }));
    var spend = sum(risks.filter(function (x) { return x.worth; }).map(function (x) { return x.cost; }));
    var days = sum(risks.map(function (x) { return x.days; }));
    var figures = [fig("Risk contingency after mitigation", money(residual), currency),
      fig("Expected cost of risk before mitigation", money(exposure), currency),
      fig("Mitigation spend that pays for itself", money(spend), currency),
      fig("Expected delay before mitigation", g(pyRound(days, 1), 1), "days")];
    if (budget) figures.push(fig("Contingency as a share of the budget", g(residual / budget * 100, 1) + " %"));
    var warnings = [];
    risks.slice().sort(function (a, b) { return b.before - a.before; }).forEach(function (x) {
      var saving = x.before - x.residual;
      var verdict = x.cost ? (saving > x.cost ? "mitigate: saves " + money(saving) + " for " + money(x.cost) : "mitigation costs more than it saves (" + money(saving) + " for " + money(x.cost) + "); consider accepting or transferring") : "no mitigation entered";
      var severity = "";
      if (budget) {
        var share = x.impact / budget;
        severity = " · " + (x.p >= 0.3 && share >= 0.05 ? "high" : x.p * share >= 0.005 ? "medium" : "low");
      }
      figures.push(fig("Risk · " + x.name, "expected " + money(x.before) + severity + " · " + verdict));
      if (budget && x.impact >= budget * 0.2) warnings.push(x.name + " could cost a fifth of the budget or more if it happens. Treat it as a board-level risk with a named owner, whatever its probability.");
    });
    return out("risk_register", "Hold " + money(residual) + " " + currency + " as risk contingency; the mitigations worth doing reduce the expected cost of risk from " + money(exposure) + " to " + money(residual) + ".", figures,
      "Expected value = probability × cost impact (and × delay for days). A mitigation pays when (probability before − after) × impact exceeds its cost. " +
      "Contingency = the expected values after the mitigations that pay, plus the full expected value of the rest.",
      ["Probabilities and impacts are your team's estimates; record who made them and when.",
        "Expected value suits a portfolio of risks. A single severe risk needs a decision of its own, not only a share of contingency."],
      warnings);
  }

  function npvOf(rate, flows) { return sum(flows.map(function (f, t) { return f / Math.pow(1 + rate, t); })); }
  function irrOf(flows) {
    if (!(flows[0] < 0 && flows.slice(1).some(function (f) { return f > 0; }))) return null;
    var low = -0.99, high = 10.0;
    if (npvOf(high, flows) > 0 || npvOf(low, flows) < 0) return null;
    for (var i = 0; i < 200; i++) {
      var mid = (low + high) / 2;
      if (npvOf(mid, flows) > 0) low = mid; else high = mid;
    }
    return (low + high) / 2;
  }
  function paybackOf(flows, rate) {
    var total = 0.0;
    for (var t = 0; t < flows.length; t++) {
      var value = rate != null ? flows[t] / Math.pow(1 + rate, t) : flows[t];
      if (t && total < 0 && 0 <= total + value) return t - 1 + (-total / value);
      total += value;
    }
    return null;
  }

  function investmentCase(inputs) {
    var currency = text(inputs.currency || "USD", "Currency", 8).toUpperCase();
    var capex = n(inputs.capex, "Investment", 0, 1e13, 2);
    var benefit = n(inputs.annual_benefit, "Yearly benefit", 0, 1e13, 2, true);
    var opex = opt(inputs, "annual_opex", "Yearly running cost", 0, 1e13, 2) || 0;
    var growth = (opt(inputs, "growth_percent", "Benefit growth % a year", -50, 100, 2) || 0) / 100;
    var years = Math.trunc(n(inputs.years || "10", "Years of benefit", 1, 50, 0));
    var rate = n(inputs.discount_percent || "10", "Discount rate %", 0, 100, 2, true) / 100;
    var residualValue = opt(inputs, "residual_value", "Value left at the end", 0, 1e13, 2) || 0;
    function flows(capexFactor, benefitFactor) {
      var list = [-capex * capexFactor];
      for (var year = 1; year <= years; year++) list.push(benefit * benefitFactor * Math.pow(1 + growth, year - 1) - opex + (year === years ? residualValue : 0));
      return list;
    }
    var base = flows(1.0, 1.0);
    var npv = npvOf(rate, base), irr = irrOf(base), payback = paybackOf(base), discounted = paybackOf(base, rate);
    var pvIn = npv + capex;
    var downside = npvOf(rate, flows(1.2, 0.8));
    var zeroBenefit = npvOf(rate, flows(1.0, 0.0));
    var figures = [fig("Net present value", money(npv), currency),
      fig("Internal rate of return", irr != null ? g(irr * 100, 2) + " %" : "not defined for these cash flows"),
      fig("Payback", payback != null ? g(pyRound(payback, 2), 2) + " years" : "not within " + years + " years"),
      fig("Discounted payback", discounted != null ? g(pyRound(discounted, 2), 2) + " years" : "not within " + years + " years"),
      fig("Profitability index", r(pvIn / capex, 2)),
      fig("NPV if the investment is 20 % higher and benefits 20 % lower", money(downside), currency)];
    if (benefit && npv !== zeroBenefit) figures.push(fig("Yearly benefit needed to break even", money(benefit * -zeroBenefit / (npv - zeroBenefit)), currency));
    var warnings = [];
    if (npv > 0 && 0 > downside) warnings.push("The case turns negative in the downside test. Approve only with firm cost control and a credible benefit plan.");
    if (npv < 0) warnings.push("The net present value is negative at your discount rate. Approve only for strategic, safety or compliance reasons, and state them.");
    return out("investment_case", "At " + g(rate * 100, 2) + " %, the project " + (npv > 0 ? "creates value" : "does not create value") + ": NPV " + money(npv) + " " + currency + (irr != null ? ", IRR " + g(irr * 100, 2) + " %" : "") + ".", figures,
      "Year 0 = −investment; each year = benefit × (1 + growth)^(year − 1) − running cost, plus the value left in the last year. " +
      "NPV = Σ cash flow ÷ (1 + rate)^year. IRR is the rate where NPV = 0. Profitability index = present value of later flows ÷ investment.",
      ["Cash flows are before tax and financing; use your own discount rate (for example your weighted average cost of capital).",
        "Benefits are your estimates. Ask who owns each one and how it will be measured."],
      warnings);
  }

  function earnedValue(inputs) {
    var currency = text(inputs.currency || "USD", "Currency", 8).toUpperCase();
    var bac = n(inputs.budget, "Budget at completion", 0, 1e13, 2);
    var planned = n(inputs.planned_percent, "Work planned by now %", 0, 100, 2, true) / 100;
    var earned = n(inputs.earned_percent, "Work actually done %", 0, 100, 2, true) / 100;
    var actual = n(inputs.actual_cost, "Actual cost so far", 0, 1e13, 2, true);
    var pv = bac * planned, ev = bac * earned;
    if (!ev || !actual || !pv) fail("Enter planned work, work done and actual cost above zero to measure performance.");
    var cpi = ev / actual, spi = ev / pv, eac = bac / cpi;
    var tcpi = bac > actual ? (bac - ev) / (bac - actual) : null;
    var figures = [fig("Forecast final cost", money(eac), currency),
      fig("Cost performance index (CPI)", r(cpi, 2)),
      fig("Schedule performance index (SPI)", r(spi, 2)),
      fig("Earned value", money(ev), currency),
      fig("Planned value", money(pv), currency),
      fig("Cost variance", money(ev - actual), currency),
      fig("Schedule variance", money(ev - pv), currency),
      fig("Estimate to complete", money(eac - actual), currency),
      fig("Overrun at completion", money(eac - bac), currency),
      fig("Efficiency needed on the remaining work (TCPI)", tcpi != null ? r(tcpi, 2) : "budget already spent")];
    var warnings = [];
    if (cpi < 0.9) warnings.push("CPI below 0.9: each unit of money buys less than 0.9 of planned work. Early overruns rarely recover by themselves; review scope, rates and claims now.");
    if (spi < 0.9) warnings.push("SPI below 0.9: the work is behind plan. Check the critical path, not only the total.");
    if (tcpi != null && tcpi > 1.1) warnings.push("The remaining work would need to run more than 10 % more efficiently than planned to hold the budget. Plan for the forecast, not the budget.");
    return out("earned_value", "Forecast final cost " + money(eac) + " " + currency + " against a budget of " + money(bac) + " (CPI " + r(cpi, 2) + ", SPI " + r(spi, 2) + ").", figures,
      "Planned value = budget × planned %; earned value = budget × work done %. CPI = earned ÷ actual cost; SPI = earned ÷ planned. " +
      "Forecast = budget ÷ CPI. TCPI = (budget − earned) ÷ (budget − actual).",
      ["Work done should be measured (quantities installed, milestones certified), not estimated from time spent.",
        "These are the standard earned value measures (ANSI/EIA-748)."],
      warnings);
  }

  var GATE_ITEMS = [
    ["business_case", "Business case approved, with NPV or a stated strategic reason", "tender", "The board should approve why before it approves how much."],
    ["scope_frozen", "Scope frozen and signed off by the owner", "tender", "Scope changes after tender are the largest source of variations and claims."],
    ["design_stage", "Design developed to the stage the contract needs", "tender", "Bidders price uncertainty as risk premium; incomplete design raises every bid."],
    ["specifications", "Specifications cite standards, tolerances and test methods", "tender", "Without them quality cannot be enforced or tested."],
    ["site_survey", "Site, ground and existing-plant surveys done", "tender", "Unforeseen ground or site conditions are a classic claim."],
    ["permits", "Permits and approvals identified", "tender", "A missing permit can stop the site after the contractor is mobilised."],
    ["cost_plan", "Cost plan at Class 3 or better, checked independently", "tender", "Bids can only be judged against a credible estimate."],
    ["risk_register", "Risk register with owners and a risk-based contingency", "tender", "Unowned risks become the owner's by default."],
    ["schedule", "Schedule with a critical path and P80 date", "tender", "Bidders need a realistic programme to price time-related costs."],
    ["contract_form", "Standard contract form chosen (FIDIC, NEC, JCT or a local standard), with payment on measured work", "tender", "Bespoke forms and payment by time invite disputes."],
    ["prequalification", "Bidders prequalified: experience, finances and references checked", "tender", "A low price from a contractor who cannot finish is the most expensive bid."],
    ["securities", "Retention (often 5–10 %) and a performance bond or guarantee (often 10 %) in the terms", "award", "Security is what makes defects and default recoverable."],
    ["damages", "Delay damages (liquidated damages) set from your real cost of delay", "award", "Without them a late finish costs you and not the contractor."],
    ["bid_check", "Lowest bid checked against the estimate, abnormally low prices explained", "award", "Unexplained low prices come back as claims."],
    ["funding", "Funding secured for the P80 cost, with a cash-flow profile", "award", "Running out of money mid-project costs more than the contingency."],
    ["insurance", "Insurances in place: contractor's all risks and third-party liability", "start", "Damage and injury claims during works can exceed the contract value."],
    ["qa_plan", "Quality plan with an inspection and test plan and hold points", "start", "Hold points stop work being covered up before it is checked."],
    ["hse_plan", "Health, safety and environment plan approved", "start", "Accidents stop sites, and directors can be personally liable."],
    ["supervision", "Independent supervision named: engineer, quantity surveyor or clerk of works", "start", "Someone who is not paid by the contractor must measure and certify the work."]
  ];
  var GATES = ["tender", "award", "start"];

  function stageGate(inputs) {
    var gate = choice(inputs, "gate", GATES, "Decision", "tender");
    var needed = GATE_ITEMS.filter(function (item) { return GATES.indexOf(item[2]) <= GATES.indexOf(gate); });
    var missing = needed.filter(function (item) { return !inputs[item[0]]; });
    var ready = !missing.length;
    var label = { tender: "go to tender", award: "award the contract", start: "start work on site" }[gate];
    var figures = [fig("Decision", (ready ? "Ready to " : "Not ready to ") + label),
      fig("Items in place", (needed.length - missing.length) + " of " + needed.length)];
    missing.forEach(function (item) { figures.push(fig("Missing · " + item[1], item[3])); });
    var later = GATE_ITEMS.filter(function (item) { return GATES.indexOf(item[2]) > GATES.indexOf(gate) && !inputs[item[0]]; });
    if (later.length) figures.push(fig("Prepare now for the next gates", later.slice(0, 6).map(function (item) { return item[1]; }).join("; ")));
    return out("stage_gate", ready ? "Ready to " + label + ": every item for this gate is in place." :
      "Not ready to " + label + ": " + missing.length + " item" + (missing.length === 1 ? "" : "s") + " missing.", figures,
      "Each gate needs its own items and those of the gates before it: tender, then award, then start on site.",
      ["The checklist follows common practice for capital projects and public procurement; your governance rules may add items.",
        "Ticking an item should mean the document exists and has been reviewed, not that it is planned."],
      ready ? [] : ["Approving with missing items moves their risk to the owner. Record who accepted it and why."]);
  }

  var CALCULATORS = {
    sourcing_compare: sourcingCompare, supplier_risk: supplierRisk, sourcing_strategy: sourcingStrategy,
    boq_estimate: boqEstimate, bid_compare: bidCompare, pert_schedule: pertSchedule, risk_register: riskRegister,
    investment_case: investmentCase, earned_value: earnedValue, stage_gate: stageGate
  };

  return {
    tools: Object.keys(CALCULATORS),
    evidence: EVIDENCE, redFlags: RED_FLAGS, controls: CONTROLS, gateItems: GATE_ITEMS, incoterms: INCOTERMS,
    calculate: function (tool, inputs) {
      if (!Object.prototype.hasOwnProperty.call(CALCULATORS, tool)) fail("Unknown tool.");
      if (!inputs || typeof inputs !== "object") fail("Inputs must be an object.");
      return CALCULATORS[tool](inputs);
    }
  };
});

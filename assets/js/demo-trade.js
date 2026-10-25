/* TradeMath for the live demo.
   Same formulas as threadforge/src/threadforge/trade_math.py. Rates and duties
   are figures the visitor types. Nothing here looks up a tariff or a market price. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TFTrade = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var S = 12n;
  var SCALE = 10n ** S;
  var DUTY = "imp" + "ort duty";
  var CLEARED = "cleared for imp" + "ort";
  var PI = parseDec("3.141592653589793");
  var INCH_MM = parseDec("25.4");
  var LB_KG = parseDec("0.45359237");
  var LENGTH = { mm: parseDec("0.001"), cm: parseDec("0.01"), m: parseDec("1"), in: div(INCH_MM, parseDec("1000")), ft: div(mul(INCH_MM, parseDec("12")), parseDec("1000")) };
  var MASS = { g: parseDec("0.001"), kg: parseDec("1"), lb: LB_KG, t: parseDec("1000") };
  var DIVISORS = {
    courier_5000: ["5000", "5,000 cm3 per kg, a divisor many express couriers publish. Confirm the one on your tariff."],
    air_6000: ["6000", "6,000 cm3 per kg, the divisor commonly used for air freight. Confirm it with the carrier."],
    measurement_1000: ["1000", "1,000 cm3 per kg, which is 1 m3 = 1,000 kg. Some sea tariffs use this measurement ton. Many charge by CBM instead. Confirm the tariff."]
  };
  var CONTAINERS = {
    "20ft": { usable_m3: "33.2", payload_kg: "28200", note: "Planning assumption for a 20-foot general-purpose container: 33.2 m3 internal and 28,200 kg payload. Real boxes differ by owner and age. This is not a booking." },
    "40ft": { usable_m3: "67.7", payload_kg: "26680", note: "Planning assumption for a 40-foot general-purpose container: 67.7 m3 internal and 26,680 kg payload. Confirm the box with the carrier." },
    "40hc": { usable_m3: "76.3", payload_kg: "26460", note: "Planning assumption for a 40-foot high-cube container: 76.3 m3 internal and 26,460 kg payload. Confirm the box with the carrier." }
  };
  var MATERIALS = {
    carbon_steel: ["Carbon steel (typical)", "7850", "Typical density for a carbon-steel estimate. A mill certificate overrides it."],
    stainless_304: ["Stainless 304 (typical)", "8000", "Typical density, not a statement that every 304 product weighs this."],
    stainless_316: ["Stainless 316 (typical)", "8000", "Typical density, not a mill test."],
    cast_iron: ["Cast iron (typical)", "7200", "Typical density for grey cast iron. Grades differ."],
    aluminum: ["Aluminium (typical)", "2700", "Typical density for wrought aluminium. Alloys differ."],
    copper: ["Copper (typical)", "8960", "Typical density for commercially pure copper."],
    brass: ["Brass (typical)", "8500", "Typical density. Brass alloys differ."],
    hdpe: ["HDPE (typical)", "950", "Typical density for an HDPE estimate, not a resin specification."],
    pp: ["Polypropylene (typical)", "900", "Typical density for a polypropylene estimate."],
    pet: ["PET (typical)", "1380", "Typical density for a PET estimate."]
  };
  var INCOTERMS = {
    EXW: { sea_only: false, seller_freight: false, seller_insurance: false, seller_risk_to_destination: false, seller_unloads: false, seller_duty: false, alongside: false, buyer_main_carriage: true, summary: "Seller makes the goods available at their premises. The buyer loads, carries, insures and clears them." },
    FCA: { sea_only: false, seller_freight: false, seller_insurance: false, seller_risk_to_destination: false, seller_unloads: false, seller_duty: false, alongside: false, buyer_main_carriage: true, summary: "Seller delivers to the carrier the buyer names, at an agreed place. The buyer pays the main carriage." },
    CPT: { sea_only: false, seller_freight: true, seller_insurance: false, seller_risk_to_destination: false, seller_unloads: false, seller_duty: false, alongside: false, buyer_main_carriage: false, summary: "Seller pays carriage to the named destination. Risk passes when the goods are handed to the first carrier, so the buyer arranges insurance if they want it." },
    CIP: { sea_only: false, seller_freight: true, seller_insurance: true, seller_risk_to_destination: false, seller_unloads: false, seller_duty: false, alongside: false, buyer_main_carriage: false, summary: "Like CPT, and the seller also provides cargo insurance for the buyer's risk." },
    DAP: { sea_only: false, seller_freight: true, seller_insurance: false, seller_risk_to_destination: true, seller_unloads: false, seller_duty: false, alongside: false, buyer_main_carriage: false, summary: "Seller delivers at the named place, ready for unloading, and carries the risk that far. The buyer pays " + DUTY + " and unloads." },
    DPU: { sea_only: false, seller_freight: true, seller_insurance: false, seller_risk_to_destination: true, seller_unloads: true, seller_duty: false, alongside: false, buyer_main_carriage: false, summary: "Seller delivers unloaded at the named place and carries the risk that far. The buyer pays " + DUTY + "." },
    DDP: { sea_only: false, seller_freight: true, seller_insurance: false, seller_risk_to_destination: true, seller_unloads: false, seller_duty: true, alongside: false, buyer_main_carriage: false, summary: "Seller delivers at the named place, " + CLEARED + ", and pays the " + DUTY + ". Unloading is the buyer's unless the contract says otherwise." },
    FAS: { sea_only: true, seller_freight: false, seller_insurance: false, seller_risk_to_destination: false, seller_unloads: false, seller_duty: false, alongside: true, buyer_main_carriage: true, summary: "Sea or inland waterway. Seller places the goods alongside the ship at the origin port. The buyer pays ocean freight and insurance." },
    FOB: { sea_only: true, seller_freight: false, seller_insurance: false, seller_risk_to_destination: false, seller_unloads: false, seller_duty: false, alongside: false, buyer_main_carriage: true, summary: "Sea or inland waterway. Seller loads the goods on board. Risk and the ocean freight pass to the buyer from that point." },
    CFR: { sea_only: true, seller_freight: true, seller_insurance: false, seller_risk_to_destination: false, seller_unloads: false, seller_duty: false, alongside: false, buyer_main_carriage: false, summary: "Sea or inland waterway. Seller pays freight to the destination port. Risk passes once the goods are on board at origin, so insurance is the buyer's choice." },
    CIF: { sea_only: true, seller_freight: true, seller_insurance: true, seller_risk_to_destination: false, seller_unloads: false, seller_duty: false, alongside: false, buyer_main_carriage: false, summary: "Like CFR, and the seller also provides the minimum cargo insurance." }
  };

  function parseDec(raw) {
    var s = String(raw).trim();
    if (!/^[+-]?\d+(\.\d+)?$/.test(s)) throw new Error("not a decimal");
    var neg = s[0] === "-";
    if (s[0] === "+" || s[0] === "-") s = s.slice(1);
    var bits = s.split(".");
    var whole = bits[0] || "0";
    var frac = bits[1] || "";
    if (frac.length > 12) frac = frac.slice(0, 12);
    while (frac.length < 12) frac += "0";
    var n = BigInt(whole) * SCALE + BigInt(frac);
    return neg ? -n : n;
  }
  function mul(a, b) {
    var n = a * b;
    var neg = n < 0n;
    if (neg) n = -n;
    var q = n / SCALE;
    var r = n % SCALE;
    if (r * 2n >= SCALE) q += 1n;
    return neg ? -q : q;
  }
  function div(a, b) {
    if (b === 0n) throw new Error("division by zero");
    var neg = (a < 0n) !== (b < 0n);
    if (a < 0n) a = -a;
    if (b < 0n) b = -b;
    var n = a * SCALE;
    var q = n / b;
    var r = n % b;
    if (r * 2n >= b) q += 1n;
    return neg ? -q : q;
  }
  function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function quant(n, places) {
    var drop = 12 - places;
    var divn = 10n ** BigInt(drop);
    var neg = n < 0n;
    if (neg) n = -n;
    var q = n / divn;
    var r = n % divn;
    if (r * 2n >= divn) q += 1n;
    var out = q * divn;
    return neg ? -out : out;
  }
  function text(n, places) {
    var q = quant(n, places);
    var neg = q < 0n;
    if (neg) q = -q;
    var s = q.toString().padStart(13, "0");
    var whole = s.slice(0, s.length - 12).replace(/^0+(?=\d)/, "");
    var frac = s.slice(s.length - 12, s.length - 12 + places);
    var out = places ? whole + "." + frac : whole;
    return neg ? "-" + out : out;
  }
  function fail(message) { var e = new Error(message); e.trade = true; throw e; }
  function num(value, label, places, min, max, allowZero) {
    if (typeof value === "boolean" || typeof value === "number" && !Number.isInteger(value)) fail(label + " must be a decimal string or an integer.");
    if (typeof value === "number") value = String(value);
    if (typeof value !== "string" || !value.trim() || value.trim().length > 40) fail(label + " must be a decimal string or an integer.");
    var raw = value.trim();
    var frac = (raw.split(".")[1] || "");
    if (frac.length > places && /[1-9]/.test(frac.slice(places))) fail(label + " has more than " + places + " decimal places.");
    var n;
    try { n = parseDec(raw); } catch (e) { fail(label + " is not a decimal number."); }
    if (min != null && cmp(n, parseDec(min)) < 0) fail(label + " is below the allowed minimum.");
    if (max != null && cmp(n, parseDec(max)) > 0) fail(label + " is above the allowed maximum.");
    if (!allowZero && min == null && cmp(n, 0n) <= 0) fail(label + " must be greater than zero.");
    return n;
  }
  function money(value, label, allowZero) {
    var n = num(value, label, 2, "0", "1000000000", true);
    if (allowZero === false && cmp(n, 0n) <= 0) fail(label + " must be greater than zero.");
    return quant(n, 2);
  }
  function positiveMoney(value, label) { return money(value, label, false); }
  function qty(value, label) { return num(value, label, 3, "0.001", "1000000", false); }
  function intQty(value, label) {
    var n = num(value, label, 0, "1", "100000", false);
    return n;
  }
  function words(value, label, maximum) {
    if (typeof value !== "string" || !value.trim() || value.length > maximum) fail("Supply " + label + " (1–" + maximum + " characters).");
    if (/[\u0000-\u001f]/.test(value)) fail(label + " contains a control character.");
    return value.trim();
  }
  function unit(value, table, label) {
    if (typeof value !== "string" || !Object.prototype.hasOwnProperty.call(table, value)) fail(label + " must be one of: " + Object.keys(table).join(", ") + ".");
    return value;
  }
  function lines(value, label) {
    if (!Array.isArray(value) || !value.length || value.length > 40) fail(label + " needs 1 to 40 rows.");
    return value;
  }
  function out(tool, summary, figures, formula, assumptions, warnings) {
    return { tool: tool, summary: summary, figures: figures, formula: formula, assumptions: assumptions, warnings: warnings || [] };
  }
  function fig(label, value, unitName) { return { label: label, value: String(value), unit: unitName || "" }; }

  function cbm(inputs) {
    var cartons = lines(inputs.cartons, "Cartons");
    var u = unit(inputs.unit || "cm", LENGTH, "Length unit");
    var factor = LENGTH[u];
    var total = 0n;
    var rows = [];
    cartons.forEach(function (row, i) {
      var index = i + 1;
      if (!row || typeof row !== "object") fail("Each carton must be an object.");
      var length = num(row.length, "Carton " + index + " length", 6, "0.000001", "100", false);
      var width = num(row.width, "Carton " + index + " width", 6, "0.000001", "100", false);
      var height = num(row.height, "Carton " + index + " height", 6, "0.000001", "100", false);
      var quantity = intQty(row.quantity, "Carton " + index + " quantity");
      var metres = [mul(length, factor), mul(width, factor), mul(height, factor)];
      if (cmp(metres[0], parseDec("30")) > 0 || cmp(metres[1], parseDec("30")) > 0 || cmp(metres[2], parseDec("30")) > 0) fail("Carton " + index + " is larger than 30 metres on one side.");
      var volume = mul(mul(mul(metres[0], metres[1]), metres[2]), quantity);
      total += volume;
      rows.push(fig("Carton " + index, text(volume, 6), "m3"));
    });
    return out("cbm", "Total cubic metres: " + text(total, 6), rows.concat([fig("Total CBM", text(total, 6), "m3")]),
      "For each carton, length × width × height × quantity, after converting the length unit to metres. The total is the sum.",
      ["The length unit applies to every carton.", "This is external carton volume, not the goods inside, and it ignores pallet voids unless you add them as cartons."]);
  }

  function volumetric(inputs) {
    var u = unit(inputs.unit || "cm", LENGTH, "Length unit");
    var length = num(inputs.length, "Length", 6, "0.000001", "100", false);
    var width = num(inputs.width, "Width", 6, "0.000001", "100", false);
    var height = num(inputs.height, "Height", 6, "0.000001", "100", false);
    var quantity = intQty(inputs.quantity || "1", "Quantity");
    var actual = num(inputs.actual_kg, "Actual weight", 3, "0", "1000000", true);
    var divisor;
    var note;
    if (typeof inputs.divisor === "string" && DIVISORS[inputs.divisor]) {
      divisor = parseDec(DIVISORS[inputs.divisor][0]);
      note = DIVISORS[inputs.divisor][1];
    } else {
      divisor = num(inputs.divisor, "Divisor", 3, "1", "1000000", false);
      note = "Divisor supplied for this calculation: cubic centimetres per kilogram.";
    }
    var toCm = mul(LENGTH[u], parseDec("100"));
    var volume = mul(mul(mul(mul(length, toCm), mul(width, toCm)), mul(height, toCm)), quantity);
    var volumetricKg = quant(div(volume, divisor), 3);
    var actualQ = quant(actual, 3);
    var chargeable = cmp(actualQ, volumetricKg) > 0 ? actualQ : volumetricKg;
    var warnings = [];
    if (cmp(volumetricKg, actualQ) > 0) warnings.push("Volumetric weight is higher, so it is the chargeable weight under this divisor.");
    return out("volumetric", "Chargeable weight: " + text(chargeable, 3) + " kg", [
      fig("Volume", text(volume, 6), "cm3"),
      fig("Volumetric weight", text(volumetricKg, 3), "kg"),
      fig("Actual weight", text(actualQ, 3), "kg"),
      fig("Chargeable weight", text(chargeable, 3), "kg")
    ], "Volumetric kg = volume in cm3 ÷ divisor. Chargeable weight is the greater of actual and volumetric weight.",
      [note, "A carrier may round each piece up before applying the divisor. This total is not rounded to a kilo."], warnings);
  }

  function margin(inputs) {
    var mode = inputs.mode;
    if (mode !== "from_prices" && mode !== "from_margin" && mode !== "from_markup") fail("Mode must be from_prices, from_margin or from_markup.");
    var cost = positiveMoney(inputs.cost, "Cost");
    var sell, profit, marginPct, markupPct;
    if (mode === "from_prices") {
      sell = positiveMoney(inputs.selling_price, "Selling price");
      if (cmp(sell, cost) <= 0) fail("Selling price must be above cost for a positive margin.");
      profit = quant(sell - cost, 2);
      marginPct = quant(div(mul(profit, parseDec("100")), sell), 2);
      markupPct = quant(div(mul(profit, parseDec("100")), cost), 2);
    } else if (mode === "from_margin") {
      marginPct = num(inputs.margin_percent, "Margin percent", 2, "0.01", "99.99", false);
      sell = quant(div(cost, parseDec("1") - div(marginPct, parseDec("100"))), 2);
      profit = quant(sell - cost, 2);
      markupPct = quant(div(mul(profit, parseDec("100")), cost), 2);
    } else {
      markupPct = num(inputs.markup_percent, "Markup percent", 2, "0.01", "100000", false);
      sell = quant(mul(cost, parseDec("1") + div(markupPct, parseDec("100"))), 2);
      profit = quant(sell - cost, 2);
      marginPct = quant(div(mul(profit, parseDec("100")), sell), 2);
    }
    return out("margin", "Profit " + text(profit, 2) + " on a selling price of " + text(sell, 2), [
      fig("Cost", text(cost, 2), ""), fig("Selling price", text(sell, 2), ""), fig("Profit", text(profit, 2), ""),
      fig("Margin", text(marginPct, 2), "% of selling price"), fig("Markup", text(markupPct, 2), "% of cost")
    ], "Margin = profit ÷ selling price. Markup = profit ÷ cost. A target margin produces selling price = cost ÷ (1 − margin).",
      ["Results are rounded to 0.01 of the currency. Margin and markup are not the same percentage."]);
  }

  function landed(inputs) {
    var goods = positiveMoney(inputs.goods, "Goods value");
    var freight = money(inputs.freight || "0", "Freight", true);
    var insurance = money(inputs.insurance || "0", "Insurance", true);
    var other = money(inputs.other || "0", "Other expenses", true);
    var rate = num(inputs.duty_percent || "0", "Duty percent", 3, "0", "1000", true);
    var baseName = inputs.duty_base || "goods";
    if (baseName !== "goods" && baseName !== "goods_freight_insurance") fail("Duty base must be goods or goods_freight_insurance.");
    if (cmp(rate, 0n) > 0) words(inputs.duty_source, "the duty source and date", 240);
    var quantity = qty(inputs.quantity || "1", "Quantity");
    var base = baseName === "goods" ? goods : goods + freight + insurance;
    var duty = quant(div(mul(base, rate), parseDec("100")), 2);
    var total = quant(goods + freight + insurance + other + duty, 2);
    var per = quant(div(total, quantity), 2);
    return out("landed", "Landed total " + text(total, 2) + ", " + text(per, 2) + " per unit", [
      fig("Goods", text(goods, 2), ""), fig("Freight", text(freight, 2), ""), fig("Insurance", text(insurance, 2), ""),
      fig("Duty base", text(quant(base, 2), 2), baseName), fig("Duty", text(duty, 2), ""), fig("Other expenses", text(other, 2), ""),
      fig("Landed total", text(total, 2), ""), fig("Per unit", text(per, 2), "")
    ], "Duty = duty base × duty percent ÷ 100. Landed total = goods + freight + insurance + duty + other expenses.",
      ["The duty percent is the one you entered. ThreadForge does not look up a tariff.", "This is an estimate for comparison, not a customs assessment or a tax invoice."]);
  }

  function container(inputs) {
    var spec = CONTAINERS[inputs.container];
    if (!spec) fail("Container must be one of: " + Object.keys(CONTAINERS).join(", ") + ".");
    var volume = num(inputs.cbm, "CBM", 6, "0", "10000", true);
    var weight = num(inputs.kg, "Weight", 3, "0", "1000000", true);
    var usable = parseDec(spec.usable_m3);
    var payload = parseDec(spec.payload_kg);
    var volumePct = quant(div(mul(volume, parseDec("100")), usable), 1);
    var weightPct = quant(div(mul(weight, parseDec("100")), payload), 1);
    var limit = cmp(volumePct, weightPct) >= 0 ? "volume" : "weight";
    var warnings = [];
    if (cmp(volume, usable) > 0 || cmp(weight, payload) > 0) warnings.push("The load is over this planning assumption. It does not say a carrier will refuse a particular box.");
    return out("container", "The tighter planning limit is " + limit + " (" + text(volumePct, 1) + "% of volume, " + text(weightPct, 1) + "% of payload).", [
      fig("Volume used", text(volumePct, 1), "% of " + spec.usable_m3 + " m3"),
      fig("Payload used", text(weightPct, 1), "% of " + spec.payload_kg + " kg"),
      fig("Tighter limit", limit, "")
    ], "Volume use = CBM ÷ assumed internal m3. Payload use = kg ÷ assumed payload kg.", [spec.note], warnings);
  }

  function shippingCompare(inputs) {
    var rows = lines(inputs.options, "Shipping options");
    var currency = words(inputs.currency, "currency", 8).toUpperCase();
    var parsed = rows.map(function (row, i) {
      var index = i + 1;
      if (!row || typeof row !== "object") fail("Each shipping option must be an object.");
      var name = words(row.name, "option " + index + " name", 80);
      var amount = money(row.amount, "option " + index + " amount", true);
      var days = String(row.days == null ? "" : row.days);
      var dayN = days === "" || days === "None" ? null : intQty(row.days, "option " + index + " days");
      if (row.currency && String(row.currency).toUpperCase() !== currency) fail("All shipping options must use " + currency + ". Convert other currencies first.");
      return { amount: amount, days: dayN == null ? null : dayN, name: name };
    });
    parsed.sort(function (a, b) {
      var c = cmp(a.amount, b.amount);
      if (c) return c;
      var ad = a.days == null ? 1000000000n : a.days;
      var bd = b.days == null ? 1000000000n : b.days;
      return cmp(ad, bd);
    });
    var figures = parsed.map(function (row) {
      return fig(row.name, text(row.amount, 2), currency + (row.days == null ? "" : " · " + text(row.days, 0) + " days"));
    });
    var winner = parsed[0];
    return out("shipping_compare", "Lowest entered amount: " + winner.name + " at " + text(winner.amount, 2) + " " + currency, figures,
      "Options are sorted by the amount you entered, then by transit days. No rate is fetched.",
      ["These are your figures, not a carrier quote.", "A lower freight amount can still cost more after duty, inventory time or a failed delivery."]);
  }

  function breakEven(inputs) {
    var fixed = money(inputs.fixed_costs, "Fixed costs", true);
    var price = positiveMoney(inputs.price, "Price per unit");
    var variable = money(inputs.variable_cost, "Variable cost per unit", true);
    var contribution = quant(price - variable, 2);
    if (cmp(contribution, 0n) <= 0) fail("Price must be above the variable cost per unit.");
    var units = quant(div(fixed, contribution), 3);
    return out("break_even", "Break-even quantity: " + text(units, 3) + " units", [
      fig("Contribution per unit", text(contribution, 2), ""),
      fig("Break-even quantity", text(units, 3), "units"),
      fig("Break-even revenue", text(quant(mul(units, price), 2), 2), "")
    ], "Break-even units = fixed costs ÷ (price − variable cost per unit).",
      ["Fixed costs are those you entered for the period. The result is not rounded up to a whole unit."]);
  }

  function convertMoney(inputs) {
    var amount = money(inputs.amount, "Amount", false);
    var rate = num(inputs.rate, "Rate", 6, "0.000001", "1000000", false);
    words(inputs.source, "the rate source and date", 240);
    var pair = words(inputs.pair, "the currency pair", 16);
    var converted = quant(mul(amount, rate), 2);
    return out("convert", text(amount, 2) + " × " + String(inputs.rate).trim() + " = " + text(converted, 2), [
      fig("Amount", text(amount, 2), ""), fig("Rate", String(inputs.rate).trim(), pair), fig("Converted", text(converted, 2), "")
    ], "Converted amount = amount × the rate you entered.",
      ["ThreadForge does not download exchange rates. The rate is only as good as the source you named."]);
  }

  function materialOf(key, density) {
    if (typeof key === "string" && MATERIALS[key]) return { name: MATERIALS[key][0], density: MATERIALS[key][1], note: MATERIALS[key][2] };
    if (key === "custom") {
      var value = num(density, "Density", 1, "1", "30000", false);
      return { name: "Custom density", density: text(value, 1), note: "Density entered for this calculation. It is not checked against a standard." };
    }
    fail("Material must be one of: " + Object.keys(MATERIALS).join(", ") + ", or custom with a density.");
  }

  function materialWeight(inputs) {
    var chosen = materialOf(inputs.material, inputs.density_kg_m3);
    var shape = inputs.shape;
    var u = unit(inputs.unit || "mm", LENGTH, "Length unit");
    var factor = LENGTH[u];
    var count = intQty(inputs.quantity || "1", "Quantity");
    function dim(name) {
      var metres = mul(num(inputs[name], name, 6, "0.000001", "100000", false), factor);
      if (cmp(metres, parseDec("30")) > 0) fail(name + " is larger than 30 metres.");
      return metres;
    }
    var volume, formula;
    if (shape === "round_bar") {
      var diameter = dim("diameter"), length = dim("length");
      volume = mul(mul(PI, mul(div(diameter, parseDec("2")), div(diameter, parseDec("2")))), length);
      formula = "Volume = π × (diameter ÷ 2)² × length.";
    } else if (shape === "square_bar") {
      var side = dim("side");
      volume = mul(mul(side, side), dim("length"));
      formula = "Volume = side² × length.";
    } else if (shape === "plate") {
      volume = mul(mul(dim("length"), dim("width")), dim("thickness"));
      formula = "Volume = length × width × thickness.";
    } else if (shape === "pipe") {
      var outside = dim("outside"), inside = dim("inside"), pipeLength = dim("length");
      if (cmp(inside, outside) >= 0) fail("Inside diameter must be smaller than outside diameter.");
      volume = mul(mul(div(PI, parseDec("4")), mul(outside, outside) - mul(inside, inside)), pipeLength);
      formula = "Volume = π ÷ 4 × (outside² − inside²) × length.";
    } else fail("Shape must be round_bar, square_bar, plate or pipe.");
    var kg = quant(mul(mul(volume, parseDec(chosen.density)), count), 3);
    return out("material_weight", "Estimated weight: " + text(kg, 3) + " kg", [
      fig("Material", chosen.name, ""), fig("Density", chosen.density, "kg/m3"), fig("Weight", text(kg, 3), "kg")
    ], formula + " Weight = volume × density × quantity.",
      [chosen.note, "π is 3.141592653589793. This is an estimate, not a mill certificate or a weighbridge ticket."]);
  }

  function units(inputs) {
    var kind = inputs.kind;
    var amount = num(inputs.amount, "Amount", 6, "0", "1000000000", true);
    var table, title;
    if (kind === "length") { table = LENGTH; title = "metres"; }
    else if (kind === "mass") { table = MASS; title = "kilograms"; }
    else fail("Kind must be length or mass.");
    var source = unit(inputs.from, table, "From unit");
    var target = unit(inputs.to, table, "To unit");
    var converted = quant(div(mul(amount, table[source]), table[target]), 6);
    var shown = String(inputs.amount).trim().replace(/^\+/, "");
    return out("units", shown + " " + source + " = " + text(converted, 6) + " " + target, [fig("Converted", text(converted, 6), target)],
      "Convert through " + title + " using exact factors, including 1 inch = 25.4 mm and 1 pound = 0.45359237 kg.",
      ["The result is rounded to 6 decimal places for display."]);
  }

  function gsm(inputs) {
    var mode = inputs.mode;
    var width = num(inputs.width_cm, "Width", 2, "0.1", "1000", false);
    var length = num(inputs.length_m, "Length", 3, "0.001", "100000", false);
    var area = mul(div(width, parseDec("100")), length);
    var value, grams, summary, formula;
    if (mode === "from_sample") {
      grams = num(inputs.grams, "Sample weight", 3, "0.001", "100000", false);
      value = quant(div(grams, area), 1);
      summary = "GSM: " + text(value, 1);
      formula = "GSM = grams ÷ (width in metres × length in metres).";
    } else if (mode === "from_gsm") {
      value = num(inputs.gsm, "GSM", 1, "1", "5000", false);
      grams = quant(mul(value, area), 3);
      summary = "Piece weight: " + text(grams, 3) + " g";
      formula = "Grams = GSM × width in metres × length in metres.";
    } else fail("Mode must be from_sample or from_gsm.");
    return out("gsm", summary, [
      fig("Area", text(area, 6), "m2"),
      fig("Result", mode === "from_gsm" ? text(grams, 3) : text(value, 1), mode === "from_gsm" ? "g" : "g/m2")
    ], formula, ["This is the arithmetic of grams per square metre. It is not an ISO 3801 conditioned laboratory test."]);
  }

  function supplierCompare(inputs) {
    var rows = lines(inputs.suppliers, "Suppliers");
    var currency = words(inputs.currency, "currency", 8).toUpperCase();
    var ranked = rows.map(function (row, i) {
      if (!row || typeof row !== "object") fail("Each supplier must be an object.");
      if (row.currency && String(row.currency).toUpperCase() !== currency) fail("Compare suppliers in one currency. Convert other currencies first.");
      var result = landed(Object.assign({}, row, { quantity: row.quantity || "1" }));
      var figures = {};
      result.figures.forEach(function (item) { figures[item.label] = item.value; });
      return { per: parseDec(figures["Per unit"]), days: intQty(row.lead_days || "1", "Lead days"), name: words(row.name, "supplier " + (i + 1) + " name", 120), total: figures["Landed total"] };
    });
    ranked.sort(function (a, b) { var c = cmp(a.per, b.per); return c || cmp(a.days, b.days); });
    return out("supplier_compare", "Lowest landed unit cost from the figures entered: " + ranked[0].name, ranked.map(function (row) {
      return fig(row.name, text(row.per, 2) + " per unit · landed " + row.total + " · " + text(row.days, 0) + " days", currency);
    }), "Each row uses the landed-cost formula. Rows sort by landed cost per unit, then by the lead time you entered.",
      ["No market price is added. A lower unit cost is not a recommendation to buy.", "Duty percents are the ones on each row, each with its own source when duty is not zero."]);
  }

  function examine(inputs) {
    var supplier = words(inputs.supplier, "supplier", 160);
    var currency = words(inputs.currency, "currency", 8).toUpperCase();
    var incoterm = words(inputs.incoterm, "incoterm", 8).toUpperCase();
    var rule = INCOTERMS[incoterm];
    if (!rule) fail("Incoterm must be one of: " + Object.keys(INCOTERMS).join(", ") + ".");
    var invoice = lines(inputs.lines, "Invoice lines");
    var freight = money(inputs.freight || "0", "Freight", true);
    var insurance = money(inputs.insurance || "0", "Insurance", true);
    var duty = money(inputs.duty || "0", "Duty", true);
    var stated = money(inputs.stated_total, "Stated total", true);
    var net = 0n;
    var qtySum = 0n;
    invoice.forEach(function (row, i) {
      var index = i + 1;
      if (!row || typeof row !== "object") fail("Each invoice line must be an object.");
      words(row.description, "line " + index + " description", 180);
      var quantity = qty(row.quantity, "line " + index + " quantity");
      var price = positiveMoney(row.unit_price, "line " + index + " unit price");
      net += quant(mul(quantity, price), 2);
      qtySum += quantity;
    });
    var expected = quant(net + freight + insurance + duty, 2);
    var warnings = [];
    var poor = cmp(expected, stated) !== 0;
    if (poor) warnings.push("Stated total " + text(stated, 2) + " does not equal lines " + text(net, 2) + " plus freight, insurance and duty (" + text(expected, 2) + ").");
    if (rule.buyer_main_carriage && cmp(freight, 0n) > 0) warnings.push("Under the " + incoterm + " summary, the buyer usually arranges main carriage. Freight inside this total needs a written reason.");
    if (rule.seller_insurance && cmp(insurance, 0n) === 0) warnings.push("Under the " + incoterm + " summary, the seller provides insurance. This invoice shows none.");
    if (inputs.benchmark_unit != null && inputs.benchmark_unit !== "") {
      var benchmark = positiveMoney(inputs.benchmark_unit, "Benchmark unit price");
      var tolerance = num(inputs.tolerance_percent || "0", "Tolerance percent", 2, "0", "100", true);
      var average = quant(div(net, qtySum), 2);
      var gap = div(mul(average > benchmark ? average - benchmark : benchmark - average, parseDec("100")), benchmark);
      if (cmp(gap, tolerance) > 0) warnings.push("Average unit price " + text(average, 2) + " differs from the benchmark you entered (" + text(benchmark, 2) + ") by more than the " + text(tolerance, 2) + "% tolerance. That benchmark is not a market survey.");
    }
    var label = poor ? "Poor" : warnings.length ? "Fair" : "Good";
    return out("examine", label + ": arithmetic " + (poor ? "does not match" : "matches") + " for " + supplier + " in " + currency + ".", [
      fig("Verdict", label, ""), fig("Lines", text(net, 2), currency), fig("Expected total", text(expected, 2), currency), fig("Stated total", text(stated, 2), currency)
    ], "Expected total = sum of quantity × unit price, plus freight, insurance and duty, each rounded to 0.01.",
      ["Good means the arithmetic matches and none of the checks below fired. It is not a judgment that the price is a market price.", rule.summary], warnings);
  }

  function advise(inputs) {
    var sea = inputs.sea_only === true;
    var alongside = inputs.place_alongside_ship === true;
    var wanted = {
      seller_freight: inputs.seller_pays_main_carriage === true,
      seller_insurance: inputs.seller_must_insure === true,
      seller_risk_to_destination: inputs.seller_risk_until_destination === true,
      seller_unloads: inputs.seller_unloads === true,
      seller_duty: inputs["seller_pays_" + "imp" + "ort_duty"] === true,
      alongside: alongside
    };
    var matches = [];
    Object.keys(INCOTERMS).forEach(function (code) {
      var rule = INCOTERMS[code];
      if (rule.sea_only && !sea) return;
      var ok = Object.keys(wanted).every(function (key) { return rule[key] === wanted[key]; });
      if (ok) matches.push(code);
    });
    if (!matches.length) fail("No Incoterms 2020 rule in this summary matches that combination. Change one answer, or pick the rule from the reference list.");
    return out("advise", "Rules consistent with those answers: " + matches.join(", ") + ".", matches.map(function (code) {
      return fig(code, INCOTERMS[code].summary, "");
    }), "A rule is kept only when every answer matches: who pays main carriage, who must insure, who keeps risk until destination, who unloads, who pays " + DUTY + ", and whether the goods are placed alongside a ship.",
      ["This is a planning summary of ICC Incoterms 2020, not the official text and not a statement of the cheapest rule.", "More than one rule can fit. The contract has to name one, plus the named place."]);
  }

  var CALCULATORS = {
    cbm: cbm, volumetric: volumetric, margin: margin, landed: landed, container: container,
    shipping_compare: shippingCompare, break_even: breakEven, convert: convertMoney,
    material_weight: materialWeight, units: units, gsm: gsm, supplier_compare: supplierCompare,
    examine: examine, advise: advise
  };

  function calculate(tool, inputs) {
    if (!CALCULATORS[tool]) fail("That trade tool is not on the TradeMath list.");
    if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) fail("Send the tool inputs as an object.");
    return CALCULATORS[tool](inputs);
  }

  var TOOLS = [
    ["cbm", "CBM"], ["volumetric", "Volumetric weight"], ["margin", "Profit margin"], ["landed", "Landed cost"],
    ["container", "Container space"], ["shipping_compare", "Shipping comparison"], ["break_even", "Break-even"],
    ["convert", "Currency conversion"], ["material_weight", "Material weight"], ["units", "Unit conversion"],
    ["gsm", "Fabric GSM"], ["supplier_compare", "Supplier comparison"], ["examine", "Proforma examiner"], ["advise", "Incoterm advisor"]
  ];

  return { calculate: calculate, TOOLS: TOOLS, INCOTERMS: INCOTERMS, CONTAINERS: CONTAINERS, MATERIALS: MATERIALS, LENGTH: LENGTH, MASS: MASS, DIVISORS: DIVISORS };
});

/* Public TradeMath desk. Formulas come from demo-trade.js (TFTrade).
   Nothing typed here is sent anywhere. */
(function () {
  "use strict";

  var LENGTHS = ["mm", "cm", "m", "in", "ft"];
  var MASSES = ["g", "kg", "lb", "t"];
  var MATERIALS = ["carbon_steel", "stainless_304", "stainless_316", "cast_iron", "aluminum", "copper", "brass", "hdpe", "pp", "pet", "custom"];
  var INCOTERMS = ["EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP", "FAS", "FOB", "CFR", "CIF"];

  var TOOLS = [
    ["cbm", "CBM"],
    ["volumetric", "Volumetric weight"],
    ["margin", "Profit margin"],
    ["landed", "Landed cost"],
    ["container", "Container space"],
    ["shipping_compare", "Shipping comparison"],
    ["break_even", "Break-even"],
    ["supplier_compare", "Supplier comparison"],
    ["convert", "Currency conversion"],
    ["material_weight", "Material weight"],
    ["units", "Unit conversion"],
    ["gsm", "Fabric GSM"],
    ["examine", "Proforma examiner"],
    ["advise", "Incoterm advisor"]
  ].map(function (item) { return item.concat("Shipment and trade"); });

  function el(tag, attrs) {
    var node = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    Object.keys(attrs || {}).forEach(function (key) {
      if (attrs[key] == null || attrs[key] === false) return;
      if (key === "class") node.className = attrs[key];
      else if (key === "text") node.textContent = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    kids.forEach(function (kid) {
      if (kid == null) return;
      node.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    });
    return node;
  }

  function field(id, label, control) {
    return el("div", { class: "field" }, el("label", { for: id, text: label }), control);
  }

  function text(id, value, mode) {
    return el("input", { id: id, type: "text", value: value || "", inputmode: mode || "decimal", autocomplete: "off" });
  }

  function select(id, options, value) {
    var node = el("select", { id: id });
    options.forEach(function (opt) {
      var pair = typeof opt === "string" ? [opt, opt] : opt;
      var item = el("option", { value: pair[0], text: pair[1] });
      if (pair[0] === value) item.selected = true;
      node.appendChild(item);
    });
    return node;
  }

  function val(id) {
    var node = document.getElementById(id);
    return node ? node.value.trim() : "";
  }

  function checked(id) {
    var node = document.getElementById(id);
    return !!(node && node.checked);
  }

  function lineBox(className) {
    return el("div", { class: className || "tm-line" });
  }

  function addRow(host, className, builder) {
    host.appendChild(builder(host.children.length));
  }

  var builders = {
    cbm: function (panel) {
      panel.appendChild(field("tm-unit", "Length unit", select("tm-unit", LENGTHS, "cm")));
      var host = el("div", { class: "tm-lines", id: "tm-rows" });
      function row(i) {
        var box = lineBox();
        [["length", "Length"], ["width", "Width"], ["height", "Height"], ["quantity", "Cartons"]].forEach(function (pair) {
          var samples = { length: "40", width: "30", height: "25", quantity: "120" };
          var second = { length: "55", width: "40", height: "35", quantity: "48" };
          var start = i === 0 ? samples[pair[0]] : i === 1 ? second[pair[0]] : "";
          box.appendChild(field("tm-" + pair[0] + "-" + i, pair[1], text("tm-" + pair[0] + "-" + i, start, pair[0] === "quantity" ? "numeric" : "decimal")));
        });
        return box;
      }
      addRow(host, "", row);
      addRow(host, "", row);
      panel.appendChild(host);
      panel.appendChild(el("button", { type: "button", class: "btn btn-ghost", id: "tm-add", text: "Add a carton" }));
    },
    volumetric: function (panel) {
      var grid = el("div", { class: "form-grid" });
      grid.appendChild(field("tm-unit", "Length unit", select("tm-unit", LENGTHS, "cm")));
      grid.appendChild(field("tm-length", "Length", text("tm-length", "60")));
      grid.appendChild(field("tm-width", "Width", text("tm-width", "40")));
      grid.appendChild(field("tm-height", "Height", text("tm-height", "40")));
      grid.appendChild(field("tm-quantity", "Pieces", text("tm-quantity", "10", "numeric")));
      grid.appendChild(field("tm-actual", "Actual weight (kg)", text("tm-actual", "85")));
      grid.appendChild(field("tm-divisor", "Divisor", select("tm-divisor", [
        ["courier_5000", "5,000 — express courier"],
        ["air_6000", "6,000 — air freight"],
        ["measurement_1000", "1,000 — measurement ton"]
      ], "air_6000")));
      panel.appendChild(grid);
    },
    margin: function (panel) {
      var grid = el("div", { class: "form-grid" });
      grid.appendChild(field("tm-mode", "Work out", select("tm-mode", [
        ["from_prices", "From cost and selling price"],
        ["from_margin", "Selling price from a target margin"],
        ["from_markup", "Selling price from a markup"]
      ], "from_prices")));
      grid.appendChild(field("tm-cost", "Cost", text("tm-cost", "12.40")));
      grid.appendChild(field("tm-sell", "Selling price", text("tm-sell", "19.00")));
      grid.appendChild(field("tm-margin", "Margin %", text("tm-margin", "")));
      grid.appendChild(field("tm-markup", "Markup %", text("tm-markup", "")));
      panel.appendChild(grid);
    },
    landed: function (panel) {
      var grid = el("div", { class: "form-grid" });
      [["tm-goods", "Goods value", "10000"], ["tm-freight", "Freight", "800"], ["tm-insurance", "Insurance", "40"],
        ["tm-other", "Other expenses", "0"], ["tm-duty", "Duty %", "0"], ["tm-qty", "Quantity", "500"]].forEach(function (row) {
        grid.appendChild(field(row[0], row[1], text(row[0], row[2])));
      });
      grid.appendChild(field("tm-base", "Duty is charged on", select("tm-base", [
        ["goods", "Goods only"],
        ["goods_freight_insurance", "Goods + freight + insurance"]
      ], "goods")));
      grid.appendChild(field("tm-source", "Duty source and date", text("tm-source", "", "text")));
      panel.appendChild(grid);
    },
    container: function (panel) {
      var grid = el("div", { class: "form-grid" });
      grid.appendChild(field("tm-box", "Container", select("tm-box", [
        ["20ft", "20-foot general purpose"],
        ["40ft", "40-foot general purpose"],
        ["40hc", "40-foot high cube"]
      ], "20ft")));
      grid.appendChild(field("tm-cbm", "Load CBM", text("tm-cbm", "18")));
      grid.appendChild(field("tm-kg", "Load weight (kg)", text("tm-kg", "9000")));
      panel.appendChild(grid);
    },
    shipping_compare: function (panel) {
      panel.appendChild(field("tm-currency", "Currency", text("tm-currency", "USD", "text")));
      var host = el("div", { class: "tm-lines", id: "tm-rows" });
      [["Sea", "2400", "28"], ["Air", "6100", "6"], ["Courier", "740", "5"]].forEach(function (sample, i) {
        var box = lineBox("tm-line tm-line-ship");
        box.appendChild(field("tm-name-" + i, "Option", text("tm-name-" + i, sample[0], "text")));
        box.appendChild(field("tm-amount-" + i, "Amount", text("tm-amount-" + i, sample[1])));
        box.appendChild(field("tm-days-" + i, "Days", text("tm-days-" + i, sample[2], "numeric")));
        host.appendChild(box);
      });
      panel.appendChild(host);
    },
    break_even: function (panel) {
      var grid = el("div", { class: "form-grid" });
      grid.appendChild(field("tm-fixed", "Fixed costs", text("tm-fixed", "12000")));
      grid.appendChild(field("tm-price", "Price per unit", text("tm-price", "45")));
      grid.appendChild(field("tm-variable", "Variable cost per unit", text("tm-variable", "27")));
      panel.appendChild(grid);
    },
    supplier_compare: function (panel) {
      panel.appendChild(field("tm-currency", "Currency", text("tm-currency", "USD", "text")));
      var host = el("div", { class: "tm-lines", id: "tm-rows" });
      [
        ["Harbour Cloth", "8400", "1100", "50", "0", "0", "1000", "21"],
        ["North Mill", "7900", "1800", "50", "200", "5", "1000", "35"]
      ].forEach(function (sample, i) {
        var box = el("div", { class: "form-grid" });
        [["name", "Supplier", sample[0], "text"], ["goods", "Goods value", sample[1]], ["freight", "Freight", sample[2]],
          ["insurance", "Insurance", sample[3]], ["other", "Other", sample[4]], ["duty", "Duty %", sample[5]],
          ["qty", "Quantity", sample[6]], ["days", "Lead days", sample[7]]].forEach(function (col) {
          box.appendChild(field("tm-" + col[0] + "-" + i, col[1], text("tm-" + col[0] + "-" + i, col[2], col[3] || "decimal")));
        });
        box.appendChild(field("tm-source-" + i, "Duty source, if duty is not zero", text("tm-source-" + i, i === 1 ? "Published tariff, checked 2026-10-01" : "", "text")));
        host.appendChild(box);
      });
      panel.appendChild(host);
    },
    convert: function (panel) {
      var grid = el("div", { class: "form-grid" });
      grid.appendChild(field("tm-amount", "Amount", text("tm-amount", "1000")));
      grid.appendChild(field("tm-rate", "Rate", text("tm-rate", "0.79")));
      grid.appendChild(field("tm-pair", "Currency pair", text("tm-pair", "USD/GBP", "text")));
      grid.appendChild(field("tm-source", "Rate source and date", text("tm-source", "Bank mid-rate, 2026-10-22", "text")));
      panel.appendChild(grid);
    },
    material_weight: function (panel) {
      var grid = el("div", { class: "form-grid" });
      grid.appendChild(field("tm-material", "Material", select("tm-material", MATERIALS.map(function (name) {
        return [name, name.replace(/_/g, " ")];
      }), "carbon_steel")));
      grid.appendChild(field("tm-density", "Density kg/m³ (custom only)", text("tm-density", "")));
      grid.appendChild(field("tm-shape", "Shape", select("tm-shape", [
        ["round_bar", "Round bar"], ["square_bar", "Square bar"], ["plate", "Plate"], ["pipe", "Pipe"]
      ], "round_bar")));
      grid.appendChild(field("tm-unit", "Length unit", select("tm-unit", LENGTHS, "mm")));
      grid.appendChild(field("tm-quantity", "Pieces", text("tm-quantity", "1", "numeric")));
      ["diameter", "side", "length", "width", "thickness", "outside", "inside"].forEach(function (name) {
        var start = name === "diameter" || name === "side" ? "20" : name === "length" ? "1000" : name === "thickness" ? "6" : name === "outside" ? "40" : name === "inside" ? "30" : "";
        grid.appendChild(field("tm-" + name, name.charAt(0).toUpperCase() + name.slice(1), text("tm-" + name, start)));
      });
      panel.appendChild(grid);
    },
    units: function (panel) {
      var grid = el("div", { class: "form-grid" });
      grid.appendChild(field("tm-kind", "Kind", select("tm-kind", [["length", "Length"], ["mass", "Mass"]], "length")));
      grid.appendChild(field("tm-amount", "Amount", text("tm-amount", "1")));
      grid.appendChild(field("tm-from", "From", select("tm-from", LENGTHS, "in")));
      grid.appendChild(field("tm-to", "To", select("tm-to", LENGTHS, "mm")));
      panel.appendChild(grid);
    },
    gsm: function (panel) {
      var grid = el("div", { class: "form-grid" });
      grid.appendChild(field("tm-mode", "Work out", select("tm-mode", [
        ["from_sample", "GSM from a weighed piece"],
        ["from_gsm", "Piece weight from GSM"]
      ], "from_sample")));
      grid.appendChild(field("tm-width", "Width (cm)", text("tm-width", "150")));
      grid.appendChild(field("tm-length", "Length (m)", text("tm-length", "1")));
      grid.appendChild(field("tm-grams", "Sample weight (g)", text("tm-grams", "240")));
      grid.appendChild(field("tm-gsm", "GSM", text("tm-gsm", "160")));
      panel.appendChild(grid);
    },
    examine: function (panel) {
      var grid = el("div", { class: "form-grid" });
      grid.appendChild(field("tm-supplier", "Supplier", text("tm-supplier", "Harbour Cloth Co.", "text")));
      grid.appendChild(field("tm-currency", "Currency", text("tm-currency", "USD", "text")));
      grid.appendChild(field("tm-incoterm", "Incoterm", select("tm-incoterm", INCOTERMS, "FOB")));
      grid.appendChild(field("tm-freight", "Freight on the invoice", text("tm-freight", "0")));
      grid.appendChild(field("tm-insurance", "Insurance on the invoice", text("tm-insurance", "0")));
      grid.appendChild(field("tm-duty", "Duty on the invoice", text("tm-duty", "0")));
      grid.appendChild(field("tm-stated", "Stated total", text("tm-stated", "4200")));
      panel.appendChild(grid);
      var host = el("div", { class: "tm-lines", id: "tm-rows" });
      var box = lineBox("tm-line tm-line-3");
      box.appendChild(field("tm-desc-0", "Description", text("tm-desc-0", "Cotton poplin, 150 cm", "text")));
      box.appendChild(field("tm-qty-0", "Quantity", text("tm-qty-0", "1000")));
      box.appendChild(field("tm-price-0", "Unit price", text("tm-price-0", "4.20")));
      host.appendChild(box);
      panel.appendChild(host);
    },
    advise: function (panel) {
      var box = el("div", { class: "tm-checks" });
      [
        ["tm-sea", "The move is sea or inland waterway only"],
        ["tm-along", "Goods are placed alongside the ship"],
        ["tm-freight", "Seller pays the main carriage"],
        ["tm-insure", "Seller must insure the goods"],
        ["tm-risk", "Seller keeps the risk until the destination"],
        ["tm-unload", "Seller unloads at the destination"],
        ["tm-duty", "Seller pays import duty"]
      ].forEach(function (item) {
        box.appendChild(el("label", { class: "check" },
          el("input", { type: "checkbox", id: item[0] }),
          el("span", { text: item[1] })));
      });
      panel.appendChild(box);
    }
  };

  var NOTES = {
    cbm: "External carton volume. Pallet voids count only if you add them as cartons.",
    volumetric: "Chargeable weight is the greater of the scale weight and volume divided by the divisor you pick. Confirm the divisor with the carrier.",
    margin: "Margin is profit divided by the selling price. Markup is profit divided by cost.",
    landed: "Duty uses the percent you type. This page does not look up a tariff.",
    container: "The capacities are planning assumptions printed with the result, not a booking.",
    shipping_compare: "Sorted by the amounts you enter. No rate is fetched.",
    break_even: "Fixed costs are for the period you have in mind. The quantity is not rounded up.",
    supplier_compare: "Lowest landed unit cost from these rows is not a recommendation to buy.",
    convert: "The rate is only as good as the source you name. No exchange rate is downloaded.",
    material_weight: "Typical densities, not a mill certificate.",
    units: "Length goes through metres. Mass goes through kilograms.",
    gsm: "Grams per square metre arithmetic, not a conditioned laboratory test.",
    examine: "Good means the arithmetic matches. It is not a market-price judgment.",
    advise: "A planning summary of Incoterms 2020, not the official text and not the cheapest rule."
  };

  function read(tool) {
    if (tool === "cbm") {
      var cartons = [];
      document.querySelectorAll("#tm-rows .tm-line").forEach(function (row, i) {
        cartons.push({
          length: val("tm-length-" + i),
          width: val("tm-width-" + i),
          height: val("tm-height-" + i),
          quantity: val("tm-quantity-" + i)
        });
      });
      return { unit: val("tm-unit"), cartons: cartons.filter(function (row) { return row.length && row.width && row.height && row.quantity; }) };
    }
    if (tool === "volumetric") {
      return { unit: val("tm-unit"), length: val("tm-length"), width: val("tm-width"), height: val("tm-height"), quantity: val("tm-quantity"), actual_kg: val("tm-actual"), divisor: val("tm-divisor") };
    }
    if (tool === "margin") {
      return { mode: val("tm-mode"), cost: val("tm-cost"), selling_price: val("tm-sell"), margin_percent: val("tm-margin"), markup_percent: val("tm-markup") };
    }
    if (tool === "landed") {
      return { goods: val("tm-goods"), freight: val("tm-freight"), insurance: val("tm-insurance"), other: val("tm-other"), duty_percent: val("tm-duty"), duty_base: val("tm-base"), duty_source: val("tm-source"), quantity: val("tm-qty") };
    }
    if (tool === "container") return { container: val("tm-box"), cbm: val("tm-cbm"), kg: val("tm-kg") };
    if (tool === "shipping_compare") {
      var options = [];
      document.querySelectorAll("#tm-rows .tm-line").forEach(function (row, i) {
        options.push({ name: val("tm-name-" + i), amount: val("tm-amount-" + i), days: val("tm-days-" + i), currency: val("tm-currency") });
      });
      return { currency: val("tm-currency"), options: options };
    }
    if (tool === "break_even") return { fixed_costs: val("tm-fixed"), price: val("tm-price"), variable_cost: val("tm-variable") };
    if (tool === "supplier_compare") {
      var suppliers = [];
      document.querySelectorAll("#tm-rows .form-grid").forEach(function (row, i) {
        suppliers.push({
          name: val("tm-name-" + i), goods: val("tm-goods-" + i), freight: val("tm-freight-" + i),
          insurance: val("tm-insurance-" + i), other: val("tm-other-" + i), duty_percent: val("tm-duty-" + i),
          duty_source: val("tm-source-" + i), quantity: val("tm-qty-" + i), lead_days: val("tm-days-" + i),
          currency: val("tm-currency")
        });
      });
      return { currency: val("tm-currency"), suppliers: suppliers };
    }
    if (tool === "convert") return { amount: val("tm-amount"), rate: val("tm-rate"), pair: val("tm-pair"), source: val("tm-source") };
    if (tool === "material_weight") {
      return {
        material: val("tm-material"), density_kg_m3: val("tm-density"), shape: val("tm-shape"),
        unit: val("tm-unit"), quantity: val("tm-quantity"), diameter: val("tm-diameter"), side: val("tm-side"),
        length: val("tm-length"), width: val("tm-width"), thickness: val("tm-thickness"),
        outside: val("tm-outside"), inside: val("tm-inside")
      };
    }
    if (tool === "units") return { kind: val("tm-kind"), amount: val("tm-amount"), from: val("tm-from"), to: val("tm-to") };
    if (tool === "gsm") return { mode: val("tm-mode"), width_cm: val("tm-width"), length_m: val("tm-length"), grams: val("tm-grams"), gsm: val("tm-gsm") };
    if (tool === "examine") {
      var lines = [];
      document.querySelectorAll("#tm-rows .tm-line").forEach(function (row, i) {
        lines.push({ description: val("tm-desc-" + i), quantity: val("tm-qty-" + i), unit_price: val("tm-price-" + i) });
      });
      return {
        supplier: val("tm-supplier"), currency: val("tm-currency"), incoterm: val("tm-incoterm"),
        freight: val("tm-freight"), insurance: val("tm-insurance"), duty: val("tm-duty"),
        stated_total: val("tm-stated"), lines: lines
      };
    }
    return {
      sea_only: checked("tm-sea"),
      place_alongside_ship: checked("tm-along"),
      seller_pays_main_carriage: checked("tm-freight"),
      seller_must_insure: checked("tm-insure"),
      seller_risk_until_destination: checked("tm-risk"),
      seller_unloads: checked("tm-unload"),
      seller_pays_import_duty: checked("tm-duty")
    };
  }

  // International procurement and Capital projects (trade-intel.js). Each form is built from its spec:
  // fields are [key, label, sample, kind], where kind is a list of [value, label] options for a choice
  // and "check" for a tick box; rows are repeating lines, and a blank line is left out.
  var YES_NO = "check";
  var INTEL = {
    sourcing_compare: {
      group: "International procurement", name: "Sourcing comparison",
      note: "Full cost of each origin, shown before and after duties, unreclaimable tax and export rebates, then tested against a currency and freight shock. The first origin is your current supply. Every rate is the one you type.",
      fields: [["home_currency", "Home currency", "USD", "text"], ["monthly_quantity", "Quantity bought per month", "5000"], ["unit", "Unit", "kg", "text"],
        ["duty_basis", "Customs value", "cif", [["cif", "CIF: goods + freight + insurance"], ["fob", "FOB: goods only (US, Canada, Australia)"]]],
        ["months", "Months to plan", "12", "numeric"], ["export_share_percent", "Share used in exported goods %", "40"],
        ["money_rate_percent", "Your annual cost of money %", "9"], ["fx_shock_percent", "Currency shock %", "10"], ["freight_shock_percent", "Freight shock %", "50"]],
      rows: { key: "origins", add: "Add an origin", columns: [["name", "Origin or supplier", "text"], ["currency", "Price currency", "text"], ["fx_rate", "Home currency per 1 unit of it"],
        ["unit_price", "Unit price"], ["incoterm", "Incoterm", [["EXW", "EXW"], ["FCA", "FCA"], ["FAS", "FAS"], ["FOB", "FOB"], ["CFR", "CFR"], ["CIF", "CIF"], ["CPT", "CPT"], ["CIP", "CIP"], ["DAP", "DAP"], ["DPU", "DPU"], ["DDP", "DDP"]]],
        ["freight", "Freight you pay per month"], ["insurance_percent", "Insurance %"], ["local_charges", "Clearing, port and inland per month"],
        ["duty_percent", "Duty %"], ["extra_duty_percent", "Additional duty % (anti-dumping, safeguard)"], ["duty_source", "Where the duty rates came from, with the date", "text"],
        ["tax_percent", "Import VAT or sales tax %"], ["tax_recoverable_percent", "Share of that tax you reclaim %"], ["drawback_percent", "Duty refunded on exports %"],
        ["reject_percent", "Rejected or lost %"], ["lead_days", "Production days", "numeric"], ["transit_days", "Transit days", "numeric"],
        ["payment", "You pay", [["advance", "In advance"], ["shipment", "At shipment"], ["credit", "On credit"]]], ["credit_days", "Credit days", "numeric"],
        ["preference", "Preferential (FTA or GSP) rate claimed", YES_NO]],
        samples: [
          { name: "China", currency: "CNY", fx_rate: "0.138", unit_price: "21.5", incoterm: "FOB", freight: "3200", insurance_percent: "0.3", local_charges: "900", duty_percent: "12", extra_duty_percent: "25", duty_source: "Your tariff schedule, with its date", tax_percent: "17", tax_recoverable_percent: "100", drawback_percent: "90", reject_percent: "2", lead_days: "30", transit_days: "35", payment: "advance" },
          { name: "Turkey", currency: "EUR", fx_rate: "1.08", unit_price: "3.4", incoterm: "CIF", freight: "", insurance_percent: "", local_charges: "700", duty_percent: "0", tax_percent: "17", tax_recoverable_percent: "80", reject_percent: "1", lead_days: "20", transit_days: "12", payment: "credit", credit_days: "60", preference: true },
          { name: "USA", currency: "USD", unit_price: "4.10", incoterm: "FCA", freight: "2600", duty_percent: "5", duty_source: "Your tariff schedule, with its date", tax_percent: "17", lead_days: "15", transit_days: "20", payment: "shipment" }] }
    },
    supplier_risk: {
      group: "International procurement", name: "Supplier and country risk",
      note: "Scores a supplier and its origin from the evidence you hold, and names a control for every weakness, including the pressure tactics and human errors behind most losses. ThreadForge does not rate countries or companies.",
      fields: [["supplier", "Supplier", "Harbour Cloth", "text"], ["on_time_percent", "On-time deliveries % (blank if not recorded)", "88"]],
      evidence: true,
      checks: "risk"
    },
    sourcing_strategy: {
      group: "International procurement", name: "Sourcing strategy",
      note: "Places the purchase on the Kraljic matrix and recommends contract, sourcing split, safety stock, shipping, Incoterm, price, currency and duty relief, each with its reason.",
      fields: [["home_currency", "Home currency", "USD", "text"], ["annual_spend", "Annual spend", "1200000"], ["spend_share_percent", "Share of your total purchasing %", "18"],
        ["criticality", "If supply stops", "stops", [["stops", "Production stops"], ["slows", "Production slows"], ["easy", "Easy to replace"]]],
        ["supply_market", "Qualified suppliers in the market", "few", [["many", "Many"], ["few", "Few"], ["single", "One"]]],
        ["current_suppliers", "Suppliers you use now", "1", "numeric"], ["lead_days", "Order-to-arrival days", "65", "numeric"],
        ["lead_variability", "Lead-time reliability", "high", [["low", "Reliable"], ["medium", "Sometimes late"], ["high", "Often late"]]],
        ["demand", "Demand", "seasonal", [["stable", "Stable"], ["seasonal", "Seasonal"], ["volatile", "Volatile"]]],
        ["price_volatility", "Price volatility", "high", [["low", "Low"], ["medium", "Medium"], ["high", "High"]]],
        ["currency_exposure", "Currency of the purchase", "volatile", [["home", "Your own currency"], ["stable", "A stable foreign currency"], ["volatile", "A volatile foreign currency"]]],
        ["country_risk", "Country and route risk", "high", [["low", "Low"], ["medium", "Medium"], ["high", "High"]]],
        ["export_share_percent", "Share used in exported goods %", "40"], ["annual_duty", "Duty paid per year", "85000"], ["monthly_cbm", "Volume shipped per month (m³)", "18"]]
    },
    boq_estimate: {
      group: "Capital projects", name: "Cost plan from a bill",
      note: "A budget from your bill of quantities or materials, with wastage, preliminaries, overhead and profit, fees, escalation, contingency and the accuracy range of the estimate class (AACE 18R-97). A line with a blank rate is listed as unpriced.",
      fields: [["currency", "Currency", "USD", "text"],
        ["estimate_class", "Estimate class", "3", [["5", "Class 5: concept screening"], ["4", "Class 4: feasibility"], ["3", "Class 3: budget authorisation"], ["2", "Class 2: control or bid check"], ["1", "Class 1: tender check"]]],
        ["preliminaries_percent", "Preliminaries and site overheads %", "12"], ["overhead_profit_percent", "Contractor overhead and profit %", "10"],
        ["fees_percent", "Design and professional fees %", "8"], ["escalation_percent", "Price escalation % a year", "5"], ["months_to_midpoint", "Months to mid-construction", "14"],
        ["contingency_percent", "Contingency % (blank for the class's typical figure)", ""], ["tax_percent", "Tax on the contract %", "5"],
        ["size", "Project size (for cost per unit)", "2400"], ["size_unit", "Size unit", "m²", "text"], ["benchmark", "Your benchmark cost per size unit", "1100"]],
      rows: { key: "items", add: "Add a line", columns: [["item", "Description", "text"], ["quantity", "Quantity"], ["rate", "Rate"], ["wastage_percent", "Wastage %"], ["category", "Category", "text"]],
        samples: [
          { item: "Excavation", quantity: "1800", rate: "12.5", category: "Substructure" },
          { item: "Concrete C30", quantity: "620", rate: "145", wastage_percent: "5", category: "Substructure" },
          { item: "Reinforcement", quantity: "74", rate: "1150", wastage_percent: "7.5", category: "Frame" },
          { item: "Steel frame", quantity: "210", rate: "2650", category: "Frame" },
          { item: "Roof sheeting", quantity: "2600", rate: "38", category: "Envelope" },
          { item: "Electrical installation", quantity: "1", rate: "185000", category: "Services" },
          { item: "Fire alarm", quantity: "1", rate: "", category: "Services" }] }
    },
    bid_compare: {
      group: "Capital projects", name: "Contractor bid check",
      note: "Weighted price and quality scoring of contractor or supplier bids. Bids below the technical pass mark are not scored; abnormally low and over-budget bids are flagged.",
      fields: [["currency", "Currency", "USD", "text"], ["estimate", "Your estimate for this package", "2400000"], ["price_weight_percent", "Weight given to price %", "60"],
        ["pass_mark", "Technical pass mark", "60"], ["abnormal_low_percent", "Flag bids this far below the estimate %", "15"]],
      rows: { key: "bids", add: "Add a bid", columns: [["bidder", "Bidder", "text"], ["price", "Price"], ["technical_score", "Technical score (0–100)"], ["duration_months", "Duration (months)"]],
        samples: [{ bidder: "Alpha Build", price: "2310000", technical_score: "78", duration_months: "14" }, { bidder: "Beta Construct", price: "1950000", technical_score: "64", duration_months: "12" },
          { bidder: "Gamma Works", price: "2720000", technical_score: "88" }, { bidder: "Delta", price: "2100000", technical_score: "52" }] }
    },
    pert_schedule: {
      group: "Capital projects", name: "Schedule (PERT)",
      note: "Three-point durations, the critical path, float and the P50, P80 and P90 finish. Name the activities each one follows, separated by commas.",
      fields: [["start_date", "Start date (YYYY-MM-DD, optional)", "2026-11-02", "text"]],
      rows: { key: "activities", add: "Add an activity", columns: [["activity", "Activity", "text"], ["optimistic", "Optimistic days"], ["likely", "Most likely days"], ["pessimistic", "Pessimistic days"], ["after", "Follows", "text"]],
        samples: [{ activity: "Design", optimistic: "20", likely: "30", pessimistic: "50" }, { activity: "Permits", optimistic: "15", likely: "25", pessimistic: "60", after: "Design" },
          { activity: "Procure steel", optimistic: "30", likely: "40", pessimistic: "70", after: "Design" }, { activity: "Foundations", optimistic: "20", likely: "25", pessimistic: "35", after: "Permits" },
          { activity: "Erect frame", optimistic: "25", likely: "30", pessimistic: "45", after: "Foundations, Procure steel" }, { activity: "Fit-out", optimistic: "40", likely: "50", pessimistic: "75", after: "Erect frame" },
          { activity: "Commission", optimistic: "5", likely: "10", pessimistic: "20", after: "Fit-out" }] }
    },
    risk_register: {
      group: "Capital projects", name: "Risk register",
      note: "Expected cost and delay of each risk, before and after mitigation, and whether each mitigation pays for itself. The result is a risk-based contingency.",
      fields: [["currency", "Currency", "USD", "text"], ["budget", "Project budget", "3000000"]],
      rows: { key: "risks", add: "Add a risk", columns: [["risk", "Risk", "text"], ["probability_percent", "Probability %"], ["cost_impact", "Cost if it happens"], ["delay_days", "Delay if it happens (days)"],
        ["mitigation_cost", "Mitigation cost"], ["probability_after_percent", "Probability after mitigation %"]],
        samples: [{ risk: "Ground conditions worse than surveyed", probability_percent: "30", cost_impact: "400000", delay_days: "45", mitigation_cost: "35000", probability_after_percent: "10" },
          { risk: "Steel price rise", probability_percent: "40", cost_impact: "180000", delay_days: "0", mitigation_cost: "90000", probability_after_percent: "20" },
          { risk: "Permit delay", probability_percent: "25", cost_impact: "60000", delay_days: "60" },
          { risk: "Key contractor fails", probability_percent: "5", cost_impact: "900000", delay_days: "120", probability_after_percent: "2" }] }
    },
    investment_case: {
      group: "Capital projects", name: "Investment case",
      note: "Net present value, internal rate of return, payback and a downside test with the investment 20 % higher and benefits 20 % lower.",
      fields: [["currency", "Currency", "USD", "text"], ["capex", "Investment", "2800000"], ["annual_benefit", "Yearly benefit", "620000"], ["annual_opex", "Yearly running cost", "85000"],
        ["growth_percent", "Benefit growth % a year", "2"], ["years", "Years of benefit", "12", "numeric"], ["discount_percent", "Discount rate %", "10"], ["residual_value", "Value left at the end", "300000"]]
    },
    earned_value: {
      group: "Capital projects", name: "Earned value",
      note: "Cost and schedule performance once work has started, and the forecast final cost (ANSI/EIA-748 measures). Measure work done from quantities or certified milestones.",
      fields: [["currency", "Currency", "USD", "text"], ["budget", "Budget at completion", "3000000"], ["planned_percent", "Work planned by now %", "45"],
        ["earned_percent", "Work actually done %", "38"], ["actual_cost", "Actual cost so far", "1320000"]]
    },
    stage_gate: {
      group: "Capital projects", name: "Stage gate",
      note: "What must be in place before you go to tender, award the contract or start work on site. Tick an item only when the document exists and has been reviewed.",
      fields: [["gate", "Decision", "award", [["tender", "Go to tender"], ["award", "Award the contract"], ["start", "Start work on site"]]]],
      checks: "gate"
    }
  };
  Object.keys(INTEL).forEach(function (key) { TOOLS.push([key, INTEL[key].name, INTEL[key].group]); });

  function intelControl(id, column, value) {
    var kind = column[2];
    if (Array.isArray(kind)) return select(id, kind, value || kind[0][0]);
    if (kind === YES_NO) return el("input", { type: "checkbox", id: id, checked: value ? "checked" : null });
    return text(id, value == null ? "" : value, kind === "text" ? "text" : kind === "numeric" ? "numeric" : "decimal");
  }

  function intelCheck(id, label, on) {
    return el("label", { class: "check" }, el("input", { type: "checkbox", id: id, checked: on ? "checked" : null }), el("span", { text: label }));
  }

  function intelRow(spec, i, sample) {
    var box = el("div", { class: "form-grid tm-row" });
    spec.columns.forEach(function (col) {
      var id = "tm-" + col[0] + "-" + i;
      if (col[2] === YES_NO) box.appendChild(intelCheck(id, col[1], sample[col[0]]));
      else box.appendChild(field(id, col[1], intelControl(id, col, sample[col[0]])));
    });
    return box;
  }

  function buildIntel(tool, panel) {
    var spec = INTEL[tool];
    var grid = el("div", { class: "form-grid" });
    spec.fields.forEach(function (f) { grid.appendChild(field("tm-" + f[0], f[1], intelControl("tm-" + f[0], [f[0], f[1], f[3]], f[2]))); });
    panel.appendChild(grid);
    if (spec.evidence) {
      var TF = window.TFIntel;
      var samples = { certificates: "copy", testing: "own", inspection: "none", consistency: "some", capacity: "single", finance: "partial", export_controls: "licensing",
        trade_remedies: "investigation", screening: "not_done", currency: "volatile", logistics: "disrupted", standards: "mixed", enforcement: "weak" };
      ["supplier", "country"].forEach(function (area) {
        panel.appendChild(el("h3", { class: "tm-sub", text: area === "supplier" ? "Evidence on the supplier" : "This product from this country" }));
        var g2 = el("div", { class: "form-grid" });
        TF.evidence.filter(function (e) { return e[1] === area; }).forEach(function (e) {
          g2.appendChild(field("tm-" + e[0], e[2], select("tm-" + e[0], e[3].map(function (o) { return [o[0], o[0].replace(/_/g, " ")]; }), samples[e[0]])));
        });
        panel.appendChild(g2);
      });
    }
    if (spec.checks === "risk") {
      panel.appendChild(el("h3", { class: "tm-sub", text: "Red flags seen" }));
      var flags = el("div", { class: "tm-checks" });
      window.TFIntel.redFlags.forEach(function (f) { flags.appendChild(intelCheck("tm-" + f[0], f[1], f[0] === "flag_urgency")); });
      panel.appendChild(flags);
      panel.appendChild(el("h3", { class: "tm-sub", text: "Controls in place" }));
      var controls = el("div", { class: "tm-checks" });
      window.TFIntel.controls.forEach(function (c) { controls.appendChild(intelCheck("tm-" + c[0], c[1], c[0] === "control_four_eyes")); });
      panel.appendChild(controls);
    }
    if (spec.checks === "gate") {
      ["tender", "award", "start"].forEach(function (gate) {
        panel.appendChild(el("h3", { class: "tm-sub", text: { tender: "Before tender", award: "Before award", start: "Before work starts" }[gate] }));
        var box = el("div", { class: "tm-checks" });
        window.TFIntel.gateItems.filter(function (item) { return item[2] === gate; }).forEach(function (item) {
          box.appendChild(intelCheck("tm-" + item[0], item[1], gate === "tender" || ["securities", "bid_check"].indexOf(item[0]) >= 0));
        });
        panel.appendChild(box);
      });
    }
    if (spec.rows) {
      var host = el("div", { class: "tm-lines", id: "tm-rows" });
      spec.rows.samples.forEach(function (sample, i) { host.appendChild(intelRow(spec.rows, i, sample)); });
      panel.appendChild(host);
      var more = el("button", { type: "button", class: "btn btn-ghost", text: spec.rows.add });
      more.addEventListener("click", function () { host.appendChild(intelRow(spec.rows, host.children.length, {})); });
      panel.appendChild(more);
    }
  }

  function readIntel(tool) {
    var spec = INTEL[tool], inputs = {};
    spec.fields.forEach(function (f) { inputs[f[0]] = val("tm-" + f[0]); });
    if (spec.evidence) window.TFIntel.evidence.forEach(function (e) { inputs[e[0]] = val("tm-" + e[0]); });
    if (spec.checks === "risk") window.TFIntel.redFlags.concat(window.TFIntel.controls).forEach(function (f) { inputs[f[0]] = checked("tm-" + f[0]); });
    if (spec.checks === "gate") window.TFIntel.gateItems.forEach(function (item) { inputs[item[0]] = checked("tm-" + item[0]); });
    if (spec.rows) {
      var list = [];
      document.querySelectorAll("#tm-rows .tm-row").forEach(function (row, i) {
        var line = {}, filled = false;
        spec.rows.columns.forEach(function (col) {
          var id = "tm-" + col[0] + "-" + i;
          if (col[2] === YES_NO) line[col[0]] = checked(id);
          else { line[col[0]] = val(id); if (line[col[0]] && !Array.isArray(col[2])) filled = true; }
        });
        if (filled) list.push(line);
      });
      inputs[spec.rows.key] = list;
    }
    return inputs;
  }

  function slipText(result) {
    var lines = [result.summary, "", result.formula, ""];
    result.figures.forEach(function (item) {
      lines.push(item.label + ": " + item.value + (item.unit ? " " + item.unit : ""));
    });
    if (result.assumptions.length) {
      lines.push("", "Assumptions");
      result.assumptions.forEach(function (item) { lines.push("- " + item); });
    }
    if (result.warnings.length) {
      lines.push("", "Warnings");
      result.warnings.forEach(function (item) { lines.push("- " + item); });
    }
    lines.push("", "TradeMath on threadforgeofficial.com. Figures you typed. Nothing was uploaded.");
    return lines.join("\n");
  }

  function show(result) {
    var host = document.getElementById("tm-result");
    host.replaceChildren();
    var slip = el("div", { class: "tm-slip" });
    slip.appendChild(el("h3", { text: result.summary }));
    var list = el("dl", { class: "tm-figures" });
    result.figures.forEach(function (item) {
      var row = el("div");
      row.appendChild(el("dt", { text: item.label }));
      row.appendChild(el("dd", { text: item.value + (item.unit ? " " + item.unit : "") }));
      list.appendChild(row);
    });
    slip.appendChild(list);
    slip.appendChild(el("p", { class: "tm-meta", text: result.formula }));
    result.assumptions.forEach(function (item) { slip.appendChild(el("p", { class: "tm-meta", text: item })); });
    result.warnings.forEach(function (item) { slip.appendChild(el("p", { class: "tm-warn", text: item })); });
    var actions = el("div", { class: "result-actions" });
    var save = el("button", { type: "button", class: "btn-plain", text: "Download this result" });
    save.addEventListener("click", function () {
      var blob = new Blob([slipText(result)], { type: "text/plain;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var link = el("a", { href: url, download: "TradeMath-result.txt" });
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    });
    actions.appendChild(save);
    slip.appendChild(actions);
    host.appendChild(slip);
  }

  function fail(message) {
    var host = document.getElementById("tm-result");
    host.replaceChildren(el("p", { class: "field-error", role: "alert", text: message }));
  }

  function paint(tool) {
    var panel = document.getElementById("tm-panel");
    var name = TOOLS.filter(function (item) { return item[0] === tool; })[0][1];
    panel.replaceChildren();
    panel.appendChild(el("h2", { id: "tm-title", text: name }));
    panel.appendChild(el("p", { class: "tm-note", text: INTEL[tool] ? INTEL[tool].note : NOTES[tool] }));
    if (INTEL[tool]) buildIntel(tool, panel); else builders[tool](panel);
    var actions = el("div", { class: "form-actions" });
    var go = el("button", { type: "button", class: "btn btn-primary", id: "tm-go", text: "Calculate" });
    actions.appendChild(go);
    panel.appendChild(actions);
    panel.appendChild(el("div", { id: "tm-result", "aria-live": "polite" }));
    document.querySelectorAll(".tm-nav button").forEach(function (button) {
      button.setAttribute("aria-current", button.getAttribute("data-tool") === tool ? "true" : "false");
    });
    var picker = document.getElementById("tm-pick");
    if (picker) picker.value = tool;
    var add = document.getElementById("tm-add");
    if (add) add.addEventListener("click", function () {
      var host = document.getElementById("tm-rows");
      var i = host.children.length;
      var box = lineBox();
      [["length", "Length"], ["width", "Width"], ["height", "Height"], ["quantity", "Cartons"]].forEach(function (pair) {
        box.appendChild(field("tm-" + pair[0] + "-" + i, pair[1], text("tm-" + pair[0] + "-" + i, "", pair[0] === "quantity" ? "numeric" : "decimal")));
      });
      host.appendChild(box);
    });
    var kind = document.getElementById("tm-kind");
    if (kind) kind.addEventListener("change", function () {
      var options = kind.value === "mass" ? MASSES : LENGTHS;
      ["tm-from", "tm-to"].forEach(function (id, index) {
        var node = document.getElementById(id);
        var keep = options.indexOf(node.value) >= 0 ? node.value : options[index === 0 ? 0 : 1];
        node.replaceChildren();
        options.forEach(function (opt) {
          var item = el("option", { value: opt, text: opt });
          if (opt === keep) item.selected = true;
          node.appendChild(item);
        });
      });
    });
    go.addEventListener("click", function () {
      try {
        show(INTEL[tool] ? window.TFIntel.calculate(tool, readIntel(tool)) : window.TFTrade.calculate(tool, read(tool)));
      } catch (error) {
        fail(error && error.trade ? error.message : "That figure could not be calculated. Check the numbers and try again.");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.TFTrade || !window.TFIntel) return;
    var nav = document.getElementById("tm-nav");
    var group = null, groupNode = null;
    // On a phone the tools are one grouped list to pick from, not a long sideways strip.
    var pick = el("select", { class: "tm-pick", id: "tm-pick", "aria-label": "TradeMath tool" });
    pick.addEventListener("change", function () { paint(pick.value); history.replaceState(null, "", "#" + pick.value); });
    nav.appendChild(field("tm-pick", "Tool", pick));
    TOOLS.forEach(function (item) {
      if (item[2] !== group) {
        group = item[2];
        nav.appendChild(el("p", { class: "tm-group", text: group }));
        groupNode = el("optgroup", { label: group });
        pick.appendChild(groupNode);
      }
      groupNode.appendChild(el("option", { value: item[0], text: item[1] }));
      var button = el("button", { type: "button", "data-tool": item[0], text: item[1] });
      button.addEventListener("click", function () { paint(item[0]); history.replaceState(null, "", "#" + item[0]); });
      nav.appendChild(button);
    });
    var initial = (location.hash || "").replace("#", "");
    if (!TOOLS.some(function (item) { return item[0] === initial; })) initial = "cbm";
    paint(initial);
    window.addEventListener("hashchange", function () {
      var tool = (location.hash || "").replace("#", "");
      if (TOOLS.some(function (item) { return item[0] === tool; })) paint(tool);
    });
  });
})();

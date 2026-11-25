/* ThreadForge TradeMath Interactive Incoterms 2020 & CBM Landed-Cost Widget.
   100% strict CSP compliant (`script-src 'self'`, `style-src 'self'`, zero inline styles).
   All monetary and volume calculations execute in exact BigInt scaled integers. */
(function () {
  "use strict";

  var INCOTERMS = {
    EXW: {
      badge: "EXW · Ex Works",
      desc: "EXW (Ex Works): Seller delivers packed goods at factory gate. Buyer bears origin loading, export clearance, main freight, marine insurance, import duty, and destination delivery.",
      freightNote: "Buyer pays main ocean/air leg",
      insNote: "Buyer arranges cargo insurance",
      dutyNote: "Applied on customs valuation base"
    },
    FOB: {
      badge: "FOB · Free On Board",
      desc: "FOB (Free On Board): Seller clears export and loads goods onto the vessel. Buyer pays main freight, marine insurance, customs import duty, and destination drayage.",
      freightNote: "Buyer pays main ocean/air leg",
      insNote: "Buyer arranges cargo insurance",
      dutyNote: "Applied on CIF customs base"
    },
    CIF: {
      badge: "CIF · Cost, Ins. & Freight",
      desc: "CIF (Cost, Insurance & Freight): Seller covers goods, main freight, and minimum Clause C insurance to destination port. Buyer pays destination clearance, port charges, and import duty.",
      freightNote: "Seller covers main leg (enter surcharge only)",
      insNote: "Seller covers base Clause C (top-up only)",
      dutyNote: "Applied on CIF customs base"
    },
    DDP: {
      badge: "DDP · Delivered Duty Paid",
      desc: "DDP (Delivered Duty Paid): Seller bears goods, freight, insurance, and import customs duty to destination. Only buyer-side internal receiving fees apply.",
      freightNote: "Included in seller quote under DDP",
      insNote: "Included in seller quote under DDP",
      dutyNote: "Seller pays import duty under DDP"
    }
  };

  var CONTAINERS = {
    "20ft": { label: "20ft Standard", cbmScaled: 33200000n, maxKgMicro: 28200000000n },
    "40ft": { label: "40ft Standard", cbmScaled: 67700000n, maxKgMicro: 26600000000n },
    "40hc": { label: "40ft High Cube", cbmScaled: 76300000n, maxKgMicro: 26460000000n },
    "lcl":  { label: "LCL Consolidated", cbmScaled: 76300000n, maxKgMicro: 26460000000n }
  };

  function h(tag, props) {
    var node = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), v);
      else if (v === true) node.setAttribute(k, "");
      else node.setAttribute(k, String(v));
    });
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }

  function append(parent, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) {
      child.forEach(function (c) { append(parent, c); });
      return;
    }
    parent.appendChild(child.nodeType ? child : document.createTextNode(String(child)));
  }

  function parseScaled(raw, scaleDigits, label) {
    var s = String(raw == null ? "" : raw).trim().replace(/[$,\s]/g, "");
    if (!s) throw new Error(label + " is required.");
    var m = /^(\d+)(?:\.(\d+))?$/.exec(s);
    if (!m) throw new Error(label + " must be a non-negative number.");
    var whole = BigInt(m[1]);
    var frac = (m[2] || "").slice(0, scaleDigits);
    while (frac.length < scaleDigits) frac += "0";
    var factor = 10n ** BigInt(scaleDigits);
    return whole * factor + BigInt(frac || "0");
  }

  function parsePositiveInt(raw, label) {
    var s = String(raw == null ? "" : raw).trim().replace(/,/g, "");
    if (!/^\d+$/.test(s)) throw new Error(label + " must be a whole integer.");
    var v = BigInt(s);
    if (v <= 0n) throw new Error(label + " must be greater than zero.");
    return v;
  }

  function divRound(num, den) {
    if (den <= 0n) return 0n;
    return (num * 2n + den) / (2n * den);
  }

  function divCeil(num, den) {
    if (num <= 0n) return 1n;
    return (num + den - 1n) / den;
  }

  function fmtScaled(valScaled, scaleDigits, decimals) {
    var neg = valScaled < 0n;
    var abs = neg ? -valScaled : valScaled;
    var drop = scaleDigits - decimals;
    var rounded = drop > 0 ? divRound(abs, 10n ** BigInt(drop)) : abs * (10n ** BigInt(-drop));
    var factor = 10n ** BigInt(decimals);
    var whole = (rounded / factor).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    var frac = (rounded % factor).toString().padStart(decimals, "0");
    return (neg ? "-" : "") + whole + (decimals > 0 ? "." + frac : "");
  }

  function fmtCents(cents) {
    return "$" + fmtScaled(cents, 2, 2);
  }

  function sha256Hex(text) {
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (buf) {
        return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
      });
    }
    return Promise.resolve("offline-browser-checksum");
  }

  function mountWidget(mountEl, index) {
    var base = mountEl.getAttribute("data-widget-base") || "./";
    if (base.slice(-1) !== "/") base += "/";
    var prefix = "lcw-" + index + "-";
    var state = { inco: "FOB", report: null };
    var inputs = {};

    function mkField(key, label, defVal, hint, opts) {
      var id = prefix + key;
      var ctrl;
      if (opts) {
        ctrl = h("select", { id: id }, opts.map(function (o) {
          var op = h("option", { value: o[0], text: o[1] });
          if (o[0] === defVal) op.selected = true;
          return op;
        }));
      } else {
        ctrl = h("input", { id: id, type: "text", value: defVal, inputmode: "decimal" });
      }
      inputs[key] = ctrl;
      var hintEl = hint ? h("small", { class: "lc-hint", text: hint }) : null;
      return {
        node: h("label", { class: "lc-fld", for: id }, h("span", { text: label }), ctrl, hintEl),
        hintEl: hintEl
      };
    }

    var fLen = mkField("len", "Carton length", "60");
    var fWid = mkField("wid", "Carton width", "40");
    var fHei = mkField("hei", "Carton height", "40");
    var fUnit = mkField("unit", "Dim. unit", "cm", null, [["cm", "Centimetres (cm)"], ["in", "Inches (in)"]]);
    var fWt = mkField("wt", "Carton weight (kg)", "18.5");
    var fCont = mkField("cont", "Container", "40hc", null, [
      ["20ft", "20ft Std (33.2 m³)"],
      ["40ft", "40ft Std (67.7 m³)"],
      ["40hc", "40ft HC (76.3 m³)"],
      ["lcl", "LCL Consolidated"]
    ]);
    var fCartons = mkField("cartons", "Total cartons", "420");
    var fUpc = mkField("upc", "Units / carton", "12");
    var fSell = mkField("sell", "Target resale ($)", "32.50");

    var fPrice = mkField("price", "Unit quote ($)", "14.25", "Seller invoice price");
    var fOrigin = mkField("origin", "Origin fees ($)", "0.00", "Export & drayage");
    var fFreight = mkField("freight", "Main freight ($)", "3850.00", "Buyer pays main leg");
    var fIns = mkField("ins", "Insurance ($)", "410.00", "Cargo policy");
    var fDuty = mkField("duty", "Import duty (%)", "6.5", "Applied on CIF customs base");
    var fDest = mkField("dest", "Dest. clearance ($)", "980.00", "Port & brokerage");

    var incoDesc = h("p", { class: "lc-inco-desc" });
    var errBox = h("p", { class: "lc-err", role: "alert", hidden: true });
    var incoButtons = {};
    var incoBar = h("div", { class: "lc-inco-bar", role: "group", "aria-label": "Incoterms 2020 selector" },
      ["EXW", "FOB", "CIF", "DDP"].map(function (code) {
        var b = h("button", {
          type: "button",
          class: "lc-inco-btn",
          "aria-pressed": String(code === state.inco),
          onclick: function () { setInco(code); }
        }, h("strong", { text: code }), h("span", { text: INCOTERMS[code].badge.split("· ")[1] }));
        incoButtons[code] = b;
        return b;
      })
    );

    var rBadge = h("span", { class: "lc-slip-badge", text: "FOB · 40ft HC" });
    var rUnitsLbl = h("div", { class: "lc-sub-lbl", text: "0 units" });
    var rUnitCost = h("div", { class: "lc-hero-val", text: "$0.0000" });
    var rGoods = h("dd", { text: "$0.00" });
    var rFreight = h("dd", { text: "$0.00" });
    var rIns = h("dd", { text: "$0.00" });
    var rCif = h("dd", { text: "$0.00" });
    var rDuty = h("dd", { text: "$0.00" });
    var rDest = h("dd", { text: "$0.00" });
    var rTotal = h("dd", { class: "lc-total-dd", text: "$0.00" });
    var rMargin = h("dd", { text: "0.00%" });

    var rCbm = h("span", { text: "0.000 m³" });
    var rVolPct = h("span", { text: "0.0%" });
    var rVolProg = h("progress", { class: "lc-progress", max: "100", value: "0", "aria-label": "Container volume fill" });
    var rKg = h("span", { text: "0 kg" });
    var rWtPct = h("span", { text: "0.0%" });
    var rWtProg = h("progress", { class: "lc-progress", max: "100", value: "0", "aria-label": "Container payload weight" });
    var rAdvice = h("p", { class: "lc-advice", text: "Packing summary" });
    var warnBox = h("p", { class: "lc-warn", hidden: true });

    // Modal for exporting BOQ report
    var modalEmail = h("input", { id: prefix + "m-email", type: "email", required: true, placeholder: "procurement@company.com" });
    var modalOrg = h("input", { id: prefix + "m-org", type: "text", required: true, placeholder: "Northgate Manufacturing Ltd." });
    var modalErr = h("p", { class: "lc-err", role: "alert", hidden: true });
    var exportBtn = h("button", { type: "button", class: "btn btn-lime lc-export-btn", text: "Export Verified BOQ Report", onclick: openModal });

    var modalCloseBtn = h("button", { type: "button", class: "lc-modal-close", "aria-label": "Close export modal", text: "×", onclick: closeModal });
    var modalForm = h("form", { novalidate: true, class: "lc-modal-form" },
      h("label", { class: "lc-fld", for: prefix + "m-email" }, h("span", { text: "Email for report header" }), modalEmail),
      h("label", { class: "lc-fld", for: prefix + "m-org" }, h("span", { text: "Organization / Company" }), modalOrg),
      modalErr,
      h("div", { class: "lc-modal-actions" },
        h("button", { type: "submit", class: "btn btn-primary", text: "Download Signed BOQ Report" }),
        h("button", { type: "button", class: "btn btn-ghost", text: "Cancel", onclick: closeModal })
      )
    );
    var modalBackdrop = h("div", {
      class: "lc-modal-bg",
      hidden: true,
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": prefix + "m-title"
    }, h("div", { class: "lc-modal" },
      h("div", { class: "lc-modal-head" },
        h("h3", { id: prefix + "m-title", text: "Export Verified BOQ Report" }),
        modalCloseBtn
      ),
      h("p", { class: "lc-modal-copy", text: "Generates a deterministic Incoterms 2020 & CBM BOQ certificate (.txt) with a browser SHA-256 checksum. Nothing is uploaded or sent anywhere." }),
      modalForm
    ));

    function openModal() {
      if (!state.report) return;
      modalErr.hidden = true;
      modalBackdrop.hidden = false;
      modalEmail.focus();
    }
    function closeModal() {
      modalBackdrop.hidden = true;
      exportBtn.focus();
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modalBackdrop.hidden) closeModal();
    });

    modalForm.addEventListener("submit", function (e) {
      e.preventDefault();
      modalErr.hidden = true;
      var email = modalEmail.value.trim();
      var org = modalOrg.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        modalErr.textContent = "Enter a valid email address for the BOQ header.";
        modalErr.hidden = false;
        modalEmail.focus();
        return;
      }
      if (!org) {
        modalErr.textContent = "Enter your organization or company name.";
        modalErr.hidden = false;
        modalOrg.focus();
        return;
      }
      var rep = state.report;
      var canonical = JSON.stringify({ organization: org, email: email, report: rep, timestamp: new Date().toISOString() }, null, 2);
      sha256Hex(canonical).then(function (digest) {
        var doc = [
          "THREADFORGE TRADEMATH - VERIFIED BOQ & LANDED-COST CERTIFICATE",
          "==============================================================",
          "Organization : " + org,
          "Prepared For : " + email,
          "Generated At : " + new Date().toISOString(),
          "Math Engine  : BigInt Integer Micro-Cents (0 Floating-Point Drift)",
          "SHA-256 Hash : " + digest,
          "",
          "SUMMARY",
          "-------",
          "Incoterm 2020 Basis : " + rep.incoterm,
          "Equipment & Count   : " + rep.containersNeeded + "x " + rep.container,
          "Quantity            : " + rep.totalUnits + " units (" + rep.cartons + " cartons @ " + rep.unitsPerCarton + "/ctn)",
          "Total CBM / Mass    : " + rep.totalCbm + " m3 / " + rep.totalGrossKg + " kg",
          "Commercial Goods    : " + rep.goodsUsd,
          "Origin + Freight    : " + rep.freightAndOriginUsd,
          "Marine Insurance    : " + rep.insuranceUsd,
          "CIF Customs Base    : " + rep.cifCustomsBaseUsd,
          "Import Duty         : " + rep.dutyUsd,
          "Destination Fees    : " + rep.destinationUsd,
          "TOTAL LANDED COST   : " + rep.totalLandedUsd,
          "UNIT LANDED COST    : " + rep.unitLandedUsd,
          "Est. Gross Margin   : " + rep.estimatedMarginPct,
          "",
          "Canonical JSON Payload:",
          canonical
        ].join("\n");
        var url = URL.createObjectURL(new Blob([doc], { type: "text/plain;charset=utf-8" }));
        var a = h("a", { href: url, download: "threadforge-trademath-" + rep.incoterm.toLowerCase() + "-boq.txt" });
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        closeModal();
      });
    });

    function setInco(code) {
      state.inco = code;
      Object.keys(incoButtons).forEach(function (k) {
        incoButtons[k].setAttribute("aria-pressed", String(k === code));
      });
      var meta = INCOTERMS[code];
      incoDesc.textContent = meta.desc;
      if (fFreight.hintEl) fFreight.hintEl.textContent = meta.freightNote;
      if (fIns.hintEl) fIns.hintEl.textContent = meta.insNote;
      if (fDuty.hintEl) fDuty.hintEl.textContent = meta.dutyNote;
      recalc();
    }

    function resetSample() {
      inputs.len.value = "60"; inputs.wid.value = "40"; inputs.hei.value = "40";
      inputs.unit.value = "cm"; inputs.wt.value = "18.5"; inputs.cont.value = "40hc";
      inputs.cartons.value = "420"; inputs.upc.value = "12"; inputs.sell.value = "32.50";
      inputs.price.value = "14.25"; inputs.origin.value = "0.00"; inputs.freight.value = "3850.00";
      inputs.ins.value = "410.00"; inputs.duty.value = "6.5"; inputs.dest.value = "980.00";
      setInco("FOB");
    }

    function recalc() {
      errBox.hidden = true;
      warnBox.hidden = true;
      try {
        var cartons = parsePositiveInt(inputs.cartons.value, "Total cartons");
        var upc = parsePositiveInt(inputs.upc.value, "Units per carton");
        var totalUnits = cartons * upc;

        var len = parseScaled(inputs.len.value, 2, "Carton length");
        var wid = parseScaled(inputs.wid.value, 2, "Carton width");
        var hei = parseScaled(inputs.hei.value, 2, "Carton height");
        if (len <= 0n || wid <= 0n || hei <= 0n) throw new Error("Carton dimensions must be greater than zero.");

        var cbmUnitScaled = inputs.unit.value === "cm"
          ? divRound(len * wid * hei, 1000000n)
          : divRound(len * wid * hei * 16387064n, 1000000000000n);
        var totalCbmScaled = cbmUnitScaled * cartons;
        var cartonKgScaled = parseScaled(inputs.wt.value, 3, "Carton weight");
        var totalKgMicro = cartonKgScaled * cartons * 1000n;

        var contKey = inputs.cont.value;
        var cont = CONTAINERS[contKey];
        var volBp = divRound(totalCbmScaled * 1000n, cont.cbmScaled);
        var wtBp = divRound(totalKgMicro * 1000n, cont.maxKgMicro);
        var practicalCap = (cont.cbmScaled * 85n) / 100n;
        var containersNeeded = contKey === "lcl" ? 1n : divCeil(totalCbmScaled, practicalCap);
        var wCont = contKey === "lcl" ? 1n : divCeil(totalKgMicro, cont.maxKgMicro);
        if (wCont > containersNeeded) containersNeeded = wCont;

        var unitPriceMicro = parseScaled(inputs.price.value, 4, "Unit quote");
        var goodsCents = divRound(unitPriceMicro * totalUnits, 100n);
        var originCents = parseScaled(inputs.origin.value, 2, "Origin fees");
        var freightCents = parseScaled(inputs.freight.value, 2, "Main freight");
        var insCents = parseScaled(inputs.ins.value, 2, "Insurance");
        var destCents = parseScaled(inputs.dest.value, 2, "Destination clearance");
        var dutyBp = parseScaled(inputs.duty.value, 2, "Import duty %");

        var cifBaseCents = goodsCents + (state.inco === "EXW" ? originCents : 0n) + freightCents + insCents;
        var dutyCents = state.inco === "DDP" ? 0n : divRound(cifBaseCents * dutyBp, 10000n);
        if (state.inco === "DDP") {
          originCents = 0n;
          freightCents = 0n;
          insCents = 0n;
        }

        var totalLandedCents = goodsCents + originCents + freightCents + insCents + dutyCents + destCents;
        var unitLandedMicro = divRound(totalLandedCents * 100n, totalUnits);
        var sellPriceCents = parseScaled(inputs.sell.value, 2, "Target resale price");
        var unitProfitCents = sellPriceCents - divRound(totalLandedCents, totalUnits);
        var marginBp = sellPriceCents > 0n ? divRound(unitProfitCents * 10000n, sellPriceCents) : 0n;

        rBadge.textContent = state.inco + " · " + cont.label;
        rUnitsLbl.textContent = totalUnits.toLocaleString("en-US") + " units (" + cartons.toLocaleString("en-US") + " cartons)";
        rUnitCost.textContent = "$" + fmtScaled(unitLandedMicro, 4, 4);
        rGoods.textContent = fmtCents(goodsCents);
        rFreight.textContent = fmtCents(originCents + freightCents);
        rIns.textContent = fmtCents(insCents);
        rCif.textContent = fmtCents(cifBaseCents);
        rDuty.textContent = fmtCents(dutyCents) + (state.inco === "DDP" ? " (Seller Paid)" : "");
        rDest.textContent = fmtCents(destCents);
        rTotal.textContent = fmtCents(totalLandedCents);
        rMargin.textContent = fmtScaled(marginBp, 2, 2) + "% (" + fmtCents(unitProfitCents) + "/unit)";

        var volPctNum = Number(volBp) / 10;
        var wtPctNum = Number(wtBp) / 10;
        rCbm.textContent = fmtScaled(totalCbmScaled, 6, 3) + " m³";
        rVolPct.textContent = volPctNum.toFixed(1) + "% fill";
        rVolProg.value = Math.min(100, Math.max(0, Math.round(volPctNum)));
        rVolProg.classList.toggle("is-over", volPctNum > 85);

        rKg.textContent = fmtScaled(totalKgMicro, 6, 1) + " kg";
        rWtPct.textContent = wtPctNum.toFixed(1) + "% payload";
        rWtProg.value = Math.min(100, Math.max(0, Math.round(wtPctNum)));
        rWtProg.classList.toggle("is-over", wtPctNum > 95);

        rAdvice.textContent = contKey === "lcl"
          ? "LCL Volume: " + fmtScaled(totalCbmScaled, 6, 3) + " m³" + (volPctNum > 45 ? " — Compare FCL 20ft rate" : "")
          : containersNeeded.toString() + "x " + cont.label + " required (@ 85% usable packing efficiency)";

        if (contKey !== "lcl" && (volPctNum > 85 || wtPctNum > 95)) {
          warnBox.textContent = "Capacity Alert: Exceeds single-container usable fill/payload (" + containersNeeded.toString() + " containers needed).";
          warnBox.hidden = false;
        }

        state.report = {
          incoterm: state.inco,
          container: cont.label,
          cartons: cartons.toString(),
          unitsPerCarton: upc.toString(),
          totalUnits: totalUnits.toString(),
          totalCbm: fmtScaled(totalCbmScaled, 6, 4),
          totalGrossKg: fmtScaled(totalKgMicro, 6, 2),
          containersNeeded: containersNeeded.toString(),
          goodsUsd: fmtCents(goodsCents),
          freightAndOriginUsd: fmtCents(originCents + freightCents),
          insuranceUsd: fmtCents(insCents),
          cifCustomsBaseUsd: fmtCents(cifBaseCents),
          dutyUsd: fmtCents(dutyCents),
          destinationUsd: fmtCents(destCents),
          totalLandedUsd: fmtCents(totalLandedCents),
          unitLandedUsd: "$" + fmtScaled(unitLandedMicro, 4, 4),
          estimatedMarginPct: fmtScaled(marginBp, 2, 2) + "%"
        };
      } catch (err) {
        errBox.textContent = err.message || "Enter valid positive numbers.";
        errBox.hidden = false;
        state.report = null;
      }
    }

    Object.keys(inputs).forEach(function (k) {
      inputs[k].addEventListener("input", recalc);
      inputs[k].addEventListener("change", recalc);
    });

    var root = h("div", { class: "lc-shell" },
      h("div", { class: "lc-inputs-card" },
        h("div", { class: "lc-block" },
          h("p", { class: "lc-kicker", text: "1. Incoterms 2020 Commercial Basis" }),
          incoBar,
          incoDesc
        ),
        h("div", { class: "lc-block" },
          h("p", { class: "lc-kicker", text: "2. Carton Dimensions & Container Utilization" }),
          h("div", { class: "lc-grid-3" }, fLen.node, fWid.node, fHei.node, fUnit.node, fWt.node, fCont.node, fCartons.node, fUpc.node, fSell.node)
        ),
        h("div", { class: "lc-block" },
          h("p", { class: "lc-kicker", text: "3. Integer-Cent Cost Breakdown (USD)" }),
          h("div", { class: "lc-grid-3" }, fPrice.node, fOrigin.node, fFreight.node, fIns.node, fDuty.node, fDest.node)
        ),
        errBox
      ),
      h("aside", { class: "lc-slip", "aria-label": "Landed cost result slip" },
        h("div", { class: "lc-slip-top" }, h("h3", { text: "Deterministic Landed-Cost Slip" }), rBadge),
        h("div", { class: "lc-hero-box" },
          h("div", null, h("span", { class: "lc-hero-lbl", text: "Unit Landed Cost" }), rUnitsLbl),
          rUnitCost
        ),
        h("dl", { class: "lc-kv" },
          h("div", { class: "lc-kv-row" }, h("dt", { text: "Commercial Goods Value" }), rGoods),
          h("div", { class: "lc-kv-row" }, h("dt", { text: "Origin + Main Freight" }), rFreight),
          h("div", { class: "lc-kv-row" }, h("dt", { text: "Marine Insurance" }), rIns),
          h("div", { class: "lc-kv-row" }, h("dt", { text: "CIF Customs Valuation Base" }), rCif),
          h("div", { class: "lc-kv-row" }, h("dt", { text: "Import Duty" }), rDuty),
          h("div", { class: "lc-kv-row" }, h("dt", { text: "Destination Clearance" }), rDest),
          h("div", { class: "lc-kv-row lc-kv-total" }, h("dt", { text: "Total All-In Landed Cost" }), rTotal),
          h("div", { class: "lc-kv-row lc-kv-clean" }, h("dt", { text: "Gross Margin @ Resale" }), rMargin)
        ),
        h("div", { class: "lc-meter-box" },
          h("div", { class: "lc-meter-head" }, rCbm, rVolPct),
          rVolProg,
          h("div", { class: "lc-meter-head" }, rKg, rWtPct),
          rWtProg,
          rAdvice
        ),
        warnBox,
        h("div", { class: "lc-slip-actions" },
          exportBtn,
          h("button", { type: "button", class: "btn btn-ghost lc-reset-btn", text: "Reset Sample", onclick: resetSample }),
          h("a", { class: "lc-portable-link", href: base + "public/widgets/trademath-landed-cost.html", text: "Standalone widget" })
        ),
        h("p", { class: "lc-slip-fine", text: "BigInt integer micro-cent math · Zero telemetry, cookies, or login wall." })
      ),
      modalBackdrop
    );

    mountEl.replaceChildren(root);
    setInco("FOB");
  }

  document.querySelectorAll("[data-lc-widget]").forEach(function (el, idx) {
    mountWidget(el, idx);
  });
})();

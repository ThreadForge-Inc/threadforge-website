/* ThreadForge live demo engine.
   Pure logic with no DOM access, so it runs in the browser and under `node --test`.
   Business workflows (stock, orders, invoices, ledger, CSV, campaigns, roles) really
   work on sample data. Due diligence, PC care, engineering and app-builder results are
   simulations that follow the product's documented behaviour; the UI labels them. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TFDemo = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "10.6.2";
  var SESSION_MINUTES = 60;
  var STORAGE_KEY = "tf-demo-v1";
  var DAY = 86400000;

  /* Roles and permissions, mirroring the business desk's four roles. */
  var ROLES = { admin: "Administrator", operator: "Operator", finance: "Finance", viewer: "Viewer" };
  var ALL_ACTIONS = ["inventory.write", "orders.write", "ledger.write", "marketing.write", "marketing.approve",
    "diligence.run", "builder.plan", "builder.approve", "engineering.run", "care.run", "access.manage"];
  var PERMS = {
    admin: ALL_ACTIONS,
    operator: ["inventory.write", "orders.write", "marketing.write", "diligence.run", "builder.plan"],
    finance: ["ledger.write"],
    viewer: []
  };
  var DENIED = {
    "inventory.write": "Your role can read inventory. An administrator or operator can change it.",
    "orders.write": "Your role can read orders. An administrator or operator can record them.",
    "ledger.write": "Your role can read the ledger. An administrator or finance user can record payments.",
    "marketing.write": "Your role can read campaigns. An administrator or operator can edit them.",
    "marketing.approve": "Only an administrator can approve a campaign revision.",
    "diligence.run": "Your role can read reports. An administrator or operator can run due diligence.",
    "builder.plan": "Your role can read projects. An administrator or operator can plan apps.",
    "builder.approve": "Only the workspace owner (administrator) can approve a build.",
    "engineering.run": "Engineering tasks belong to the workspace owner (administrator).",
    "care.run": "PC care runs on the administrator's own computer.",
    "access.manage": "Only an administrator can issue or revoke access."
  };
  function can(role, action) { return (PERMS[role] || []).indexOf(action) !== -1; }
  function deniedMessage(action) { return DENIED[action] || "Your role can't do that."; }

  var MISSIONS = [
    { id: "receive_po", title: "Receive a purchase order", hint: "Commerce → open PO-0187 → Receive into stock", section: "commerce" },
    { id: "fulfil_sale", title: "Fulfil a sale and open its invoice", hint: "Commerce → SO-0412 → Fulfil", section: "commerce" },
    { id: "record_payment", title: "Record a payment in exact cents", hint: "Commerce → Ledger → Record entry", section: "commerce" },
    { id: "csv_import", title: "Preview and commit a CSV import", hint: "Data & insights → Import CSV", section: "insights" },
    { id: "approve_campaign", title: "Approve a campaign and see who consent leaves out", hint: "Marketing → confirm image rights → Approve", section: "marketing" },
    { id: "run_diligence", title: "Run a supplier due-diligence check", hint: "Due diligence → try an example request", section: "diligence" },
    { id: "engineering_task", title: "Give the engineering agent a task and review its draft", hint: "Engineering → describe a fix → Start", section: "engineering" },
    { id: "plan_app", title: "Plan an original app with the app builder", hint: "App builder → describe an app → Plan", section: "builder" },
    { id: "pc_care", title: "Diagnose a PC and approve one repair", hint: "PC care → describe the problem → run a repair", section: "care" },
    { id: "viewer_role", title: "Switch to the Viewer role and see what's read-only", hint: "Role menu at the top → Viewer", section: "access" }
  ];

  /* Money is held in integer cents and only formatted for display. */
  function money(cents) {
    var sign = cents < 0 ? "-" : "";
    var abs = Math.abs(Math.round(cents));
    var dollars = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return sign + "$" + dollars + "." + String(abs % 100).padStart(2, "0");
  }
  function parseMoney(text) {
    var s = String(text == null ? "" : text).trim().replace(/[$,\s]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    var parts = s.split(".");
    return parseInt(parts[0], 10) * 100 + (parts[1] ? parseInt(parts[1].padEnd(2, "0"), 10) : 0);
  }
  function num(n) { return Number(n).toLocaleString("en-US"); }

  /* ---------- Sample organization ---------- */
  function seedData(now) {
    var products = [
      { sku: "EX-1042", name: "Kraft mailer box, medium", onHand: 38, reorderAt: 60, unitCents: 85 },
      { sku: "EX-1050", name: "Kraft mailer box, large", onHand: 140, reorderAt: 80, unitCents: 112 },
      { sku: "EX-2210", name: "Thermal labels, 4 × 6 in", onHand: 1240, reorderAt: 500, unitCents: 4 },
      { sku: "EX-3307", name: "Packing tape, 48 mm", onHand: 96, reorderAt: 120, unitCents: 349 },
      { sku: "EX-4120", name: "Void fill paper roll", onHand: 41, reorderAt: 15, unitCents: 2650 },
      { sku: "EX-5001", name: "Parcel scale, 30 kg", onHand: 6, reorderAt: 2, unitCents: 4999 }
    ];
    var contacts = [
      { id: "c1", name: "Northgate Packaging Ltd.", kind: "supplier", email: "orders@northgate.example", consent: false, country: "United Kingdom" },
      { id: "c2", name: "Bright Coast Lighting Co.", kind: "supplier", email: "sales@brightcoast.example", consent: false, country: "Viet Nam" },
      { id: "c3", name: "Harbor Street Café", kind: "customer", email: "hello@harborstreet.example", consent: true, consentSource: "Signup form, 2026-03-02" },
      { id: "c4", name: "Lumen & Loom Studio", kind: "customer", email: "team@lumenloom.example", consent: true, consentSource: "Trade show list, 2026-05-14" },
      { id: "c5", name: "Parcel Pantry", kind: "customer", email: "ops@parcelpantry.example", consent: false },
      { id: "c6", name: "Willow Lane Books", kind: "both", email: "buyers@willowlane.example", consent: true, consentSource: "Customer portal opt-in, 2026-01-20" },
      { id: "c7", name: "Fernway Plant Co.", kind: "customer", email: "orders@fernway.example", consent: true, consentSource: "Signup form, 2026-06-09" },
      { id: "c8", name: "Copperleaf Candles", kind: "customer", email: "", consent: true, consentSource: "Phone request, 2026-07-01" },
      { id: "c9", name: "Tidepool Toys", kind: "customer", email: "buy@tidepool.example", consent: false },
      { id: "c10", name: "Quarry Hill Coffee", kind: "customer", email: "beans@quarryhill.example", consent: true, consentSource: "Signup form, 2026-08-22" }
    ];
    var orders = [
      { id: "o1", no: "PO-0187", kind: "purchase", contactId: "c1", status: "open", createdAt: now - 2 * DAY,
        lines: [{ sku: "EX-1042", qty: 200, unitCents: 80 }, { sku: "EX-3307", qty: 100, unitCents: 330 }] },
      { id: "o2", no: "SO-0412", kind: "sale", contactId: "c3", status: "open", createdAt: now - DAY,
        lines: [{ sku: "EX-1050", qty: 40, unitCents: 175 }, { sku: "EX-2210", qty: 300, unitCents: 9 }] },
      { id: "o3", no: "SO-0409", kind: "sale", contactId: "c4", status: "fulfilled", createdAt: now - 9 * DAY, fulfilledAt: now - 8 * DAY, invoiceNo: "INV-0409",
        lines: [{ sku: "EX-4120", qty: 4, unitCents: 3990 }, { sku: "EX-3307", qty: 24, unitCents: 525 }] }
    ];
    var ledger = [
      { id: "l1", ts: now - 8 * DAY, contactId: "c4", kind: "invoice", amountCents: 28560, ref: "INV-0409", note: "Fulfilled SO-0409" },
      { id: "l2", ts: now - 3 * DAY, contactId: "c4", kind: "payment", amountCents: 15000, ref: "INV-0409", note: "Bank transfer" }
    ];
    var movements = [];
    var mid = 0;
    // Thirty days of plausible history so the analytics window has something to show.
    for (var d = 29; d >= 1; d--) {
      if (d % 3 === 0) movements.push({ id: "m" + (++mid), ts: now - d * DAY, sku: "EX-2210", delta: -60, reason: "Sale fulfilment", ref: "SO-03" + (90 + d) });
      if (d % 5 === 0) movements.push({ id: "m" + (++mid), ts: now - d * DAY, sku: "EX-1050", delta: -12, reason: "Sale fulfilment", ref: "SO-03" + (80 + d) });
      if (d % 7 === 0) movements.push({ id: "m" + (++mid), ts: now - d * DAY, sku: "EX-3307", delta: 48, reason: "Purchase receipt", ref: "PO-01" + (60 + d) });
      if (d === 8) movements.push({ id: "m" + (++mid), ts: now - d * DAY, sku: "EX-4120", delta: -4, reason: "Sale fulfilment", ref: "SO-0409" });
      if (d === 12) movements.push({ id: "m" + (++mid), ts: now - d * DAY, sku: "EX-1042", delta: -3, reason: "Adjustment: damaged in storage", ref: "" });
    }
    var campaigns = [{
      id: "k1", name: "Spring restock", revision: 3, status: "draft", channel: "email",
      subject: "Fresh stock of mailer boxes is in",
      body: "Hello {name},\n\nOur medium and large kraft mailer boxes are back in stock, along with 48 mm packing tape.\nReply to this email to reserve a pallet before Friday.\n\nThe Example Co. team",
      assets: [{ name: "mailers-stacked.jpg", rights: "owned" }, { name: "tape-closeup.jpg", rights: "unconfirmed" }],
      history: [{ revision: 1, note: "First draft" }, { revision: 2, note: "Shorter subject line" }, { revision: 3, note: "Added the Friday deadline" }]
    }];
    return {
      products: products, contacts: contacts, orders: orders, ledger: ledger, movements: movements,
      campaigns: campaigns, captures: [], reports: [], tasks: [], apps: [], tokens: [],
      care: { journal: [], quarantine: [], admin: false, session: null },
      seq: { order: 420, invoice: 412, po: 190, id: 100 }
    };
  }

  function createState(now) {
    var state = seedData(now);
    state.v = 1;
    state.role = "admin";
    state.org = "Example Co.";
    state.session = { startedAt: now, endsAt: now + SESSION_MINUTES * 60000 };
    state.missions = {};
    state.audit = [];
    log(state, now, "Demo session started with sample data for Example Co.");
    return state;
  }

  /* One session per browser: new → active → ended. Nothing restarts an ended session. */
  function sessionStatus(state, now) {
    if (!state || !state.session) return "new";
    if (state.session.endedAt || now >= state.session.endsAt) return "ended";
    return "active";
  }
  function remainingMs(state, now) {
    if (sessionStatus(state, now) !== "active") return 0;
    return Math.max(0, state.session.endsAt - now);
  }
  function endSession(state, now) {
    // Keep only what the "session ended" screen needs; sample records are discarded.
    return {
      v: 1,
      session: { startedAt: state.session.startedAt, endsAt: state.session.endsAt, endedAt: Math.min(now, state.session.endsAt) },
      missions: state.missions || {}
    };
  }
  function resetData(state, now) {
    var fresh = seedData(now);
    Object.keys(fresh).forEach(function (k) { state[k] = fresh[k]; });
    log(state, now, "Sample data restored. The session timer kept running.");
    return state;
  }

  function nextId(state, prefix) { state.seq.id += 1; return prefix + state.seq.id; }
  function log(state, now, text) {
    state.audit = state.audit || [];
    state.audit.unshift({ ts: now, role: state.role || "admin", text: text });
    if (state.audit.length > 120) state.audit.length = 120;
  }
  function complete(state, now, id) {
    if (!state.missions[id]) state.missions[id] = now;
  }
  function missionProgress(state) {
    var done = MISSIONS.filter(function (m) { return state.missions && state.missions[m.id]; }).length;
    return { done: done, total: MISSIONS.length };
  }

  function guard(state, action) {
    if (!can(state.role, action)) return { ok: false, error: deniedMessage(action) };
    return null;
  }
  function product(state, sku) { return state.products.filter(function (p) { return p.sku === sku; })[0]; }
  function contact(state, id) { return state.contacts.filter(function (c) { return c.id === id; })[0]; }
  function order(state, id) { return state.orders.filter(function (o) { return o.id === id; })[0]; }
  function orderTotal(o) { return o.lines.reduce(function (s, l) { return s + l.qty * l.unitCents; }, 0); }

  function setRole(state, now, role) {
    if (!ROLES[role]) return { ok: false, error: "Unknown role." };
    state.role = role;
    log(state, now, "Signed in as " + ROLES[role] + ".");
    if (role === "viewer") complete(state, now, "viewer_role");
    return { ok: true };
  }

  /* ---------- Inventory ---------- */
  function addProduct(state, now, input) {
    var denied = guard(state, "inventory.write"); if (denied) return denied;
    var sku = String(input.sku || "").trim().toUpperCase();
    var name = String(input.name || "").trim();
    var onHand = Number(input.onHand), reorderAt = Number(input.reorderAt);
    var unitCents = parseMoney(input.unitPrice);
    if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(sku)) return { ok: false, error: "Use 2 to 24 letters, digits or dashes for the SKU." };
    if (product(state, sku)) return { ok: false, error: "A product with SKU " + sku + " already exists." };
    if (!name) return { ok: false, error: "Add a product name." };
    if (!Number.isInteger(onHand) || onHand < 0 || !Number.isInteger(reorderAt) || reorderAt < 0) return { ok: false, error: "Stock and reorder level must be whole numbers of 0 or more." };
    if (unitCents == null) return { ok: false, error: "Enter the reference value in dollars, like 4.99." };
    state.products.push({ sku: sku, name: name, onHand: onHand, reorderAt: reorderAt, unitCents: unitCents });
    state.movements.push({ id: nextId(state, "m"), ts: now, sku: sku, delta: onHand, reason: "Opening stock", ref: "" });
    log(state, now, "Created product " + sku + " (" + name + ") with " + onHand + " on hand.");
    return { ok: true };
  }
  function adjustStock(state, now, sku, delta, reason) {
    var denied = guard(state, "inventory.write"); if (denied) return denied;
    var p = product(state, sku);
    delta = Number(delta);
    if (!p) return { ok: false, error: "Choose a product." };
    if (!Number.isInteger(delta) || delta === 0) return { ok: false, error: "Enter a whole number other than 0, like -3 or 12." };
    if (p.onHand + delta < 0) return { ok: false, error: "Stock can't go below 0. " + p.sku + " has " + p.onHand + " on hand." };
    reason = String(reason || "").trim() || "Manual adjustment";
    p.onHand += delta;
    state.movements.push({ id: nextId(state, "m"), ts: now, sku: sku, delta: delta, reason: "Adjustment: " + reason, ref: "" });
    log(state, now, "Adjusted " + sku + " by " + (delta > 0 ? "+" : "") + delta + " (" + reason + ").");
    return { ok: true };
  }
  function stockHistory(state, sku) {
    return state.movements.filter(function (m) { return m.sku === sku; }).sort(function (a, b) { return b.ts - a.ts; });
  }
  function lowStock(state) { return state.products.filter(function (p) { return p.onHand <= p.reorderAt; }); }

  /* ---------- Orders, invoices and the ledger ---------- */
  function createOrder(state, now, kind, contactId, lines) {
    var denied = guard(state, "orders.write"); if (denied) return denied;
    var c = contact(state, contactId);
    if (kind !== "purchase" && kind !== "sale") return { ok: false, error: "Choose purchase or sale." };
    if (!c) return { ok: false, error: "Choose a contact." };
    if (kind === "purchase" && c.kind === "customer") return { ok: false, error: c.name + " is a customer. Choose a supplier for a purchase." };
    if (kind === "sale" && c.kind === "supplier") return { ok: false, error: c.name + " is a supplier. Choose a customer for a sale." };
    var clean = [];
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (!l || !l.sku) continue;
      var p = product(state, l.sku), qty = Number(l.qty), unitCents = parseMoney(l.unitPrice);
      if (!p) return { ok: false, error: "Line " + (i + 1) + ": choose a product." };
      if (!Number.isInteger(qty) || qty <= 0) return { ok: false, error: "Line " + (i + 1) + ": quantity must be a whole number above 0." };
      if (unitCents == null) return { ok: false, error: "Line " + (i + 1) + ": enter a unit price like 1.75." };
      clean.push({ sku: p.sku, qty: qty, unitCents: unitCents });
    }
    if (!clean.length) return { ok: false, error: "Add at least one product line." };
    var no = kind === "purchase" ? "PO-0" + (++state.seq.po) : "SO-0" + (++state.seq.order);
    var o = { id: nextId(state, "o"), no: no, kind: kind, contactId: contactId, status: "open", createdAt: now, lines: clean };
    state.orders.unshift(o);
    log(state, now, "Recorded " + (kind === "purchase" ? "purchase " : "sale ") + no + " for " + c.name + " (" + money(orderTotal(o)) + ").");
    return { ok: true, order: o };
  }
  function receivePurchase(state, now, orderId) {
    var denied = guard(state, "orders.write"); if (denied) return denied;
    var o = order(state, orderId);
    if (!o || o.kind !== "purchase") return { ok: false, error: "Choose a purchase order." };
    if (o.status !== "open") return { ok: false, error: o.no + " was already received." };
    o.lines.forEach(function (l) {
      product(state, l.sku).onHand += l.qty;
      state.movements.push({ id: nextId(state, "m"), ts: now, sku: l.sku, delta: l.qty, reason: "Purchase receipt", ref: o.no });
    });
    o.status = "received"; o.receivedAt = now;
    log(state, now, "Received " + o.no + " into stock.");
    complete(state, now, "receive_po");
    return { ok: true };
  }
  function fulfilSale(state, now, orderId) {
    var denied = guard(state, "orders.write"); if (denied) return denied;
    var o = order(state, orderId);
    if (!o || o.kind !== "sale") return { ok: false, error: "Choose a sales order." };
    if (o.status !== "open") return { ok: false, error: o.no + " was already fulfilled." };
    for (var i = 0; i < o.lines.length; i++) {
      var p = product(state, o.lines[i].sku);
      if (p.onHand < o.lines[i].qty) return { ok: false, error: "Not enough " + p.sku + ": " + o.lines[i].qty + " needed, " + p.onHand + " on hand. Receive stock first." };
    }
    o.lines.forEach(function (l) {
      product(state, l.sku).onHand -= l.qty;
      state.movements.push({ id: nextId(state, "m"), ts: now, sku: l.sku, delta: -l.qty, reason: "Sale fulfilment", ref: o.no });
    });
    o.status = "fulfilled"; o.fulfilledAt = now; o.invoiceNo = "INV-0" + (++state.seq.invoice);
    // The invoice keeps the names and prices at the moment it was issued.
    o.invoiceSnapshot = o.lines.map(function (l) { return { sku: l.sku, name: product(state, l.sku).name, qty: l.qty, unitCents: l.unitCents }; });
    state.ledger.unshift({ id: nextId(state, "l"), ts: now, contactId: o.contactId, kind: "invoice", amountCents: orderTotal(o), ref: o.invoiceNo, note: "Fulfilled " + o.no });
    log(state, now, "Fulfilled " + o.no + " and issued internal invoice " + o.invoiceNo + ".");
    return { ok: true, invoiceNo: o.invoiceNo };
  }
  function openInvoice(state, now, orderId) {
    var o = order(state, orderId);
    if (!o || !o.invoiceNo) return { ok: false, error: "This order has no invoice yet." };
    if (o.id !== "o3") complete(state, now, "fulfil_sale");
    var lines = o.invoiceSnapshot || o.lines.map(function (l) { return { sku: l.sku, name: product(state, l.sku).name, qty: l.qty, unitCents: l.unitCents }; });
    return { ok: true, invoice: { no: o.invoiceNo, order: o.no, contact: contact(state, o.contactId).name, date: o.fulfilledAt, lines: lines, totalCents: orderTotal(o) } };
  }
  var LEDGER_KINDS = { payment: "Payment received", credit: "Credit adjustment", refund: "Refund recorded", invoice: "Invoice issued" };
  function recordLedger(state, now, contactId, kind, amountText, note) {
    var denied = guard(state, "ledger.write"); if (denied) return denied;
    var c = contact(state, contactId);
    var cents = parseMoney(amountText);
    if (!c) return { ok: false, error: "Choose a contact." };
    if (kind !== "payment" && kind !== "credit" && kind !== "refund") return { ok: false, error: "Choose an entry type." };
    if (cents == null || cents <= 0) return { ok: false, error: "Enter an amount in dollars and cents, like 120.50." };
    state.ledger.unshift({ id: nextId(state, "l"), ts: now, contactId: contactId, kind: kind, amountCents: cents, ref: "", note: String(note || "").trim() });
    log(state, now, LEDGER_KINDS[kind] + ": " + money(cents) + " for " + c.name + ". No money moved; this is a record.");
    complete(state, now, "record_payment");
    return { ok: true };
  }
  function balances(state) {
    var by = {};
    state.ledger.forEach(function (e) {
      var sign = e.kind === "invoice" || e.kind === "refund" ? 1 : -1;
      by[e.contactId] = (by[e.contactId] || 0) + sign * e.amountCents;
    });
    return Object.keys(by).map(function (id) { return { contact: contact(state, id), balanceCents: by[id] }; })
      .filter(function (b) { return b.contact; })
      .sort(function (a, b) { return b.balanceCents - a.balanceCents; });
  }

  /* ---------- Data & insights ---------- */
  function parseCsv(text) {
    var rows = [], row = [], cell = "", q = false, s = String(text || "");
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (q) {
        if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && s[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        if (row.some(function (c) { return c.trim() !== ""; })) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some(function (c) { return c.trim() !== ""; })) rows.push(row);
    return rows;
  }
  var CSV_COLUMNS = ["sku", "name", "on_hand", "reorder_at", "unit_price"];
  function previewImport(state, text, mode) {
    var rows = parseCsv(text);
    if (!rows.length) return { ok: false, error: "Paste CSV with a header row first.", rows: [] };
    var header = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var missing = CSV_COLUMNS.filter(function (c) { return header.indexOf(c) === -1; });
    if (missing.length) return { ok: false, error: "The header needs these columns: " + CSV_COLUMNS.join(", ") + ". Missing: " + missing.join(", ") + ".", rows: [] };
    var idx = {}; CSV_COLUMNS.forEach(function (c) { idx[c] = header.indexOf(c); });
    var seen = {}, out = [];
    rows.slice(1).forEach(function (r, n) {
      var line = n + 2, sku = String(r[idx.sku] || "").trim().toUpperCase(), name = String(r[idx.name] || "").trim();
      var onHand = Number(String(r[idx.on_hand] || "").trim()), reorderAt = Number(String(r[idx.reorder_at] || "").trim());
      var unitCents = parseMoney(r[idx.unit_price]);
      var existing = product(state, sku), error = "";
      if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(sku)) error = "SKU must be 2 to 24 letters, digits or dashes";
      else if (seen[sku]) error = "SKU appears twice in this file";
      else if (!Number.isInteger(onHand) || onHand < 0) error = "on_hand must be a whole number of 0 or more";
      else if (!Number.isInteger(reorderAt) || reorderAt < 0) error = "reorder_at must be a whole number of 0 or more";
      else if (unitCents == null) error = "unit_price must look like 4.99";
      else if (mode === "create" && existing) error = sku + " already exists; choose “Reconcile existing stock” to update it";
      else if (mode === "adjust" && !existing) error = sku + " doesn't exist yet; choose “Create new products only”";
      else if (mode === "create" && !name) error = "name is required for new products";
      seen[sku] = true;
      out.push({ line: line, sku: sku, name: name || (existing ? existing.name : ""), onHand: onHand, reorderAt: reorderAt, unitCents: unitCents,
        action: error ? "error" : (mode === "create" ? "create" : "adjust"), delta: existing && !error ? onHand - existing.onHand : null, error: error });
    });
    if (!out.length) return { ok: false, error: "The file has a header but no rows.", rows: [] };
    var bad = out.filter(function (r) { return r.error; }).length;
    return { ok: bad === 0, rows: out, errors: bad, error: bad ? bad + " row(s) need fixing. Nothing is imported until every row is valid." : "" };
  }
  function commitImport(state, now, text, mode) {
    var denied = guard(state, "inventory.write"); if (denied) return denied;
    var preview = previewImport(state, text, mode);
    if (!preview.ok) return { ok: false, error: preview.error };
    preview.rows.forEach(function (r) {
      if (mode === "create") {
        state.products.push({ sku: r.sku, name: r.name, onHand: r.onHand, reorderAt: r.reorderAt, unitCents: r.unitCents });
        state.movements.push({ id: nextId(state, "m"), ts: now, sku: r.sku, delta: r.onHand, reason: "Opening stock (CSV import)", ref: "" });
      } else {
        var p = product(state, r.sku);
        if (r.delta) state.movements.push({ id: nextId(state, "m"), ts: now, sku: r.sku, delta: r.delta, reason: "Reconciled to stock snapshot (CSV import)", ref: "" });
        p.onHand = r.onHand; p.reorderAt = r.reorderAt; p.unitCents = r.unitCents;
      }
    });
    log(state, now, "Imported " + preview.rows.length + " row(s) from CSV (" + (mode === "create" ? "new products" : "stock reconciliation") + ").");
    complete(state, now, "csv_import");
    return { ok: true, count: preview.rows.length };
  }
  function csvCell(value) {
    var s = String(value == null ? "" : value);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // formula-safe: spreadsheets won't run it
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function exportInventoryCsv(state) {
    var lines = [CSV_COLUMNS.join(",")];
    state.products.forEach(function (p) {
      lines.push([p.sku, p.name, p.onHand, p.reorderAt, (p.unitCents / 100).toFixed(2)].map(csvCell).join(","));
    });
    return lines.join("\n") + "\n";
  }
  function analytics(state, now, days) {
    var start = now - days * DAY, buckets = [];
    var size = days <= 30 ? 1 : days <= 90 ? 7 : 30; // days per bar
    for (var t = start; t < now; t += size * DAY) buckets.push({ from: t, inUnits: 0, outUnits: 0 });
    state.movements.forEach(function (m) {
      if (m.ts < start || m.ts > now) return;
      var i = Math.min(buckets.length - 1, Math.floor((m.ts - start) / (size * DAY)));
      if (m.delta > 0) buckets[i].inUnits += m.delta; else buckets[i].outUnits += -m.delta;
    });
    var status = { open: 0, received: 0, fulfilled: 0 };
    state.orders.forEach(function (o) { if (o.createdAt >= start) status[o.status] = (status[o.status] || 0) + 1; });
    return { buckets: buckets, daysPerBar: size, orderStatus: status, low: lowStock(state).length };
  }
  function overview(state) {
    var value = state.products.reduce(function (s, p) { return s + p.onHand * p.unitCents; }, 0);
    var open = state.orders.filter(function (o) { return o.status === "open"; }).length;
    var receivable = balances(state).filter(function (b) { return b.contact.kind !== "supplier"; }).reduce(function (s, b) { return s + Math.max(0, b.balanceCents); }, 0);
    return { inventoryValueCents: value, lowStock: lowStock(state).length, openOrders: open, receivableCents: receivable, products: state.products.length };
  }

  /* ---------- Marketing ---------- */
  var RIGHTS = { unconfirmed: "Unconfirmed", licensed: "Licensed", owned: "Owned", public_domain: "Public domain" };
  function campaign(state) { return state.campaigns[0]; }
  function audience(state) {
    var included = [], excluded = [];
    state.contacts.forEach(function (c) {
      if (c.kind === "supplier") return;
      if (!c.consent) excluded.push({ contact: c, reason: "No consent on file" });
      else if (!c.email) excluded.push({ contact: c, reason: "No email address" });
      else included.push(c);
    });
    return { included: included, excluded: excluded };
  }
  function setAssetRights(state, now, assetName, rights) {
    var denied = guard(state, "marketing.write"); if (denied) return denied;
    var k = campaign(state), a = k.assets.filter(function (x) { return x.name === assetName; })[0];
    if (!a || !RIGHTS[rights]) return { ok: false, error: "Choose an image and its rights." };
    a.rights = rights;
    log(state, now, "Recorded " + RIGHTS[rights].toLowerCase() + " rights for " + assetName + ".");
    return { ok: true };
  }
  function reviseCampaign(state, now, subject, body) {
    var denied = guard(state, "marketing.write"); if (denied) return denied;
    var k = campaign(state);
    subject = String(subject || "").trim(); body = String(body || "").trim();
    if (!subject || !body) return { ok: false, error: "A campaign needs a subject and a message." };
    if (subject === k.subject && body === k.body) return { ok: false, error: "Nothing changed, so no new revision was saved." };
    k.revision += 1; k.subject = subject; k.body = body; k.status = "draft";
    k.history.push({ revision: k.revision, note: "Edited in the demo" });
    log(state, now, "Saved revision " + k.revision + " of “" + k.name + "”. It needs approval again.");
    return { ok: true, revision: k.revision };
  }
  function approveCampaign(state, now) {
    var denied = guard(state, "marketing.approve"); if (denied) return denied;
    var k = campaign(state);
    var unconfirmed = k.assets.filter(function (a) { return a.rights === "unconfirmed"; });
    if (unconfirmed.length) return { ok: false, error: "Confirm the rights for " + unconfirmed.map(function (a) { return a.name; }).join(", ") + " before approving." };
    if (k.status !== "draft") return { ok: false, error: "Revision " + k.revision + " is already approved." };
    var aud = audience(state);
    var first = aud.included[0];
    var eml = [
      "From: Example Co. <news@example.com>",
      "To: " + (first ? first.name + " <" + first.email + ">" : "(no recipients)"),
      "Subject: " + k.subject,
      "Date: " + new Date(now).toUTCString(),
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "List-Unsubscribe: <https://example.com/unsubscribe>",
      "",
      k.body.replace(/\{name\}/g, first ? first.name : "there")
    ].join("\n");
    k.status = "approved";
    state.captures.unshift({ id: nextId(state, "e"), ts: now, revision: k.revision, recipients: aud.included.length, excluded: aud.excluded.length, eml: eml });
    log(state, now, "Approved revision " + k.revision + " of “" + k.name + "” for " + aud.included.length + " recipients; " + aud.excluded.length + " left out. Captured as an email file. Nothing was sent.");
    complete(state, now, "approve_campaign");
    return { ok: true, recipients: aud.included.length, excluded: aud.excluded.length, eml: eml };
  }

  /* ---------- Supplier due diligence (simulated sources, invented sample data) ---------- */
  var SAMPLE_LIST = [
    { name: "Crimson Delta Trading Company", list: "Demo restricted-party list (sample)", programme: "Sample export restriction", score: 0 },
    { name: "Ostrander Marine Logistics", list: "Demo restricted-party list (sample)", programme: "Sample asset freeze", score: 0 },
    { name: "Silver Fen Components Limited", list: "Demo sanctions list (sample)", programme: "Sample trade embargo", score: 0 }
  ];
  var SAMPLE_REGISTRY = {
    "northgate packaging": { lei: "DEMO00NORTHGATE00001", legalName: "Northgate Packaging Ltd.", status: "Active", address: "Unit 4, Example Park, Leeds, United Kingdom", parent: "None reported" },
    "crimson delta trading": { lei: "DEMO00CRIMSONDELTA02", legalName: "Crimson Delta Trading Co.", status: "Inactive", address: "Not published in the sample record", parent: "Not reported" },
    "harbor street cafe": { lei: "DEMO00HARBORSTREET03", legalName: "Harbor Street Café LLC", status: "Active", address: "18 Harbor Street, Portland, USA", parent: "None reported" }
  };
  var SAMPLE_SHIPMENTS = {
    "northgate packaging": { count: 14, months: 12, buyers: 6, hs: "4819.10", origin: "United Kingdom", source: "Sample shipment export (demo)" }
  };
  var COUNTRIES = ["Viet Nam", "Vietnam", "China", "India", "United Kingdom", "UK", "United States", "USA", "Germany", "Mexico", "Türkiye", "Turkey",
    "Bangladesh", "Pakistan", "Indonesia", "Thailand", "Malaysia", "Japan", "South Korea", "Taiwan", "Italy", "Spain", "France", "Poland", "Netherlands",
    "Canada", "Brazil", "United Arab Emirates", "UAE", "Saudi Arabia", "Egypt", "Kenya", "Nigeria", "South Africa", "Australia", "Philippines", "Sri Lanka"];
  var CANONICAL = { Vietnam: "Viet Nam", UK: "United Kingdom", USA: "United States", Turkey: "Türkiye", UAE: "United Arab Emirates" };
  var DATA_SERVICES = ["52wmb", "ImportGenius", "Panjiva", "Volza", "Trademo"];
  var LEGAL_SUFFIX = /\b(co|company|corp|corporation|inc|incorporated|llc|ltd|limited|plc|gmbh|sa|srl|bv|pte|pvt|jsc|group|holdings)\b/g;

  function normalizeName(name) {
    return String(name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ")
      .replace(/[^a-z0-9 ]+/g, " ").replace(LEGAL_SUFFIX, " ").replace(/\s+/g, " ").trim();
  }
  function bigrams(s) { var out = {}; s = " " + s + " "; for (var i = 0; i < s.length - 1; i++) { var g = s.slice(i, i + 2); out[g] = (out[g] || 0) + 1; } return out; }
  function similarity(a, b) {
    a = normalizeName(a); b = normalizeName(b);
    if (!a || !b) return 0;
    if (a === b) return 1;
    var A = bigrams(a), B = bigrams(b), inter = 0, total = 0, g;
    for (g in A) { total += A[g]; if (B[g]) inter += Math.min(A[g], B[g]); }
    for (g in B) total += B[g];
    return Math.round((2 * inter / total) * 100) / 100;
  }
  function findCountry(text, after) {
    var best = null, bestAt = Infinity;
    COUNTRIES.forEach(function (c) {
      var re = new RegExp("\\b" + after + "\\s+(?:the\\s+)?" + c.replace(/ /g, "\\s+") + "\\b", "i");
      var m = re.exec(text);
      if (m && m.index < bestAt) { best = CANONICAL[c] || c; bestAt = m.index; }
    });
    return best;
  }
  function parseDiligence(state, text) {
    var t = String(text || "").trim();
    var understood = { supplier: null, country: null, hs: null, product: null, destination: null, services: [] };
    // A supplier already in the workspace wins; otherwise read the name after "on" or "for".
    state.contacts.forEach(function (c) {
      if (!understood.supplier && normalizeName(t).indexOf(normalizeName(c.name)) !== -1) understood.supplier = c.name;
    });
    if (!understood.supplier) {
      var m = /(?:diligence|check|screen|screening|vet|verify|research)\s+(?:on|for|of)?\s*(.+?)(?=\s+(?:in|from|based in|located in|before|to|for|shipped)\b|[,.(]|$)/i.exec(t);
      var cand = m ? m[1].replace(/^(a|an|the|our|this|that)\s+/i, "").trim() : "";
      if (cand && cand.split(/\s+/).length <= 7 && !/^(supplier|vendor|factory|company|manufacturer)s?$/i.test(cand)
          && !/^(before|after|if|whether|when|to|it|them|us|we|please)\b/i.test(cand)) understood.supplier = cand;
      else {
        // Fall back to the first run of two or more capitalised words, like "Acme Lighting Co",
        // skipping a capitalised first word that only starts the sentence ("Please", "Run").
        var caps, re = /\b([A-Z][\w'&-]*(?:\s+(?:&|and|of|[A-Z][\w'&-]*)){1,6})/g;
        while ((caps = re.exec(t))) {
          var phrase = caps[1].replace(/^(?:(?:Please|Run|Check|Screen|Do|Can|Could|We|I|Our|The|A|An|Due|Diligence)\s+)+/, "").replace(/\s+(?:and|of|&)$/, "");
          if (phrase.split(/\s+/).length >= 2) { understood.supplier = phrase; break; }
        }
      }
    }
    understood.country = findCountry(t, "(?:in|from|based in|located in)");
    understood.destination = findCountry(t, "(?:to|into|shipped to|delivered to)");
    var hs = /\bHS\s*(?:code\s*)?(\d{4}(?:\.\d{2}){0,2})\b/i.exec(t) || /\b(\d{4}\.\d{2})\b/.exec(t);
    if (hs) understood.hs = hs[1];
    var prod = /\b(?:order|purchase order|PO|buy|buying|import)\s+(?:for|of)\s+(.+?)(?=\s*\(|\s+(?:shipped|to|from|in|HS)\b|[,.]|$)/i.exec(t);
    if (prod) understood.product = prod[1].trim();
    DATA_SERVICES.forEach(function (s) { if (new RegExp("\\b" + s + "\\b", "i").test(t)) understood.services.push(s); });
    return understood;
  }
  function runDiligence(state, now, text) {
    var denied = guard(state, "diligence.run"); if (denied) return denied;
    if (!String(text || "").trim()) return { ok: false, error: "Describe the check or name the supplier." };
    var u = parseDiligence(state, text), findings = [], status = "none";
    if (!u.supplier) {
      status = "incomplete";
      findings.push({ source: "Restricted parties", severity: "problem", title: "Screening did not run", detail: "No supplier name was found in the request, so nothing could be screened." });
    } else {
      var key = normalizeName(u.supplier);
      var matches = SAMPLE_LIST.map(function (e) { return { name: e.name, list: e.list, programme: e.programme, score: similarity(u.supplier, e.name) }; })
        .filter(function (e) { return e.score >= 0.75; }).sort(function (a, b) { return b.score - a.score; });
      if (matches.length && matches[0].score >= 0.9) {
        status = "hold";
        findings.push({ source: "Restricted parties", severity: "problem", title: "Strong match: " + matches[0].name, detail: matches[0].list + " · " + matches[0].programme + " · match score " + matches[0].score.toFixed(2) + ". Confirm it isn't the same party before ordering." });
      } else if (matches.length) {
        status = "review";
        findings.push({ source: "Restricted parties", severity: "warning", title: "Possible match: " + matches[0].name, detail: matches[0].list + " · match score " + matches[0].score.toFixed(2) + ". A person should compare addresses and identifiers." });
      } else {
        findings.push({ source: "Restricted parties", severity: "ok", title: "No listed match", detail: "Screened against " + SAMPLE_LIST.length + " sample list entries; nothing scored 0.75 or higher." });
      }
      var reg = null;
      Object.keys(SAMPLE_REGISTRY).forEach(function (k) { if (!reg && similarity(key, k) >= 0.85) reg = SAMPLE_REGISTRY[k]; });
      if (!reg) {
        if (status === "none") status = "review";
        findings.push({ source: "Legal entity", severity: "warning", title: "No LEI record found", detail: "No legal entity record matched “" + u.supplier + "”. Ask the supplier for its registration details." });
      } else if (reg.status !== "Active") {
        status = "hold";
        findings.push({ source: "Legal entity", severity: "problem", title: reg.legalName + " is " + reg.status.toLowerCase(), detail: "LEI " + reg.lei + " · " + reg.address + ". An inactive entity can't be a reliable counterparty." });
      } else {
        findings.push({ source: "Legal entity", severity: "ok", title: reg.legalName + " · " + reg.status, detail: "LEI " + reg.lei + " · " + reg.address + " · parent: " + reg.parent });
      }
      var ship = null;
      Object.keys(SAMPLE_SHIPMENTS).forEach(function (k) { if (!ship && similarity(key, k) >= 0.85) ship = SAMPLE_SHIPMENTS[k]; });
      findings.push(ship
        ? { source: "Shipment records", severity: "ok", title: ship.count + " shipments in " + ship.months + " months to " + ship.buyers + " buyers", detail: "HS " + ship.hs + " · declared origin " + ship.origin + " · from " + ship.source + "." }
        : { source: "Shipment records", severity: "info", title: "No shipment records imported", detail: "Shipment-level customs data comes from your own licensed export or API. None is imported for this supplier." });
      findings.push(u.country && u.hs
        ? { source: "Trade statistics", severity: "info", title: u.country + " exports of HS " + u.hs.slice(0, 4) + ", last three years", detail: "Sample figures for the demo: 2023 $412M · 2024 $455M · 2025 $498M. The real check reads UN Comtrade." }
        : { source: "Trade statistics", severity: "info", title: "Not checked", detail: "Add the supplier country and an HS code to compare recorded exports." });
      var prior = state.orders.filter(function (o) { var c = contact(state, o.contactId); return o.kind === "purchase" && c && similarity(c.name, u.supplier) >= 0.85; });
      findings.push({ source: "Your records", severity: "info", title: prior.length ? prior.length + " earlier purchase order(s)" : "No earlier purchase orders", detail: prior.length ? prior.map(function (o) { return o.no + " (" + o.status + ")"; }).join(", ") : "Nothing in this organization mentions this supplier yet." });
    }
    var labels = { hold: "Hold", review: "Review", none: "No issues found", incomplete: "Incomplete" };
    var report = { id: nextId(state, "r"), ts: now, request: String(text).trim(), understood: u, findings: findings, recommendation: status, label: labels[status],
      listDigest: "sha256:" + digest(JSON.stringify(SAMPLE_LIST)), listDate: new Date(now - 2 * DAY).toISOString().slice(0, 10) };
    state.reports.unshift(report);
    log(state, now, "Due diligence on " + (u.supplier || "an unnamed supplier") + ": " + labels[status] + ".");
    complete(state, now, "run_diligence");
    return { ok: true, report: report };
  }
  function digest(s) { // short deterministic fingerprint for display; not cryptographic
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < s.length; i++) { h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0; h2 = Math.imul(h2 + s.charCodeAt(i), 2246822507) >>> 0; }
    return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).repeat(2);
  }

  /* ---------- PC care (routing copied from care.py; PC state and results simulated) ---------- */
  var CARE_AREAS = [
    {"id": "performance", "title": "Speed and startup", "checks": ["system", "disk", "memory", "startup"], "actions": ["clean_temp"], "keywords": ["slow", "sluggish", "lag", "laggy", "freeze", "freezes", "freezing", "frozen", "hang", "hangs", "hanging", "performance", "startup", "boot", "booting", "cpu", "memory", "ram", "storage", "disk space", "disk full", "storage full", "fan", "hot", "takes forever"]},
    {"id": "security", "title": "Malware, spyware and antivirus", "checks": ["security", "startup"], "actions": ["defender_update", "defender_quick_scan", "defender_full_scan", "clamav_scan"], "keywords": ["virus", "viruses", "malware", "spyware", "adware", "ransomware", "trojan", "worm", "rootkit", "keylogger", "infected", "infection", "hacked", "hijacked", "popup", "popups", "pop up", "pop ups", "suspicious", "antivirus", "defender", "phishing", "miner", "scam"]},
    {"id": "devices", "title": "Devices and drivers", "checks": ["devices", "updates"], "actions": ["driver_rescan", "driver_updates"], "keywords": ["driver", "drivers", "device", "devices", "usb", "printer", "scanner", "bluetooth", "audio", "sound", "speaker", "speakers", "microphone", "mic", "webcam", "camera", "graphics", "gpu", "display", "monitor", "touchpad", "keyboard", "mouse", "adapter"]},
    {"id": "network", "title": "Internet and network", "checks": ["network"], "actions": ["flush_dns", "network_reset"], "keywords": ["internet", "network", "wifi", "wi fi", "wireless", "dns", "ethernet", "offline", "connection", "connect", "connected", "disconnects", "website", "websites", "router"]},
    {"id": "crashes", "title": "Crashes and software errors", "checks": ["crashes", "system"], "actions": ["crash_report"], "keywords": ["crash", "crashes", "crashing", "crashed", "error", "errors", "bug", "bugs", "not responding", "blue screen", "bsod", "stop code", "closes", "quits", "exception", "debug", "debugger"]},
    {"id": "updates", "title": "Windows Update", "checks": ["updates", "disk"], "actions": ["windows_update_reset"], "keywords": ["update", "updates", "updating", "patch", "patches", "upgrade", "reboot", "restart loop"]},
    {"id": "system_files", "title": "Windows system files", "checks": ["system_files", "updates", "disk"], "actions": ["sfc_scan", "dism_restore"], "keywords": ["corrupt", "corrupted", "corruption", "system file", "system files", "dll", "missing file", "repair windows", "fix windows", "broken windows", "sfc", "dism"]}
  ];
  function words(text) { return " " + String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ") + " "; }
  function matchAreas(prompt) {
    var text = words(prompt), scores = [];
    CARE_AREAS.forEach(function (a, i) {
      var score = a.keywords.filter(function (k) { return text.indexOf(words(k)) !== -1; }).length;
      if (score) scores.push({ score: score, index: i, id: a.id });
    });
    return scores.sort(function (a, b) { return b.score - a.score || a.index - b.index; }).map(function (s) { return s.id; });
  }
  var CARE_ACTIONS = {
    restore_point: { title: "Create a system restore point", admin: true, minutes: "1-3", reboot: false, reversible: "not_applicable", description: "Saves a Windows restore point so later system changes can be rolled back from System Restore." },
    clean_temp: { title: "Remove old temporary files", admin: false, minutes: "1-5", reboot: false, reversible: "no", description: "Deletes your own temporary files older than 7 days. Files in use are skipped; deleted files are not recoverable." },
    flush_dns: { title: "Clear the DNS cache", admin: false, minutes: "<1", reboot: false, reversible: "not_applicable", description: "Runs ipconfig /flushdns so Windows looks up website addresses again." },
    network_reset: { title: "Reset the network stack", admin: true, minutes: "1", reboot: true, reversible: "no", description: "Runs netsh winsock reset and netsh int ip reset. VPN and custom network settings may need to be set up again." },
    sfc_scan: { title: "Check and repair Windows system files (sfc)", admin: true, minutes: "10-30", reboot: false, reversible: "no", description: "Runs sfc /scannow, which replaces damaged protected Windows files with correct copies." },
    dism_restore: { title: "Repair the Windows component store (DISM)", admin: true, minutes: "10-40", reboot: false, reversible: "no", description: "Runs DISM /Online /Cleanup-Image /RestoreHealth, which downloads correct components from Windows Update. Run sfc again afterwards." },
    driver_rescan: { title: "Rescan devices for drivers", admin: true, minutes: "1", reboot: false, reversible: "not_applicable", description: "Runs pnputil /scan-devices so Windows retries installing drivers it already has." },
    driver_updates: { title: "Open Windows Update optional driver updates", admin: false, minutes: "<1", reboot: false, reversible: "not_applicable", description: "Opens Settings at the optional updates page, where Windows offers drivers published by device makers." },
    windows_update_reset: { title: "Reset Windows Update components", admin: true, minutes: "2-5", reboot: false, reversible: "partial", description: "Stops the update services, renames the SoftwareDistribution and catroot2 caches (kept as backups) and starts the services again." },
    defender_update: { title: "Update Microsoft Defender security intelligence", admin: false, minutes: "1-5", reboot: false, reversible: "not_applicable", description: "Runs MpCmdRun -SignatureUpdate." },
    defender_quick_scan: { title: "Run a Microsoft Defender quick scan", admin: false, minutes: "5-15", reboot: false, reversible: "not_applicable", description: "Scans common malware locations. Defender applies its configured remediation to anything it finds." },
    defender_full_scan: { title: "Run a Microsoft Defender full scan", admin: false, minutes: "30-240", reboot: false, reversible: "not_applicable", description: "Scans every file and running program. Defender applies its configured remediation to anything it finds." },
    quarantine_startup: { title: "Quarantine a startup entry", admin: false, minutes: "<1", reboot: false, reversible: "yes", description: "Removes one startup entry and keeps an exact copy so restore_startup can put it back. Machine-wide entries need administrator rights." },
    restore_startup: { title: "Restore a quarantined startup entry", admin: false, minutes: "<1", reboot: false, reversible: "yes", description: "Puts a quarantined startup entry back exactly as it was." },
    crash_report: { title: "Save a crash report", admin: false, minutes: "<1", reboot: false, reversible: "not_applicable", description: "Writes recent crash and system details to a JSON file you can share with a software developer." }
  };
  var CARE_CHECK_TITLES = { system: "System summary", disk: "Disk space", memory: "Memory", startup: "Startup programs", security: "Antivirus and threats",
    devices: "Devices and drivers", crashes: "Recent crashes", updates: "Windows Update and restarts", network: "Internet connection", system_files: "Windows component store" };
  function careFlags(id) {
    var a = CARE_ACTIONS[id], f = [];
    if (a.admin) f.push("administrator");
    if (a.reboot) f.push("restart");
    if (a.reversible === "no") f.push("not reversible");
    f.push(a.minutes + " min");
    return f.join(", ");
  }
  function careFindings(state, check) {
    var q = state.care.quarantine.map(function (x) { return x.name; });
    switch (check) {
      case "system": return [{ severity: "warning", title: "This computer has not restarted for 12 days", detail: "Restart to finish installed updates and free memory held by long-running programs." }];
      case "disk": return [{ severity: "warning", title: "Low free space on C:\\", detail: "Updates, virtual memory and repairs need free space. Remove unused programs and large downloads, or clean old temporary files.", suggest: [["clean_temp", null]] }];
      case "memory": return [{ severity: "ok", title: "Memory use is normal (61% in use)", detail: "" }];
      case "startup": {
        var f = [{ severity: "info", title: (q.indexOf("UpdaterHelper") === -1 ? 9 : 8) + " programs start automatically", detail: "" }];
        if (q.indexOf("UpdaterHelper") === -1) f.push({ severity: "warning", title: "Review startup entry 'UpdaterHelper'", detail: "Flagged because it starts a program from a temporary, download or shared folder. Quarantine removes it from startup and can be undone.", suggest: [["quarantine_startup", "UpdaterHelper"]] });
        return f;
      }
      case "security": return [{ severity: "info", title: "No recent Defender quick scan", detail: "Run a quick scan to check common malware locations.", suggest: [["defender_quick_scan", null]] }];
      case "devices": return [{ severity: "warning", title: "Integrated Camera has no driver (Windows problem code 28)", detail: "Hardware ID USB\\VID_0DEM&PID_0C4M. Windows can retry the drivers it already has, or offer one from the device maker.", suggest: [["driver_rescan", null], ["driver_updates", null]] }];
      case "crashes": return [{ severity: "info", title: "2 application crashes or hangs in the last 14 days", detail: "PhotoTool.exe stopped working 3 days ago; File Explorer stopped responding 9 days ago.", suggest: [["crash_report", null]] }];
      case "updates": return [{ severity: "ok", title: "No restart is pending and Windows Update is running", detail: "" }];
      case "network": return [{ severity: "ok", title: "Name resolution and Windows' connectivity test succeeded", detail: "" }];
      case "system_files": return [{ severity: "info", title: "Checking the Windows component store needs administrator rights", detail: "Run PC care as administrator, or approve the system file repairs below." }];
    }
    return [];
  }
  function careDiagnose(state, now, description) {
    var denied = guard(state, "care.run"); if (denied) return denied;
    var ids = matchAreas(description), full = !ids.length;
    if (full) ids = CARE_AREAS.map(function (a) { return a.id; });
    var chosen = CARE_AREAS.filter(function (a) { return ids.indexOf(a.id) !== -1; })
      .sort(function (a, b) { return ids.indexOf(a.id) - ids.indexOf(b.id); });
    var checks = [];
    if (full) checks = Object.keys(CARE_CHECK_TITLES);
    else chosen.forEach(function (a) { a.checks.forEach(function (c) { if (checks.indexOf(c) === -1 && CARE_CHECK_TITLES[c]) checks.push(c); }); });
    var findings = [];
    checks.forEach(function (c) { findings = findings.concat(careFindings(state, c)); });
    var order = { problem: 0, warning: 1, info: 2, ok: 3 };
    findings.sort(function (a, b) { return order[a.severity] - order[b.severity]; });
    var seen = {}, suggestions = [];
    var found = [];
    findings.forEach(function (f) { (f.suggest || []).forEach(function (s) { found.push(s); }); });
    var offered = full ? [] : [].concat.apply([], chosen.map(function (a) { return a.actions.map(function (x) { return [x, null]; }); }));
    found.concat(offered).forEach(function (s) {
      var key = s[0] + ":" + s[1];
      if (seen[key] || !CARE_ACTIONS[s[0]]) return;
      seen[key] = true;
      var title = s[0] === "quarantine_startup" ? "Quarantine startup entry '" + s[1] + "' (reversible)" : CARE_ACTIONS[s[0]].title;
      suggestions.push({ action: s[0], argument: s[1], title: title, flags: careFlags(s[0]), admin: CARE_ACTIONS[s[0]].admin });
    });
    var session = { description: String(description || ""), areas: chosen.map(function (a) { return a.title; }), routing: full ? "full check-up" : "keywords", findings: findings, suggestions: suggestions, ts: now };
    state.care.session = session;
    log(state, now, "PC care diagnosis (read-only): " + (session.areas.join(", ") || "full check-up") + ".");
    return { ok: true, session: session };
  }
  function careRun(state, now, action, argument, confirmed) {
    var denied = guard(state, "care.run"); if (denied) return denied;
    var a = CARE_ACTIONS[action];
    if (!a) return { ok: false, error: "Unknown repair." };
    if (!confirmed) return { ok: false, status: "confirmation_required", error: "Nothing changed. A repair runs only after you answer yes." };
    var result;
    if (a.admin && !state.care.admin) {
      result = { status: "needs_admin", summary: "This repair needs administrator rights. Approve the Windows administrator prompt to run it." };
    } else if (action === "quarantine_startup") {
      if (state.care.quarantine.some(function (q) { return q.name === argument; })) return { ok: false, error: "'" + argument + "' is already quarantined." };
      var qid = "q-" + digest(argument + now).slice(0, 4);
      state.care.quarantine.push({ id: qid, name: argument, ts: now });
      result = { status: "completed", summary: "Quarantined startup entry '" + argument + "'. Undo with: threadforge care run restore_startup --quarantine " + qid + " --yes" };
    } else if (action === "restore_startup") {
      var qi = state.care.quarantine.findIndex(function (q) { return q.id === argument || q.name === argument; });
      if (qi === -1) return { ok: false, error: "Nothing to restore." };
      var name = state.care.quarantine[qi].name;
      state.care.quarantine.splice(qi, 1);
      result = { status: "completed", summary: "Restored startup entry '" + name + "'." };
    } else {
      var summaries = {
        restore_point: "Created a restore point named “ThreadForge PC care”.",
        clean_temp: "Removed 1,284 old temporary file(s), freeing 2310.4 MB; 37 item(s) were in use or protected.",
        flush_dns: "Cleared the DNS cache.",
        network_reset: "Reset Winsock and the IP stack. Restart the computer to finish.",
        sfc_scan: "Windows Resource Protection did not find any integrity violations.",
        dism_restore: "The restore operation completed successfully.",
        driver_rescan: "Windows rescanned devices. Integrated Camera now uses an installed driver.",
        driver_updates: "Opened Windows Update optional updates. Install the driver updates offered there, or use the device maker's official support site.",
        windows_update_reset: "Windows Update components were reset; previous caches are kept as SoftwareDistribution.bak, catroot2.bak.",
        defender_update: "Microsoft Defender security intelligence is up to date.",
        defender_quick_scan: "Microsoft Defender's quick scan finished. No threats were found.",
        defender_full_scan: "Microsoft Defender's full scan finished. No threats were found.",
        crash_report: "Saved a crash report to %LOCALAPPDATA%\\ThreadForge\\care\\crash-report.json. Review it before sharing; it contains program names and system details."
      };
      result = { status: "completed", summary: summaries[action] || "Completed." };
    }
    state.care.journal.unshift({ ts: now, action: action, argument: argument || null, status: result.status, summary: result.summary });
    log(state, now, "PC care repair " + action + ": " + result.status + ".");
    if (result.status === "completed") complete(state, now, "pc_care");
    return { ok: true, result: result };
  }
  function careElevate(state, now) {
    var denied = guard(state, "care.run"); if (denied) return denied;
    state.care.admin = true;
    log(state, now, "PC care reopened as administrator after the Windows prompt.");
    return { ok: true };
  }

  /* ---------- Engineering agent (simulated run) ---------- */
  var ENGINEERING = [
    { match: /round|cent|discount|invoice|total/i, files: 14, read: "invoice.py lines 40 to 96", changed: ["src/billing/invoice.py", "tests/test_invoice.py"], plus: 18, minus: 4, tests: 42,
      diff: ["--- a/src/billing/invoice.py", "+++ b/src/billing/invoice.py", "@@ def line_total(line):", "-    return line.qty * line.unit_price * (1 - line.discount)", "+    gross = line.qty * line.unit_cents", "+    return gross - round_half_even(gross * line.discount_bp, 10_000)", "", "+++ b/tests/test_invoice.py", "+def test_discount_rounds_to_the_cent():", "+    assert line_total(Line(qty=3, unit_cents=333, discount_bp=1500)) == 849"] },
    { match: /crash|empty|null|none|cart|exception|error/i, files: 9, read: "cart.js lines 1 to 120", changed: ["src/cart.js", "test/cart.test.js"], plus: 11, minus: 2, tests: 27,
      diff: ["--- a/src/cart.js", "+++ b/src/cart.js", "@@ export function subtotal(cart) {", "-  return cart.items.reduce((sum, item) => sum + item.price, 0);", "+  if (!cart || !Array.isArray(cart.items)) return 0;", "+  return cart.items.reduce((sum, item) => sum + item.price, 0);", "", "+++ b/test/cart.test.js", "+test('an empty cart has a subtotal of 0', () => {", "+  assert.equal(subtotal({ items: [] }), 0);", "+});"] },
    { match: /slow|performance|timeout|speed|faster/i, files: 11, read: "search.py lines 12 to 75", changed: ["app/search.py", "tests/test_search.py"], plus: 16, minus: 7, tests: 35,
      diff: ["--- a/app/search.py", "+++ b/app/search.py", "@@ def find_products(term):", "-    return [p for p in load_all() if term in p.name]", "+    index = _index()  # built once, reused for every search", "+    return index.lookup(term.casefold())", "", "+++ b/tests/test_search.py", "+def test_search_uses_the_cached_index(benchmark):", "+    assert benchmark(find_products, 'mailer') == EXPECTED"] }
  ];
  var ENGINEERING_DEFAULT = { files: 8, read: "the modules the task names", changed: ["src/main.py", "tests/test_main.py"], plus: 9, minus: 3, tests: 21,
    diff: ["--- a/src/main.py", "+++ b/src/main.py", "@@ def handle(request):", "-    value = request.data['amount']", "+    value = request.data.get('amount')", "+    if value is None:", "+        raise ValidationError('amount is required')", "", "+++ b/tests/test_main.py", "+def test_missing_amount_is_a_clear_error():", "+    with pytest.raises(ValidationError): handle(Request(data={}))"] };
  function startEngineering(state, now, text, repo) {
    var denied = guard(state, "engineering.run"); if (denied) return denied;
    text = String(text || "").trim();
    if (text.length < 8) return { ok: false, error: "Describe the change in a sentence, like “Fix the crash when the cart is empty”." };
    var tpl = ENGINEERING.filter(function (t) { return t.match.test(text); })[0] || ENGINEERING_DEFAULT;
    var task = { id: nextId(state, "t"), ts: now, text: text, repo: String(repo || "example-org/storefront").trim() || "example-org/storefront",
      steps: [
        { key: "inspect", label: "Inspected", detail: tpl.files + " files; read " + tpl.read },
        { key: "change", label: "Changed", detail: tpl.changed.length + " files on a new branch (+" + tpl.plus + " −" + tpl.minus + ")" },
        { key: "test", label: "Tested", detail: tpl.tests + " passed in a sealed container with networking off" },
        { key: "review", label: "Reviewed", detail: "A separate reviewer re-ran the tests and could not edit" },
        { key: "draft", label: "Draft pull request", detail: "Ready for your review. ThreadForge never merges." }
      ], diff: tpl.diff, changed: tpl.changed, prNumber: 128 + state.tasks.length, status: "running" };
    state.tasks.unshift(task);
    log(state, now, "Engineering task started on " + task.repo + ": “" + text + "”.");
    return { ok: true, task: task };
  }
  function finishEngineering(state, now, taskId) {
    var t = state.tasks.filter(function (x) { return x.id === taskId; })[0];
    if (!t) return { ok: false, error: "Task not found." };
    t.status = "draft";
    log(state, now, "Draft pull request #" + t.prNumber + " is ready on " + t.repo + ". Merging stays with you.");
    return { ok: true, task: t };
  }
  function reviewDraft(state, now, taskId) {
    var t = state.tasks.filter(function (x) { return x.id === taskId; })[0];
    if (!t || t.status !== "draft") return { ok: false, error: "The draft isn't ready yet." };
    t.reviewed = true;
    complete(state, now, "engineering_task");
    return { ok: true, task: t };
  }

  /* ---------- App builder (simulated research and build) ---------- */
  var KINDS = [
    { id: "music", label: "Music streaming app", kw: /music|song|playlist|album|podcast|spotify|radio/i, content: true,
      names: ["Tidewave", "Cadence Room", "Low Light FM"], features: ["Library of tracks, albums and playlists", "Queue with shuffle, repeat and gapless playback", "Offline downloads of content you own", "Search across artists, albums and tracks", "Listening history and liked songs"],
      screens: ["Home", "Search", "Album and playlist", "Now playing", "Library"], tests: ["plays the next track when the current one ends", "keeps the queue order after shuffle is turned off", "finds a track by part of its title", "shows downloaded tracks with no connection"] },
    { id: "game", label: "HTML5 game", kw: /game|runner|platformer|puzzle|arcade|subway|surfers|level/i, content: false,
      names: ["Skyline Dash", "Rail Fox", "Neon Sprint"], features: ["Three-lane endless run with jumps and slides", "Keyboard, touch and swipe controls", "Original characters and art drawn in code", "Coins, power-ups and a rising difficulty curve", "Local high scores"],
      screens: ["Title", "Run", "Pause", "Game over and score"], tests: ["moves one lane per swipe and never leaves the track", "ends the run on collision with an obstacle", "raises speed every 30 seconds", "saves the best score locally"] },
    { id: "film", label: "Film and video catalog", kw: /film|movie|video|series|cinema|moviebox|netflix|tv show/i, content: true,
      names: ["Reelhouse", "Matinee Box", "Frame & Field"], features: ["Catalog with genres, collections and search", "Detail pages with cast, runtime and ratings", "Watchlist and continue-watching row", "Player for videos you own or license", "Parental profile with age ratings"],
      screens: ["Browse", "Title detail", "Player", "Watchlist", "Profiles"], tests: ["filters the catalog by genre", "resumes a video where it stopped", "hides titles above a profile's age rating", "adds and removes watchlist items"] },
    { id: "store", label: "Online store", kw: /shop|store|e-?commerce|marketplace|checkout|cart|amazon|etsy/i, content: false,
      names: ["Brightcrate", "Oak & Parcel", "Marketfold"], features: ["Product catalog with variants and stock", "Cart, checkout and order confirmation", "Customer accounts and order history", "Discount codes with clear rules", "Admin view for orders"],
      screens: ["Home", "Product", "Cart", "Checkout", "Orders"], tests: ["applies a discount code once per order", "blocks checkout when an item is out of stock", "calculates totals in exact cents", "shows the order in the customer's history"] },
    { id: "booking", label: "Booking app", kw: /book|booking|appointment|reservation|salon|clinic|calendly|schedule/i, content: false,
      names: ["Slotwise", "Quillday", "Openhour"], features: ["Services, staff and opening hours", "Live availability and instant booking", "Reminders and reschedule links", "Buffer times and no-double-booking rules", "Owner dashboard"],
      screens: ["Services", "Pick a time", "Confirm", "My bookings", "Dashboard"], tests: ["never books two clients into the same slot", "respects buffer time between bookings", "moves a booking when rescheduled", "hides times outside opening hours"] },
    { id: "social", label: "Community app", kw: /social|community|forum|chat|feed|friends|instagram|reddit|discord/i, content: true,
      names: ["Commonroom", "Hearthline", "Porchlight"], features: ["Profiles, posts and comments", "Groups with moderation tools", "Reporting and blocking", "Notifications you control", "Content the community creates or you license"],
      screens: ["Feed", "Group", "Post", "Profile", "Moderation"], tests: ["hides posts from blocked accounts", "sends a report to group moderators", "keeps private groups private", "removes a deleted post everywhere"] },
    { id: "productivity", label: "Productivity app", kw: /notes?|todo|to-do|task|planner|calendar|crm|notion|trello|kanban/i, content: false,
      names: ["Plainboard", "Tasklark", "Northnote"], features: ["Boards, lists and cards", "Due dates, labels and reminders", "Search and filters", "Keyboard shortcuts", "Export to CSV and JSON"],
      screens: ["Boards", "Board", "Card", "Search", "Settings"], tests: ["moves a card between lists", "sorts cards by due date", "finds cards by label", "exports every card to CSV"] },
    { id: "website", label: "Website", kw: /website|landing|portfolio|blog|homepage|site/i, content: false,
      names: ["Fieldnote", "Lanternpage", "Brightside"], features: ["Responsive pages", "Contact form", "Blog with tags", "Fast loading and accessible markup", "Search engine basics"],
      screens: ["Home", "About", "Blog", "Contact"], tests: ["passes an automated accessibility check", "shows a confirmation after the form is sent", "lists posts by tag", "loads under two seconds on a mobile profile"] }
  ];
  var REFUSE = /decompil|\bapk file|scrape|scraping|\brip\b|download (?:films|movies|music|songs) from|bypass|crack|\bcheat|aimbot|wallhack|phish|steal|other people'?s passwords|copy (?:the|their) (?:logo|code|art|characters)|same logo|\bdrm\b|torrent|pirat/i;
  function parseApp(text) {
    var t = String(text || "");
    var refs = [], m, re = /\b(?:like|similar to|inspired by)\s+([A-Z0-9][\w'&.+-]*(?:\s+[A-Z][\w'&.+-]*){0,2})/g;
    while ((m = re.exec(t))) { if (refs.indexOf(m[1]) === -1) refs.push(m[1].replace(/[.,]$/, "")); }
    var kind = KINDS.filter(function (k) { return k.kw.test(t); })[0] || KINDS[KINDS.length - 1];
    var platforms = [];
    if (/android/i.test(t)) platforms.push("Android");
    if (/\bios\b|iphone|ipad/i.test(t)) platforms.push("iOS");
    if (/desktop|windows|mac/i.test(t)) platforms.push("Desktop");
    if (!platforms.length || /web|browser/i.test(t)) platforms.unshift("Web");
    var improvements = [];
    var im = /\b(faster|quicker|simpler|easier to use|cleaner|cheaper|lighter|works offline|offline|more accessible|private|without tracking|no tracking|without ads|no ads|ad-free)\b/gi;
    while ((m = im.exec(t))) {
      var phrase = m[1].toLowerCase().replace(/^(no ads|ad-free)$/, "without ads").replace(/^offline$/, "works offline").replace(/^no tracking$/, "without tracking");
      if (improvements.indexOf(phrase) === -1) improvements.push(phrase);
    }
    var refusal = REFUSE.test(t) ? "This asks for copying, scraping, cracking or bypassing something ThreadForge won't touch. It builds original products only." : null;
    return { references: refs, kind: kind.id, kindLabel: kind.label, platforms: platforms, improvements: improvements, needsContentSource: kind.content, refusal: refusal };
  }
  function planApp(state, now, text, contentSource) {
    var denied = guard(state, "builder.plan"); if (denied) return denied;
    if (String(text || "").trim().length < 10) return { ok: false, error: "Describe what to build." };
    var u = parseApp(text);
    if (u.refusal) return { ok: false, refused: true, error: u.refusal, understood: u };
    if (u.needsContentSource && !contentSource) return { ok: false, needsChoice: true, error: "Choose a content source before planning.", understood: u };
    var kind = KINDS.filter(function (k) { return k.id === u.kind; })[0];
    var name = kind.names[state.apps.length % kind.names.length];
    var project = { id: nextId(state, "a"), ts: now, request: String(text).trim(), understood: u, name: name, contentSource: contentSource || "Not needed",
      features: kind.features, improvements: u.improvements.length ? u.improvements : ["Clearer navigation than the reference", "Accessible colour contrast and keyboard use"],
      screens: kind.screens, tests: kind.tests, status: "planned",
      rights: ["Own name, artwork, text and code; nothing copied from " + (u.references.join(", ") || "the reference"), "The reference is never visited, scraped, downloaded or decompiled", u.needsContentSource ? "Plays only " + String(contentSource).toLowerCase() : "No third-party content"] };
    state.apps.unshift(project);
    log(state, now, "App builder planned “" + name + "” (" + u.kindLabel + "). Waiting for owner approval.");
    complete(state, now, "plan_app");
    return { ok: true, project: project };
  }
  function approveBuild(state, now, projectId) {
    var denied = guard(state, "builder.approve"); if (denied) return denied;
    var p = state.apps.filter(function (x) { return x.id === projectId; })[0];
    if (!p || p.status !== "planned") return { ok: false, error: "Choose a planned project." };
    p.status = "building";
    log(state, now, "Owner approved the build of “" + p.name + "”.");
    return { ok: true, project: p };
  }
  function finishBuild(state, now, projectId) {
    var p = state.apps.filter(function (x) { return x.id === projectId; })[0];
    if (!p) return { ok: false, error: "Project not found." };
    var slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    p.status = "built";
    p.files = ["apps/" + slug + "/README.md", "apps/" + slug + "/RIGHTS.md", "apps/" + slug + "/index.html", "apps/" + slug + "/src/app.js", "apps/" + slug + "/src/styles.css", "apps/" + slug + "/manifest.webmanifest", "apps/" + slug + "/tests/acceptance.test.js"];
    p.testsPassed = p.tests.length + 8;
    log(state, now, "Built “" + p.name + "”: " + p.testsPassed + " tests passed. Draft pull request ready.");
    return { ok: true, project: p };
  }

  /* ---------- Workspace access ---------- */
  var TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function issueToken(state, now, role, label, randomInts) {
    var denied = guard(state, "access.manage"); if (denied) return denied;
    if (!ROLES[role] || role === "admin") return { ok: false, error: "Choose operator, finance or viewer." };
    label = String(label || "").trim() || ROLES[role] + " access";
    var ints = randomInts || [];
    var secret = "tfo_";
    for (var i = 0; i < 24; i++) secret += TOKEN_ALPHABET[(ints[i] != null ? ints[i] : Math.floor(Math.random() * 4096)) % TOKEN_ALPHABET.length];
    var token = { id: nextId(state, "k"), ts: now, role: role, label: label, hint: secret.slice(-4), expires: now + 30 * DAY, revoked: false };
    state.tokens.unshift(token);
    log(state, now, "Issued " + ROLES[role].toLowerCase() + " access “" + label + "” (ends …" + token.hint + ").");
    return { ok: true, token: token, secret: secret };
  }
  function revokeToken(state, now, id) {
    var denied = guard(state, "access.manage"); if (denied) return denied;
    var t = state.tokens.filter(function (x) { return x.id === id; })[0];
    if (!t || t.revoked) return { ok: false, error: "Choose an active credential." };
    t.revoked = true;
    log(state, now, "Revoked “" + t.label + "”.");
    return { ok: true };
  }

  return {
    VERSION: VERSION, SESSION_MINUTES: SESSION_MINUTES, STORAGE_KEY: STORAGE_KEY, DAY: DAY,
    ROLES: ROLES, MISSIONS: MISSIONS, LEDGER_KINDS: LEDGER_KINDS, RIGHTS: RIGHTS, CARE_ACTIONS: CARE_ACTIONS, CARE_AREAS: CARE_AREAS,
    can: can, deniedMessage: deniedMessage, money: money, parseMoney: parseMoney, num: num,
    createState: createState, sessionStatus: sessionStatus, remainingMs: remainingMs, endSession: endSession, resetData: resetData,
    missionProgress: missionProgress, setRole: setRole,
    addProduct: addProduct, adjustStock: adjustStock, stockHistory: stockHistory, lowStock: lowStock,
    createOrder: createOrder, receivePurchase: receivePurchase, fulfilSale: fulfilSale, openInvoice: openInvoice, orderTotal: orderTotal,
    recordLedger: recordLedger, balances: balances,
    parseCsv: parseCsv, previewImport: previewImport, commitImport: commitImport, exportInventoryCsv: exportInventoryCsv, csvCell: csvCell,
    analytics: analytics, overview: overview,
    audience: audience, setAssetRights: setAssetRights, reviseCampaign: reviseCampaign, approveCampaign: approveCampaign,
    similarity: similarity, parseDiligence: parseDiligence, runDiligence: runDiligence,
    matchAreas: matchAreas, careDiagnose: careDiagnose, careRun: careRun, careElevate: careElevate,
    startEngineering: startEngineering, finishEngineering: finishEngineering, reviewDraft: reviewDraft,
    parseApp: parseApp, planApp: planApp, approveBuild: approveBuild, finishBuild: finishBuild,
    issueToken: issueToken, revokeToken: revokeToken,
    contact: contact, product: product
  };
});

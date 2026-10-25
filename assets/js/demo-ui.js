/* ThreadForge live demo interface. Renders the suite from the demo engine's state.
   No network requests. All text is set with textContent, never parsed as HTML. */
(function () {
  "use strict";
  var E = window.TFDemo;
  if (!E) return;

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var STEP_MS = reduceMotion ? 150 : 850;
  var $ = function (id) { return document.getElementById(id); };
  var now = function () { return Date.now(); };

  /* ---------- Storage: this browser only; the page still works if storage is blocked ---------- */
  var memory = null;
  var store = {
    load: function () {
      try { var raw = window.localStorage.getItem(E.STORAGE_KEY); return raw ? JSON.parse(raw) : memory; }
      catch (e) { return memory; }
    },
    save: function (s) {
      memory = s;
      try { window.localStorage.setItem(E.STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* in-memory only */ }
    }
  };

  var state = store.load();
  var SAMPLE_CSV = {
    create: "sku,name,on_hand,reorder_at,unit_price\nEX-6100,Bubble wrap roll 50 m,24,10,18.50\nEX-6110,Padded envelope A4,500,200,0.42\nEX-6120,\"Fragile labels, roll of 500\",12,5,6.90\n",
    adjust: "sku,name,on_hand,reorder_at,unit_price\nEX-1042,,36,60,0.85\nEX-3307,,90,120,3.49\n"
  };
  var ui = {
    section: "overview", historySku: null, invoice: null, orderFilter: "all",
    newOrder: { kind: "purchase", contactId: "", lines: [{ sku: "", qty: "", unitPrice: "" }] },
    csvMode: "create", csvText: SAMPLE_CSV.create, csvPreview: null, windowDays: 30,
    diligenceText: "", reportId: null, appText: "", appContent: "", appRun: null, appRefusal: null,
    engText: "", engRepo: "example-org/storefront", engRun: null, engReviewed: null,
    careText: "", careLines: [], careConfirm: null, careNeedsAdmin: null,
    secret: null, missionsOpen: false, confirmEnd: false, confirmReset: false, warned: false, timer: null,
    connector: { provider: "Anthropic Claude", reviewer: true, mcp: { docs: false, notes: false } }
  };

  var SECTIONS = [
    { id: "overview", label: "Overview", group: "Business desk" },
    { id: "commerce", label: "Commerce" },
    { id: "trade", label: "Trade" },
    { id: "insights", label: "Data & insights" },
    { id: "diligence", label: "Due diligence" },
    { id: "builder", label: "App builder" },
    { id: "marketing", label: "Marketing" },
    { id: "connectors", label: "AI & connectors" },
    { id: "access", label: "Workspace access" },
    { id: "engineering", label: "Engineering agent", group: "Engineering workspace" },
    { id: "care", label: "PC care", group: "Windows app" }
  ];

  /* ---------- Small DOM helpers ---------- */
  function h(tag, props) {
    var el = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else if (k === "value") el.value = v;
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  function fmtDate(ts) { return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  function fmtTime(ts) { return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
  function badge(text, kind) { return h("span", { class: "badge" + (kind ? " " + kind : ""), text: text }); }
  function sim() { return h("span", { class: "badge sim", text: "Simulated" }); }
  function btn(text, onclick, cls, extra) { return h("button", Object.assign({ class: "btn-s" + (cls ? " " + cls : ""), type: "button", onclick: onclick }, extra || {}), text); }
  function fld(label, control) { return h("label", { class: "fld" }, h("span", { text: label }), control); }
  function select(id, options, value, onchange, extra) {
    var s = h("select", Object.assign({ id: id, onchange: onchange }, extra || {}));
    options.forEach(function (o) { var opt = h("option", { value: o[0], text: o[1] }); if (o[0] === value) opt.selected = true; s.appendChild(opt); });
    return s;
  }
  function panel(title, kids, extra) { return h("section", Object.assign({ class: "panel" }, extra || {}), title ? h("h3", null, title) : null, kids); }
  function head(title, text, extra) {
    return h("div", { class: "view-head" }, h("div", null, h("h2", { id: "view-title", tabindex: "-1", text: title }), text ? h("p", { text: text }) : null), extra || null);
  }
  function table(headers, rows, cls) {
    return h("div", { class: "tbl-wrap" }, h("table", { class: "tbl" + (cls ? " " + cls : "") },
      h("thead", null, h("tr", null, headers.map(function (x) { return h("th", { scope: "col", class: x.cls || null, text: x.text || x }); }))),
      h("tbody", null, rows)));
  }
  function td(text, cls) { return h("td", { class: cls || null }, text); }
  function permitted(action) { return E.can(state.role, action); }
  function roleNote(action) { return permitted(action) ? null : h("p", { class: "note-inline", text: E.deniedMessage(action) }); }
  function download(name, text, type) {
    try {
      var url = URL.createObjectURL(new Blob([text], { type: type }));
      var a = h("a", { href: url, download: name });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    } catch (e) { toast("Your browser blocked the download.", true); }
  }

  var toastTimer = null;
  function toast(text, warn) {
    var t = $("demo-toast");
    t.textContent = text;
    t.className = "demo-toast" + (warn ? " is-warn" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.textContent = ""; }, warn ? 6000 : 4200);
  }
  function save() { store.save(state); }
  function act(result, okMessage) {
    if (!result || !result.ok) { toast((result && result.error) || "That didn't work.", true); return false; }
    save();
    if (okMessage) toast(typeof okMessage === "function" ? okMessage(result) : okMessage);
    render();
    return true;
  }

  var SIGNUP_KEY = "tf-demo-signup";
  var memorySignup = null;
  function validEmail(value) {
    var email = String(value || "").trim();
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  function loadSignup() {
    if (memorySignup && validEmail(memorySignup.email)) return memorySignup;
    try {
      var raw = JSON.parse(window.localStorage.getItem(SIGNUP_KEY) || "null");
      if (raw && validEmail(raw.email)) { memorySignup = raw; return raw; }
    } catch (e) { /* keep the form */ }
    return null;
  }
  function saveSignup(email) {
    memorySignup = { email: email.trim(), at: now() };
    try { window.localStorage.setItem(SIGNUP_KEY, JSON.stringify(memorySignup)); } catch (e) { /* this tab only */ }
    return memorySignup;
  }

  /* ---------- Gate: start, resume or ended ---------- */
  function boot() {
    var signup = loadSignup();
    var emailInput = $("demo-email");
    var emailErr = $("demo-email-err");
    if (signup && emailInput) emailInput.value = signup.email;
    function currentEmail() { return emailInput ? emailInput.value : ""; }
    function showEmailError(message) {
      if (!emailErr) return;
      emailErr.hidden = !message;
      emailErr.textContent = message || "";
    }
    if (emailInput) {
      emailInput.addEventListener("input", function () { showEmailError(""); });
    }
    var status = E.sessionStatus(state, now());
    if (signup && status === "active") { showApp(); return; }
    if (status === "ended") {
      if (state && state.products) { state = E.endSession(state, now()); save(); }
      showEnded();
      return;
    }
    var start = $("demo-start");
    var form = $("demo-signup");
    if (start) start.disabled = false;
    function begin(event) {
      if (event) event.preventDefault();
      if (!validEmail(currentEmail())) {
        showEmailError("Enter an email address to open the demo. A work or personal address is fine.");
        if (emailInput) emailInput.focus();
        return;
      }
      var signed = saveSignup(currentEmail());
      if (E.sessionStatus(state, now()) === "active") { showApp(); return; }
      state = E.createState(now());
      save();
      showApp();
      toast("Signed up as " + signed.email + ". Your 60-minute session has started.");
    }
    if (form) {
      form.addEventListener("submit", begin);
      form.addEventListener("invalid", function (event) {
        event.preventDefault();
        showEmailError("Enter an email address to open the demo. A work or personal address is fine.");
      }, true);
    }
  }

  function showEnded() {
    stopTimer();
    $("demo-app").hidden = true;
    $("demo-tools").hidden = true;
    $("demo-gate").hidden = false;
    var done = E.missionProgress(state);
    var copy = $("gate-copy");
    copy.replaceChildren(
      h("p", { class: "eyebrow", text: "Live demo · session ended" }),
      h("h1", { id: "gate-title", text: "Your demo session has ended." }),
      h("p", { class: "lead", text: "You completed " + done.done + " of " + done.total + " missions. The sample records were removed from this browser." }),
      h("p", { class: "lead", text: "If ThreadForge looks right for your team, buy it once, from $49, and run it on your PC or server with your own data. Nothing is charged after that." }),
      h("div", { class: "demo-gate-actions" },
        h("a", { class: "btn btn-primary", href: "../#pricing", text: "See the prices" }),
        h("a", { class: "btn btn-ghost", href: "../#pilot", text: "Order ThreadForge" })),
      h("p", { class: "fine" }, "Questions, or want a guided walkthrough? Email ", h("span", { class: "addr", text: "support@threadforgeofficial.com" }), ".")
    );
    markGateMissions();
  }
  function markGateMissions() {
    var items = $("gate-missions").children;
    E.MISSIONS.forEach(function (m, i) { if (items[i]) items[i].classList.toggle("is-done", !!(state && state.missions && state.missions[m.id])); });
    if (state && state.missions) $("gate-missions-title").textContent = "What you tried";
  }

  function showApp() {
    $("demo-gate").hidden = true;
    $("demo-app").hidden = false;
    $("demo-tools").hidden = false;
    var who = $("demo-who");
    var signup = loadSignup();
    if (who && signup) who.textContent = signup.email;
    var fromHash = (location.hash || "").slice(1);
    if (SECTIONS.some(function (s) { return s.id === fromHash; })) ui.section = fromHash;
    render();
    startTimer();
  }

  function startTimer() {
    stopTimer();
    tick();
    ui.timer = setInterval(tick, 1000);
  }
  function stopTimer() { if (ui.timer) clearInterval(ui.timer); ui.timer = null; }
  function tick() {
    if (E.sessionStatus(state, now()) !== "active") {
      if (state && state.products) { state = E.endSession(state, now()); save(); }
      showEnded();
      toast("Your demo session has ended.");
      return;
    }
    var ms = E.remainingMs(state, now());
    var m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
    var el = $("demo-timer");
    el.replaceChildren(h("span", { text: m + ":" + String(s).padStart(2, "0") }), h("span", { class: "timer-suffix", text: " left" }));
    el.classList.toggle("is-low", ms < 5 * 60000);
    if (ms < 5 * 60000 && !ui.warned) { ui.warned = true; toast("Five minutes left in your demo session.", true); }
  }

  /* ---------- Shell ---------- */
  function render() {
    if (!state || !state.products) return;
    $("demo-role").value = state.role;
    var p = E.missionProgress(state);
    $("demo-mission-count").textContent = p.done + "/" + p.total;
    renderNav();
    renderMissions();
    var view = $("demo-view");
    view.replaceChildren(VIEWS[ui.section]());
  }

  function openSection(id, focus) {
    ui.section = id;
    ui.missionsOpen = false;
    try { history.replaceState(null, "", "#" + id); } catch (e) { /* ignore */ }
    render();
    if (focus !== false) {
      var t = $("view-title");
      if (t) t.focus();
      if (window.innerWidth < 861) window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    }
  }

  function renderNav() {
    var pending = {};
    E.MISSIONS.forEach(function (m) { if (!state.missions[m.id]) pending[m.section] = true; });
    var nav = $("demo-nav");
    nav.replaceChildren();
    SECTIONS.forEach(function (s) {
      if (s.group) nav.appendChild(h("p", { class: "demo-nav-group", text: s.group }));
      nav.appendChild(h("button", { type: "button", "aria-current": ui.section === s.id ? "page" : null, onclick: function () { openSection(s.id); } },
        h("span", { text: s.label }), pending[s.id] ? h("span", { class: "dot", title: "A mission is waiting here", "aria-hidden": "true" }) : null));
    });
  }

  function renderMissions() {
    var box = $("demo-missions");
    var p = E.missionProgress(state);
    var bar = h("span"); bar.style.width = Math.round(100 * p.done / p.total) + "%";
    var list = h("ul", { class: "mission-list" }, E.MISSIONS.map(function (m) {
      var done = !!state.missions[m.id];
      return h("li", { class: "mission" + (done ? " is-done" : "") },
        h("span", { class: "mission-check", "aria-hidden": "true", text: "✓" }),
        h("div", null,
          h("p", { class: "mission-title" }, h("span", { class: "visually-hidden", text: done ? "Done: " : "To do: " }), m.title),
          h("p", { class: "mission-hint", text: m.hint }),
          done ? null : h("button", { type: "button", onclick: function () { openSection(m.section); }, text: "Go there" })));
    }));
    var foot = h("div", { class: "demo-missions-foot" },
      ui.confirmReset
        ? h("div", { class: "btn-row" }, h("span", { class: "note-inline", text: "Put back the original sample data? The timer keeps running." }),
            btn("Yes, restore", function () { ui.confirmReset = false; ui.historySku = null; ui.invoice = null; ui.reportId = null; ui.careLines = []; act(E.resetData(state, now()), "Sample data restored."); }, "primary"),
            btn("Cancel", function () { ui.confirmReset = false; render(); }))
        : btn("Restore sample data", function () { ui.confirmReset = true; ui.confirmEnd = false; render(); }),
      ui.confirmEnd
        ? h("div", { class: "btn-row" }, h("span", { class: "note-inline", text: "End now? This browser can't start another session." }),
            btn("Yes, end session", function () { state = E.endSession(state, now()); save(); showEnded(); }, "danger"),
            btn("Keep going", function () { ui.confirmEnd = false; render(); }))
        : btn("End session", function () { ui.confirmEnd = true; ui.confirmReset = false; render(); }, "danger"),
      h("p", { class: "note-inline", text: "Sample data stays in this browser until the session ends." }));
    box.replaceChildren(
      h("div", { class: "demo-missions-head" }, h("h2", { id: "missions-title", text: "Missions" }),
        h("button", { class: "icon-btn close", type: "button", "aria-label": "Close missions", onclick: function () { setMissions(false); } }, "×")),
      h("p", { class: "note-inline", text: p.done + " of " + p.total + " done" }),
      h("div", { class: "demo-progress", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(p.total), "aria-valuenow": String(p.done), "aria-label": "Missions done" }, bar),
      list,
      p.done === p.total ? h("div", { class: "demo-all-done" }, h("b", { text: "All ten done. You've seen the whole suite." }),
        h("span", null, "Ready to run it with your own data? ", h("a", { href: "../#pilot", text: "Order ThreadForge" }), " or ", h("a", { href: "../#pricing", text: "see pricing" }), ".")) : null,
      foot);
    box.classList.toggle("is-open", ui.missionsOpen);
    $("demo-missions-toggle").setAttribute("aria-expanded", String(ui.missionsOpen));
  }
  function setMissions(open) {
    ui.missionsOpen = open;
    var scrim = document.querySelector(".demo-scrim");
    if (open && window.innerWidth < 1280 && !scrim) document.body.appendChild(h("div", { class: "demo-scrim", onclick: function () { setMissions(false); } }));
    if (!open && scrim) scrim.remove();
    render();
    if (open) {
      var t = $("missions-title");
      if (t) { t.setAttribute("tabindex", "-1"); t.focus(); }
    }
  }

  /* ---------- Views ---------- */
  var VIEWS = {};

  VIEWS.overview = function () {
    var o = E.overview(state);
    var canInv = permitted("inventory.write");
    var rows = state.products.map(function (p) {
      var low = p.onHand <= p.reorderAt;
      return h("tr", { class: ui.historySku === p.sku ? "is-selected" : null },
        td(p.sku, "mono"), td([p.name, low ? " " : null, low ? badge("Reorder", "warn") : null]),
        td(E.num(p.onHand), "num" + (low ? " low" : "")), td(E.num(p.reorderAt), "num"), td(E.money(p.onHand * p.unitCents), "num"),
        h("td", null, h("div", { class: "actions" }, btn("History", function () { ui.historySku = p.sku; render(); }))));
    });
    var movement = { sku: state.products[0].sku };
    var mvForm = h("form", { class: "form", onsubmit: function (e) {
      e.preventDefault();
      var f = e.target;
      act(E.adjustStock(state, now(), f.elements.sku.value, f.elements.delta.value.trim() === "" ? NaN : Number(f.elements.delta.value), f.elements.reason.value), "Movement recorded.");
    } },
      h("div", { class: "form-row" },
        fld("Product", select("mv-sku", state.products.map(function (p) { return [p.sku, p.sku + " · " + p.name]; }), movement.sku, null, { name: "sku", disabled: !canInv })),
        fld("Change", h("input", { id: "mv-delta", name: "delta", type: "number", step: "1", placeholder: "-3 or 12", required: true, disabled: !canInv })),
        fld("Reason", h("input", { id: "mv-reason", name: "reason", type: "text", placeholder: "Counted, damaged…", disabled: !canInv }))),
      h("div", { class: "btn-row" }, h("button", { class: "btn-s primary", type: "submit", disabled: !canInv }, "Record movement")), roleNote("inventory.write"));
    var addForm = h("form", { class: "form", onsubmit: function (e) {
      e.preventDefault();
      var f = e.target.elements;
      act(E.addProduct(state, now(), { sku: f.sku.value, name: f.name.value, onHand: Number(f.onHand.value), reorderAt: Number(f.reorderAt.value), unitPrice: f.unitPrice.value }), "Product saved.");
    } },
      h("div", { class: "form-row" },
        fld("SKU", h("input", { id: "np-sku", name: "sku", placeholder: "EX-7001", required: true, disabled: !canInv })),
        fld("Name", h("input", { id: "np-name", name: "name", placeholder: "Stretch film", required: true, disabled: !canInv }))),
      h("div", { class: "form-row" },
        fld("On hand", h("input", { id: "np-onhand", name: "onHand", type: "number", min: "0", step: "1", value: "0", disabled: !canInv })),
        fld("Reorder at", h("input", { id: "np-reorder", name: "reorderAt", type: "number", min: "0", step: "1", value: "0", disabled: !canInv })),
        fld("Value each ($)", h("input", { id: "np-price", name: "unitPrice", inputmode: "decimal", placeholder: "4.99", required: true, disabled: !canInv }))),
      h("div", { class: "btn-row" }, h("button", { class: "btn-s primary", type: "submit", disabled: !canInv }, "Save product")));
    var history = null;
    if (ui.historySku) {
      var hp = E.product(state, ui.historySku);
      history = panel(["Stock history · ", hp.sku], [
        table(["Date", { text: "Change", cls: "num" }, "Reason", "Reference"], E.stockHistory(state, hp.sku).slice(0, 25).map(function (m) {
          return h("tr", null, td(fmtDate(m.ts) + " " + fmtTime(m.ts)), td((m.delta > 0 ? "+" : "") + E.num(m.delta), "num"), td(m.reason), td(m.ref || "—", "mono"));
        })),
        h("div", { class: "btn-row" }, btn("Close history", function () { ui.historySku = null; render(); }))
      ], { id: "stock-history" });
    }
    return h("div", null,
      head("Business overview", "Example Co.'s stock, orders and money at a glance. Every number is sample data in your browser."),
      h("div", { class: "metric-row" },
        metric(E.money(o.inventoryValueCents), "Inventory value"), metric(String(o.lowStock), "Products at or below reorder level"),
        metric(String(o.openOrders), "Open orders"), metric(E.money(o.receivableCents), "Owed by customers")),
      panel("Inventory", table(["SKU", "Product", { text: "On hand", cls: "num" }, { text: "Reorder at", cls: "num" }, { text: "Value", cls: "num" }, ""], rows)),
      history,
      h("div", { class: "grid-2" }, panel("Record a stock movement", mvForm), panel("Add a product", addForm)),
      h("div", { class: "panel" }, h("h3", { text: "Activity ledger" }), h("p", { class: "panel-note", text: "Every change is recorded with the role that made it." }),
        table(["When", "Role", "What happened"], state.audit.slice(0, 8).map(function (a) { return h("tr", null, td(fmtTime(a.ts)), td(E.ROLES[a.role] || a.role), td(a.text)); }))));
  };
  function metric(value, label) { return h("div", { class: "metric" }, h("strong", { text: value }), h("span", { text: label })); }

  VIEWS.commerce = function () {
    var canOrders = permitted("orders.write");
    var orders = state.orders.filter(function (o) { return ui.orderFilter === "all" || o.status === ui.orderFilter; });
    var orderRows = orders.map(function (o) {
      var c = E.contact(state, o.contactId);
      var action = null;
      if (o.kind === "purchase" && o.status === "open") action = btn("Receive into stock", function () { act(E.receivePurchase(state, now(), o.id), o.no + " received. Stock went up."); }, "primary", { disabled: !canOrders });
      else if (o.kind === "sale" && o.status === "open") action = btn("Fulfil", function () { act(E.fulfilSale(state, now(), o.id), function (r) { return o.no + " fulfilled. Internal invoice " + r.invoiceNo + " issued."; }); }, "primary", { disabled: !canOrders });
      else if (o.invoiceNo) action = btn("Open invoice", function () { var r = E.openInvoice(state, now(), o.id); if (r.ok) { ui.invoice = r.invoice; save(); render(); var el = $("invoice-record"); if (el) el.scrollIntoView({ block: "nearest" }); } });
      var status = o.status === "open" ? badge("Open", "warn") : badge(o.status === "received" ? "Received" : "Fulfilled", "ok");
      return h("tr", null, td(o.no, "mono"), td(o.kind === "purchase" ? "Purchase" : "Sale"), td(c ? c.name : "—"), td(E.money(E.orderTotal(o)), "num"), td(status), h("td", null, h("div", { class: "actions" }, action)));
    });
    var invoice = null;
    if (ui.invoice) {
      var inv = ui.invoice;
      invoice = panel(["Internal invoice record · ", inv.no], [
        h("dl", { class: "kv-list" }, kv("Order", inv.order), kv("Customer", inv.contact), kv("Issued", fmtDate(inv.date))),
        table(["Product", { text: "Qty", cls: "num" }, { text: "Unit", cls: "num" }, { text: "Amount", cls: "num" }], inv.lines.map(function (l) {
          return h("tr", null, td(l.sku + " · " + l.name), td(E.num(l.qty), "num"), td(E.money(l.unitCents), "num"), td(E.money(l.qty * l.unitCents), "num"));
        }).concat([h("tr", null, td(h("b", { text: "Total" })), td(""), td(""), td(h("b", { text: E.money(inv.totalCents) }), "num"))])),
        h("p", { class: "note-inline", text: "An internal record that keeps the names and prices from the moment it was issued. It isn't a tax invoice." }),
        h("div", { class: "btn-row" }, btn("Close record", function () { ui.invoice = null; render(); }))
      ], { id: "invoice-record" });
    }
    var no = ui.newOrder;
    var contacts = state.contacts.filter(function (c) { return no.kind === "purchase" ? c.kind !== "customer" : c.kind !== "supplier"; });
    if (!contacts.some(function (c) { return c.id === no.contactId; })) no.contactId = contacts[0].id;
    var lineRows = no.lines.map(function (l, i) {
      return h("div", { class: "form-row" },
        fld("Product " + (i + 1), select("ol-sku-" + i, [["", "Choose…"]].concat(state.products.map(function (p) { return [p.sku, p.sku + " · " + p.name]; })), l.sku, function (e) { l.sku = e.target.value; var p = E.product(state, l.sku); if (p && !l.unitPrice) { l.unitPrice = (p.unitCents * (no.kind === "sale" ? 2 : 1) / 100).toFixed(2); render(); } }, { disabled: !canOrders })),
        fld("Quantity", h("input", { id: "ol-qty-" + i, type: "number", min: "1", step: "1", value: l.qty, oninput: function (e) { l.qty = e.target.value; }, disabled: !canOrders })),
        fld("Unit price ($)", h("input", { id: "ol-price-" + i, inputmode: "decimal", value: l.unitPrice, oninput: function (e) { l.unitPrice = e.target.value; }, disabled: !canOrders })));
    });
    var orderForm = h("form", { class: "form", onsubmit: function (e) {
      e.preventDefault();
      var r = E.createOrder(state, now(), no.kind, no.contactId, no.lines);
      if (act(r, function (res) { return "Saved " + res.order.no + ". Find it in the list above."; })) ui.newOrder = { kind: no.kind, contactId: no.contactId, lines: [{ sku: "", qty: "", unitPrice: "" }] };
    } },
      h("div", { class: "form-row" },
        fld("Type", select("ol-kind", [["purchase", "Purchase from a supplier"], ["sale", "Sale to a customer"]], no.kind, function (e) { no.kind = e.target.value; no.lines.forEach(function (l) { l.unitPrice = ""; }); render(); }, { disabled: !canOrders })),
        fld("Contact", select("ol-contact", contacts.map(function (c) { return [c.id, c.name]; }), no.contactId, function (e) { no.contactId = e.target.value; }, { disabled: !canOrders }))),
      lineRows,
      h("div", { class: "btn-row" },
        no.lines.length < 3 ? btn("Add product line", function () { no.lines.push({ sku: "", qty: "", unitPrice: "" }); render(); }, null, { disabled: !canOrders }) : null,
        h("button", { class: "btn-s primary", type: "submit", disabled: !canOrders }, "Save order")),
      roleNote("orders.write"));

    var canLedger = permitted("ledger.write");
    var customers = state.contacts.filter(function (c) { return c.kind !== "supplier"; });
    var ledgerForm = h("form", { class: "form", onsubmit: function (e) {
      e.preventDefault();
      var f = e.target.elements;
      act(E.recordLedger(state, now(), f.contact.value, f.kind.value, f.amount.value, f.note.value), "Entry recorded. No money moved; this is a record.");
    } },
      h("div", { class: "form-row" },
        fld("Contact", select("lg-contact", customers.map(function (c) { return [c.id, c.name]; }), "c4", null, { name: "contact", disabled: !canLedger })),
        fld("Entry", select("lg-kind", [["payment", E.LEDGER_KINDS.payment], ["credit", E.LEDGER_KINDS.credit], ["refund", E.LEDGER_KINDS.refund]], "payment", null, { name: "kind", disabled: !canLedger }))),
      h("div", { class: "form-row" },
        fld("Amount ($)", h("input", { id: "lg-amount", name: "amount", inputmode: "decimal", placeholder: "135.60", required: true, disabled: !canLedger })),
        fld("Note", h("input", { id: "lg-note", name: "note", placeholder: "Bank transfer", disabled: !canLedger }))),
      h("div", { class: "btn-row" }, h("button", { class: "btn-s primary", type: "submit", disabled: !canLedger }, "Record entry")), roleNote("ledger.write"));
    var balanceRows = E.balances(state).map(function (b) { return h("tr", null, td(b.contact.name), td(E.money(b.balanceCents), "num" + (b.balanceCents > 0 ? " low" : ""))); });
    var entryRows = state.ledger.slice(0, 10).map(function (e) {
      var c = E.contact(state, e.contactId);
      return h("tr", null, td(fmtDate(e.ts)), td(c ? c.name : "—"), td(E.LEDGER_KINDS[e.kind]), td(E.money(e.amountCents), "num"), td(e.ref || e.note || "—"));
    });

    return h("div", null,
      head("Commerce", "Purchases, sales, internal invoices and the ledger. Amounts are exact US cents, and no live money moves."),
      panel(["Sales & procurement", h("span", { class: "note-inline", text: "Filter:" }), select("order-filter", [["all", "All"], ["open", "Open"], ["received", "Received"], ["fulfilled", "Fulfilled"]], ui.orderFilter, function (e) { ui.orderFilter = e.target.value; render(); }, { "aria-label": "Filter orders" })],
        table(["Order", "Type", "Contact", { text: "Total", cls: "num" }, "Status", ""], orderRows.length ? orderRows : [h("tr", null, h("td", { colspan: "6", text: "No orders match this filter." }))])),
      invoice,
      panel("Record an order", orderForm),
      h("div", { class: "grid-2" },
        panel("Ledger balances", [h("p", { class: "panel-note", text: "Invoices minus payments and credits, plus refunds." }), table(["Contact", { text: "Balance", cls: "num" }], balanceRows)]),
        panel("Record a ledger entry", ledgerForm)),
      panel("Ledger entries", table(["Date", "Contact", "Entry", { text: "Amount", cls: "num" }, "Reference"], entryRows)));
  };
  function kv(k, v) { return h("div", null, h("dt", { text: k }), h("dd", null, v == null || v === "" ? "—" : v)); }

  VIEWS.insights = function () {
    var a = E.analytics(state, now(), ui.windowDays);
    var max = Math.max(1, Math.max.apply(null, a.buckets.map(function (b) { return Math.max(b.inUnits, b.outUnits); })));
    var bars = h("div", { class: "bars", role: "img", "aria-label": "Units received and shipped per " + (a.daysPerBar === 1 ? "day" : a.daysPerBar + " days") + " over the last " + ui.windowDays + " days" },
      a.buckets.map(function (b) {
        var inEl = h("i", { class: "in" }), outEl = h("i", { class: "out" });
        inEl.style.height = (100 * b.inUnits / max / 2) + "%";
        outEl.style.height = (100 * b.outUnits / max / 2) + "%";
        return h("span", { class: "bar", title: fmtDate(b.from) + ": +" + b.inUnits + " in, −" + b.outUnits + " out" }, inEl, outEl);
      }));
    var canInv = permitted("inventory.write");
    var preview = ui.csvPreview;
    var previewBox = null;
    if (preview) {
      previewBox = h("div", null,
        preview.rows && preview.rows.length ? table(["Line", "SKU", "Name", { text: "On hand", cls: "num" }, "Result"], preview.rows.map(function (r) {
          return h("tr", null, td(String(r.line), "mono"), td(r.sku, "mono"), td(r.name || "—"), td(isNaN(r.onHand) ? "—" : E.num(r.onHand), "num"),
            td(r.error ? h("span", { class: "err", text: r.error }) : r.action === "create" ? badge("New product", "ok") : badge(r.delta === 0 ? "No change" : (r.delta > 0 ? "+" : "") + r.delta + " units", "ok")));
        })) : null,
        preview.error ? h("p", { class: "err", text: preview.error }) : h("p", { class: "note-inline", text: "Every row is valid. Commit imports them together, or none at all." }));
    }
    var importForm = h("div", { class: "form" },
      h("div", { class: "form-row" }, fld("What should the import do?", select("csv-mode", [["create", "Create new products only"], ["adjust", "Reconcile existing stock to this snapshot"]], ui.csvMode, function (e) { ui.csvMode = e.target.value; ui.csvText = SAMPLE_CSV[ui.csvMode]; ui.csvPreview = null; render(); }))),
      fld("CSV with columns sku, name, on_hand, reorder_at, unit_price", h("textarea", { id: "csv-text", class: "mono-in", spellcheck: "false", value: ui.csvText, oninput: function (e) { ui.csvText = e.target.value; ui.csvPreview = null; } })),
      h("div", { class: "btn-row" },
        btn("Preview import", function () { ui.csvPreview = E.previewImport(state, ui.csvText, ui.csvMode); render(); }),
        btn("Commit import", function () { if (act(E.commitImport(state, now(), ui.csvText, ui.csvMode), function (r) { return "Imported " + r.count + " row(s)."; })) { ui.csvPreview = null; render(); } }, "primary", { disabled: !canInv || !(preview && preview.ok) }),
        btn("Load an example with a mistake", function () { ui.csvText = SAMPLE_CSV[ui.csvMode].replace(/,(\d+),/, ",-4,"); ui.csvPreview = null; render(); })),
      previewBox, roleNote("inventory.write"));
    return h("div", null,
      head("Data & insights", "Compare activity over a chosen period, bring in a spreadsheet safely, and export records you can open anywhere."),
      panel(["Activity", select("window", [["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["365", "Last 365 days"]], String(ui.windowDays), function (e) { ui.windowDays = Number(e.target.value); render(); }, { "aria-label": "Analytics window" })], [
        bars, h("div", { class: "legend" }, h("span", { class: "in", text: "Units received" }), h("span", { class: "out", text: "Units shipped or written off" })),
        h("dl", { class: "kv-list" }, kv("Open orders", String(a.orderStatus.open || 0)), kv("Received purchases", String(a.orderStatus.received || 0)), kv("Fulfilled sales", String(a.orderStatus.fulfilled || 0)), kv("Products at reorder level", String(a.low)))]),
      panel("Import from CSV", [h("p", { class: "panel-note", text: "Preview shows exactly what each row will do. Nothing changes until every row is valid and you commit." }), importForm]),
      panel("Export", [h("p", { class: "note-inline", text: "Exports are formula-safe: a cell that starts with =, +, - or @ is prefixed so a spreadsheet won't run it." }),
        h("div", { class: "btn-row" }, btn("Download inventory CSV", function () { download("example-co-inventory.csv", E.exportInventoryCsv(state), "text/csv"); toast("Downloaded example-co-inventory.csv."); }))]));
  };

  var DILIGENCE_EXAMPLES = [
    "Due diligence on Northgate Packaging Ltd. in the United Kingdom before we reorder kraft mailer boxes (HS 4819.10)",
    "Check Bright Coast Lighting Co. in Viet Nam before a purchase order for LED panels (HS 9405.11) shipped to the USA, like 52wmb",
    "Screen Crimson Delta Trading Co. before we place an order for packing tape"
  ];
  VIEWS.diligence = function () {
    var canRun = permitted("diligence.run");
    var report = state.reports.filter(function (r) { return r.id === ui.reportId; })[0] || state.reports[0];
    var form = h("form", { class: "form", onsubmit: function (e) {
      e.preventDefault();
      var r = E.runDiligence(state, now(), ui.diligenceText);
      if (r.ok) ui.reportId = r.report.id;
      act(r, function (res) { return "Due-diligence report saved: " + res.report.label + "."; });
    } },
      fld("What do you need to check?", h("textarea", { id: "dd-text", value: ui.diligenceText, placeholder: "Due diligence on Acme Lighting Co., Ltd. in Viet Nam before a purchase order for LED panels (HS 9405.11)", oninput: function (e) { ui.diligenceText = e.target.value; }, disabled: !canRun })),
      h("p", { class: "note-inline", text: "Try an example:" }),
      h("div", { class: "chips" }, DILIGENCE_EXAMPLES.map(function (x) { return h("button", { class: "chip-btn", type: "button", text: x, onclick: function () { ui.diligenceText = x; render(); var t = $("dd-text"); if (t) t.focus(); }, disabled: !canRun }); })),
      h("div", { class: "btn-row" }, h("button", { class: "btn-s primary", type: "submit", disabled: !canRun }, "Run due diligence")), roleNote("diligence.run"));
    var reportPanel = null;
    if (report) {
      var u = report.understood;
      var explain = { hold: "A problem to resolve first, such as a strong listed match or an inactive legal entity.", review: "Warnings for a person to check before ordering.", none: "Nothing flagged in the sources checked. Your usual procurement steps still apply.", incomplete: "Screening did not run, so this report can't support a purchase decision yet." };
      reportPanel = panel(["Report", sim(), h("span", { class: "note-inline", text: fmtDate(report.ts) + " " + fmtTime(report.ts) })], [
        h("p", { class: "note-inline" }, "Request: “", report.request, "”"),
        h("h4", { class: "visually-hidden", text: "What ThreadForge understood" }),
        h("dl", { class: "kv-list" }, kv("Supplier", u.supplier || "Not found — add the supplier's name"), kv("Supplier country", u.country), kv("HS code", u.hs), kv("Product", u.product), kv("Destination", u.destination),
          kv("Data services named", u.services.length ? u.services.join(", ") + " — recognised, never scraped; import your own licensed export" : null)),
        h("div", { class: "recommend " + report.recommendation }, h("strong", { text: report.label }), h("span", { text: explain[report.recommendation] })),
        report.findings.map(function (f) {
          var kinds = { problem: ["Problem", "bad"], warning: ["Warning", "warn"], info: ["Info", ""], ok: ["OK", "ok"] };
          return h("div", { class: "finding" }, h("span", { class: "src", text: f.source }), badge(kinds[f.severity][0], kinds[f.severity][1]), h("div", null, h("b", { text: f.title }), h("p", { text: f.detail })));
        }),
        h("p", { class: "note-inline", text: "Evidence: sample lists downloaded " + report.listDate + " · " + report.listDigest.slice(0, 23) + "… · All companies, people and list entries in this demo are invented." }),
        h("div", { class: "btn-row" }, btn("Download data (JSON)", function () { download("due-diligence-" + report.id + ".json", JSON.stringify(report, null, 2), "application/json"); }))
      ]);
    }
    var earlier = state.reports.length > 1 ? panel("Earlier reports", table(["When", "Supplier", "Recommendation", ""], state.reports.map(function (r) {
      return h("tr", { class: report && r.id === report.id ? "is-selected" : null }, td(fmtTime(r.ts)), td(r.understood.supplier || "—"), td(r.label), h("td", null, h("div", { class: "actions" }, btn("Open", function () { ui.reportId = r.id; render(); }))));
    }))) : null;
    return h("div", null,
      head("Due diligence", "Ask about a supplier the way you'd ask a colleague. ThreadForge shows how it read the request, checks each source and ends with one of four recommendations.", sim()),
      panel("Ask in plain words", [h("p", { class: "panel-note", text: "In this demo the sources are invented sample lists, a sample legal-entity registry, a sample shipment export and sample trade figures. The real check uses the official US, EU and UK lists, GLEIF and UN Comtrade." }), form]),
      reportPanel, earlier,
      h("p", { class: "note-inline", text: "A report supports a person's decision. It isn't legal advice, a sanctions clearance or a credit report." }));
  };

  var APP_EXAMPLES = [
    "Build a better music streaming app like Spotify for our own recordings, installable on Android, faster and without ads",
    "An endless runner game like Subway Surfers with touch controls and original characters",
    "A booking app like Calendly for our salon, simpler and works offline",
    "Decompile the APK file of a game like Subway Surfers and copy their characters"
  ];
  VIEWS.builder = function () {
    var canPlan = permitted("builder.plan");
    var u = ui.appText.trim().length >= 10 ? E.parseApp(ui.appText) : null;
    var status = !u ? null : u.refusal ? badge("ThreadForge will not build this", "bad") : (u.needsContentSource && !ui.appContent) ? badge("Needs a choice before planning", "warn") : badge("Ready to plan", "ok");
    var understood = u ? h("dl", { class: "kv-list" },
      kv("References", u.references.join(", ") || "None named"), kv("Kind of product", u.kindLabel), kv("Platforms", u.platforms.join(", ")),
      kv("Improvements asked for", u.improvements.join(", ") || "None stated — the brief will propose some")) : null;
    var form = h("form", { class: "form", onsubmit: function (e) {
      e.preventDefault();
      var r = E.planApp(state, now(), ui.appText, ui.appContent);
      if (!r.ok) { ui.appRefusal = r.refused ? r.error : null; toast(r.error, true); render(); return; }
      ui.appRefusal = null; act(r, "Brief ready for review. Nothing is built until the owner approves it.");
    } },
      fld("What should ThreadForge build?", h("textarea", { id: "app-text", value: ui.appText, placeholder: APP_EXAMPLES[0], oninput: function (e) { ui.appText = e.target.value; }, onchange: function () { render(); }, disabled: !canPlan })),
      h("p", { class: "note-inline", text: "Try an example:" }),
      h("div", { class: "chips" }, APP_EXAMPLES.map(function (x) { return h("button", { class: "chip-btn", type: "button", text: x, onclick: function () { ui.appText = x; ui.appContent = ""; ui.appRefusal = null; render(); }, disabled: !canPlan }); })),
      u ? panelLite("Check the plan first", [status, understood]) : null,
      u && u.needsContentSource ? fld("Content source (for streaming and community apps)", select("app-content", [["", "Choose if needed"], ["Original placeholder content", "Original placeholder content"], ["Content we own", "Content we own"], ["Content we license", "Content we license"]], ui.appContent, function (e) { ui.appContent = e.target.value; render(); }, { disabled: !canPlan })) : null,
      ui.appRefusal ? h("p", { class: "err", text: ui.appRefusal }) : null,
      h("div", { class: "btn-row" }, h("button", { class: "btn-s primary", type: "submit", disabled: !canPlan }, "Plan this app")), roleNote("builder.plan"));
    var projects = state.apps.map(function (p) { return projectCard(p); });
    return h("div", null,
      head("App builder", "Name an app you like and say what should be better. ThreadForge plans an original product with its own name, art and code, waits for the owner's approval, then builds, reviews and tests it.", sim()),
      panel("Team and connections", h("dl", { class: "kv-list" },
        kv("Research and builder model", "Simulated in this demo. In ThreadForge, the model you connect"),
        kv("Independent reviewer model", "Separate model configured"), kv("Research tools (MCP)", "Managed by the workspace owner"), kv("Ready to build", "Yes, after owner approval"))),
      panel("Describe what to build", form),
      projects.length ? h("div", null, projects) : panel("Projects", h("p", { class: "note-inline", text: "No app projects yet. Projects stay inside this organization." })));
  };
  function panelLite(title, kids) { return h("div", { class: "panel" }, h("h3", { text: title }), kids); }
  function projectCard(p) {
    var labels = { planned: ["Planned — waiting for owner approval", "warn"], building: ["Building", "warn"], built: ["Built — draft pull request ready", "ok"] };
    var running = ui.appRun && ui.appRun.id === p.id ? ui.appRun : null;
    var stages = ["Research brief approved", "Builder agent writing the app", "Reviewer agent checking it", "Tests running in the isolated runner", "Draft pull request opened"];
    var body = [
      h("dl", { class: "kv-list" }, kv("Request", p.request), kv("Kind", p.understood.kindLabel + " · " + p.understood.platforms.join(", ")), kv("Content source", p.contentSource)),
      h("div", { class: "grid-2" },
        h("div", null, h("h4", { class: "mission-title", text: "Features" }), h("ul", { class: "check-list" }, p.features.map(function (f) { return h("li", null, h("span", { text: f })); }))),
        h("div", null, h("h4", { class: "mission-title", text: "Improvements" }), h("ul", { class: "check-list" }, p.improvements.map(function (f) { return h("li", null, h("span", { text: f })); })),
          h("h4", { class: "mission-title", text: "Screens" }), h("p", { class: "note-inline", text: p.screens.join(" · ") }))),
      h("h4", { class: "mission-title", text: "Acceptance tests (node --test)" }), h("ul", { class: "file-list" }, p.tests.map(function (t) { return h("li", { text: "✓ " + t }); })),
      h("h4", { class: "mission-title", text: "Rights rules for this build" }), h("ul", { class: "x-list" }, p.rights.map(function (r) { return h("li", { text: r }); }))
    ];
    if (p.status === "planned") body.push(h("div", { class: "btn-row" }, btn("Approve and build", function () { startBuild(p.id); }, "go", { disabled: !permitted("builder.approve") }), roleNote("builder.approve")));
    if (running || p.status === "building") body.push(h("ol", { class: "steps-run" }, stages.map(function (s, i) {
      var step = running ? running.step : 0;
      return h("li", { class: i < step ? "is-done" : i === step ? "is-now" : null }, h("b", { text: s }));
    })));
    if (p.status === "built") body.push(
      h("p", { class: "note-inline", text: p.testsPassed + " tests passed. Files in the draft pull request:" }),
      h("ul", { class: "file-list" }, p.files.map(function (f) { return h("li", { text: f }); })),
      h("div", { class: "btn-row" }, btn("Review the draft pull request ↗", function () { toast("In ThreadForge this opens the draft pull request on GitHub. You review and merge it there."); })));
    return panel([p.name, badge(labels[p.status][0], labels[p.status][1]), sim()], body);
  }
  function startBuild(id) {
    var r = E.approveBuild(state, now(), id);
    if (!act(r)) return;
    ui.appRun = { id: id, step: 0 };
    var advance = function () {
      if (!state.products) return;
      ui.appRun.step += 1;
      if (ui.appRun.step >= 5) { E.finishBuild(state, now(), id); ui.appRun = null; save(); toast("Built. The draft pull request is ready for review."); }
      else setTimeout(advance, STEP_MS);
      if (ui.section === "builder") render();
    };
    render();
    setTimeout(advance, STEP_MS);
  }

  VIEWS.marketing = function () {
    var k = state.campaigns[0];
    var canWrite = permitted("marketing.write"), canApprove = permitted("marketing.approve");
    var aud = E.audience(state);
    var capture = state.captures[0];
    var editor = h("form", { class: "form", onsubmit: function (e) {
      e.preventDefault();
      var f = e.target.elements;
      act(E.reviseCampaign(state, now(), f.subject.value, f.body.value), function (r) { return "Saved revision " + r.revision + ". It needs approval again."; });
    } },
      fld("Subject", h("input", { id: "cp-subject", name: "subject", value: k.subject, disabled: !canWrite })),
      fld("Message", h("textarea", { id: "cp-body", name: "body", value: k.body, disabled: !canWrite })),
      h("div", { class: "btn-row" }, h("button", { class: "btn-s", type: "submit", disabled: !canWrite }, "Save as a new revision")), roleNote("marketing.write"));
    var assets = h("div", { class: "form" }, k.assets.map(function (a) {
      return h("div", { class: "form-row" }, h("p", { class: "mono" }, a.name, " ", a.rights === "unconfirmed" ? badge("Rights unconfirmed", "warn") : badge(E.RIGHTS[a.rights], "ok")),
        fld("Rights for " + a.name, select("rights-" + a.name.replace(/\W/g, ""), Object.keys(E.RIGHTS).map(function (r) { return [r, E.RIGHTS[r]]; }), a.rights, function (e) { act(E.setAssetRights(state, now(), a.name, e.target.value), "Image rights recorded."); }, { disabled: !canWrite })));
    }));
    var approve = h("div", { class: "btn-row" },
      btn("Approve revision " + k.revision, function () { act(E.approveCampaign(state, now()), function (r) { return "Approved for " + r.recipients + " recipients; " + r.excluded + " left out. Captured as an email file. Nothing was sent."; }); }, "go", { disabled: !canApprove || k.status !== "draft" }),
      k.status === "approved" ? badge("Revision " + k.revision + " approved", "ok") : null, roleNote("marketing.approve"));
    return h("div", null,
      head("Marketing", "Campaigns reach only contacts with recorded consent, after an approved revision, and each message is captured for a final read before any delivery service is switched on."),
      panel(["Campaign · " + k.name, badge("Revision " + k.revision, ""), k.status === "draft" ? badge("Draft", "warn") : badge("Approved", "ok")], [
        editor,
        h("h4", { class: "mission-title", text: "Image rights" }), assets,
        h("h4", { class: "mission-title", text: "Audience" }),
        h("p", { class: "note-inline", text: aud.included.length + " contacts will receive it. " + aud.excluded.length + " are left out:" }),
        h("ul", { class: "x-list" }, aud.excluded.map(function (x) { return h("li", { text: x.contact.name + " — " + x.reason }); })),
        h("h4", { class: "mission-title", text: "Delivery" }),
        h("div", { class: "form" },
          h("label", { class: "note-inline" }, h("input", { type: "radio", name: "delivery", checked: true }), " Private local capture (recommended)"),
          h("label", { class: "note-inline" }, h("input", { type: "radio", name: "delivery", disabled: true }), " Configured external email transport — not available in the demo")),
        approve]),
      capture ? panel(["Captured email · revision " + capture.revision, badge(capture.recipients + " recipients", "ok")], [
        h("pre", { class: "eml", text: capture.eml }),
        h("div", { class: "btn-row" }, btn("Download .eml", function () { download("spring-restock-r" + capture.revision + ".eml", capture.eml, "message/rfc822"); }))]) : null,
      panel("Contacts", table(["Name", "Type", "Email", "Consent", "Source"], state.contacts.map(function (c) {
        return h("tr", null, td(c.name), td(c.kind === "both" ? "Customer and supplier" : c.kind === "customer" ? "Customer" : "Supplier"), td(c.email || "—", "mono"),
          td(c.kind === "supplier" ? "—" : c.consent ? badge("Recorded", "ok") : badge("None", "warn")), td(c.consentSource || "—"));
      }))));
  };

  VIEWS.connectors = function () {
    var c = ui.connector;
    var providers = ["OpenAI", "Anthropic Claude", "Google Gemini", "Ollama (local, OpenAI-compatible)", "LM Studio (local)", "vLLM", "Mistral", "Groq", "OpenRouter"];
    return h("div", null,
      head("AI & connectors", "The agent teams run on the model you choose, and research uses only the tools you allow. Everything here starts off until the workspace owner turns it on."),
      panel("Model providers", h("form", { class: "form", onsubmit: function (e) { e.preventDefault(); toast("Saved for this demo. In ThreadForge, keys live in the owner's settings file and are never shown in the app."); } },
        h("div", { class: "form-row" },
          fld("Research and builder model", select("cn-provider", providers.map(function (p) { return [p, p]; }), c.provider, function (e) { c.provider = e.target.value; render(); })),
          fld("Reviewer", select("cn-reviewer", [["yes", "A different model, for a real second opinion"], ["no", "Same model as the builder"]], c.reviewer ? "yes" : "no", function (e) { c.reviewer = e.target.value === "yes"; render(); }))),
        /Ollama|LM Studio/.test(c.provider) ? h("p", { class: "note-inline", text: "Local models run on your own computer. From 10.6.1, setup-ollama.ps1 installs and connects one. In 10.6.2 the script finds the desktop app's settings on its own, in %APPDATA%\\methodology-threadforge-desktop\\suite-runtime." }) : null,
        h("div", { class: "btn-row" }, h("button", { class: "btn-s primary", type: "submit" }, "Save")))),
      panel("Research tools (MCP)", [h("p", { class: "panel-note", text: "Only the tools you list are offered, and only to the app builder's research step. Their results are treated as untrusted data." }),
        mcpRow("docs", "Docs search", "HTTPS server"), mcpRow("notes", "Local reference notes", "Local program")]),
      panel("Plugins", h("p", { class: "note-inline", text: "No plugins are turned on. A plugin folder adds research playbooks and MCP servers, which stay off until you turn the plugin on." })));
  };
  function mcpRow(key, name, kind) {
    var on = ui.connector.mcp[key];
    return h("div", { class: "repair" }, h("div", null, h("b", { text: name }), h("small", { text: kind + " · " + (on ? "allowed" : "off") })),
      btn(on ? "Turn off" : "Allow", function () { ui.connector.mcp[key] = !on; toast(on ? name + " is off." : name + " is allowed for research only."); render(); }, on ? null : "primary"));
  }

  VIEWS.access = function () {
    var matrix = [["Change inventory and orders", "inventory.write"], ["Record payments and refunds", "ledger.write"], ["Edit campaigns", "marketing.write"], ["Approve campaigns", "marketing.approve"],
      ["Run due diligence", "diligence.run"], ["Plan apps", "builder.plan"], ["Approve builds", "builder.approve"], ["Issue and revoke access", "access.manage"]];
    var roles = ["admin", "operator", "finance", "viewer"];
    var canManage = permitted("access.manage");
    var issue = h("form", { class: "form", onsubmit: function (e) {
      e.preventDefault();
      var f = e.target.elements, ints = null;
      try { ints = Array.prototype.slice.call(window.crypto.getRandomValues(new Uint16Array(24))); } catch (err) { ints = null; }
      var r = E.issueToken(state, now(), f.role.value, f.label.value, ints);
      if (act(r, "Credential issued. Copy it now; it won't be shown again.")) { ui.secret = r.secret; render(); }
    } },
      h("div", { class: "form-row" },
        fld("Role", select("tk-role", [["viewer", "Viewer"], ["finance", "Finance"], ["operator", "Operator"]], "viewer", null, { name: "role", disabled: !canManage })),
        fld("Label", h("input", { id: "tk-label", name: "label", placeholder: "Accountant, read-only", disabled: !canManage }))),
      h("div", { class: "btn-row" }, h("button", { class: "btn-s primary", type: "submit", disabled: !canManage }, "Issue credential")), roleNote("access.manage"));
    var secret = ui.secret ? h("div", { class: "secret" }, h("b", { text: "Shown once. Copy it now; only its last four characters are kept." }), h("code", { text: ui.secret }),
      h("div", { class: "btn-row" }, btn("Copy", function (e) { var b = e.currentTarget; navigator.clipboard && navigator.clipboard.writeText(ui.secret).then(function () { b.textContent = "Copied"; }, function () { b.textContent = "Select and copy"; }); }), btn("I've saved it", function () { ui.secret = null; render(); }))) : null;
    return h("div", null,
      head("Workspace access", "Each organization keeps its own records. Give people revocable access with the role they need, and switch roles at the top to see the difference."),
      panel(["You're signed in as ", E.ROLES[state.role]], [
        state.role === "viewer" ? h("p", { class: "note-inline", text: "Viewers can open every section and read every record, but every control that changes something is off." }) : null,
        table(["Action"].concat(roles.map(function (r) { return { text: E.ROLES[r] }; })), matrix.map(function (m) {
          return h("tr", null, td(m[0]), roles.map(function (r) { var yes = E.can(r, m[1]); return td(h("span", { class: yes ? "perm-yes" : "perm-no", text: yes ? "Yes" : "—" })); }));
        }), "perm-tbl")]),
      panel("Issue a credential", [issue, secret]),
      state.tokens.length ? panel("Credentials", table(["Label", "Role", "Ends", "Expires", "Status", ""], state.tokens.map(function (t) {
        return h("tr", null, td(t.label), td(E.ROLES[t.role]), td("…" + t.hint, "mono"), td(fmtDate(t.expires)), td(t.revoked ? badge("Revoked", "") : badge("Active", "ok")),
          h("td", null, h("div", { class: "actions" }, t.revoked ? null : btn("Revoke", function () { act(E.revokeToken(state, now(), t.id), "Revoked. That credential stops working at once."); }, "danger", { disabled: !canManage }))));
      }))) : null);
  };

  var ENG_EXAMPLES = ["Invoice totals are off by one cent when a discount applies. Fix it and add a test.", "Fix the crash when the cart is empty", "Product search is slow on large catalogs; make it faster"];
  VIEWS.engineering = function () {
    var canRun = permitted("engineering.run");
    var task = state.tasks[0];
    var running = ui.engRun && task && ui.engRun.id === task.id ? ui.engRun : null;
    var form = h("form", { class: "form", onsubmit: function (e) {
      e.preventDefault();
      var r = E.startEngineering(state, now(), ui.engText, ui.engRepo);
      if (!r.ok) { toast(r.error, true); return; }
      ui.engRun = { id: r.task.id, step: 0 };
      act(r, "Task started. Watch each step; the draft opens only after tests and review pass.");
      var advance = function () {
        if (!state.products || !ui.engRun) return;
        ui.engRun.step += 1;
        if (ui.engRun.step >= 4) { E.finishEngineering(state, now(), r.task.id); ui.engRun = null; save(); toast("Draft pull request #" + r.task.prNumber + " is ready for your review."); }
        else setTimeout(advance, STEP_MS);
        if (ui.section === "engineering") render();
      };
      setTimeout(advance, STEP_MS);
    } },
      h("div", { class: "form-row" }, fld("Repository", h("input", { id: "eng-repo", value: ui.engRepo, oninput: function (e) { ui.engRepo = e.target.value; }, disabled: !canRun }))),
      fld("Task", h("textarea", { id: "eng-text", value: ui.engText, placeholder: ENG_EXAMPLES[1], oninput: function (e) { ui.engText = e.target.value; }, disabled: !canRun })),
      h("div", { class: "chips" }, ENG_EXAMPLES.map(function (x) { return h("button", { class: "chip-btn", type: "button", text: x, onclick: function () { ui.engText = x; render(); }, disabled: !canRun }); })),
      h("div", { class: "btn-row" }, h("button", { class: "btn-s primary", type: "submit", disabled: !canRun || !!ui.engRun }, ui.engRun ? "Running…" : "Start task")), roleNote("engineering.run"));
    var current = null;
    if (task) {
      var step = running ? running.step : (task.status === "draft" ? 5 : 0);
      current = panel(["Thread · " + task.repo, task.status === "draft" ? badge("Draft ready", "ok") : badge("Running", "warn"), sim()], [
        h("p", { class: "note-inline" }, "“", task.text, "”"),
        h("ol", { class: "steps-run" }, task.steps.map(function (s, i) {
          return h("li", { class: i < step ? "is-done" : i === step ? "is-now" : null }, h("span", null, h("b", { text: s.label }), " ", h("small", { text: s.detail })));
        })),
        task.status === "draft" ? [
          diffBlock(task.diff),
          task.reviewed
            ? h("div", { class: "secret" }, h("b", { text: "Draft pull request #" + task.prNumber + " · " + task.repo }), h("span", { class: "note-inline", text: task.changed.length + " files changed · tests passed · reviewer approved" }),
                h("div", { class: "btn-row" }, h("button", { class: "btn-s", type: "button", disabled: true }, "Merge"), h("span", { class: "note-inline", text: "ThreadForge has no merge button. You review and merge on GitHub." })))
            : h("div", { class: "btn-row" }, btn("Review the draft", function () { act(E.reviewDraft(state, now(), task.id), "This is the draft you'd review on GitHub. Merging is your decision."); }, "go"))
        ] : null
      ]);
    }
    return h("div", null,
      head("Engineering agent", "Describe a change in plain language. The agent reads the code, makes the change, tests it in a sealed container, has a separate reviewer check it and opens a draft pull request. It never merges.", sim()),
      panel("Start a task", form),
      current,
      h("p", { class: "note-inline", text: "In ThreadForge the agent works on your repository with the model you connect, inside step, token and time limits." }));
  };
  function diffBlock(lines) {
    return h("pre", { class: "diff-block" }, lines.map(function (l) {
      var cls = /^\+/.test(l) ? "add" : /^-/.test(l) ? "del" : /^@@/.test(l) ? "hunk" : null;
      return h("span", { class: cls }, l + "\n");
    }));
  }

  var CARE_EXAMPLES = ["my pc is slow and keeps showing pop ups", "my camera has no driver", "websites won't load", ""];
  VIEWS.care = function () {
    var canRun = permitted("care.run");
    var session = state.care.session;
    var out = h("pre", { class: "term-out", id: "care-out", "aria-live": "polite" },
      ui.careLines.length ? ui.careLines.map(lineEl) : [lineEl([["p", "PS> "], ["u", "threadforge care"]]), lineEl([["dim", "ThreadForge PC care " + E.VERSION]]), lineEl([["dim", "Checks are read-only. Nothing changes unless you approve a repair."]]), lineEl([["dim", "Describe the problem below, or leave it blank for a full check-up."]])]);
    var input = h("form", { class: "term-in", onsubmit: function (e) { e.preventDefault(); diagnose(ui.careText); } },
      h("label", { class: "visually-hidden", for: "care-text", text: "Describe the problem" }),
      h("input", { id: "care-text", value: ui.careText, placeholder: "Describe the problem, or leave blank", autocomplete: "off", oninput: function (e) { ui.careText = e.target.value; }, disabled: !canRun }),
      h("button", { class: "btn-s go", type: "submit", disabled: !canRun }, "Diagnose"));
    var repairs = session && session.suggestions.length ? panel(["Suggested repairs", h("span", { class: "note-inline", text: "Each runs only after you say yes." })],
      h("ul", { class: "repair-list" }, session.suggestions.map(function (s, i) {
        var confirming = ui.careConfirm === s.action + ":" + s.argument;
        return h("li", { class: "repair" },
          h("div", null, h("b", { text: (i + 1) + ". " + s.title }), h("small", { text: "[" + s.flags + "] " + E.CARE_ACTIONS[s.action].description })),
          btn("Run", function () { ui.careConfirm = s.action + ":" + s.argument; render(); }, null, { disabled: !canRun || confirming }),
          confirming ? h("div", { class: "confirm" }, h("span", { text: "Run it now? [y/N]" }),
            btn("Yes, run it", function () { runRepair(s); }, "primary"), btn("No", function () { ui.careConfirm = null; pushLine([["dim", "Skipped."]]); render(); })) : null);
      }))) : null;
    var admin = ui.careNeedsAdmin ? h("div", { class: "secret" }, h("b", { text: "Windows administrator prompt" }), h("span", { class: "note-inline", text: "PC care asks Windows to reopen it as administrator. Approve to continue." }),
      h("div", { class: "btn-row" }, btn("Approve the prompt", function () { E.careElevate(state, now()); save(); var s = ui.careNeedsAdmin; ui.careNeedsAdmin = null; pushLine([["dim", "Continuing in the administrator window."]]); runRepair(s); }, "primary"), btn("Cancel", function () { ui.careNeedsAdmin = null; render(); }))) : null;
    var quarantine = state.care.quarantine.length ? panel("Quarantined startup entries", h("ul", { class: "repair-list" }, state.care.quarantine.map(function (q) {
      return h("li", { class: "repair" }, h("div", null, h("b", { text: q.name }), h("small", { text: "Quarantine " + q.id + " · an exact copy is kept" })),
        btn("Restore", function () { var r = E.careRun(state, now(), "restore_startup", q.id, true); if (r.ok) { pushLine([["ok", "[completed] "], ["", r.result.summary]]); } act(r, "Restored exactly as it was."); }));
    }))) : null;
    var journal = state.care.journal.length ? panel("Repair journal", [h("p", { class: "panel-note", text: "Every approved run, including one refused for missing rights, is recorded in %LOCALAPPDATA%\\ThreadForge\\care\\journal.jsonl." }),
      table(["When", "Repair", "Status", "Summary"], state.care.journal.map(function (j) { return h("tr", null, td(fmtTime(j.ts)), td(j.action, "mono"), td(j.status === "completed" ? badge("completed", "ok") : badge(j.status.replace("_", " "), "warn")), td(j.summary)); }))]) : null;
    return h("div", null,
      head("PC care", "Describe a Windows problem in your own words. ThreadForge checks the PC read-only, explains what it found and offers numbered repairs that run only after you say yes.", sim()),
      h("p", { class: "note-inline", text: "Here the PC and its results are simulated, but the way your words are matched to problem areas is the product's own. In ThreadForge, detection and removal belong to Microsoft Defender." }),
      h("div", { class: "term-box" }, out, input),
      h("div", { class: "chips" }, CARE_EXAMPLES.map(function (x) { return h("button", { class: "chip-btn", type: "button", text: x || "Full check-up (blank)", onclick: function () { ui.careText = x; diagnose(x); }, disabled: !canRun }); })),
      roleNote("care.run"), admin, repairs, quarantine, journal);
  };
  function lineEl(segs) { return h("span", null, segs.map(function (s) { return h("span", { class: s[0] || null, text: s[1] }); }), "\n"); }
  function pushLine(segs) { ui.careLines.push(segs); if (ui.careLines.length > 120) ui.careLines.splice(0, ui.careLines.length - 120); }
  function diagnose(text) {
    var r = E.careDiagnose(state, now(), text);
    if (!r.ok) { toast(r.error, true); return; }
    var s = r.session;
    ui.careLines = [];
    pushLine([["p", "PS> "], ["u", "threadforge care"]]);
    pushLine([["dim", "ThreadForge PC care " + E.VERSION]]);
    pushLine([["dim", "Checks are read-only. Nothing changes unless you approve a repair."]]);
    pushLine([["", "Describe the problem (or press Enter for a full check-up): "], ["u", text]]);
    pushLine([["", "Checking... this can take a minute."]]);
    pushLine([["", "Problem areas: " + s.areas.join(", ") + "  (" + s.routing + ")"]]);
    s.findings.forEach(function (f) {
      var cls = { problem: "w", warning: "w", info: "i", ok: "ok" }[f.severity];
      pushLine([[cls, "[" + (f.severity + "       ").slice(0, 7) + "]"], ["", " " + f.title]]);
      if (f.detail) pushLine([["dim", "          " + f.detail]]);
    });
    if (s.suggestions.length) {
      pushLine([["", ""]]);
      pushLine([["", "Suggested repairs:"]]);
      s.suggestions.forEach(function (x, i) { pushLine([["", "  " + (i + 1) + ". " + x.title + "  "], ["dim", "[" + x.flags + "]"]]); });
    }
    ui.careConfirm = null;
    save();
    render();
    var o = $("care-out"); if (o) o.scrollTop = o.scrollHeight;
  }
  function runRepair(s) {
    ui.careConfirm = null;
    pushLine([["", ""]]);
    pushLine([["", E.CARE_ACTIONS[s.action].title + ": "], ["dim", E.CARE_ACTIONS[s.action].description]]);
    pushLine([["", "Run it now? [y/N] "], ["u", "y"]]);
    var r = E.careRun(state, now(), s.action, s.argument, true);
    if (!r.ok) { toast(r.error, true); render(); return; }
    var res = r.result;
    pushLine([[res.status === "completed" ? "ok" : "w", "[" + res.status + "] "], ["", res.summary]]);
    if (res.status === "needs_admin") ui.careNeedsAdmin = s;
    else pushLine([["dim", "Every repair is recorded in %LOCALAPPDATA%\\ThreadForge\\care\\journal.jsonl."]]);
    act(r, res.status === "completed" ? "Repair completed and recorded in the journal." : null);
    var o = $("care-out"); if (o) o.scrollTop = o.scrollHeight;
  }

  /* ---------- TradeMath ---------- */
  var TRADE = window.TFTrade;
  var TRADE_SAMPLES = {
    cbm: { unit: "cm", cartons: [{ length: "30", width: "20", height: "10", quantity: "2" }] },
    volumetric: { unit: "cm", length: "40", width: "30", height: "20", quantity: "1", actual_kg: "2.5", divisor: "courier_5000" },
    margin: { mode: "from_prices", cost: "80.00", selling_price: "100.00" },
    landed: { goods: "1000.00", freight: "150.00", insurance: "10.00", other: "0.00", duty_percent: "5", duty_base: "goods_freight_insurance", duty_source: "Example schedule, entered by you, dated YYYY-MM-DD", quantity: "100" },
    container: { container: "40hc", cbm: "20", kg: "8000" },
    shipping_compare: { currency: "USD", options: [{ name: "Sea quote A", amount: "1200.00", days: "28" }, { name: "Air quote B", amount: "4100.00", days: "5" }] },
    break_even: { fixed_costs: "5000.00", price: "25.00", variable_cost: "10.00" },
    convert: { amount: "100.00", rate: "1.08", pair: "EUR to USD", source: "Rate you copied, with its publisher and date" },
    material_weight: { shape: "round_bar", material: "carbon_steel", unit: "mm", diameter: "20", length: "1000", quantity: "1" },
    units: { kind: "length", amount: "1", from: "in", to: "mm" },
    gsm: { mode: "from_sample", grams: "12.5", width_cm: "10", length_m: "1" },
    supplier_compare: { currency: "USD", suppliers: [{ name: "Supplier A", goods: "1000", freight: "100", duty_percent: "0", quantity: "10", lead_days: "20" }, { name: "Supplier B", goods: "900", freight: "250", duty_percent: "5", duty_source: "Your schedule and date", quantity: "10", lead_days: "35" }] },
    examine: { supplier: "Example Mill", currency: "USD", incoterm: "FOB", freight: "0", insurance: "0", duty: "0", stated_total: "250.00", lines: [{ description: "Widget", quantity: "10", unit_price: "25.00" }] },
    advise: { sea_only: false, place_alongside_ship: false, seller_pays_main_carriage: false, seller_must_insure: false, seller_risk_until_destination: false, seller_unloads: false, seller_pays_import_duty: false }
  };
  ui.tradeTool = "landed";
  ui.tradeText = JSON.stringify(TRADE_SAMPLES.landed, null, 2);
  ui.tradeResult = null;
  ui.tradeError = "";
  VIEWS.trade = function () {
    if (!TRADE) {
      return h("div", null, head("Trade", "The trade calculators did not load in this browser."));
    }
    var tools = TRADE.TOOLS;
    return h("div", null,
      head("Trade", "Shipment math, landed cost, quotations and supplier comparisons. Every rate and duty is a figure you type. The demo does not look up a live tariff, a freight quote or a ranking of countries."),
      panel("TradeMath calculators", [
        fld("Calculator", select("trade-tool", tools, ui.tradeTool, function (e) {
          ui.tradeTool = e.target.value;
          ui.tradeText = JSON.stringify(TRADE_SAMPLES[ui.tradeTool], null, 2);
          ui.tradeResult = null;
          ui.tradeError = "";
          render();
        })),
        fld("Inputs", h("textarea", { id: "trade-json", class: "mono-in", spellcheck: "false", oninput: function (e) { ui.tradeText = e.target.value; } }, ui.tradeText)),
        h("p", { class: "note-inline", text: "Edit the numbers, then calculate. A duty above zero needs the schedule and date you copied it from. A currency rate needs its source and date." }),
        btn("Calculate", function () {
          var parsed;
          try { parsed = JSON.parse(ui.tradeText); }
          catch (e) { ui.tradeError = "The inputs are not valid JSON."; ui.tradeResult = null; render(); return; }
          try {
            ui.tradeResult = TRADE.calculate(ui.tradeTool, parsed);
            ui.tradeError = "";
          } catch (e2) {
            ui.tradeError = e2.message || "That calculation was refused.";
            ui.tradeResult = null;
          }
          render();
        }, "go"),
        ui.tradeError ? h("p", { class: "err", text: ui.tradeError }) : null,
        ui.tradeResult ? h("div", null,
          h("h4", { text: ui.tradeResult.summary }),
          table(["Figure", "Value", "Unit"], ui.tradeResult.figures.map(function (f) {
            return h("tr", null, td(f.label), td(f.value, "mono"), td(f.unit || "—"));
          })),
          h("p", { class: "note-inline", text: ui.tradeResult.formula }),
          (ui.tradeResult.assumptions || []).map(function (line) { return h("p", { class: "note-inline", text: line }); }),
          (ui.tradeResult.warnings || []).map(function (line) { return h("p", { class: "err", text: line }); })
        ) : null
      ]));
  };

  /* ---------- Wire up ---------- */
  $("demo-role").addEventListener("change", function (e) {
    var role = e.target.value;
    var r = E.setRole(state, now(), role);
    act(r, role === "viewer" ? "Signed in as Viewer: you can read everything and change nothing." : "Signed in as " + E.ROLES[role] + ".");
  });
  $("demo-missions-toggle").addEventListener("click", function () { setMissions(!ui.missionsOpen); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && ui.missionsOpen) { setMissions(false); $("demo-missions-toggle").focus(); } });
  window.addEventListener("storage", function (e) {
    if (e.key !== E.STORAGE_KEY) return;
    state = store.load();
    if (E.sessionStatus(state, now()) !== "active") showEnded(); else render();
  });
  markGateMissions();
  boot();
})();

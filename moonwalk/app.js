"use strict";

(() => {
  const DB_NAME = "threadforge-moonwalk-pwa";
  const DB_VERSION = 1;
  const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
  const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
  const MAX_MEDIA_PIXELS = 30_000_000;
  const STORES = ["inventory", "suppliers", "hrbp", "campaigns", "activity"];
  const TEMPLATES = {
    "Onboarding coordination": [
      "Prepare role-specific equipment and access requests.",
      "Share the approved first-week schedule and points of contact.",
      "Confirm required policy and safety materials are available.",
      "Schedule role training and a first-week check-in.",
      "Review setup tasks with the responsible teams."
    ],
    "Manager check-in preparation": [
      "Review role goals and previously agreed follow-up actions.",
      "Prepare open questions and invite the employee to set the agenda.",
      "Identify support, training, or resource requests to discuss.",
      "Agree on owners and dates for follow-up actions.",
      "Share a concise, factual recap through the approved HR process."
    ],
    "Policy communication plan": [
      "Confirm the current, approved policy version and effective date.",
      "Identify the intended audience and approved communication channel.",
      "Prepare a plain-language summary without changing policy meaning.",
      "Provide the authoritative policy and contact for questions.",
      "Track completion only in an organization-approved HR system."
    ],
    "Offboarding coordination": [
      "Confirm the approved transition plan with the authorized HR contact.",
      "Coordinate access changes with responsible IT and security teams.",
      "Arrange equipment return using the approved process.",
      "Document handover owners and due dates in the approved system.",
      "Follow organizational retention and records-handling procedures."
    ]
  };
  const state = {
    db: null,
    view: "overview",
    inventorySearch: "",
    supplierSearch: "",
    campaignSearch: "",
    activityFilter: "",
    media: null,
    installPrompt: null,
    persistentStorage: false
  };
  const root = document.querySelector("#view-root");
  const crumb = document.querySelector("#crumb");
  const sidebar = document.querySelector("#sidebar");
  const scrim = document.querySelector("#scrim");
  const toastRegion = document.querySelector("#toast-region");

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function requestValue(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("The browser data request failed."));
    });
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        const inventory = db.createObjectStore("inventory", { keyPath: "id", autoIncrement: true });
        inventory.createIndex("sku", "sku", { unique: true });
        db.createObjectStore("suppliers", { keyPath: "id", autoIncrement: true });
        db.createObjectStore("hrbp", { keyPath: "id" });
        db.createObjectStore("campaigns", { keyPath: "id", autoIncrement: true });
        const activity = db.createObjectStore("activity", { keyPath: "id", autoIncrement: true });
        activity.createIndex("createdAt", "createdAt");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open this browser's local database."));
      request.onblocked = () => reject(new Error("Close older Moonwalk tabs to finish the local database update."));
    });
  }

  function transaction(storeNames, mode, action) {
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(storeNames, mode);
      let result;
      let actionError;
      try {
        result = action(tx, error => {
          actionError = error;
          tx.abort();
        });
      } catch (error) {
        tx.abort();
        reject(error);
        return;
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(actionError || tx.error || new Error("The local database transaction failed."));
      tx.onabort = () => reject(actionError || tx.error || new Error("The local database transaction was cancelled."));
    });
  }

  function readAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error(`Could not read ${storeName}.`));
      tx.onerror = () => reject(tx.error || new Error(`Could not read ${storeName}.`));
    });
  }

  async function allData() {
    const values = await Promise.all(STORES.map(name => readAll(name)));
    return Object.fromEntries(STORES.map((name, index) => [name, values[index]]));
  }

  async function refreshAfterWrite(summary) {
    toast(summary);
    await render();
  }

  async function commitAndLog(storeNames, action, summary, operation) {
    const createdAt = new Date().toISOString();
    const names = [...new Set([...storeNames, "activity"])];
    await transaction(names, "readwrite", tx => {
      operation(tx);
      tx.objectStore("activity").add({ action, summary: String(summary).slice(0, 500), createdAt });
    });
    await refreshAfterWrite(summary);
  }

  function toast(message, error = false) {
    const item = document.createElement("div");
    item.className = `toast${error ? " error" : ""}`;
    item.textContent = message;
    toastRegion.append(item);
    window.setTimeout(() => item.remove(), 4200);
  }

  function fail(error) {
    toast(error?.message || "The action could not be completed.", true);
  }

  function safeText(value, maxLength, label) {
    const result = String(value ?? "").trim();
    if (!result || result.length > maxLength) throw new Error(`${label} is required and must be at most ${maxLength} characters.`);
    return result;
  }

  function wholeNumber(value, min, max, label) {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
      throw new Error(`${label} must be a whole number between ${min.toLocaleString()} and ${max.toLocaleString()}.`);
    }
    return parsed;
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return "—";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return "Unknown time";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
  }

  function escapeCsv(value) {
    let text = String(value ?? "");
    if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  function emptyState(title, message) {
    return `<div class="empty"><strong>${escapeHtml(title)}</strong>${escapeHtml(message)}</div>`;
  }

  function pageHeader(eyebrow, title, description, date = false) {
    return `<header class="page-head"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>${date ? `<span class="date-chip">${escapeHtml(new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date()))}</span>` : ""}</header>`;
  }

  function activityRows(rows, limit = 5) {
    if (!rows.length) return emptyState("Your activity starts here", "Records you add and update on this device appear in this local timeline.");
    return `<div class="activity-list">${rows.slice(0, limit).map(entry => `<div class="activity-row"><span class="activity-mark" aria-hidden="true">↗</span><span><strong>${escapeHtml(entry.action)}</strong><small>${escapeHtml(entry.summary)}</small></span><time datetime="${escapeHtml(entry.createdAt)}">${escapeHtml(formatDateTime(entry.createdAt))}</time></div>`).join("")}</div>`;
  }

  async function render() {
    if (!state.db) return;
    try {
      const data = await allData();
      crumb.textContent = ({ overview: "Overview", inventory: "Inventory", suppliers: "Suppliers", hrbp: "People toolkit", campaigns: "Campaigns", media: "Media studio", activity: "Activity", settings: "Data & privacy" })[state.view] || "Overview";
      document.querySelectorAll(".nav-link").forEach(button => {
        button.classList.toggle("active", button.dataset.view === state.view);
        button.setAttribute("aria-current", button.dataset.view === state.view ? "page" : "false");
      });
      root.innerHTML = ({
        overview: renderOverview(data),
        inventory: renderInventory(data.inventory),
        suppliers: renderSuppliers(data.suppliers),
        hrbp: renderHrbp(data.hrbp),
        campaigns: renderCampaigns(data.campaigns),
        media: renderMedia(),
        activity: renderActivity(data.activity),
        settings: renderSettings(data)
      })[state.view] || "";
      if (state.view === "media") drawMediaPreview();
    } catch (error) {
      fail(error);
      root.innerHTML = `<section class="card">${emptyState("Local workspace unavailable", error.message || "The browser could not load its database.")}<button class="button secondary" type="button" data-action="retry">Retry</button></section>`;
    }
  }

  function renderOverview(data) {
    const lowStock = data.inventory.filter(item => item.quantity <= item.reorderPoint).length;
    const pending = data.campaigns.filter(item => item.status !== "Approved").length;
    const events = [...data.activity].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return `${pageHeader("YOUR LOCAL WORKSPACE", "Good work, kept in view.", "A calm place to track operations, people workflows and the next campaign.", true)}
      <section class="hero"><div class="hero-content"><p class="eyebrow">MOONWALK · PRIVATE BY DESIGN</p><h2>Your work. Your device.<br>Your next step.</h2><p>A useful, installable workspace for everyday business coordination. Your records stay in this browser profile; nothing is sent to a server.</p><button class="button" type="button" data-view="inventory">Open your workspace <span aria-hidden="true">→</span></button></div></section>
      <section class="metrics" aria-label="Workspace summary">
        <article class="metric"><div class="metric-top">Inventory items <span class="metric-icon">▦</span></div><strong>${data.inventory.length}</strong><small>Saved in this browser</small></article>
        <article class="metric"><div class="metric-top">At reorder point <span class="metric-icon">↻</span></div><strong>${lowStock}</strong><small>Review before replenishing</small></article>
        <article class="metric"><div class="metric-top">Suppliers <span class="metric-icon">◇</span></div><strong>${data.suppliers.length}</strong><small>Local contact register</small></article>
        <article class="metric"><div class="metric-top">Campaign drafts <span class="metric-icon">✳</span></div><strong>${pending}</strong><small>Pending internal review</small></article>
      </section>
      <div class="dashboard-grid"><section class="card"><div class="card-head"><h2>Pick up where you left off</h2><button class="text-button" type="button" data-view="activity">View activity →</button></div>
        <div class="quick-grid">
          <button class="quick-action" type="button" data-view="inventory"><span class="metric-icon">▦</span><span><strong>Manage inventory</strong><small>Items, stock and reorder levels</small></span></button>
          <button class="quick-action" type="button" data-view="hrbp"><span class="metric-icon">◇</span><span><strong>People toolkit</strong><small>Start a generic HR checklist</small></span></button>
          <button class="quick-action" type="button" data-view="campaigns"><span class="metric-icon">✳</span><span><strong>Plan a campaign</strong><small>Draft and review content</small></span></button>
          <button class="quick-action" type="button" data-view="media"><span class="metric-icon">▧</span><span><strong>Open media studio</strong><small>Edit a local image copy</small></span></button>
        </div><div class="notice"><span aria-hidden="true">ⓘ</span><span><strong>Local-only preview.</strong> Data is saved by this browser on this device. Clearing browser site data can erase it—export a backup from Data &amp; privacy.</span></div></section>
        <section class="card"><div class="card-head"><h2>Recent activity</h2><span class="badge">This device</span></div>${activityRows(events, 5)}</section>
      </div>`;
  }

  function renderInventory(items) {
    const query = state.inventorySearch.toLocaleLowerCase();
    const rows = [...items].filter(item => `${item.sku} ${item.name}`.toLocaleLowerCase().includes(query)).sort((a, b) => a.name.localeCompare(b.name));
    return `${pageHeader("OPERATIONS", "Inventory", "Keep a lightweight stock register and record every quantity change with a reason.")}
      <div class="toolbar"><h2>Your items <span class="badge">${items.length}</span></h2><div class="toolbar-controls"><input class="search-input" type="search" data-search="inventory" value="${escapeHtml(state.inventorySearch)}" placeholder="Search SKU or item" aria-label="Search inventory"><button class="button secondary" type="button" data-action="export-inventory">Export CSV</button></div></div>
      <div class="split-layout"><section class="card"><div class="table-wrap">${rows.length ? `<table><thead><tr><th>SKU</th><th>Item</th><th>On hand</th><th>Reorder at</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(item => `<tr><td><strong>${escapeHtml(item.sku)}</strong></td><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${item.reorderPoint}</td><td><span class="badge${item.quantity <= item.reorderPoint ? " orange" : ""}">${item.quantity <= item.reorderPoint ? "Review stock" : "In range"}</span></td><td><button class="text-button" type="button" data-action="delete-inventory" data-id="${item.id}" aria-label="Delete ${escapeHtml(item.name)}">Remove</button></td></tr>`).join("")}</tbody></table>` : emptyState(query ? "No matching items" : "No inventory yet", query ? "Try another search." : "Add a product to create your local stock register.")}</div>
          <div class="callout mt-12">Record stock changes with a reason. This local browser log is for operational visibility, not a tamper-proof compliance record.</div>
        </section><div class="form-card"><h2>Add an item</h2><p class="field-help">Use an internal SKU. Changes stay on this device.</p><form class="form-grid" id="inventory-form">
          <div class="field"><label for="item-sku">SKU</label><input id="item-sku" name="sku" maxlength="40" required autocomplete="off"></div>
          <div class="field"><label for="item-name">Product name</label><input id="item-name" name="name" maxlength="120" required></div>
          <div class="field"><label for="item-quantity">Opening stock</label><input id="item-quantity" name="quantity" type="number" min="0" max="1000000" step="1" value="0" required></div>
          <div class="field"><label for="item-reorder">Reorder point</label><input id="item-reorder" name="reorderPoint" type="number" min="0" max="1000000" step="1" value="0" required></div>
          <div class="field full"><button class="button" type="submit">Add to inventory</button></div>
        </form>
        <hr class="form-divider"><h2>Record a movement</h2><p class="field-help">Positive for received stock; negative for issued stock. Quantity cannot go below zero.</p>
        <form class="form-grid" id="movement-form"><div class="field full"><label for="movement-item">Item</label><select id="movement-item" name="itemId" required>${items.map(item => `<option value="${item.id}">${escapeHtml(item.sku)} · ${escapeHtml(item.name)} (${item.quantity})</option>`).join("")}</select></div>
          <div class="field"><label for="movement-delta">Quantity change</label><input id="movement-delta" name="delta" type="number" min="-1000000" max="1000000" step="1" required></div>
          <div class="field"><label for="movement-reason">Reason</label><input id="movement-reason" name="reason" maxlength="160" required></div>
          <div class="field full"><button class="button secondary" type="submit" ${items.length ? "" : "disabled"}>Record movement</button></div>
        </form></div></div>`;
  }

  function renderSuppliers(suppliers) {
    const query = state.supplierSearch.toLocaleLowerCase();
    const rows = [...suppliers].filter(item => `${item.company} ${item.contact} ${item.email}`.toLocaleLowerCase().includes(query)).sort((a, b) => a.company.localeCompare(b.company));
    return `${pageHeader("OPERATIONS", "Suppliers", "A simple local contact register. Review labels are entered by you—not externally verified.")}
      <div class="toolbar"><h2>Supplier register <span class="badge">${suppliers.length}</span></h2><div class="toolbar-controls"><input class="search-input" type="search" data-search="suppliers" value="${escapeHtml(state.supplierSearch)}" placeholder="Search supplier or contact" aria-label="Search suppliers"></div></div>
      <div class="split-layout"><section class="card"><div class="table-wrap">${rows.length ? `<table><thead><tr><th>Company</th><th>Contact</th><th>Email</th><th>Review status</th><th></th></tr></thead><tbody>${rows.map(item => `<tr><td><strong>${escapeHtml(item.company)}</strong></td><td>${escapeHtml(item.contact || "—")}</td><td>${escapeHtml(item.email || "—")}</td><td><span class="badge">${escapeHtml(item.status || "Pending")}</span></td><td><button class="text-button" type="button" data-action="delete-supplier" data-id="${item.id}" aria-label="Delete ${escapeHtml(item.company)}">Remove</button></td></tr>`).join("")}</tbody></table>` : emptyState("No suppliers yet", "Add a company to keep contact details on this device.")}</div></section>
      <section class="form-card"><h2>Add a supplier</h2><form class="form-grid" id="supplier-form">
        <div class="field full"><label for="supplier-company">Company</label><input id="supplier-company" name="company" maxlength="120" required></div>
        <div class="field"><label for="supplier-contact">Contact name (optional)</label><input id="supplier-contact" name="contact" maxlength="100"></div>
        <div class="field"><label for="supplier-email">Email (optional)</label><input id="supplier-email" name="email" type="email" maxlength="254"></div>
        <div class="field full"><label for="supplier-status">Internal review status</label><select id="supplier-status" name="status"><option>Pending</option><option>Reviewed</option><option>Needs follow-up</option></select></div>
        <div class="form-actions"><button class="button" type="submit">Save supplier</button></div>
      </form><div class="notice"><span>ⓘ</span><span>Contact data is stored locally in this browser profile. This is not a supplier background check or identity verification.</span></div></section></div>`;
  }

  function renderHrbp(records) {
    const cards = Object.entries(TEMPLATES).map(([name, tasks]) => {
      const completed = tasks.reduce((count, _, index) => count + (records.find(record => record.id === `${name}:${index}`)?.done ? 1 : 0), 0);
      const progress = Math.round(completed / tasks.length * 100);
      return `<article class="template-card"><h3>${escapeHtml(name)}</h3><div class="checklist">${tasks.map((task, index) => {
        const id = `${name}:${index}`;
        const checked = records.find(record => record.id === id)?.done === true;
        return `<label class="check-row"><input type="checkbox" data-hrbp-id="${escapeHtml(id)}" ${checked ? "checked" : ""}><span>${escapeHtml(task)}</span></label>`;
      }).join("")}</div><progress class="progressbar" max="${tasks.length}" value="${completed}" aria-label="${progress}% complete"></progress><span class="progress-copy">${completed} of ${tasks.length} coordination steps marked</span></article>`;
    }).join("");
    return `${pageHeader("PEOPLE OPERATIONS", "A thoughtful start.", "Generic checklists for everyday coordination—never employee scoring or automated decisions.")}
      <div class="callout">Privacy by default: these templates contain no employee-name, health, demographic, performance-rating, or case-record fields. Do not put personal or sensitive employee information into this preview.</div>
      <div class="toolbar"><h2>HRBP coordination templates</h2><span class="badge">Saved on this device</span></div><div class="template-list">${cards}</div>
      <div class="notice"><span>ⓘ</span><span>Planning aids only. Follow approved organizational processes and local law. Completion marks are saved locally and can be changed or deleted in this browser.</span></div>`;
  }

  function renderCampaigns(campaigns) {
    const query = state.campaignSearch.toLocaleLowerCase();
    const rows = [...campaigns].filter(item => `${item.title} ${item.channel} ${item.copy}`.toLocaleLowerCase().includes(query)).sort((a, b) => (a.plannedDate || "").localeCompare(b.plannedDate || ""));
    return `${pageHeader("BRAND & CONTENT", "Make room for good ideas.", "Plan a campaign, keep the draft, and record an internal review. Nothing is published or sent.")}
      <div class="split-layout"><section class="card"><div class="toolbar compact"><h2>Your campaign drafts</h2><input class="search-input" type="search" data-search="campaigns" value="${escapeHtml(state.campaignSearch)}" placeholder="Search drafts" aria-label="Search campaign drafts"></div>
        ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Campaign</th><th>Channel</th><th>Planned</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(item => `<tr><td><strong>${escapeHtml(item.title)}</strong></td><td>${escapeHtml(item.channel)}</td><td>${escapeHtml(item.plannedDate || "—")}</td><td><span class="badge${item.status === "Approved" ? "" : " orange"}">${escapeHtml(item.status)}</span></td><td><button class="text-button" type="button" data-action="campaign-transition" data-id="${item.id}">${item.status === "Draft" ? "Review" : item.status === "In review" ? "Approve" : "Reopen"}</button></td></tr><tr><td colspan="5">${escapeHtml(item.copy)}</td></tr>`).join("")}</tbody></table></div>` : emptyState("No campaign drafts yet", "Drafts and internal review states are stored locally.")}</section>
      <section class="form-card"><h2>Start a draft</h2><p class="field-help">Keep the content; choose a publication plan later in your approved workflow.</p><form class="form-grid" id="campaign-form">
        <div class="field full"><label for="campaign-title">Campaign title</label><input id="campaign-title" name="title" maxlength="100" required></div>
        <div class="field"><label for="campaign-channel">Channel</label><select id="campaign-channel" name="channel"><option>Website</option><option>Instagram</option><option>LinkedIn</option><option>Facebook</option><option>Email</option><option>Other</option></select></div>
        <div class="field"><label for="campaign-date">Planned date</label><input id="campaign-date" name="plannedDate" type="date"></div>
        <div class="field full"><label for="campaign-copy">Draft copy</label><textarea id="campaign-copy" name="copy" maxlength="3000" rows="5" required></textarea></div>
        <div class="field full"><button class="button" type="submit">Save draft</button></div>
      </form><div class="notice"><span>ⓘ</span><span>“Approved” means internal review only. This preview has no social publishing connection.</span></div></section></div>`;
  }

  function renderMedia() {
    return `${pageHeader("CREATIVE STUDIO", "Shape the story.", "A private canvas for quick image adjustments. Work on a copy; your source file is untouched.")}
      <div class="callout">Images are processed in this browser and are not uploaded or saved into the workspace database. Supported files: PNG, JPEG and WebP; maximum 25 MB and 30 megapixels.</div>
      <section class="card mt-14"><div class="media-toolbar">
        <label class="button secondary" for="media-file">Open image</label><input class="visually-hidden" id="media-file" type="file" accept="image/png,image/jpeg,image/webp">
        <button class="button secondary" type="button" data-action="media-rotate" ${state.media ? "" : "disabled"}>Rotate 90°</button>
        <button class="button secondary" type="button" data-action="media-flip" ${state.media ? "" : "disabled"}>Flip horizontal</button>
        <span class="field-inline">Width <input id="media-width" type="number" min="1" max="30000" value="${state.media?.width || ""}" ${state.media ? "" : "disabled"} aria-label="Edited image width in pixels"> px</span>
        <span class="field-inline">Height <input id="media-height" type="number" min="1" max="30000" value="${state.media?.height || ""}" ${state.media ? "" : "disabled"} aria-label="Edited image height in pixels"> px</span>
        <button class="button secondary" type="button" data-action="media-resize" ${state.media ? "" : "disabled"}>Resize</button>
        <button class="button" type="button" data-action="media-export" ${state.media ? "" : "disabled"}>Export PNG</button>
      </div>
      <div class="media-stage"><canvas id="media-canvas" hidden aria-label="Edited image preview"></canvas><div class="media-empty" ${state.media ? "hidden" : ""}><strong>Your canvas is ready</strong>Open an image from this device to rotate, flip or resize a working copy. Nothing leaves the browser.</div></div>
      <div class="storage-line"><span>Source</span><strong id="media-source-name">${escapeHtml(state.media?.name || "No image loaded")}</strong></div>
      <div class="storage-line"><span>Working size</span><strong id="media-dimensions">${state.media ? `${state.media.width.toLocaleString()} × ${state.media.height.toLocaleString()} px` : "—"}</strong></div></section>`;
  }

  function renderActivity(events) {
    const query = state.activityFilter.toLocaleLowerCase();
    const rows = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).filter(item => `${item.action} ${item.summary}`.toLocaleLowerCase().includes(query));
    return `${pageHeader("LOCAL OBSERVABILITY", "A clear record of the work.", "A browser-local activity feed for operational visibility. It is not a tamper-proof or server-side audit log.")}
      <section class="card"><div class="toolbar compact"><h2>Recent workspace changes <span class="badge">${events.length}</span></h2><div class="toolbar-controls"><input class="search-input" type="search" data-search="activity" value="${escapeHtml(state.activityFilter)}" placeholder="Filter activity" aria-label="Filter activity"><button class="button secondary" type="button" data-action="export-activity">Download CSV</button></div></div>
      ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>When (device time)</th><th>Action</th><th>Detail</th></tr></thead><tbody>${rows.map(item => `<tr><td>${escapeHtml(formatDateTime(item.createdAt))}</td><td><strong>${escapeHtml(item.action)}</strong></td><td>${escapeHtml(item.summary)}</td></tr>`).join("")}</tbody></table></div>` : emptyState("No matching activity", "New actions are written to this browser's local database.")}</section>
      <div class="notice"><span>ⓘ</span><span>This feed lives in the same browser profile as the app data. A person with access to this device/browser can alter or clear it; it does not prove identity or provide compliance-grade evidence.</span></div>`;
  }

  function renderSettings(data) {
    const counts = STORES.map(name => `<div class="storage-line"><span>${escapeHtml(name[0].toUpperCase() + name.slice(1))}</span><strong>${data[name].length} records</strong></div>`).join("");
    return `${pageHeader("DATA STEWARDSHIP", "Your data, in your hands.", "Understand what this preview saves, make a portable backup, or clear this browser's workspace.")}
      <div class="callout">Local-only means exactly that: this preview does not create an account, sync to a server, or write your records to ThreadForge's SQL service. Use an encrypted, trusted device. Browser storage is not encrypted by this app.</div>
      <div class="settings-grid"><section class="setting-card"><h3>Workspace storage</h3><p>App records are stored in IndexedDB for this site and browser profile. Browser settings, private browsing, or clearing site data can remove them.</p>${counts}<div class="storage-line"><span>Persistent storage request</span><strong>${state.persistentStorage ? "Granted by browser" : "Not granted"}</strong></div><button class="button secondary" type="button" data-action="request-persistence">Request persistent storage</button></section>
      <section class="setting-card"><h3>Backup &amp; restore</h3><p>Export an encrypted-device-appropriate backup file to a location you control. A restore replaces all records in this browser after confirmation.</p><div class="toolbar-controls"><button class="button" type="button" data-action="export-backup">Export backup</button><label class="button secondary" for="backup-file">Restore backup</label><input class="visually-hidden" id="backup-file" type="file" accept="application/json,.json"></div><p class="field-help">Backup file max 10 MB. Keep it private; it contains the records you saved.</p></section>
      <section class="setting-card"><h3>What is not monitored</h3><p>There is no remote telemetry, admin console, central SQL database, cross-device monitoring, or tamper-resistant logging in this edition. The activity screen is a convenience log held beside your records.</p><button class="button secondary" type="button" data-view="activity">Open activity log</button></section>
      <section class="setting-card"><h3>Remove local data</h3><p>Clear this app's inventory, supplier contacts, drafts, HRBP checklist marks and local activity from this browser.</p><button class="button danger" type="button" data-action="clear-data">Clear this workspace</button></section></div>`;
  }

  function closeMenu() {
    sidebar.classList.remove("open");
    scrim.hidden = true;
    document.querySelector("#menu-button").setAttribute("aria-expanded", "false");
  }

  async function openView(name) {
    if (!["overview", "inventory", "suppliers", "hrbp", "campaigns", "media", "activity", "settings"].includes(name)) return;
    state.view = name;
    closeMenu();
    await render();
    document.querySelector("#main").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitInventory(form) {
    const values = new FormData(form);
    const sku = safeText(values.get("sku"), 40, "SKU").toLocaleUpperCase();
    const name = safeText(values.get("name"), 120, "Product name");
    const quantity = wholeNumber(values.get("quantity"), 0, 1_000_000, "Opening stock");
    const reorderPoint = wholeNumber(values.get("reorderPoint"), 0, 1_000_000, "Reorder point");
    await commitAndLog(["inventory"], "Inventory added", `${sku} · ${name} · opening stock ${quantity}`, tx => {
      tx.objectStore("inventory").add({ sku, name, quantity, reorderPoint, updatedAt: new Date().toISOString() });
    });
  }

  async function submitMovement(form) {
    const values = new FormData(form);
    const id = wholeNumber(values.get("itemId"), 1, Number.MAX_SAFE_INTEGER, "Item");
    const delta = wholeNumber(values.get("delta"), -1_000_000, 1_000_000, "Quantity change");
    const reason = safeText(values.get("reason"), 160, "Reason");
    if (delta === 0) throw new Error("Enter a non-zero stock change.");
    let movementSummary = "";
    await transaction(["inventory", "activity"], "readwrite", (tx, abort) => {
      const store = tx.objectStore("inventory");
      const request = store.get(id);
      request.onsuccess = () => {
        const item = request.result;
        if (!item) {
          abort(new Error("That inventory item is no longer available."));
          return;
        }
        const quantity = item.quantity + delta;
        if (quantity < 0 || quantity > 1_000_000) {
          abort(new Error("The movement would put stock outside the supported 0–1,000,000 range."));
          return;
        }
        item.quantity = quantity;
        item.updatedAt = new Date().toISOString();
        store.put(item);
        movementSummary = `${item.sku} · ${delta > 0 ? "+" : ""}${delta} · ${reason}`;
        tx.objectStore("activity").add({
          action: "Stock movement recorded",
          summary: movementSummary,
          createdAt: new Date().toISOString()
        });
      };
    });
    await refreshAfterWrite(movementSummary);
  }

  async function submitSupplier(form) {
    const values = new FormData(form);
    const company = safeText(values.get("company"), 120, "Company");
    const contact = String(values.get("contact") || "").trim().slice(0, 100);
    const email = String(values.get("email") || "").trim().slice(0, 254);
    const status = String(values.get("status"));
    if (!["Pending", "Reviewed", "Needs follow-up"].includes(status)) throw new Error("Choose a supported review status.");
    await commitAndLog(["suppliers"], "Supplier saved", `${company} · ${status}`, tx => {
      tx.objectStore("suppliers").add({ company, contact, email, status, updatedAt: new Date().toISOString() });
    });
  }

  async function submitCampaign(form) {
    const values = new FormData(form);
    const title = safeText(values.get("title"), 100, "Campaign title");
    const channel = safeText(values.get("channel"), 40, "Channel");
    const plannedDate = String(values.get("plannedDate") || "");
    if (plannedDate && !/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) throw new Error("Choose a valid planned date.");
    const copy = safeText(values.get("copy"), 3000, "Draft copy");
    await commitAndLog(["campaigns"], "Campaign draft saved", `${title} · ${channel}`, tx => {
      tx.objectStore("campaigns").add({ title, channel, plannedDate, copy, status: "Draft", updatedAt: new Date().toISOString() });
    });
  }

  async function transitionCampaign(id) {
    let campaignSummary = "";
    await transaction(["campaigns", "activity"], "readwrite", (tx, abort) => {
      const store = tx.objectStore("campaigns");
      const request = store.get(id);
      request.onsuccess = () => {
        const campaign = request.result;
        if (!campaign) {
          abort(new Error("Campaign draft not found."));
          return;
        }
        campaign.status = campaign.status === "Draft" ? "In review" : campaign.status === "In review" ? "Approved" : "Draft";
        campaign.updatedAt = new Date().toISOString();
        store.put(campaign);
        campaignSummary = `${campaign.title} · ${campaign.status} · internal workflow only`;
        tx.objectStore("activity").add({ action: "Campaign review updated", summary: campaignSummary, createdAt: new Date().toISOString() });
      };
    });
    await refreshAfterWrite(campaignSummary);
  }

  async function setHrbpTask(id, done) {
    const [template, indexText] = id.split(":");
    const index = Number(indexText);
    if (!TEMPLATES[template] || !Number.isInteger(index) || index < 0 || index >= TEMPLATES[template].length) {
      throw new Error("Checklist item is invalid.");
    }
    const record = { id, template, index, done, updatedAt: new Date().toISOString() };
    await commitAndLog(["hrbp"], done ? "Checklist step completed" : "Checklist step reopened", `${template} · step ${index + 1}`, tx => {
      tx.objectStore("hrbp").put(record);
    });
  }

  async function deleteRecord(store, id, label) {
    if (!window.confirm(`Remove this ${label} from the local workspace?`)) return;
    await commitAndLog([store], `${label[0].toUpperCase() + label.slice(1)} removed`, `Local record ${id}`, tx => {
      tx.objectStore(store).delete(id);
    });
  }

  async function exportBackup() {
    const backup = { format: "threadforge-moonwalk-local-backup", version: 1, exportedAt: new Date().toISOString(), data: await allData() };
    downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }), `moonwalk-local-backup-${new Date().toISOString().slice(0, 10)}.json`);
    toast("Local backup exported. Store it somewhere private.");
  }

  function validateBackup(backup) {
    if (!backup || backup.format !== "threadforge-moonwalk-local-backup" || backup.version !== 1 || !backup.data || typeof backup.data !== "object") {
      throw new Error("This is not a supported Moonwalk local backup.");
    }
    for (const store of STORES) {
      if (!Array.isArray(backup.data[store]) || backup.data[store].length > 100_000) throw new Error(`Backup store "${store}" is missing or exceeds the supported size.`);
    }
    const inventorySkus = new Set();
    for (const item of backup.data.inventory) {
      if (!item || typeof item.sku !== "string" || typeof item.name !== "string" || !Number.isSafeInteger(item.quantity) || item.quantity < 0 || !Number.isSafeInteger(item.reorderPoint) || item.reorderPoint < 0) throw new Error("Backup contains an invalid inventory record.");
      const sku = item.sku.toLocaleUpperCase();
      if (inventorySkus.has(sku)) throw new Error("Backup contains duplicate inventory SKUs.");
      inventorySkus.add(sku);
    }
    for (const supplier of backup.data.suppliers) {
      if (!supplier || typeof supplier.company !== "string" || !["Pending", "Reviewed", "Needs follow-up"].includes(supplier.status)) throw new Error("Backup contains an invalid supplier record.");
    }
    for (const task of backup.data.hrbp) {
      if (!task || typeof task.id !== "string" || typeof task.template !== "string" || !TEMPLATES[task.template] || !Number.isInteger(task.index) || task.index < 0 || task.index >= TEMPLATES[task.template].length || typeof task.done !== "boolean") throw new Error("Backup contains an invalid HRBP checklist record.");
    }
    for (const campaign of backup.data.campaigns) {
      if (!campaign || typeof campaign.title !== "string" || typeof campaign.channel !== "string" || typeof campaign.copy !== "string" || !["Draft", "In review", "Approved"].includes(campaign.status)) throw new Error("Backup contains an invalid campaign record.");
    }
    for (const event of backup.data.activity) {
      if (!event || typeof event.action !== "string" || typeof event.summary !== "string" || typeof event.createdAt !== "string" || Number.isNaN(Date.parse(event.createdAt))) throw new Error("Backup contains an invalid activity record.");
    }
  }

  async function restoreBackup(file) {
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) throw new Error("Backup exceeds the 10 MB size limit.");
    const backup = JSON.parse(await file.text());
    validateBackup(backup);
    if (!window.confirm("Restore replaces every local workspace record and activity entry in this browser. Export a backup first if you may need the current data. Continue?")) return;
    await transaction(STORES, "readwrite", tx => {
      for (const name of STORES) {
        const store = tx.objectStore(name);
        store.clear();
        for (const row of backup.data[name]) store.add(row);
      }
      tx.objectStore("activity").add({
        action: "Local backup restored",
        summary: "Workspace restored from a user-selected local backup.",
        createdAt: new Date().toISOString()
      });
    });
    toast("Backup restored to this browser.");
    await render();
  }

  async function clearData() {
    if (!window.confirm("Permanently clear all Moonwalk records and local activity from this browser? This cannot be undone. Export a backup first if needed.")) return;
    await transaction(STORES, "readwrite", tx => STORES.forEach(name => tx.objectStore(name).clear()));
    toast("Local workspace cleared.");
    await render();
  }

  async function requestPersistence() {
    if (!navigator.storage?.persist) throw new Error("This browser does not support persistent site storage.");
    state.persistentStorage = await navigator.storage.persist();
    toast(state.persistentStorage ? "Browser granted persistent storage." : "Browser did not grant persistent storage; export regular backups.");
    await render();
  }

  async function exportInventory() {
    const rows = await readAll("inventory");
    const csv = [["SKU", "Product", "Quantity", "Reorder point", "Updated at"], ...rows.map(item => [item.sku, item.name, item.quantity, item.reorderPoint, item.updatedAt])].map(row => row.map(escapeCsv).join(",")).join("\r\n");
    downloadBlob(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }), "moonwalk-inventory.csv");
    toast("Inventory CSV exported.");
  }

  async function exportActivity() {
    const rows = await readAll("activity");
    const csv = [["When", "Action", "Detail"], ...rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(item => [item.createdAt, item.action, item.summary])].map(row => row.map(escapeCsv).join(",")).join("\r\n");
    downloadBlob(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }), "moonwalk-activity.csv");
    toast("Local activity CSV exported.");
  }

  function drawMediaPreview() {
    if (!state.media) return;
    const canvas = document.querySelector("#media-canvas");
    if (!canvas) return;
    const source = state.media.bitmap;
    const turns = ((state.media.rotation % 360) + 360) % 360;
    const rotated = turns === 90 || turns === 270;
    const outWidth = rotated ? state.media.height : state.media.width;
    const outHeight = rotated ? state.media.width : state.media.height;
    canvas.width = outWidth;
    canvas.height = outHeight;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("This browser could not create an image canvas.");
    context.translate(outWidth / 2, outHeight / 2);
    context.rotate(turns * Math.PI / 180);
    context.scale(state.media.flip ? -1 : 1, 1);
    context.drawImage(source, -state.media.width / 2, -state.media.height / 2, state.media.width, state.media.height);
    canvas.hidden = false;
    const empty = document.querySelector(".media-empty");
    if (empty) empty.hidden = true;
    const sourceName = document.querySelector("#media-source-name");
    const dimensions = document.querySelector("#media-dimensions");
    if (sourceName) sourceName.textContent = state.media.name;
    if (dimensions) dimensions.textContent = `${outWidth.toLocaleString()} × ${outHeight.toLocaleString()} px`;
  }

  async function loadMedia(file) {
    if (!file) return;
    if (file.size > MAX_MEDIA_BYTES) throw new Error("Choose an image smaller than 25 MB.");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Choose a PNG, JPEG or WebP image.");
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    if (bitmap.width * bitmap.height > MAX_MEDIA_PIXELS) {
      bitmap.close();
      throw new Error("Image exceeds the 30 megapixel limit.");
    }
    if (state.media?.bitmap) state.media.bitmap.close();
    state.media = { bitmap, name: file.name.slice(0, 180), width: bitmap.width, height: bitmap.height, rotation: 0, flip: false };
    await render();
  }

  function resizeMedia() {
    if (!state.media) throw new Error("Open an image first.");
    const width = wholeNumber(document.querySelector("#media-width").value, 1, 30_000, "Width");
    const height = wholeNumber(document.querySelector("#media-height").value, 1, 30_000, "Height");
    if (width * height > MAX_MEDIA_PIXELS) throw new Error("Output exceeds the 30 megapixel limit.");
    state.media.width = width;
    state.media.height = height;
    drawMediaPreview();
    document.querySelector("#media-width").value = String(width);
    document.querySelector("#media-height").value = String(height);
  }

  function exportMedia() {
    if (!state.media) throw new Error("Open an image first.");
    const canvas = document.querySelector("#media-canvas");
    canvas.toBlob(blob => {
      if (!blob) {
        fail(new Error("The browser could not export this image."));
        return;
      }
      downloadBlob(blob, `${state.media.name.replace(/\.[^.]+$/, "")}-edited.png`);
      toast("Edited PNG downloaded. The source image is unchanged.");
    }, "image/png");
  }

  function navigateForAction(button) {
    if (button.dataset.view) {
      void openView(button.dataset.view);
      return true;
    }
    return false;
  }

  document.addEventListener("click", event => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton && navigateForAction(viewButton)) return;
    const action = event.target.closest("[data-action]");
    if (!action) return;
    const id = Number(action.dataset.id);
    Promise.resolve().then(async () => {
      switch (action.dataset.action) {
        case "retry": await render(); break;
        case "delete-inventory": await deleteRecord("inventory", id, "inventory item"); break;
        case "delete-supplier": await deleteRecord("suppliers", id, "supplier"); break;
        case "campaign-transition": await transitionCampaign(id); break;
        case "export-inventory": await exportInventory(); break;
        case "export-activity": await exportActivity(); break;
        case "export-backup": await exportBackup(); break;
        case "clear-data": await clearData(); break;
        case "request-persistence": await requestPersistence(); break;
        case "media-rotate":
          if (!state.media) throw new Error("Open an image first.");
          state.media.rotation = (state.media.rotation + 90) % 360;
          await render();
          break;
        case "media-flip":
          if (!state.media) throw new Error("Open an image first.");
          state.media.flip = !state.media.flip;
          drawMediaPreview();
          break;
        case "media-resize": resizeMedia(); break;
        case "media-export": exportMedia(); break;
        default: break;
      }
    }).catch(fail);
  });

  root.addEventListener("submit", event => {
    event.preventDefault();
    const form = event.target;
    Promise.resolve().then(async () => {
      if (form.id === "inventory-form") await submitInventory(form);
      else if (form.id === "movement-form") await submitMovement(form);
      else if (form.id === "supplier-form") await submitSupplier(form);
      else if (form.id === "campaign-form") await submitCampaign(form);
    }).catch(fail);
  });

  root.addEventListener("input", event => {
    const field = event.target;
    if (!field.matches("[data-search]")) return;
    if (field.dataset.search === "inventory") state.inventorySearch = field.value;
    else if (field.dataset.search === "suppliers") state.supplierSearch = field.value;
    else if (field.dataset.search === "campaigns") state.campaignSearch = field.value;
    else if (field.dataset.search === "activity") state.activityFilter = field.value;
    const position = field.selectionStart;
    void render().then(() => {
      const next = root.querySelector(`[data-search="${CSS.escape(field.dataset.search)}"]`);
      if (next) {
        next.focus();
        next.setSelectionRange(position, position);
      }
    }).catch(fail);
  });

  root.addEventListener("change", event => {
    const field = event.target;
    if (field.matches("[data-hrbp-id]")) void setHrbpTask(field.dataset.hrbpId, field.checked).catch(fail);
    if (field.id === "media-file") void loadMedia(field.files?.[0]).catch(fail);
    if (field.id === "backup-file" && field.files?.[0]) {
      void restoreBackup(field.files[0]).catch(fail).finally(() => { field.value = ""; });
    }
  });

  document.querySelectorAll(".nav-link").forEach(button => button.addEventListener("click", () => void openView(button.dataset.view)));
  document.querySelector("#menu-button").addEventListener("click", event => {
    const opening = !sidebar.classList.contains("open");
    sidebar.classList.toggle("open", opening);
    scrim.hidden = !opening;
    event.currentTarget.setAttribute("aria-expanded", String(opening));
  });
  scrim.addEventListener("click", closeMenu);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu();
  });

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    state.installPrompt = event;
    document.querySelector("#install-button").hidden = false;
  });

  document.querySelector("#install-button").addEventListener("click", async event => {
    if (!state.installPrompt) return;
    event.currentTarget.disabled = true;
    try {
      await state.installPrompt.prompt();
      await state.installPrompt.userChoice;
      state.installPrompt = null;
      event.currentTarget.hidden = true;
    } catch (error) {
      fail(error);
    } finally {
      event.currentTarget.disabled = false;
    }
  });

  window.addEventListener("appinstalled", () => {
    state.installPrompt = null;
    document.querySelector("#install-button").hidden = true;
    toast("Moonwalk installed on this device.");
  });

  async function start() {
    if (!("indexedDB" in window)) throw new Error("This browser does not support local IndexedDB storage.");
    state.db = await openDatabase();
    const status = document.querySelector("#connection-state");
    try {
      state.persistentStorage = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
    } catch (error) {
      state.persistentStorage = false;
      console.error("Moonwalk storage persistence status could not be checked:", error);
    }
    status.textContent = "Local database ready · no sync";
    await render();
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/moonwalk/sw.js", { scope: "/moonwalk/" })
        .then(() => { status.textContent = "Offline app ready · no sync"; })
        .catch(error => {
          status.textContent = "Local database ready · offline setup failed";
          console.error("Moonwalk offline app setup failed:", error);
        });
    }
  }

  start().catch(error => {
    document.querySelector("#connection-state").textContent = "Local storage unavailable";
    fail(error);
    root.innerHTML = `<section class="card">${emptyState("Could not open local storage", error.message || "This browser could not create the workspace database.")}</section>`;
  });
})();

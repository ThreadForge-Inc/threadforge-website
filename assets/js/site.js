/* ThreadForge website behaviour. No tracking, no network requests. */

(function () {

  "use strict";



  var root = document.documentElement;



  function store(key, value) {

    try {

      if (value === undefined) return window.localStorage.getItem(key);

      if (value === null) window.localStorage.removeItem(key);

      else window.localStorage.setItem(key, value);

    } catch (error) {

      return null;

    }

    return null;

  }



  function copyText(text, button) {

    var label = button ? button.textContent : "";

    function done(ok) {

      if (!button) return;

      button.textContent = ok ? "Copied" : "Select and copy";

      window.setTimeout(function () { button.textContent = label; }, 1800);

    }

    if (navigator.clipboard && navigator.clipboard.writeText) {

      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });

    } else {

      done(false);

    }

  }



  // Theme: system, light, dark, or one of three vision-friendly themes. Stored only in this browser.

  var themeButton = document.getElementById("theme-toggle");

  var THEMES = [

    ["cosmos", "Royal Navy & Gold", "Marine oceanic navy, golden silhouette & Royal English serif"],

    ["system", "Match this device", "Light or dark, as your device is set"],

    ["light", "Light", "The standard ThreadForge colours"],

    ["dark", "Dark", "Easier on the eyes at night"],

    ["contrast", "High contrast", "White on black, the strongest contrast"],

    ["warm", "Warm reading", "Soft paper tones with less glare"],

    ["cvd", "Colour-blind safe", "Blue and orange instead of green"]

  ];

  var names = {};

  THEMES.forEach(function (t) { names[t[0]] = t[1]; });

  var themeMenu = null;

  function applyTheme(mode) {

    if (!names[mode]) mode = "cosmos";

    if (mode === "system") root.removeAttribute("data-theme");

    else root.setAttribute("data-theme", mode);

    if (themeButton) {

      themeButton.setAttribute("data-mode", mode);

      themeButton.setAttribute("aria-label", "Colour theme: " + names[mode]);

      themeButton.title = "Colour theme: " + names[mode];

    }

    if (themeMenu) themeMenu.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-theme-choice") === mode)); });

  }

  if (themeButton) {

    // An eye icon stands for the three vision-friendly themes.

    themeButton.insertAdjacentHTML("beforeend", '<svg class="i-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>');

    var wrap = document.createElement("div");

    wrap.className = "theme-wrap";

    themeButton.parentNode.insertBefore(wrap, themeButton);

    wrap.appendChild(themeButton);

    themeMenu = document.createElement("div");

    themeMenu.className = "theme-menu"; themeMenu.id = "theme-menu"; themeMenu.hidden = true;

    themeMenu.setAttribute("role", "menu"); themeMenu.setAttribute("aria-label", "Colour theme");

    themeMenu.innerHTML = "<p>Colour theme</p>";

    THEMES.forEach(function (t) {

      var b = document.createElement("button");

      b.type = "button"; b.setAttribute("role", "menuitemradio"); b.setAttribute("data-theme-choice", t[0]);

      b.innerHTML = '<span class="theme-swatch sw-' + t[0] + '" aria-hidden="true"></span><span></span>';

      b.lastChild.textContent = t[1];

      var hint = document.createElement("small"); hint.textContent = t[2]; b.lastChild.appendChild(hint);

      themeMenu.appendChild(b);

    });

    wrap.appendChild(themeMenu);

    themeButton.setAttribute("aria-haspopup", "menu");

    themeButton.setAttribute("aria-controls", "theme-menu");

    themeButton.setAttribute("aria-expanded", "false");

    var items = function () { return Array.prototype.slice.call(themeMenu.querySelectorAll("button")); };

    var setOpen = function (open, focusItem) {

      themeMenu.hidden = !open;

      themeButton.setAttribute("aria-expanded", String(open));

      if (open && focusItem) (themeMenu.querySelector('[aria-checked="true"]') || items()[0]).focus();

    };

    themeButton.addEventListener("click", function () { setOpen(themeMenu.hidden, true); });

    themeMenu.addEventListener("click", function (event) {

      var b = event.target.closest("button");

      if (!b) return;

      var mode = b.getAttribute("data-theme-choice");

      applyTheme(mode);

      store("tf-theme", mode);

      setOpen(false); themeButton.focus();

    });

    themeMenu.addEventListener("keydown", function (event) {

      var list = items(), i = list.indexOf(document.activeElement);

      if (event.key === "ArrowDown") { event.preventDefault(); list[(i + 1) % list.length].focus(); }

      else if (event.key === "ArrowUp") { event.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }

      else if (event.key === "Home") { event.preventDefault(); list[0].focus(); }

      else if (event.key === "End") { event.preventDefault(); list[list.length - 1].focus(); }

      else if (event.key === "Escape") { event.preventDefault(); setOpen(false); themeButton.focus(); }

      else if (event.key === "Tab") setOpen(false);

    });

    document.addEventListener("click", function (event) { if (!wrap.contains(event.target)) setOpen(false); });

  }

  applyTheme(store("tf-theme") || "cosmos");



  // Header border once the page scrolls, and the mobile menu.

  var header = document.querySelector(".site-header");

  if (header) {

    var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 8); };

    onScroll();

    window.addEventListener("scroll", onScroll, { passive: true });

  }

  var navToggle = document.querySelector(".nav-toggle");

  var nav = document.getElementById("site-nav");

  if (navToggle && nav) {

    var setMenu = function (open) {

      nav.classList.toggle("is-open", open);

      navToggle.setAttribute("aria-expanded", String(open));

      navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");

    };

    navToggle.addEventListener("click", function () { setMenu(!nav.classList.contains("is-open")); });

    nav.addEventListener("click", function (event) { if (event.target.closest("a")) { setMenu(false); closeMenus(); } });

    document.addEventListener("keydown", function (event) {

      if (event.key !== "Escape") return;

      var open = nav.querySelector('.nav-trigger[aria-expanded="true"]');

      if (open) { closeMenus(); open.focus(); }

      else if (nav.classList.contains("is-open")) { setMenu(false); navToggle.focus(); }

    });

  }



  // Products, Solutions and Resources menus: disclosure buttons, one open at a time.

  var triggers = Array.prototype.slice.call(document.querySelectorAll(".nav-trigger"));

  function closeMenus(except) {

    triggers.forEach(function (trigger) { if (trigger !== except) trigger.setAttribute("aria-expanded", "false"); });

  }

  triggers.forEach(function (trigger) {

    trigger.addEventListener("click", function () {

      var open = trigger.getAttribute("aria-expanded") === "true";

      closeMenus(trigger);

      trigger.setAttribute("aria-expanded", String(!open));

    });

  });

  document.addEventListener("click", function (event) {

    if (!event.target.closest(".nav-item")) closeMenus();

  });

  document.addEventListener("focusin", function (event) {

    if (!event.target.closest(".nav-item")) closeMenus();

  });



  // Console tabs (WAI-ARIA tabs pattern).

  var tabs = Array.prototype.slice.call(document.querySelectorAll(".console-tab"));

  function selectTab(tab, focus) {

    tabs.forEach(function (other) {

      var selected = other === tab;

      var panel = document.getElementById(other.getAttribute("aria-controls"));

      other.setAttribute("aria-selected", String(selected));

      other.tabIndex = selected ? 0 : -1;

      if (panel) {

        panel.classList.toggle("is-active", selected);

        if (selected) { panel.removeAttribute("inert"); panel.removeAttribute("aria-hidden"); }

        else { panel.setAttribute("inert", ""); panel.setAttribute("aria-hidden", "true"); }

      }

    });

    if (focus) tab.focus();

  }

  tabs.forEach(function (tab, index) {

    tab.addEventListener("click", function () { selectTab(tab, false); });

    tab.addEventListener("keydown", function (event) {

      var next = null;

      if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];

      else if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];

      else if (event.key === "Home") next = tabs[0];

      else if (event.key === "End") next = tabs[tabs.length - 1];

      if (next) { event.preventDefault(); selectTab(next, true); }

    });

  });

  if (tabs.length) selectTab(tabs.filter(function (t) { return t.getAttribute("aria-selected") === "true"; })[0] || tabs[0], false);



  // Approval demo: the decision belongs to the visitor.

  document.querySelectorAll("[data-approval]").forEach(function (box) {

    var button = box.querySelector("[data-approve]");

    var pending = box.querySelector("[data-pending]");

    var done = box.querySelector("[data-done]");

    var original = button.textContent;

    button.addEventListener("click", function () {

      var approved = !box.classList.contains("is-done");

      box.classList.toggle("is-done", approved);

      pending.hidden = approved;

      done.hidden = !approved;

      button.textContent = approved ? "Reset example" : original;

    });

    done.setAttribute("aria-live", "polite");

  });



  // The film: the hero button and highlights window open it in a player with sound.

  // The highlights loop plays muted only while it is on screen, and not at all for reduced motion or data saving.

  var filmDialog = document.getElementById("film-dialog");

  if (filmDialog && typeof filmDialog.showModal === "function") {

    var filmPlayer = filmDialog.querySelector("video");

    document.querySelectorAll("[data-film-open]").forEach(function (link) {

      link.addEventListener("click", function (event) {

        event.preventDefault();

        filmDialog.showModal();

        filmPlayer.currentTime = 0;

        var started = filmPlayer.play();

        if (started && started.catch) started.catch(function () {});

      });

    });

    filmDialog.addEventListener("close", function () { filmPlayer.pause(); });

    filmDialog.addEventListener("click", function (event) { if (event.target === filmDialog) filmDialog.close(); });

    filmDialog.querySelector("[data-film-close]").addEventListener("click", function () { filmDialog.close(); });

  }

  var teaser = document.querySelector(".film-teaser-video");

  var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var saveData = navigator.connection && navigator.connection.saveData;

  if (teaser && !calm && !saveData && "IntersectionObserver" in window) {

    new IntersectionObserver(function (entries) {

      entries.forEach(function (entry) {

        if (entry.isIntersecting) { var p = teaser.play(); if (p && p.catch) p.catch(function () {}); } else teaser.pause();

      });

    }, { threshold: .5 }).observe(teaser);

  }



  // Custom tier calculator: $19 plus $15 per desk, never more than the cheapest full tier with those
  // desks (the same rule as licence.price in the app). Prices come from the dialog's data attributes.
  var calc = document.getElementById("calc-dialog");
  if (calc && typeof calc.showModal === "function") {
    var tiers = ["essentials", "professional", "industrial"];
    var names = { essentials: "Essentials", professional: "Professional", industrial: "Industrial" };
    var boxes = calc.querySelectorAll("input[type=checkbox]");
    var priceOut = document.getElementById("calc-price");
    var noteOut = document.getElementById("calc-note");
    var order = document.getElementById("calc-order");
    var chosen = [], plan = "", message = "";
    var update = function () {
      chosen = Array.prototype.filter.call(boxes, function (box) { return box.checked; });
      if (!chosen.length) {
        priceOut.textContent = "$0"; noteOut.textContent = "Choose at least one desk."; order.setAttribute("aria-disabled", "true");
        return;
      }
      var top = chosen.reduce(function (best, box) { return Math.max(best, tiers.indexOf(box.getAttribute("data-tier"))); }, 0);
      var full = Number(calc.getAttribute("data-" + tiers[top]));
      var custom = Number(calc.getAttribute("data-base")) + Number(calc.getAttribute("data-per")) * chosen.length;
      var labels = chosen.map(function (box) { return box.parentNode.textContent.trim(); });
      order.removeAttribute("aria-disabled");
      if (custom >= full) {
        priceOut.textContent = "$" + full;
        noteOut.textContent = "once. " + names[tiers[top]] + " includes " + (chosen.length === 1 ? "this desk" : "all of these desks") + " for $" + full + ", so we'll order " + names[tiers[top]] + ".";
        plan = names[tiers[top]]; message = "";
      } else {
        priceOut.textContent = "$" + custom;
        noteOut.textContent = "once for " + chosen.length + (chosen.length === 1 ? " desk." : " desks.") + " Upgrade later by paying the difference.";
        plan = "Custom"; message = "Custom licence ($" + custom + " once) with: " + labels.join("; ") + ".";
      }
    };
    Array.prototype.forEach.call(boxes, function (box) { box.addEventListener("change", update); });
    document.querySelectorAll("[data-calc-open]").forEach(function (button) {
      button.addEventListener("click", function () { update(); calc.showModal(); });
    });
    calc.querySelectorAll("[data-calc-close]").forEach(function (button) {
      button.addEventListener("click", function () { calc.close(); });
    });
    calc.addEventListener("click", function (event) { if (event.target === calc) calc.close(); });
    order.addEventListener("click", function (event) {
      if (!chosen.length) { event.preventDefault(); return; }
      var select = document.getElementById("pf-plan");
      var text = document.getElementById("pf-message");
      if (select) select.value = plan;
      if (text && message) text.value = message + (text.value ? "\n\n" + text.value : "");
      calc.close();
    });
  }

  // Copy buttons.

  document.querySelectorAll("[data-copy]").forEach(function (button) {

    button.addEventListener("click", function () { copyText(button.getAttribute("data-copy"), button); });

  });



  // Order buttons on the price cards choose their tier in the order form.

  Array.prototype.forEach.call(document.querySelectorAll("[data-plan]"), function (link) {

    link.addEventListener("click", function () {

      var select = document.getElementById("pf-plan");

      if (select) select.value = link.getAttribute("data-plan");

    });

  });



  // Order: compose an email in the visitor's own mail app. Nothing is stored or sent by this page.

  var form = document.getElementById("pilot-form");

  if (form) {

    var to = form.getAttribute("data-to");

    var result = document.getElementById("pf-result");

    var preview = document.getElementById("pf-preview");

    var errorBox = document.getElementById("pf-error");

    var mailto = "";

    document.getElementById("pf-to").textContent = to;



    form.addEventListener("submit", function (event) {

      event.preventDefault();

      var name = form.elements.name;

      var email = form.elements.email;

      var problems = [];

      [name, email].forEach(function (input) { input.removeAttribute("aria-invalid"); });

      if (!name.value.trim()) { problems.push("Add your name."); name.setAttribute("aria-invalid", "true"); }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { problems.push("Add an email address we can reply to, like you@company.com."); email.setAttribute("aria-invalid", "true"); }

      if (problems.length) {

        errorBox.textContent = problems.join(" ");

        errorBox.hidden = false;

        (name.getAttribute("aria-invalid") ? name : email).focus();

        return;

      }

      errorBox.hidden = true;



      var plan = form.elements.plan.value;

      var company = form.elements.company.value.trim();

      var subject = "ThreadForge order: " + plan + (company ? " for " + company : "");

      var body = [

        "Hello ThreadForge team,",

        "",

        "I'd like to buy ThreadForge " + plan + ". Please send a secure card payment link.",

        "",

        "Name: " + name.value.trim(),

        "Email: " + email.value.trim(),

        "Company: " + (company || "Not given"),

        "Team size: " + form.elements.size.value,

        "Tier: " + plan,

        "",

        "What we want ThreadForge to help with:",

        form.elements.message.value.trim() || "(Not given)",

        ""

      ].join("\n");



      preview.textContent = "To: " + to + "\nSubject: " + subject + "\n\n" + body;

      mailto = "mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);

      result.hidden = false;

      window.location.href = mailto;

    });



    document.getElementById("pf-copy").addEventListener("click", function (event) { copyText(preview.textContent, event.currentTarget); });

    document.getElementById("pf-copy-addr").addEventListener("click", function (event) { copyText(to, event.currentTarget); });

    document.getElementById("pf-mail").addEventListener("click", function () { if (mailto) window.location.href = mailto; });

  }



})();


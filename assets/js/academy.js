/* ThreadForge PWI .NET Practice Lab & Chronological Research Academy
   100% local execution. Zero telemetry, zero external network calls, CSP-compliant. */
(function () {
  "use strict";

  var STORAGE_KEY = "tf-academy-state-v1";

  function loadState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch (e) {}
    return {
      modules: { "m1-1": true, "m1-2": true },
      labsRun: { "lab-1": true },
      pledgeSigned: false,
      updatedAt: new Date().toISOString()
    };
  }

  var state = loadState();

  function saveState() {
    state.updatedAt = new Date().toISOString();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  /* 1. Learner Rank & Progress Engine */
  var checkboxes = Array.prototype.slice.call(document.querySelectorAll(".js-module-check"));
  var rankNameEl = document.getElementById("rank-name");
  var rankSubEl = document.getElementById("rank-sub");
  var rankFillEl = document.getElementById("rank-fill");
  var rankSteps = Array.prototype.slice.call(document.querySelectorAll("[data-rank-step]"));

  function updateRankUI() {
    var totalModules = checkboxes.length || 16;
    var doneModules = 0;
    checkboxes.forEach(function (cb) {
      var id = cb.getAttribute("data-module-id");
      var isChecked = Boolean(state.modules && state.modules[id]);
      cb.checked = isChecked;
      if (isChecked) doneModules += 1;
    });

    var labsCount = Object.keys(state.labsRun || {}).length;
    var totalPoints = totalModules + 5;
    var earnedPoints = doneModules + Math.min(5, labsCount);
    var pct = Math.round((earnedPoints / totalPoints) * 100);

    var rankTitle = "Rank I · Apprentice";
    var activeStep = "apprentice";
    if (pct >= 85) {
      rankTitle = "Rank IV · Titan";
      activeStep = "titan";
    } else if (pct >= 55) {
      rankTitle = "Rank III · Professor";
      activeStep = "professor";
    } else if (pct >= 25) {
      rankTitle = "Rank II · Builder";
      activeStep = "builder";
    }

    if (rankNameEl) rankNameEl.textContent = rankTitle;
    if (rankSubEl) {
      rankSubEl.textContent =
        doneModules + "/" + totalModules + " modules · " +
        Math.min(5, labsCount) + "/5 PWI labs verified (" + pct + "%)";
    }
    if (rankFillEl) rankFillEl.style.width = Math.max(6, pct) + "%";

    rankSteps.forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-rank-step") === activeStep);
    });
  }

  checkboxes.forEach(function (cb) {
    cb.addEventListener("change", function () {
      var id = cb.getAttribute("data-module-id");
      if (!state.modules) state.modules = {};
      if (cb.checked) state.modules[id] = true;
      else delete state.modules[id];
      saveState();
      updateRankUI();
    });
  });

  function markLabRun(labId) {
    if (!state.labsRun) state.labsRun = {};
    state.labsRun[labId] = true;
    saveState();
    updateRankUI();
  }

  var exportBtn = document.getElementById("btn-export-portfolio");
  if (exportBtn) {
    exportBtn.addEventListener("click", function () {
      var payload = {
        schema: "threadforge.pwi.portfolio.v1",
        principle: "Learning, Applying, and Growing — Non-Commercialized Sovereign Education",
        authorCorpus: "Bilal Ahmed Khan (MBA 2021 XUST · Founder, Threadforge Inc.)",
        exportedAt: new Date().toISOString(),
        rank: rankNameEl ? rankNameEl.textContent : "Rank I · Apprentice",
        completedModules: Object.keys(state.modules || {}),
        verifiedLabs: Object.keys(state.labsRun || {}),
        nonAbusivePledgeAccepted: Boolean(state.pledgeSigned)
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "threadforge-pwi-portfolio-record.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  var resetBtn = document.getElementById("btn-reset-progress");
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      state = { modules: {}, labsRun: {}, pledgeSigned: false, updatedAt: new Date().toISOString() };
      saveState();
      updateRankUI();
    });
  }

  /* 2. Chronological Research Library Filter */
  var filterBtns = Array.prototype.slice.call(document.querySelectorAll("[data-paper-filter]"));
  var paperCards = Array.prototype.slice.call(document.querySelectorAll("[data-paper-cat]"));
  var filterCountEl = document.getElementById("paper-filter-count");

  filterBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var cat = btn.getAttribute("data-paper-filter");
      filterBtns.forEach(function (b) { b.classList.toggle("is-active", b === btn); });
      var shown = 0;
      paperCards.forEach(function (card) {
        var cats = (card.getAttribute("data-paper-cat") || "").split(/\s+/);
        var match = cat === "all" || cats.indexOf(cat) !== -1;
        card.hidden = !match;
        if (match) shown += 1;
      });
      if (filterCountEl) {
        filterCountEl.textContent = "Showing " + shown + " of " + paperCards.length + " chronological works";
      }
    });
  });

  /* 3. PWI Workbench Tab Switcher & Deep Links */
  var pwiTabs = Array.prototype.slice.call(document.querySelectorAll("[data-pwi-tab]"));
  var pwiPanels = Array.prototype.slice.call(document.querySelectorAll("[data-pwi-panel]"));

  function activateLabTab(labId, scrollIntoView) {
    pwiTabs.forEach(function (t) {
      var match = t.getAttribute("data-pwi-tab") === labId;
      t.classList.toggle("is-active", match);
      t.setAttribute("aria-selected", String(match));
    });
    pwiPanels.forEach(function (p) {
      p.hidden = p.getAttribute("data-pwi-panel") !== labId;
    });
    markLabRun(labId);
    if (scrollIntoView) {
      var workbench = document.getElementById("pwi-workbench");
      if (workbench && workbench.scrollIntoView) {
        workbench.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  pwiTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      activateLabTab(tab.getAttribute("data-pwi-tab"), false);
    });
  });

  Array.prototype.slice.call(document.querySelectorAll("[data-open-lab]")).forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      activateLabTab(btn.getAttribute("data-open-lab"), true);
    });
  });

  /* 4. LAB 1: Evidence Confidence & Actuarial Accountability Denominator */
  function runLab1() {
    var sampleInput = document.getElementById("lab1-samples");
    var incInput = document.getElementById("lab1-incidents");
    var enfInput = document.getElementById("lab1-enforcements");
    var popInput = document.getElementById("lab1-population");
    if (!sampleInput) return;

    var values = sampleInput.value
      .split(",")
      .map(function (v) { return Number(v.trim()); })
      .filter(function (n) { return Number.isFinite(n); });

    if (values.length < 2) values = [12.4, 14.1, 11.8, 15.2, 13.7, 16.0, 14.9, 13.2];
    var n = values.length;
    var mean = values.reduce(function (a, b) { return a + b; }, 0) / n;
    var variance = values.reduce(function (acc, val) { return acc + Math.pow(val - mean, 2); }, 0) / (n - 1);
    var sd = Math.sqrt(variance);
    var se = sd / Math.sqrt(n);
    var margin = 1.96 * se;

    var incidents = Math.max(1, Number(incInput ? incInput.value : 1200) || 1200);
    var enforcements = Math.max(0, Number(enfInput ? enfInput.value : 36) || 36);
    var population = Math.max(100, Number(popInput ? popInput.value : 50000) || 50000);

    var enforcementRate = (enforcements / incidents) * 100;
    var impunityGap = Math.max(0, 100 - enforcementRate);
    var ratePer1000 = (incidents / population) * 1000;

    var kpiMean = document.getElementById("lab1-kpi-mean");
    var kpiCi = document.getElementById("lab1-kpi-ci");
    var kpiEnf = document.getElementById("lab1-kpi-enf");
    var outPre = document.getElementById("lab1-output");

    if (kpiMean) kpiMean.textContent = mean.toFixed(2) + " (±" + sd.toFixed(2) + " SD)";
    if (kpiCi) kpiCi.textContent = "[" + (mean - margin).toFixed(2) + ", " + (mean + margin).toFixed(2) + "]";
    if (kpiEnf) kpiEnf.textContent = enforcementRate.toFixed(1) + "% (" + impunityGap.toFixed(1) + "% gap)";

    if (outPre) {
      outPre.textContent =
        "EVIDENCE & DENOMINATOR AUDIT [D/I/U PROTOCOL]\n" +
        "------------------------------------------------------------\n" +
        "1. Sample Distribution (n = " + n + "): Mean = " + mean.toFixed(3) + " | SD = " + sd.toFixed(3) + " | SE = " + se.toFixed(3) + "\n" +
        "   95% Confidence Interval: [" + (mean - margin).toFixed(3) + " to " + (mean + margin).toFixed(3) + "]\n\n" +
        "2. Actuarial Accountability Denominator (Ref: 'The Wrong Denominator', Oct 1, 2026):\n" +
        "   - Documented Incidents [D]:        " + incidents + " events (" + ratePer1000.toFixed(2) + " per 1,000 exposed population)\n" +
        "   - Verified Enforcements [D]:       " + enforcements + " convictions/actions\n" +
        "   - True Accountability Rate:        " + enforcementRate.toFixed(2) + "% (Enforcements / Incidents)\n" +
        "   - Structural Impunity Gap [I]:     " + impunityGap.toFixed(2) + "% unaddressed incidents\n" +
        "   - Verdict: " +
        (enforcementRate < 25
          ? "CRITICAL DENOMINATOR ALERT — Citing perpetrator headcount instead of the " + enforcementRate.toFixed(1) + "% enforcement rate conceals a " + impunityGap.toFixed(1) + "% accountability failure."
          : "Accountability denominator within auditable review corridor.");
    }
    markLabRun("lab-1");
  }

  var btnLab1 = document.getElementById("btn-run-lab1");
  if (btnLab1) btnLab1.addEventListener("click", runLab1);

  /* 5. LAB 2: Software Licence Structuring (Puffy Phase 2) & Chokepoint Safety Stock */
  function runLab2() {
    var allDay = Math.max(0, Number((document.getElementById("lab2-allday") || {}).value) || 12);
    var occasional = Math.max(0, Number((document.getElementById("lab2-occasional") || {}).value) || 68);
    var peakOcc = Math.max(0, Number((document.getElementById("lab2-peak") || {}).value) || 8);
    var namedCost = Math.max(1, Number((document.getElementById("lab2-named-cost") || {}).value) || 1000);
    var concCost = Math.max(1, Number((document.getElementById("lab2-conc-cost") || {}).value) || 2400);
    var capeDays = Math.max(0, Number((document.getElementById("lab2-cape-days") || {}).value) || 12);
    var dailyDemandSd = Math.max(1, Number((document.getElementById("lab2-demand-sd") || {}).value) || 45);

    var totalStaff = allDay + occasional;
    var draftWorkspaces = 4;
    var setupFee = 2000;
    var draftTotal = totalStaff * namedCost + draftWorkspaces * setupFee;
    var allConcTotal = (allDay + peakOcc) * concCost + setupFee;
    var hybridNamed = allDay * namedCost;
    var hybridConc = peakOcc * concCost;
    var revisedTotal = hybridNamed + hybridConc + setupFee;
    var savingUsd = draftTotal - revisedTotal;
    var savingPct = draftTotal > 0 ? (savingUsd / draftTotal) * 100 : 0;

    // Safety stock z * sigma * sqrt(LT) with base 28 days + Cape diversion days
    var baseLt = 28;
    var totalLt = baseLt + capeDays;
    var z = 1.65; // 95% service level
    var ssBase = Math.round(z * dailyDemandSd * Math.sqrt(baseLt));
    var ssShock = Math.round(z * dailyDemandSd * Math.sqrt(totalLt));
    var extraBuffer = ssShock - ssBase;

    var kpiRev = document.getElementById("lab2-kpi-revised");
    var kpiSave = document.getElementById("lab2-kpi-saving");
    var kpiBuffer = document.getElementById("lab2-kpi-buffer");
    var outPre = document.getElementById("lab2-output");

    if (kpiRev) kpiRev.textContent = "$" + revisedTotal.toLocaleString();
    if (kpiSave) kpiSave.textContent = "$" + savingUsd.toLocaleString() + " (" + savingPct.toFixed(1) + "%)";
    if (kpiBuffer) kpiBuffer.textContent = ssShock + " units (+" + extraBuffer + ")";

    if (outPre) {
      outPre.textContent =
        "PROCUREMENT STRUCTURING & CHOKEPOINT RESILIENCE BRIEF\n" +
        "------------------------------------------------------------\n" +
        "A. Software Licence Optimization (Ref: Bilal Ahmed Khan, Puffy Phase 2, Oct 2026):\n" +
        "   - Draft Order (" + totalStaff + " Named + 4 Workspaces):  $" + draftTotal.toLocaleString() + " / yr\n" +
        "   - All-Concurrent Alternative (" + (allDay + peakOcc) + " Concurrent): $" + allConcTotal.toLocaleString() + " / yr\n" +
        "   - Optimal Hybrid (" + allDay + " Named + " + peakOcc + " Concurrent + 1 Shared Workspace): $" + revisedTotal.toLocaleString() + " / yr\n" +
        "   - Verified Year-1 Saving: $" + savingUsd.toLocaleString() + " (" + savingPct.toFixed(1) + "% reduction; 12-month fixed term, no auto-renewal)\n\n" +
        "B. Hormuz / Bab el-Mandeb Cape Diversion Safety Stock (Ref: 'The War Is Now a Cost Line'):\n" +
        "   - Base Lead Time: " + baseLt + " days -> Safety Stock (95% SL): " + ssBase + " units\n" +
        "   - Cape of Good Hope Diversion (+" + capeDays + " days, LT = " + totalLt + "d): " + ssShock + " units (+" + extraBuffer + " buffer units)\n" +
        "   - Action Gate: Split critical SKUs 70/30 across qualified dual origins & lock 60-day buffer.";
    }
    markLabRun("lab-2");
  }

  var btnLab2 = document.getElementById("btn-run-lab2");
  if (btnLab2) btnLab2.addEventListener("click", runLab2);

  /* 6. LAB 3: Chamber Resilience 12-Sector Simulator & Chair's Mock Test */
  var CHAMBER_SECTORS = [
    { id: 1, name: "Government Affairs", base: 76.11, kpi: "Institutional contact depth", action: "Name a second senior contact for each regulator; document every channel.", sens: { reg: -18, ctrl: -8, talent: -6 } },
    { id: 2, name: "Policy Making", base: 64.35, kpi: "Exception rate (exceptions / policies)", action: "Frequent exceptions mean the policy is wrong or ignored. Rewrite it or enforce it.", sens: { reg: -24, ctrl: -16, supply: -4 } },
    { id: 3, name: "Public Affairs", base: 80.67, kpi: "Holding-statement coverage", action: "Draft and pre-approve holding statements for every identified crisis scenario.", sens: { reg: -16, ctrl: -22, cash: -8, supply: -6 } },
    { id: 4, name: "Public Interest", base: 70.42, kpi: "Public-interest test coverage", action: "Add a mandatory public-interest box to every board paper.", sens: { reg: -14, ctrl: -18 } },
    { id: 5, name: "Human Resources", base: 83.00, kpi: "Succession coverage", action: "Name a successor and an emergency backup for every critical role; start rotation plans.", sens: { talent: -42, cash: -9, ctrl: -10 } },
    { id: 6, name: "Organizational Interest", base: 72.40, kpi: "Related-party transactions reviewed", action: "Route every related-party transaction through the committee; no retrospective approvals.", sens: { ctrl: -25, reg: -12 } },
    { id: 7, name: "Payroll", base: 77.59, kpi: "Overrides without prior approval", action: "Block post-run approvals: no override without sign-off before the run.", sens: { ctrl: -46, talent: -22, reg: -14 } },
    { id: 8, name: "Finance", base: 93.02, kpi: "Days sales outstanding", action: "Re-cost products, review pricing and tighten credit terms on overdue receivables.", sens: { cash: -44, supply: -26, talent: -8 } },
    { id: 9, name: "Audit", base: 72.86, kpi: "Overdue share of open findings", action: "Escalate every overdue finding to the Audit & Risk committee with the owner present.", sens: { ctrl: -28, reg: -20 } },
    { id: 10, name: "Commercials", base: 82.75, kpi: "Contract renewal rate", action: "Start renewal conversations 120 days out; pause new orders for chronic late payers.", sens: { cash: -35, supply: -18, talent: -10 } },
    { id: 11, name: "Procurement", base: 74.62, kpi: "Plan-B coverage of critical categories", action: "Write and test a plan B for every critical category without one; buffer critical items.", sens: { supply: -38, cash: -16 } },
    { id: 12, name: "Production", base: 82.01, kpi: "Lost-time injuries", action: "Treat every injury as a board-level event; move from reactive to planned maintenance.", sens: { supply: -29, talent: -20, ctrl: -12 } }
  ];

  var SCENARIO_DESC = {
    base: "Base Case: Normal operating conditions using the chamber's baseline values (PKR millions).",
    supply: "Supply Shock: Commodity prices +18%, supplier on-time delivery -18%, downtime +35%, revenue -5%.",
    cash: "Cash Squeeze: Revenue -20%, receivable days +25, input costs +5%, attrition +10%.",
    reg: "Regulatory Shock: Compliance slippage ×3, payroll errors ×1.5, incidents ×2, revenue -3%.",
    talent: "Talent Exodus: Competitors poach staff — attrition ×2.2, payroll errors ×1.8, downtime ×1.25.",
    ctrl: "Control Failure / Fraud: Weak payroll & approval controls exploited — payroll errors ×4, incidents ×3."
  };

  function renderChamberScenario(scenarioKey) {
    var tbody = document.getElementById("chamber-tbody");
    if (!tbody) return;

    var totalScore = 0;
    var greenCount = 0, amberCount = 0, redCount = 0;
    var weakest = null;

    var rowsHtml = CHAMBER_SECTORS.map(function (sec) {
      var delta = (sec.sens && sec.sens[scenarioKey]) || 0;
      var score = Math.max(8, Math.min(100, sec.base + delta));
      totalScore += score;
      var status = score >= 70 ? "GREEN" : score >= 40 ? "AMBER" : "RED";
      var pillClass = score >= 70 ? "rag-green" : score >= 40 ? "rag-amber" : "rag-red";
      if (status === "GREEN") greenCount += 1;
      else if (status === "AMBER") amberCount += 1;
      else redCount += 1;

      if (!weakest || score < weakest.score) {
        weakest = { name: sec.name, score: score, kpi: sec.kpi, action: sec.action };
      }

      return (
        "<tr>" +
        "<td>" + sec.id + ". " + sec.name + "</td>" +
        "<td><strong>" + score.toFixed(1) + "</strong></td>" +
        '<td><span class="rag-pill ' + pillClass + '">' + status + "</span></td>" +
        "<td>" + sec.kpi + "</td>" +
        "<td>" + sec.action + "</td>" +
        "</tr>"
      );
    }).join("");

    tbody.innerHTML = rowsHtml;

    var overall = totalScore / CHAMBER_SECTORS.length;
    var kpiOverall = document.getElementById("chamber-kpi-overall");
    var kpiSplit = document.getElementById("chamber-kpi-split");
    var kpiWeakest = document.getElementById("chamber-kpi-weakest");
    var descEl = document.getElementById("chamber-scenario-desc");

    if (kpiOverall) kpiOverall.textContent = overall.toFixed(2) + " / 100";
    if (kpiSplit) kpiSplit.textContent = greenCount + " G · " + amberCount + " A · " + redCount + " R";
    if (kpiWeakest && weakest) kpiWeakest.textContent = weakest.name + " (" + weakest.score.toFixed(1) + ")";
    if (descEl) descEl.textContent = SCENARIO_DESC[scenarioKey] || SCENARIO_DESC.base;

    markLabRun("lab-3");
  }

  Array.prototype.slice.call(document.querySelectorAll("[data-chamber-scenario]")).forEach(function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.getAttribute("data-chamber-scenario");
      Array.prototype.slice.call(document.querySelectorAll("[data-chamber-scenario]")).forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });
      renderChamberScenario(key);
    });
  });

  // Chair's Mock Test Scorer
  var quizSelects = Array.prototype.slice.call(document.querySelectorAll(".js-chair-quiz"));
  var quizScoreEl = document.getElementById("chair-quiz-score");
  function scoreChairQuiz() {
    var answered = 0, correct = 0;
    quizSelects.forEach(function (sel) {
      var val = sel.value;
      var ans = sel.getAttribute("data-answer");
      var why = sel.getAttribute("data-why");
      var fb = sel.parentNode.querySelector(".quiz-feedback");
      if (!val) {
        if (fb) fb.textContent = "Select an answer to test the Chair's judgement.";
        return;
      }
      answered += 1;
      if (val === ans) {
        correct += 1;
        if (fb) fb.textContent = "✓ CORRECT (" + ans + "): " + why;
      } else {
        if (fb) fb.textContent = "✗ REVIEW (" + ans + " is best): " + why;
      }
    });
    if (quizScoreEl) {
      quizScoreEl.textContent = "Chair's Mock Test Score: " + correct + " / " + quizSelects.length + " correct (" + answered + " answered)";
    }
    if (answered > 0) markLabRun("lab-3");
  }
  quizSelects.forEach(function (sel) {
    sel.addEventListener("change", scoreChairQuiz);
  });

  /* 7. LAB 4: Secure Edge LLM & AI Governance Deterrent Audit */
  function runLab4() {
    var checks = Array.prototype.slice.call(document.querySelectorAll(".js-edge-check"));
    if (!checks.length) return;
    var passed = 0;
    var missing = [];
    checks.forEach(function (c) {
      if (c.checked) passed += 1;
      else missing.push(c.getAttribute("data-control-label"));
    });
    var score = Math.round((passed / checks.length) * 100);
    var arch = "Architecture I · User-Friendly Voluntary Pledge (Fragile)";
    if (score >= 85) arch = "Architecture III · Sovereign Deterrent & Hardened Edge";
    else if (score >= 55) arch = "Architecture II · Partial Compliance Scaffold";

    var kpiScore = document.getElementById("lab4-kpi-score");
    var kpiArch = document.getElementById("lab4-kpi-arch");
    var kpiGates = document.getElementById("lab4-kpi-gates");
    var outPre = document.getElementById("lab4-output");

    if (kpiScore) kpiScore.textContent = score + " / 100";
    if (kpiArch) kpiArch.textContent = score >= 85 ? "Deterrent Grade" : score >= 55 ? "Compliance Grade" : "Voluntary Pledge";
    if (kpiGates) kpiGates.textContent = passed + " / " + checks.length + " Controls";

    if (outPre) {
      outPre.textContent =
        "SECURE EDGE LLM & AI ACCORD DETERRENCE AUDIT\n" +
        "------------------------------------------------------------\n" +
        "Classification: " + arch + "\n" +
        "Verified Controls (" + passed + "/" + checks.length + "):\n" +
        " - Layer 1 (Model): Quantized GGUF via llama.cpp on local/edge hardware\n" +
        " - Layer 2 (Safety): Dual input/output guardrails + per-request audit log (NIST AU)\n" +
        " - Layer 3 (Security): X-API-Key (NIST IA), TLS/mTLS (NIST SC), systemd sandbox (CIS/STIG), IEC 62443 VLAN\n" +
        " - Governance Accord (Ref: 'Defendant, Judge and Jury' & 'AI-Native University'):\n" +
        "   Named independent auditor, statutory/procurement consequence, human approval gate.\n\n" +
        (missing.length === 0
          ? "VERDICT: ALL 10 SOVEREIGN EDGE & GOVERNANCE CONTROLS VERIFIED. Ready for production release gate."
          : "MISSING CONTROLS TO REMEDIATE BEFORE PRODUCTION:\n - " + missing.join("\n - "));
    }
    markLabRun("lab-4");
  }

  var btnLab4 = document.getElementById("btn-run-lab4");
  if (btnLab4) btnLab4.addEventListener("click", runLab4);
  Array.prototype.slice.call(document.querySelectorAll(".js-edge-check")).forEach(function (c) {
    c.addEventListener("change", runLab4);
  });

  /* 8. LAB 5: Biological Sovereignty & Architecture of the Heart (Qalb / Nafs) */
  function runLab5() {
    var bioType = (document.getElementById("lab5-biotype") || {}).value || "iris";
    var luxHours = Math.max(0, Number((document.getElementById("lab5-blue-hours") || {}).value) || 4.5);
    var purposeLim = (document.getElementById("lab5-purpose") || {}).value || "enforced";
    var qalbFocus = Math.max(1, Math.min(10, Number((document.getElementById("lab5-qalb") || {}).value) || 8));

    var permanenceRisk = bioType === "password" ? 15 : bioType === "facial" ? 78 : 95;
    var circadianLoad = Math.min(100, Math.round(luxHours * 14));
    var sovBonus = purposeLim === "enforced" ? 35 : purposeLim === "partial" ? 15 : -20;
    var sovereigntyScore = Math.max(5, Math.min(100, Math.round(100 - permanenceRisk * 0.45 - circadianLoad * 0.25 + sovBonus)));
    var heartCoherence = Math.min(100, Math.round(qalbFocus * 9.5 + (purposeLim === "enforced" ? 5 : 0)));

    var kpiSov = document.getElementById("lab5-kpi-sov");
    var kpiCirc = document.getElementById("lab5-kpi-circ");
    var kpiQalb = document.getElementById("lab5-kpi-qalb");
    var outPre = document.getElementById("lab5-output");

    if (kpiSov) kpiSov.textContent = sovereigntyScore + " / 100";
    if (kpiCirc) kpiCirc.textContent = circadianLoad + "% (480nm ipRGC)";
    if (kpiQalb) kpiQalb.textContent = heartCoherence + "% Coherence";

    if (outPre) {
      outPre.textContent =
        "BIOLOGICAL SOVEREIGNTY & ARCHITECTURE OF THE HEART (قرآن کا تصورِ نفس)\n" +
        "------------------------------------------------------------\n" +
        "1. Biometric Permanence Assessment (Ref: 'When the Human Body Becomes Data', Dawn Prism):\n" +
        "   - Identifier Class: " + bioType.toUpperCase() + " (Irrevocability Index: " + permanenceRisk + "/100)\n" +
        "   - Principle: 'A compromised password can be changed. A face, fingerprint or iris cannot be reissued.'\n" +
        "   - Purpose Limitation & Audit Trail: " + purposeLim.toUpperCase() + "\n\n" +
        "2. Retinal Photoreception & SCN Circadian Entrainment (Ref: melanopsin ~480 nm):\n" +
        "   - Nocturnal Blue-Spectrum Exposure: " + luxHours + " hrs/night -> Circadian Suppression Load: " + circadianLoad + "%\n\n" +
        "3. Quranic Psychology in the Digital Age (Qalb · Aql · Nafs · Ruh):\n" +
        "   - Inward Sanctuary & Intentionality (Qalb / Aql Coherence): " + heartCoherence + "%\n" +
        "   - Synthesis: Protecting biological sovereignty without and spiritual stillness within ensures\n" +
        "     technology serves human dignity rather than turning the human being into raw telemetry.";
    }
    markLabRun("lab-5");
  }

  var btnLab5 = document.getElementById("btn-run-lab5");
  if (btnLab5) btnLab5.addEventListener("click", runLab5);

  /* 9. Non-Abusive Cloud & Local PWI Charter Pledge */
  var pledgeBtn = document.getElementById("btn-sign-charter");
  var pledgeStatus = document.getElementById("charter-pledge-status");
  function updatePledgeUI() {
    if (!pledgeStatus || !pledgeBtn) return;
    if (state.pledgeSigned) {
      pledgeStatus.textContent = "✓ Sovereign Non-Abusive PWI Charter Accepted & Recorded Locally (" + state.updatedAt.slice(0, 10) + ")";
      pledgeBtn.textContent = "Charter Verified ✓";
    }
  }
  if (pledgeBtn) {
    pledgeBtn.addEventListener("click", function () {
      state.pledgeSigned = true;
      saveState();
      updatePledgeUI();
      updateRankUI();
    });
  }

  // Initialize all views on load
  updateRankUI();
  updatePledgeUI();
  runLab1();
  runLab2();
  renderChamberScenario("base");
  runLab4();
  runLab5();
})();

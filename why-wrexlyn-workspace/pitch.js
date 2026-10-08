/* Wrexlyn — Why Wrexlyn · © Nishant Prabhakar · pitch.js
 * Scroll reveals, the self-check demo, the convergence flow, the Bot Wizard team, and the measured
 * results — drawn from results.json, which is generated from the committed A/B report (no hand-entered numbers). */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, reduce ? 0 : ms); }); };

  $$(".cr-yr").forEach(function (e) { e.textContent = new Date().getFullYear(); });

  /* reading progress */
  var prog = $("#prog");
  function onScroll() { var h = document.documentElement.scrollHeight - innerHeight; if (prog) prog.style.width = (h > 0 ? (scrollY / h) * 100 : 0) + "%"; }
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* reveals; sections start their animation the first time they come into view */
  var starters = {};
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      var go = starters[e.target.id]; if (go) { delete starters[e.target.id]; go(); }
      io.unobserve(e.target);
    });
  }, { threshold: 0.2 });
  function watch(el) { if (el) io.observe(el); }
  $$(".rv").forEach(watch);

  /* card glow follows the pointer */
  document.addEventListener("pointermove", function (e) { var c = e.target.closest && e.target.closest(".card"); if (!c) return; var r = c.getBoundingClientRect(); c.style.setProperty("--mx", (e.clientX - r.left) + "px"); c.style.setProperty("--my", (e.clientY - r.top) + "px"); });

  /* ---------------- hero: a wrong figure is caught, repaired and verified ---------------- */
  var demo = $(".demo"), num = $("#dNum"), chip = $("#dChip"), txt = $("#dTxt");
  function setChip(cls, t) { chip.className = "chip" + (cls ? " " + cls : ""); txt.textContent = t; }
  async function heroLoop() {
    if (!demo) return;
    for (;;) {
      demo.classList.remove("done"); num.className = "num"; num.textContent = "₹4.2 cr";
      setChip("", "Second engine reviewing…");
      await wait(2600);
      num.className = "num bad"; setChip("bad", "Error: 50 customers × ₹7.6 lakh is ₹3.8 cr, not ₹4.2 cr");
      await wait(2600);
      num.className = "num good"; num.textContent = "₹3.8 cr"; demo.classList.add("done");
      setChip("good", "✓ Repaired and verified");
      await wait(reduce ? 1e9 : 4200);
    }
  }
  heroLoop();

  /* ---------------- how: the convergence flow ---------------- */
  var flow = $("#flow");
  if (flow) {
    var nodes = $$(".node", flow), items = $$(".steps li", flow), pulses = $$(".p", flow);
    var paths = ["w1", "w2", "w3", "w4", "w5"].map(function (id) { return document.getElementById(id); });
    var route = { 0: [0, 1, 2], 1: [3], 2: [4], 3: [] }; // which wires carry work out of each stage
    var step = 0, t0 = performance.now();
    function light() {
      nodes.forEach(function (n) { n.classList.toggle("on", +n.dataset.step === step); });
      items.forEach(function (li) { li.classList.toggle("on", +li.dataset.step === step); });
    }
    function frame(now) {
      var p = Math.min(1, (now - t0) / 1500), live = route[step] || [];
      pulses.forEach(function (c, i) {
        var w = paths[live[i]];
        if (!w || i >= live.length) { c.style.opacity = 0; return; }
        var pt = w.getPointAtLength(p * w.getTotalLength());
        c.setAttribute("cx", pt.x); c.setAttribute("cy", pt.y); c.style.opacity = p < 0.95 ? 1 : 0;
      });
      if (now - t0 > 1900) { step = (step + 1) % 4; t0 = now; light(); }
      requestAnimationFrame(frame);
    }
    starters.flow = function () { light(); if (!reduce) requestAnimationFrame(frame); else nodes.forEach(function (n) { n.classList.add("on"); }); };
  }

  /* ---------------- Bot Wizard: a team forms, works in stages, and is verified ---------------- */
  var wiz = $("#wiz");
  if (wiz) {
    var bots = $$(".bot", wiz), typed = $("#wizType"), bar = $("#wizBar"), verdict = $("#wizV");
    var GOAL = "A pricing decision brief for a 50-customer software startup";
    function st(i, cls, label) { bots[i].className = "bot show" + (cls ? " " + cls : ""); $("em", bots[i]).textContent = label; }
    function crit(n, extra) { bar.style.width = (n / 8) * 100 + "%"; verdict.textContent = "Criteria checked: " + n + " of 8" + (extra || ""); }
    async function wizLoop() {
      for (;;) {
        typed.textContent = ""; bots.forEach(function (b) { b.className = "bot"; $("em", b).textContent = "waiting"; }); crit(0);
        for (var c = 1; c <= GOAL.length; c++) { typed.textContent = GOAL.slice(0, c); await wait(32); }
        await wait(500);
        for (var i = 0; i < bots.length; i++) { bots[i].classList.add("show"); await wait(160); }
        await wait(600);
        st(0, "work", "drafting"); st(1, "work", "drafting"); st(2, "work", "drafting"); await wait(1500);
        st(0, "work", "reviewing"); st(1, "fix", "error found"); st(2, "work", "reviewing"); await wait(1500);
        st(0, "pass", "passed"); st(1, "fix", "repairing"); st(2, "pass", "passed"); await wait(1300);
        st(1, "pass", "passed"); st(3, "work", "writing"); await wait(1500);
        st(3, "pass", "passed"); st(4, "work", "checking");
        for (var k = 1; k <= 8; k++) { crit(Math.min(k, 7)); await wait(260); }
        st(4, "pass", "done"); crit(7, " · verified with one exception, reported");
        await wait(reduce ? 1e9 : 5200);
      }
    }
    starters.wiz = wizLoop;
  }

  /* ---------------- algorithms: each lights up in turn; tap one to read it ---------------- */
  var algo = $("#algo");
  if (algo) {
    var algs = $$(".alg", algo), algD = $("#algoD"), ai = 0, aTimer = null, paused = false;
    function showAlg(i) {
      algs.forEach(function (a, j) { a.classList.toggle("on", j === i); a.classList.toggle("done", j < i); });
      algD.textContent = algs[i].querySelector("i").textContent + " · " + algs[i].textContent.replace(/^\d+/, "").trim() + ": " + algs[i].dataset.d;
    }
    function stepAlg() { if (paused) return; showAlg(ai); ai = (ai + 1) % algs.length; }
    algs.forEach(function (a, i) { a.addEventListener("click", function () { paused = true; ai = i; showAlg(i); clearTimeout(a._t); a._t = setTimeout(function () { paused = false; ai = (i + 1) % algs.length; }, 8000); }); });
    starters.algo = function () { stepAlg(); if (!reduce) aTimer = setInterval(stepAlg, 1900); };
  }

  /* ---------------- the Proprietary Convergence Protocol: four mechanisms in order ---------------- */
  var pcp = $("#pcp");
  if (pcp) {
    var ps = $$(".pcp-steps li", pcp), pbar = $("#pcpBar"), pk = 0;
    function stepPcp() {
      ps.forEach(function (li, j) { li.classList.toggle("on", j === pk); li.classList.toggle("done", j < pk); });
      pbar.style.width = ((pk + 1) / ps.length) * 100 + "%";
      pk = (pk + 1) % ps.length;
    }
    starters.pcp = function () { if (reduce) { ps.forEach(function (li) { li.classList.add("done"); }); pbar.style.width = "100%"; return; } stepPcp(); setInterval(stepPcp, 2200); };
  }

  /* ---------------- bots: a day of activity ---------------- */
  var feedList = $("#feedList");
  if (feedList) {
    var DAY = [
      ["08:30", "", "<b>Research Bot</b> sent your morning brief<small>Routine · weekdays 08:30 · 6 developments, with sources</small>"],
      ["09:00", "", "<b>Inbox Triage</b> flagged 4 emails that need you<small>Routine · drafted 3 replies</small>"],
      ["09:01", "ask", "<b>Inbox Triage</b> wants to send 3 replies<small>Approval needed before anything is sent</small><span class=\"ok\">Approve</span>"],
      ["11:15", "", "<b>Folder Watcher</b> filed a new invoice<small>Trigger · a file landed in /Invoices</small>"],
      ["14:00", "", "<b>Chief of Staff</b> handed the Q3 numbers to <b>Report Writer</b><small>Delegation · report back when done</small>"],
      ["14:06", "okd", "<b>Report Writer</b> delivered Q3-review.pptx<small>After another bot finished · document checks passed</small>"]
    ];
    async function feedLoop() {
      for (;;) {
        feedList.innerHTML = "";
        for (var i = 0; i < DAY.length; i++) {
          var d = DAY[i], li = document.createElement("li");
          if (d[1]) li.className = d[1];
          li.innerHTML = "<time>" + d[0] + "</time><div>" + d[2] + "</div>";
          feedList.appendChild(li);
          await wait(1500);
          if (d[1] === "ask") { await wait(900); li.className = "okd"; li.querySelector(".ok").textContent = "Approved ✓"; await wait(700); }
        }
        await wait(reduce ? 1e9 : 4500);
      }
    }
    starters.feed = feedLoop;
  }

  /* ---------------- files: Excel cells fill in sequence ---------------- */
  $$(".cells i").forEach(function (c, i) { c.style.setProperty("--k", i * 45); });

  /* ---------------- measured results ---------------- */
  var stats = $("#stats");
  function countTo(el, to, fmt) {
    if (reduce) { el.textContent = fmt(to); return; }
    var t0 = null; function s(t) { t0 = t0 || t; var p = Math.min(1, (t - t0) / 1300), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(to * e); if (p < 1) requestAnimationFrame(s); }
    requestAnimationFrame(s);
  }
  // next to this script (the page can also be shown inside the desktop app, where the document has another address)
  var HERE = (document.currentScript && document.currentScript.src) || location.href;
  fetch(new URL("results.json", HERE).href).then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(function (R) {
    var B = R.arms[1], sc = R.selfCheck || {};
    var said = sc.saidVerified || 0, right = sc.saidVerifiedAndPassed || 0, wrong = said - right;
    var put = function (k, v) { $$('[data-k="' + k + '"]').forEach(function (e) { e.textContent = v; }); };
    put("tasks", R.taskCount); put("repeats", R.repeats);
    starters.stats = function () {
      countTo($('[data-k="verified"]'), right, function (x) { return Math.round(x) + "/" + said; });
      countTo($('[data-k="false"]'), wrong, function (x) { return String(Math.round(x)); });
      countTo($('[data-k="runs"]'), B.runs, function (x) { return String(Math.round(x)); });
    };
    // Wrexlyn's verdict on each run against the independent grader
    var row = function (lab, cls, w, val) { return '<div class="crow"><span class="lab">' + lab + '</span><span class="track"><i class="fill ' + cls + '" data-w="' + w + '"></i></span><span class="val">' + val + "</span></div>"; };
    var chart = $("#chart"), tot = B.runs || 1;
    chart.innerHTML = "<h4>Wrexlyn's verdict vs. the independent grader</h4>" +
      row("Verified · passed", "b", (right / tot) * 100, String(right)) +
      row("Verified · failed", "a", (wrong / tot) * 100, String(wrong)) +
      row("Flagged · not verified", "a", ((sc.flaggedNotVerified || 0) / tot) * 100, String(sc.flaggedNotVerified || 0));
    starters.chart = function () { $$(".fill", chart).forEach(function (f) { f.style.width = f.dataset.w + "%"; }); };
    var d = new Date(R.generatedAt);
    $("#proofNote").textContent = "Run on " + d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) + " with " + R.model + ": " + R.taskCount + " coding tasks × " + R.repeats + " repeats, each graded by the task's own tests, which Wrexlyn never saw. Checking takes extra time; the Bot Wizard result comes from a separate live run.";
    if (stats.classList.contains("in")) starters.stats(); if (chart.classList.contains("in")) starters.chart();
  }).catch(function () { $("#proofNote").textContent = "The measured report couldn't be loaded. Refresh to try again."; });

  // ids for the sections whose animation starts on first view
  if (stats) { stats.id = "stats"; watch(stats); }
  var ch = $("#chart"); if (ch) watch(ch);
  watch(flow); watch(wiz); watch(algo); watch(pcp); watch($("#feed"));

  /* shown inside the desktop app: its buttons talk to the app instead of navigating away */
  var embedded = window.parent !== window;
  if (embedded) {
    document.documentElement.classList.add("embedded");
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a"); if (!a) return;
      var href = a.getAttribute("href") || "";
      if (a.hasAttribute("data-open-app")) { e.preventDefault(); parent.postMessage("wx:open-app", "*"); }
      else if (href.indexOf("?ledger") >= 0) { e.preventDefault(); parent.postMessage("wx:ledger", "*"); }
      else if (href.charAt(0) === "#") { e.preventDefault(); var t = document.querySelector(href); if (t) t.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); }
      else { a.target = "_blank"; a.rel = "noopener"; } // other pages open beside the app
    });
  }

  /* open the app that fits this device */
  var big = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches && Math.max(screen.width, screen.height) >= 1024;
  var local = location.pathname.indexOf("/mobile/") === 0; // opened from the installed app: desktop at /, phone at /mobile/
  var APP = document.documentElement.getAttribute("data-app") || ""; // published on another site: the app's own address
  $$("[data-open-app]").forEach(function (a) { a.href = APP + (big ? (local ? "/" : "/desktop/") : (local ? "/mobile/" : "/?phone")); });
  if (local) { $$('a[href="/desktop/"]').forEach(function (a) { a.href = "/"; }); $$('a[href="/?phone"]').forEach(function (a) { a.href = "/mobile/"; }); $$('a[href="/?ledger"]').forEach(function (a) { a.href = "/mobile/?ledger"; }); }
})();

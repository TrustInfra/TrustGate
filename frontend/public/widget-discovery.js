/* ============================================================================
 * TrustGate Discovery Widget (batch) - widget-discovery.js
 *
 * Additive script-tag path for Phase 2b. Does NOT replace or touch widget.js.
 * A partner includes this file, marks each badge slot with
 *   <span data-trustgate-badge="0xTOKENADDRESS"></span>
 * and the script batches every slot and fills it with a COMPACT trust mark,
 * a tiny tier-colored "{score} {SHORT}" (for example a small yellow "58 MID"),
 * sized to tuck into a dense list without disturbing it.
 *
 * Keep the TIER / FLAG tables in sync with src/lib/discovery/display.ts.
 * ========================================================================== */
(function () {
  "use strict";

  // Live batch by default (Phase 2b). Set data-trustgate-mock="1" on the script tag for fixtures.
  var USE_MOCK = (function () {
    var tag = document.currentScript;
    if (!tag) return false;
    return (tag.getAttribute("data-trustgate-mock") || "") === "1";
  })();
  var BATCH_ENDPOINT = (function () {
    var tag = document.currentScript;
    var custom = tag && tag.getAttribute("data-trustgate-batch-url");
    if (custom) return custom;
    // Same-origin when hosted on trustgated.xyz; absolute fallback otherwise
    try {
      if (typeof location !== "undefined" && location.origin) {
        return location.origin + "/api/batch";
      }
    } catch (e) {}
    return "https://www.trustgated.xyz/api/batch";
  })();

  var SLOT_ATTR = "data-trustgate-badge";

  // Flags are off by default. A partner turns them on globally by adding
  // data-trustgate-flags="on" to the <script> tag, or per slot on the element.
  var GLOBAL_FLAGS_ON = (function () {
    var tag = document.currentScript;
    if (!tag) return false;
    return (tag.getAttribute("data-trustgate-flags") || "").toLowerCase() === "on";
  })();

  // --- display config, KEEP IN SYNC with src/lib/discovery/display.ts --------
  var TIER = {
    VERIFIED: { short: "VERIFIED", color: "#2563EB", bg: "#2563EB1A", showScore: false, deprioritized: false },
    ELITE: { short: "ELITE", color: "#059669", bg: "#0596691A", showScore: false, deprioritized: false },
    HIGH: { short: "HIGH", color: "#22C55E", bg: "#22C55E1A", showScore: true, deprioritized: false },
    MEDIUM: { short: "MID", color: "#F59E0B", bg: "#F59E0B1A", showScore: true, deprioritized: false },
    LOW: { short: "LOW", color: "#F97316", bg: "#F973161A", showScore: true, deprioritized: true },
    BLOCKED: { short: "BLOCKED", color: "#EF4444", bg: "#EF44441A", showScore: true, deprioritized: true }
  };
  var FLAG = {
    HONEYPOT_PATTERN: { label: "Honeypot", sev: "high" },
    COORDINATED_BUY: { label: "Coordinated buy", sev: "medium" },
    EXIT_SYNC: { label: "Exit sync", sev: "high" },
    LOW_HOLDER_QUALITY: { label: "Low holders", sev: "medium" }
  };
  var SEV = {
    high: { color: "#EF4444", bg: "#EF44441A" },
    medium: { color: "#F59E0B", bg: "#F59E0B1A" },
    info: { color: "#64748B", bg: "#64748B1A" }
  };
  var MINING_COLOR = "#64748B";

  // --- mock, mirrors src/lib/discovery/mock.ts -------------------------------
  var PROFILES = [
    { score: 88, tier: "ELITE", confidence: "high", flags: [], state: "graduated" },
    { score: 71, tier: "HIGH", confidence: 82, flags: [], state: "graduated" },
    { score: 54, tier: "MEDIUM", confidence: "low", flags: ["LOW_HOLDER_QUALITY"], state: "graduated" },
    { score: 33, tier: "LOW", confidence: "low", flags: ["COORDINATED_BUY"], state: "graduated" },
    { score: 9, tier: "BLOCKED", confidence: "low", flags: ["HONEYPOT_PATTERN", "EXIT_SYNC"], state: "graduated" },
    { score: 64, tier: "HIGH", confidence: "medium", flags: [], state: "mining" },
    { score: 28, tier: "LOW", confidence: "low", flags: ["LOW_HOLDER_QUALITY"], state: "mining" }
  ];

  function hashAddress(address) {
    var h = 0, a = String(address).toLowerCase();
    for (var i = 0; i < a.length; i++) h = (h * 31 + a.charCodeAt(i)) >>> 0;
    return h;
  }
  function mockScoreBatch(addresses) {
    return addresses.map(function (address) {
      var p = PROFILES[hashAddress(address) % PROFILES.length];
      return { address: address, score: p.score, tier: p.tier, confidence: p.confidence, flags: p.flags.slice(), state: p.state };
    });
  }
  function scoreBatch(addresses) {
    if (!addresses.length) return Promise.resolve([]);
    if (USE_MOCK) return Promise.resolve(mockScoreBatch(addresses));
    return fetch(BATCH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses: addresses })
    }).then(function (res) {
      if (!res.ok) throw new Error("Batch scoring failed: " + res.status);
      return res.json();
    }).then(function (data) {
      return Array.isArray(data) ? data : data.results;
    });
  }

  function el(tag, styles, text) {
    var node = document.createElement(tag);
    if (styles) for (var k in styles) node.style[k] = styles[k];
    if (text != null) node.textContent = text;
    return node;
  }
  function humanize(code) {
    return String(code).toLowerCase().split("_").map(function (w) { return w ? w[0].toUpperCase() + w.slice(1) : w; }).join(" ");
  }
  function flagDisplay(code) { return FLAG[code] || { label: humanize(code), sev: "info" }; }

  // --- compact builders ------------------------------------------------------
  function buildGraduated(score) {
    var t = TIER[score.tier];
    if (!t) return el("span", {}, score.tier);
    var pill = el("span", {
      display: "inline-flex", alignItems: "center", gap: "4px",
      padding: "1px 5px", borderRadius: "4px",
      fontSize: "10px", fontWeight: "700", lineHeight: "1.4",
      color: t.color, backgroundColor: t.bg, whiteSpace: "nowrap",
      opacity: t.deprioritized ? "0.92" : "1"
    });
    pill.setAttribute("data-trustgate-tier", score.tier);
    pill.title = "TrustGate: " + score.tier;
    if (t.showScore) pill.appendChild(el("span", null, String(score.score)));
    pill.appendChild(el("span", { opacity: "0.85", letterSpacing: "0.2px" }, t.short));
    return pill;
  }
  function buildMining(score) {
    var t = TIER[score.tier] || TIER.LOW;
    var pill = el("span", {
      display: "inline-flex", alignItems: "center", gap: "4px",
      padding: "1px 5px", borderRadius: "4px",
      fontSize: "10px", fontWeight: "700", lineHeight: "1.4",
      backgroundColor: MINING_COLOR + "1A", whiteSpace: "nowrap"
    });
    pill.setAttribute("data-trustgate-state", "mining");
    pill.title = "Mining: no pool yet, showing deployer wallet trust";
    pill.appendChild(el("span", { color: MINING_COLOR, letterSpacing: "0.2px" }, "MINING"));
    pill.appendChild(el("span", { color: t.color }, t.short + (t.showScore ? " " + score.score : "")));
    return pill;
  }
  function buildFlags(flags) {
    if (!flags || !flags.length) return null;
    var wrap = el("span", { display: "inline-flex", flexWrap: "wrap", gap: "3px" });
    flags.forEach(function (code) {
      var f = flagDisplay(code), c = SEV[f.sev] || SEV.info;
      var chip = el("span", {
        display: "inline-flex", alignItems: "center", padding: "1px 4px",
        borderRadius: "4px", fontSize: "9px", fontWeight: "600", lineHeight: "1.3",
        color: c.color, backgroundColor: c.bg, whiteSpace: "nowrap"
      }, f.label);
      chip.setAttribute("data-trustgate-flag", code);
      wrap.appendChild(chip);
    });
    return wrap;
  }
  function flagsEnabled(slot) {
    var perSlot = (slot.getAttribute("data-trustgate-flags") || "").toLowerCase();
    if (perSlot === "on") return true;
    if (perSlot === "off") return false;
    return GLOBAL_FLAGS_ON; // script-tag default
  }

  function renderSlot(slot, score) {
    var wrap = el("span", { display: "inline-flex", alignItems: "center", gap: "5px", flexWrap: "wrap", fontFamily: "inherit" });
    wrap.appendChild(score.state === "mining" ? buildMining(score) : buildGraduated(score));
    // Flags are OFF by default to stay minimal in a partner's UI. They opt in
    // per slot with data-trustgate-flags="on", or globally by putting the same
    // attribute on the <script> tag. Badge alone otherwise.
    if (flagsEnabled(slot)) {
      var flags = buildFlags(score.flags);
      if (flags) wrap.appendChild(flags);
    }
    slot.textContent = "";
    slot.appendChild(wrap);
  }

  // --- Phase 2b search intercept ---------------------------------------------
  // Opt-in: <script data-trustgate-search="#results" data-trustgate-reorder="on">
  // Rows: [data-trustgate-row] or children of the search root containing an
  // address in [data-address] / [data-token] / data-trustgate-badge.
  var TIER_RANK = { VERIFIED: 6, ELITE: 5, HIGH: 4, MEDIUM: 3, LOW: 2, BLOCKED: 1 };

  function scriptAttr(name) {
    var tag = document.currentScript;
    return tag ? (tag.getAttribute(name) || "") : "";
  }

  function extractAddress(node) {
    if (!node || !node.getAttribute) return "";
    var a =
      node.getAttribute(SLOT_ATTR) ||
      node.getAttribute("data-address") ||
      node.getAttribute("data-token") ||
      node.getAttribute("data-token-address") ||
      "";
    if (a && /^0x[0-9a-fA-F]{40}$/.test(a)) return a;
    var child = node.querySelector(
      "[" + SLOT_ATTR + "], [data-address], [data-token], [data-token-address]"
    );
    if (child) return extractAddress(child);
    return "";
  }

  function reorderRows(parent, rows, scoreMap) {
    var decorated = rows.map(function (row, index) {
      var addr = extractAddress(row).toLowerCase();
      var s = scoreMap[addr];
      return { row: row, index: index, score: s };
    });
    decorated.sort(function (a, b) {
      var sa = a.score, sb = b.score;
      if (!sa && !sb) return a.index - b.index;
      if (!sa) return 1;
      if (!sb) return -1;
      var ta = TIER_RANK[sa.tier] || 0, tb = TIER_RANK[sb.tier] || 0;
      if (tb !== ta) return tb - ta;
      if ((sb.score || 0) !== (sa.score || 0)) return (sb.score || 0) - (sa.score || 0);
      return a.index - b.index;
    });
    decorated.forEach(function (d) {
      parent.appendChild(d.row);
      if (d.score && (d.score.tier === "LOW" || d.score.tier === "BLOCKED")) {
        d.row.style.opacity = d.row.style.opacity || "0.72";
        d.row.setAttribute("data-trustgate-deprioritized", "1");
      }
    });
  }

  function fillBadges(scoreMap) {
    var slots = document.querySelectorAll("[" + SLOT_ATTR + "]");
    for (var j = 0; j < slots.length; j++) {
      var addr = (slots[j].getAttribute(SLOT_ATTR) || "").toLowerCase();
      if (scoreMap[addr]) renderSlot(slots[j], scoreMap[addr]);
    }
  }

  function runBatch(addresses, thenFn) {
    scoreBatch(addresses).then(function (results) {
      var map = {};
      results.forEach(function (r) { map[String(r.address).toLowerCase()] = r; });
      thenFn(map);
    }).catch(function (err) {
      if (window && window.console) console.error("[trustgate] batch widget:", err);
    });
  }

  function initSlots() {
    var slots = document.querySelectorAll("[" + SLOT_ATTR + "]");
    if (!slots.length) return;
    var addresses = [], seen = {};
    for (var i = 0; i < slots.length; i++) {
      var a = slots[i].getAttribute(SLOT_ATTR);
      if (a && !seen[a.toLowerCase()]) { seen[a.toLowerCase()] = true; addresses.push(a); }
    }
    runBatch(addresses, fillBadges);
  }

  function initSearch() {
    var sel = scriptAttr("data-trustgate-search");
    if (!sel) return;
    var root = document.querySelector(sel);
    if (!root) return;
    var reorderOn = scriptAttr("data-trustgate-reorder").toLowerCase() === "on";
    var rows = root.querySelectorAll("[data-trustgate-row]");
    if (!rows.length) {
      // Fallback: direct children that carry an address
      rows = [];
      for (var c = 0; c < root.children.length; c++) {
        if (extractAddress(root.children[c])) rows.push(root.children[c]);
      }
    } else {
      rows = Array.prototype.slice.call(rows);
    }
    if (!rows.length) return;

    var addresses = [], seen = {};
    for (var i = 0; i < rows.length; i++) {
      var a = extractAddress(rows[i]);
      if (a && !seen[a.toLowerCase()]) {
        seen[a.toLowerCase()] = true;
        addresses.push(a);
      }
      // Auto-inject badge slot if missing
      if (a && !rows[i].querySelector("[" + SLOT_ATTR + "]")) {
        var span = document.createElement("span");
        span.setAttribute(SLOT_ATTR, a);
        span.setAttribute("data-trustgate-flags", GLOBAL_FLAGS_ON ? "on" : "off");
        rows[i].appendChild(span);
      }
    }
    runBatch(addresses, function (map) {
      fillBadges(map);
      if (reorderOn) reorderRows(root, rows, map);
    });
  }

  function init() {
    initSlots();
    initSearch();
  }

  // Public API for DEX partners who render search results dynamically
  window.TrustGateDiscovery = {
    scoreAndRender: function (addresses) {
      return scoreBatch(addresses || []).then(function (results) {
        var map = {};
        results.forEach(function (r) { map[String(r.address).toLowerCase()] = r; });
        fillBadges(map);
        return results;
      });
    },
    reorderContainer: function (selector) {
      var root = document.querySelector(selector);
      if (!root) return Promise.resolve([]);
      var rows = root.querySelectorAll("[data-trustgate-row]");
      rows = rows.length ? Array.prototype.slice.call(rows) : Array.prototype.slice.call(root.children);
      var addresses = [];
      rows.forEach(function (row) {
        var a = extractAddress(row);
        if (a) addresses.push(a);
      });
      return scoreBatch(addresses).then(function (results) {
        var map = {};
        results.forEach(function (r) { map[String(r.address).toLowerCase()] = r; });
        fillBadges(map);
        reorderRows(root, rows, map);
        return results;
      });
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

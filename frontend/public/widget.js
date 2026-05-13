/*
 * TrustGate widget — drop-in trust score badge for token input fields.
 *
 *   <script src="https://trustgated.xyz/widget.js"></script>
 *   <input type="text" data-trustgate="token-shield" />
 *
 * The widget watches inputs with the data-trustgate attribute, debounces
 * 800ms after typing stops, fetches /api/widget/score/{address} from the
 * origin that served this script, and renders a small badge below the
 * input. Badge is removed automatically when the address becomes invalid.
 *
 * Self-contained: no dependencies, no globals beyond a single namespace
 * marker, no side effects on the host page beyond the badge element.
 */
(function () {
  "use strict";

  if (typeof window === "undefined" || window.__trustgateWidgetLoaded) return;
  window.__trustgateWidgetLoaded = true;

  var SELECTOR = '[data-trustgate="token-shield"]';
  var DEBOUNCE_MS = 800;
  var ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
  var BADGE_ATTR = "data-trustgate-badge";
  var ATTACHED_FLAG = "__trustgateAttached";

  // Resolve the API origin from the script tag that loaded this file. Falls
  // back to the host page origin so the demo on trustgated.xyz works the
  // same as third-party DEX embeds.
  var scriptEl =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      for (var i = scripts.length - 1; i >= 0; i--) {
        var src = scripts[i].getAttribute("src") || "";
        if (src.indexOf("widget.js") !== -1) return scripts[i];
      }
      return null;
    })();
  var API_BASE;
  try {
    API_BASE = scriptEl
      ? new URL(scriptEl.getAttribute("src") || "", window.location.href).origin
      : window.location.origin;
  } catch (e) {
    API_BASE = window.location.origin;
  }

  var TIER_STYLE = {
    HIGH_ELITE: {
      color: "#34d399",
      bg: "rgba(16,185,129,0.12)",
      border: "rgba(16,185,129,0.35)",
      text: "HIGH ELITE",
    },
    HIGH: {
      color: "#34d399",
      bg: "rgba(16,185,129,0.12)",
      border: "rgba(16,185,129,0.35)",
      text: "HIGH",
    },
    MEDIUM: {
      color: "#fbbf24",
      bg: "rgba(245,158,11,0.12)",
      border: "rgba(245,158,11,0.35)",
      text: "MEDIUM",
    },
    LOW: {
      color: "#f87171",
      bg: "rgba(239,68,68,0.12)",
      border: "rgba(239,68,68,0.35)",
      text: "LOW",
    },
    BLOCKED: {
      color: "#fca5a5",
      bg: "rgba(220,38,38,0.16)",
      border: "rgba(220,38,38,0.45)",
      text: "BLOCKED",
    },
  };

  var LOADING_STYLE = {
    color: "#a1a1aa",
    bg: "rgba(161,161,170,0.08)",
    border: "rgba(161,161,170,0.25)",
    text: "Checking trust score…",
  };

  var BADGE_CSS = [
    "font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "font-size: 12px",
    "font-weight: 500",
    "letter-spacing: 0.01em",
    "line-height: 1.2",
    "padding: 6px 10px",
    "margin: 6px 0 0 0",
    "border-radius: 6px",
    "border: 1px solid transparent",
    "display: block",
    "width: fit-content",
    "max-width: 100%",
    "box-sizing: border-box",
    "pointer-events: none",
    "user-select: none",
    "z-index: 1",
  ].join("; ");

  // Per-input state stored on the element itself (avoids a Map keyed by node
  // that could leak when the host removes inputs).
  function getState(input) {
    if (!input.__trustgateState) {
      input.__trustgateState = {
        debounceId: 0,
        abort: null,
        lastQuery: "",
      };
    }
    return input.__trustgateState;
  }

  function ensureBadge(input) {
    var existing = input.nextElementSibling;
    if (
      existing &&
      existing.nodeType === 1 &&
      existing.getAttribute &&
      existing.getAttribute(BADGE_ATTR) === "true"
    ) {
      return existing;
    }
    var badge = document.createElement("div");
    badge.setAttribute(BADGE_ATTR, "true");
    badge.style.cssText = BADGE_CSS;
    badge.style.display = "none";
    if (input.parentNode) {
      input.parentNode.insertBefore(badge, input.nextSibling);
    }
    return badge;
  }

  function applyStyle(badge, style, textOverride) {
    badge.style.color = style.color;
    badge.style.background = style.bg;
    badge.style.borderColor = style.border;
    badge.style.display = "block";
    badge.textContent =
      typeof textOverride === "string" ? textOverride : style.text;
  }

  function tierLabel(tier, score) {
    var style = TIER_STYLE[tier];
    if (tier === "HIGH_ELITE" || tier === "BLOCKED") return style.text;
    if (typeof score === "number" && isFinite(score)) {
      return score + " · " + style.text;
    }
    return style.text;
  }

  function hideBadge(badge) {
    badge.style.display = "none";
    badge.textContent = "";
  }

  function fetchScore(address, signal) {
    var url = API_BASE + "/api/widget/score/" + encodeURIComponent(address);
    return fetch(url, { signal: signal, cache: "no-store" }).then(function (
      res
    ) {
      if (!res.ok) return null;
      return res.json().catch(function () {
        return null;
      });
    });
  }

  function handleInput(input) {
    var state = getState(input);
    var raw = (input.value || "").trim();
    var badge = ensureBadge(input);

    if (state.debounceId) {
      clearTimeout(state.debounceId);
      state.debounceId = 0;
    }
    if (state.abort) {
      try {
        state.abort.abort();
      } catch (e) {
        /* noop */
      }
      state.abort = null;
    }

    if (!ADDRESS_RE.test(raw)) {
      state.lastQuery = "";
      hideBadge(badge);
      return;
    }

    var lower = raw.toLowerCase();
    state.lastQuery = lower;
    applyStyle(badge, LOADING_STYLE);

    state.debounceId = setTimeout(function () {
      state.debounceId = 0;
      var ac =
        typeof AbortController !== "undefined" ? new AbortController() : null;
      state.abort = ac;
      fetchScore(raw, ac ? ac.signal : undefined)
        .then(function (data) {
          // Bail if the user kept typing or supplied a different address.
          if (state.lastQuery !== lower) return;
          if (state.abort !== ac) return;
          state.abort = null;
          if (
            !data ||
            typeof data.tier !== "string" ||
            !TIER_STYLE.hasOwnProperty(data.tier)
          ) {
            hideBadge(badge);
            return;
          }
          applyStyle(badge, TIER_STYLE[data.tier], tierLabel(data.tier, data.score));
        })
        .catch(function () {
          if (state.abort !== ac) return;
          state.abort = null;
          hideBadge(badge);
        });
    }, DEBOUNCE_MS);
  }

  function attach(input) {
    if (input[ATTACHED_FLAG]) return;
    input[ATTACHED_FLAG] = true;
    var listener = function () {
      handleInput(input);
    };
    input.addEventListener("input", listener);
    input.addEventListener("change", listener);
    if (input.value) handleInput(input);
  }

  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    var nodes = root.querySelectorAll(SELECTOR);
    for (var i = 0; i < nodes.length; i++) attach(nodes[i]);
  }

  function init() {
    scan(document);
    if (typeof MutationObserver === "undefined") return;
    var obs = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (!node || node.nodeType !== 1) continue;
          if (node.matches && node.matches(SELECTOR)) attach(node);
          scan(node);
        }
      }
    });
    obs.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

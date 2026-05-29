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
 *
 * Inline badge mode (second mode): any element — not just inputs — carrying
 * both data-trustgate="token-shield" and data-trustgate-address="0x…" is
 * scored silently in the background and gets a compact badge rendered
 * immediately after it, sized to sit inline beside a token name:
 *
 *   <span data-trustgate="token-shield" data-trustgate-address="0x…">USDC</span>
 *
 * The optional data-trustgate-style attribute picks the badge text: "full"
 * shows score + tier ("87 · HIGH_ELITE"), "minimal" shows the tier only
 * ("HIGH_ELITE"). When absent, it defaults to "minimal".
 *
 * NTT (non-tradeable) results, scoring failures, and timeouts render nothing.
 * Elements are picked up on load and via MutationObserver so dynamically
 * rendered token lists are covered.
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

  // Normalize the apex origin to www. The apex (trustgated.xyz) 307-redirects
  // to www, and browsers drop Access-Control-Allow-Origin on the redirect hop,
  // so cross-origin badge fetches from a DEX fail CORS. Forcing www lets either
  // the apex or www snippet work. Applied once to the final value regardless of
  // whether it came from the script src or the location.origin fallback. The
  // "://" anchor keeps "www.trustgated.xyz" untouched (it has no "://trustgated").
  if (API_BASE.indexOf("://trustgated.xyz") !== -1) {
    API_BASE = API_BASE.replace("://trustgated.xyz", "://www.trustgated.xyz");
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

  var BADGE_CSS_FONT =
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  var BADGE_CSS = [
    "font-family: " + BADGE_CSS_FONT,
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

  // ---- Inline badge mode -------------------------------------------------
  // A second, opt-in mode for non-input elements (span, td, li, …) that carry
  // both data-trustgate="token-shield" and data-trustgate-address="0x…". Each
  // matching element is scored silently and gets a compact badge rendered
  // immediately after it, sized to sit inline next to a token name. NTT
  // results, failures, and timeouts render nothing.
  //
  // The optional data-trustgate-style attribute controls the badge text:
  //   "full"    → score + tier, e.g. "87 · HIGH_ELITE"
  //   "minimal" → tier only,     e.g. "HIGH_ELITE"
  // When the attribute is absent or unrecognized, "minimal" is used.
  var ADDRESS_ATTR = "data-trustgate-address";
  var STYLE_ATTR = "data-trustgate-style";
  var INLINE_BADGE_ATTR = "data-trustgate-inline-badge";
  var INLINE_ADDR_PROP = "__trustgateInlineAddr";
  var INLINE_TIMEOUT_MS = 8000;

  var INLINE_BADGE_CSS = [
    "font-family: " + BADGE_CSS_FONT,
    "font-size: 10px",
    "font-weight: 600",
    "letter-spacing: 0.02em",
    "line-height: 1.2",
    "padding: 1px 5px",
    "margin: 0 0 0 6px",
    "border-radius: 4px",
    "border: 1px solid transparent",
    "display: inline-block",
    "vertical-align: middle",
    "white-space: nowrap",
    "box-sizing: border-box",
    "pointer-events: none",
    "user-select: none",
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
    badge.style.fontFamily = BADGE_CSS_FONT;
    badge.style.color = style.color;
    badge.style.background = style.bg;
    badge.style.borderColor = style.border;
    badge.style.display = "block";
    badge.textContent =
      typeof textOverride === "string" ? textOverride : style.text;
  }

  // NTT (Not a Tradeable Token) is rendered as plain text in the badge's own
  // font: no tier color, no background, no border. Returned for NFT contracts,
  // non-token contracts, and wallet addresses.
  function applyNttStyle(badge) {
    badge.style.fontFamily = BADGE_CSS_FONT;
    badge.style.color = "inherit";
    badge.style.background = "transparent";
    badge.style.borderColor = "transparent";
    badge.style.display = "block";
    badge.textContent = "NTT";
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
          if (data && data.tier === "NTT") {
            applyNttStyle(badge);
            return;
          }
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

  function removeInlineBadge(el) {
    var existing = el.nextElementSibling;
    if (
      existing &&
      existing.nodeType === 1 &&
      existing.getAttribute &&
      existing.getAttribute(INLINE_BADGE_ATTR) === "true"
    ) {
      if (existing.parentNode) existing.parentNode.removeChild(existing);
    }
  }

  function ensureInlineBadge(el) {
    var existing = el.nextElementSibling;
    if (
      existing &&
      existing.nodeType === 1 &&
      existing.getAttribute &&
      existing.getAttribute(INLINE_BADGE_ATTR) === "true"
    ) {
      return existing;
    }
    var badge = document.createElement("span");
    badge.setAttribute(INLINE_BADGE_ATTR, "true");
    badge.style.cssText = INLINE_BADGE_CSS;
    if (el.parentNode) el.parentNode.insertBefore(badge, el.nextSibling);
    return badge;
  }

  // Resolve the requested display style. Defaults to "minimal" when the
  // attribute is absent or holds an unrecognized value.
  function resolveInlineStyle(el) {
    var v = (el.getAttribute(STYLE_ATTR) || "").trim().toLowerCase();
    return v === "full" ? "full" : "minimal";
  }

  // Inline badge text. "full" prepends the numeric score ("87 · HIGH_ELITE")
  // for every tier when a finite score is available; "minimal" is tier only
  // ("HIGH_ELITE").
  function inlineLabel(tier, score, displayStyle) {
    var text = TIER_STYLE[tier].text;
    if (
      displayStyle === "full" &&
      typeof score === "number" &&
      isFinite(score)
    ) {
      return score + " · " + text;
    }
    return text;
  }

  function renderInlineBadge(el, tier, score) {
    var style = TIER_STYLE[tier];
    var badge = ensureInlineBadge(el);
    badge.style.fontFamily = BADGE_CSS_FONT;
    badge.style.color = style.color;
    badge.style.background = style.bg;
    badge.style.borderColor = style.border;
    badge.textContent = inlineLabel(tier, score, resolveInlineStyle(el));
  }

  function scoreInline(el, address) {
    var ac =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ac
      ? setTimeout(function () {
          try {
            ac.abort();
          } catch (e) {
            /* noop */
          }
        }, INLINE_TIMEOUT_MS)
      : 0;
    fetchScore(address, ac ? ac.signal : undefined)
      .then(function (data) {
        if (timer) clearTimeout(timer);
        // Bail if the element's address changed while in flight (covers
        // virtualized lists that recycle DOM nodes).
        if (el[INLINE_ADDR_PROP] !== address) return;
        if (
          !data ||
          typeof data.tier !== "string" ||
          data.tier === "NTT" ||
          !TIER_STYLE.hasOwnProperty(data.tier)
        ) {
          // NTT / unknown / failure: render nothing in inline mode.
          return;
        }
        renderInlineBadge(el, data.tier, data.score);
      })
      .catch(function () {
        if (timer) clearTimeout(timer);
        // Failures and timeouts are silent in inline mode.
      });
  }

  function attachInline(el) {
    var addr = (el.getAttribute(ADDRESS_ATTR) || "").trim().toLowerCase();
    // Idempotent per address: skip if we already handled this exact value, so
    // repeated scans and unrelated mutations don't re-score needlessly.
    if (el[INLINE_ADDR_PROP] === addr) return;
    el[INLINE_ADDR_PROP] = addr;
    removeInlineBadge(el);
    if (!ADDRESS_RE.test(addr)) return;
    scoreInline(el, addr);
  }

  // Route a matched element to the correct mode. Presence of a
  // data-trustgate-address attribute opts the element into inline badge mode;
  // everything else keeps the original input behavior untouched.
  function route(el) {
    if (el.hasAttribute && el.hasAttribute(ADDRESS_ATTR)) {
      attachInline(el);
    } else {
      attach(el);
    }
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
    for (var i = 0; i < nodes.length; i++) route(nodes[i]);
  }

  function init() {
    scan(document);
    if (typeof MutationObserver === "undefined") return;
    var obs = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === "attributes") {
          var target = m.target;
          if (
            target &&
            target.nodeType === 1 &&
            target.matches &&
            target.matches(SELECTOR)
          ) {
            route(target);
          }
          continue;
        }
        var added = m.addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (!node || node.nodeType !== 1) continue;
          if (node.matches && node.matches(SELECTOR)) route(node);
          scan(node);
        }
      }
    });
    obs.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [ADDRESS_ATTR],
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

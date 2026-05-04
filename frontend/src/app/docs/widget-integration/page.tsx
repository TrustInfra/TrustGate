"use client";

import { useEffect } from "react";
import DocShell from "@/components/docs/DocShell";

const SCRIPT_URL = "/widget.js";

const HTML_SNIPPET = `<!-- 1. Load the widget once, anywhere on the page -->
<script src="https://trustgated.xyz/widget.js"></script>

<!-- 2. Tag any token-address input with data-trustgate -->
<label>
  Token address
  <input type="text" data-trustgate="token-shield" placeholder="0x..." />
</label>`;

const REACT_SNIPPET = `// app/_document.tsx (or anywhere in <head>)
import Script from "next/script";

export default function Document() {
  return (
    <>
      <Script
        src="https://trustgated.xyz/widget.js"
        strategy="afterInteractive"
      />
      {/* ...rest of the app */}
    </>
  );
}

// In any component:
export function TokenAddressField() {
  return (
    <input
      type="text"
      data-trustgate="token-shield"
      placeholder="0x..."
    />
  );
}`;

const JS_SNIPPET = `// Load the widget at runtime if you can't add a <script> tag manually.
const s = document.createElement("script");
s.src = "https://trustgated.xyz/widget.js";
s.async = true;
document.head.appendChild(s);

// Mark any input you want scored — works for inputs added later too,
// the widget watches the DOM for new tagged fields.
const input = document.querySelector("#token-address");
input.setAttribute("data-trustgate", "token-shield");`;

export default function WidgetIntegrationPage() {
  useEffect(() => {
    if (document.querySelector('script[data-trustgate-loader="1"]')) return;
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    s.setAttribute("data-trustgate-loader", "1");
    document.head.appendChild(s);
  }, []);

  return (
    <DocShell
      eyebrow="Widget"
      title="Embed TrustGate in your DEX"
      lede="One script tag, one data attribute. Any token-address input field becomes a live trust signal — no API key, no SDK, no React adapter required."
    >
      <h2>One-line install</h2>
      <p>
        Drop this once at the bottom of your <code>&lt;body&gt;</code> or in
        the <code>&lt;head&gt;</code>. The widget auto-detects token-address
        inputs anywhere on the page, including ones added later.
      </p>
      <pre>
        <code>{`<script src="https://trustgated.xyz/widget.js"></script>`}</code>
      </pre>

      <h2>Live demo</h2>
      <p>
        The input below is a plain <code>&lt;input&gt;</code> with{" "}
        <code>data-trustgate=&quot;token-shield&quot;</code>. Paste any Arc
        testnet contract address and the badge updates 800ms after you stop
        typing. Try a verified ERC-20 or any deployed contract address.
      </p>

      <div
        style={{
          padding: "1.25rem",
          background: "#0d0d0d",
          border: "1px solid #262626",
          borderRadius: "10px",
          margin: "1rem 0 1.5rem",
        }}
      >
        <label
          htmlFor="trustgate-demo-input"
          style={{
            display: "block",
            fontSize: "11px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#71717a",
            marginBottom: "8px",
          }}
        >
          Token contract address
        </label>
        <input
          id="trustgate-demo-input"
          type="text"
          data-trustgate="token-shield"
          placeholder="0x..."
          spellCheck={false}
          autoComplete="off"
          style={{
            width: "100%",
            background: "#0a0a0a",
            border: "1px solid #262626",
            borderRadius: "8px",
            color: "#f5f5f5",
            padding: "10px 12px",
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: "13px",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      <h2>Integration examples</h2>

      <h3>HTML</h3>
      <pre>
        <code>{HTML_SNIPPET}</code>
      </pre>

      <h3>React / Next.js</h3>
      <pre>
        <code>{REACT_SNIPPET}</code>
      </pre>

      <h3>Plain JS (runtime injection)</h3>
      <pre>
        <code>{JS_SNIPPET}</code>
      </pre>

      <h2>What renders</h2>
      <ul>
        <li>
          <strong>HIGH_ELITE / HIGH</strong> — green badge, signals the
          contract has strong on-chain behaviour and a trusted deployer.
        </li>
        <li>
          <strong>MEDIUM</strong> — yellow caution badge.
        </li>
        <li>
          <strong>LOW</strong> — red low-trust badge.
        </li>
        <li>
          <strong>Invalid or unknown address</strong> — no badge is rendered.
          The widget never replaces or styles the host input itself, so your
          DEX layout is untouched.
        </li>
      </ul>

      <h2>Free during Arc testnet</h2>
      <p>
        The widget endpoint at <code>/api/widget/score/&#123;address&#125;</code>{" "}
        is rate-limited to 60 requests per minute per IP and requires no API
        key. Pricing for mainnet integrations will be announced ahead of the
        Arc mainnet launch — testnet usage stays free.
      </p>
    </DocShell>
  );
}
